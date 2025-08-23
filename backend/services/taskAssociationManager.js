/**
 * Task Association Manager - Priority and Conflict Management System
 * Handles task relationships, priority resolution, and execution conflicts
 * Supports priority_based, mutual_exclusive, and dependency associations
 */

const logger = require('../utils/logger');
const { enhancedCache } = require('../utils/enhancedCache');

class TaskAssociationManager {
    constructor() {
        // Conflict resolution strategies
        this.RESOLUTION_STRATEGIES = {
            SKIP_LOWER: 'skip_lower_priority',
            SKIP_HIGHER: 'skip_higher_priority', 
            SUSPEND_LOWER: 'suspend_lower_priority',
            DELAY_EXECUTION: 'delay_execution',
            MERGE_EXECUTION: 'merge_execution'
        };
        
        // Performance tracking
        this.stats = {
            conflictsDetected: 0,
            conflictsResolved: 0,
            tasksSkipped: 0,
            tasksSuspended: 0,
            executionsDelayed: 0,
            cacheHits: 0,
            errors: 0
        };
    }

    /**
     * Check for priority conflicts between tasks scheduled at the same time
     * @param {Array} executionPlans - Array of execution plans to check
     * @returns {Object} Conflict analysis and resolution recommendations
     */
    async checkPriorityConflicts(executionPlans) {
        logger.debug('Checking priority conflicts', { plansCount: executionPlans.length });
        
        try {
            const conflicts = [];
            const timeGroups = this.groupExecutionsByTime(executionPlans);
            
            for (const [timeSlot, plans] of timeGroups.entries()) {
                if (plans.length > 1) {
                    const timeConflicts = await this.analyzeTimeSlotConflicts(timeSlot, plans);
                    conflicts.push(...timeConflicts);
                }
            }
            
            this.stats.conflictsDetected += conflicts.length;
            
            logger.debug('Priority conflicts analysis completed', {
                totalConflicts: conflicts.length,
                timeSlots: timeGroups.size
            });
            
            return {
                hasConflicts: conflicts.length > 0,
                conflicts,
                summary: this.generateConflictSummary(conflicts)
            };
            
        } catch (error) {
            this.stats.errors++;
            logger.error('Failed to check priority conflicts', { error: error.message });
            throw error;
        }
    }

    /**
     * Group execution plans by time slot for conflict analysis
     */
    groupExecutionsByTime(executionPlans) {
        const timeGroups = new Map();
        
        executionPlans.forEach(plan => {
            const timeKey = `${plan.scheduled_date}_${plan.scheduled_time}`;
            
            if (!timeGroups.has(timeKey)) {
                timeGroups.set(timeKey, []);
            }
            
            timeGroups.get(timeKey).push(plan);
        });
        
        return timeGroups;
    }

    /**
     * Analyze conflicts within a specific time slot
     */
    async analyzeTimeSlotConflicts(timeSlot, plans) {
        const conflicts = [];
        
        // Get task associations for all tasks in this time slot
        const taskIds = plans.map(plan => plan.task_id);
        const associations = await this.getTaskAssociations(taskIds);
        
        // Check each pair of tasks for conflicts
        for (let i = 0; i < plans.length; i++) {
            for (let j = i + 1; j < plans.length; j++) {
                const plan1 = plans[i];
                const plan2 = plans[j];
                
                const conflict = await this.checkTaskPairConflict(plan1, plan2, associations);
                if (conflict) {
                    conflicts.push({
                        ...conflict,
                        timeSlot,
                        plans: [plan1, plan2]
                    });
                }
            }
        }
        
        return conflicts;
    }

    /**
     * Check conflict between a pair of tasks
     */
    async checkTaskPairConflict(plan1, plan2, associations) {
        // Find associations between these tasks
        const relevantAssocs = associations.filter(assoc => 
            (assoc.primary_task_id === plan1.task_id && assoc.associated_task_id === plan2.task_id) ||
            (assoc.primary_task_id === plan2.task_id && assoc.associated_task_id === plan1.task_id)
        );
        
        if (relevantAssocs.length === 0) {
            // Check for implicit priority conflicts (same time, different priorities)
            if (plan1.priority !== plan2.priority) {
                return this.createImplicitPriorityConflict(plan1, plan2);
            }
            return null;
        }
        
        // Analyze explicit associations
        for (const assoc of relevantAssocs) {
            const conflict = this.analyzeAssociationConflict(plan1, plan2, assoc);
            if (conflict) {
                return conflict;
            }
        }
        
        return null;
    }

    /**
     * Create implicit priority conflict for tasks without explicit associations
     */
    createImplicitPriorityConflict(plan1, plan2) {
        const priority1 = this.getPriorityScore(plan1.priority);
        const priority2 = this.getPriorityScore(plan2.priority);
        
        if (priority1 === priority2) {
            return null; // Same priority, no conflict
        }
        
        return {
            type: 'implicit_priority',
            severity: 'medium',
            description: 'Tasks with different priorities scheduled at the same time',
            resolution: {
                strategy: this.RESOLUTION_STRATEGIES.SKIP_LOWER,
                affectedTask: priority1 > priority2 ? plan2.task_id : plan1.task_id,
                reason: 'Lower priority task skipped due to timing conflict'
            }
        };
    }

    /**
     * Analyze conflict based on task association
     */
    analyzeAssociationConflict(plan1, plan2, association) {
        switch (association.relationship_type) {
            case 'priority_based':
                return this.analyzePriorityBasedConflict(plan1, plan2, association);
            case 'mutual_exclusive':
                return this.analyzeMutualExclusiveConflict(plan1, plan2, association);
            case 'dependency':
                return this.analyzeDependencyConflict(plan1, plan2, association);
            default:
                return null;
        }
    }

    /**
     * Analyze priority-based association conflict
     */
    analyzePriorityBasedConflict(plan1, plan2, association) {
        const { priority_rule } = association;
        const strategy = priority_rule.strategy || 'higher_wins';
        
        const primary = association.primary_task_id === plan1.task_id ? plan1 : plan2;
        const associated = association.primary_task_id === plan1.task_id ? plan2 : plan1;
        
        switch (strategy) {
            case 'higher_wins':
                const primaryScore = this.getPriorityScore(primary.priority);
                const associatedScore = this.getPriorityScore(associated.priority);
                
                return {
                    type: 'priority_based',
                    severity: 'high',
                    description: `Priority-based conflict: ${strategy}`,
                    resolution: {
                        strategy: this.RESOLUTION_STRATEGIES.SKIP_LOWER,
                        affectedTask: primaryScore > associatedScore ? associated.task_id : primary.task_id,
                        reason: `Task with lower priority skipped (${strategy} strategy)`
                    }
                };
                
            case 'suspend_lower':
                return {
                    type: 'priority_based',
                    severity: 'high',
                    description: `Priority-based conflict with suspension: ${strategy}`,
                    resolution: {
                        strategy: this.RESOLUTION_STRATEGIES.SUSPEND_LOWER,
                        affectedTask: this.getLowerPriorityTask(primary, associated).task_id,
                        suspendDays: association.suspend_duration || 1,
                        reason: `Lower priority task suspended for ${association.suspend_duration || 1} days`
                    }
                };
                
            case 'first_scheduled':
                return {
                    type: 'priority_based',
                    severity: 'medium',
                    description: `Priority-based conflict: ${strategy}`,
                    resolution: {
                        strategy: this.RESOLUTION_STRATEGIES.SKIP_LOWER,
                        requiresTimeComparison: true,
                        reason: 'Later scheduled task will be skipped'
                    }
                };
                
            default:
                return null;
        }
    }

    /**
     * Analyze mutual exclusive conflict
     */
    analyzeMutualExclusiveConflict(plan1, plan2, association) {
        return {
            type: 'mutual_exclusive',
            severity: 'high',
            description: 'Tasks are mutually exclusive and cannot run simultaneously',
            resolution: {
                strategy: this.RESOLUTION_STRATEGIES.SKIP_LOWER,
                affectedTask: this.getLowerPriorityTask(plan1, plan2).task_id,
                reason: 'Lower priority task skipped due to mutual exclusion'
            }
        };
    }

    /**
     * Analyze dependency conflict
     */
    analyzeDependencyConflict(plan1, plan2, association) {
        const { priority_rule } = association;
        const dependencyType = priority_rule.dependency_type || 'before';
        const delayMinutes = priority_rule.delay_minutes || 0;
        
        return {
            type: 'dependency',
            severity: 'medium',
            description: `Dependency conflict: tasks must execute in order (${dependencyType})`,
            resolution: {
                strategy: this.RESOLUTION_STRATEGIES.DELAY_EXECUTION,
                dependencyType,
                delayMinutes,
                reason: `Task execution order enforced with ${delayMinutes}min delay`
            }
        };
    }

    /**
     * Resolve conflicts by applying resolution strategies
     * @param {Array} conflicts - Array of conflicts to resolve
     * @param {Array} executionPlans - Original execution plans
     * @returns {Object} Resolution results with modified plans
     */
    async resolveConflicts(conflicts, executionPlans) {
        logger.info('Resolving task conflicts', { conflictsCount: conflicts.length });
        
        const resolutionActions = [];
        const modifiedPlans = [...executionPlans];
        const suspendedTasks = new Set();
        const delayedExecutions = [];
        
        for (const conflict of conflicts) {
            const action = await this.applyResolution(conflict, modifiedPlans);
            resolutionActions.push(action);
            
            // Track resolution statistics
            switch (action.strategy) {
                case this.RESOLUTION_STRATEGIES.SKIP_LOWER:
                    this.stats.tasksSkipped++;
                    break;
                case this.RESOLUTION_STRATEGIES.SUSPEND_LOWER:
                    this.stats.tasksSuspended++;
                    suspendedTasks.add(action.affectedTask);
                    break;
                case this.RESOLUTION_STRATEGIES.DELAY_EXECUTION:
                    this.stats.executionsDelayed++;
                    delayedExecutions.push(action);
                    break;
            }
        }
        
        this.stats.conflictsResolved += conflicts.length;
        
        const result = {
            resolvedConflicts: conflicts.length,
            resolutionActions,
            modifiedPlans: modifiedPlans.filter(plan => !this.isPlanSkipped(plan, resolutionActions)),
            suspendedTasks: Array.from(suspendedTasks),
            delayedExecutions,
            summary: this.generateResolutionSummary(resolutionActions)
        };
        
        logger.info('Conflict resolution completed', {
            resolved: result.resolvedConflicts,
            skipped: this.stats.tasksSkipped,
            suspended: this.stats.tasksSuspended,
            delayed: this.stats.executionsDelayed
        });
        
        return result;
    }

    /**
     * Apply specific resolution strategy
     */
    async applyResolution(conflict, executionPlans) {
        const { resolution } = conflict;
        
        switch (resolution.strategy) {
            case this.RESOLUTION_STRATEGIES.SKIP_LOWER:
                return this.applySkipResolution(conflict, executionPlans);
                
            case this.RESOLUTION_STRATEGIES.SUSPEND_LOWER:
                return this.applySuspendResolution(conflict, executionPlans);
                
            case this.RESOLUTION_STRATEGIES.DELAY_EXECUTION:
                return this.applyDelayResolution(conflict, executionPlans);
                
            default:
                return {
                    strategy: 'no_action',
                    reason: 'Unknown resolution strategy'
                };
        }
    }

    /**
     * Apply skip resolution
     */
    applySkipResolution(conflict, executionPlans) {
        const affectedTask = conflict.resolution.affectedTask;
        
        // Mark plans for removal
        const skippedPlans = executionPlans.filter(plan => plan.task_id === affectedTask);
        skippedPlans.forEach(plan => {
            plan._skipReason = conflict.resolution.reason;
            plan._conflictId = conflict.id;
        });
        
        return {
            strategy: this.RESOLUTION_STRATEGIES.SKIP_LOWER,
            affectedTask,
            affectedPlans: skippedPlans.length,
            reason: conflict.resolution.reason
        };
    }

    /**
     * Apply suspend resolution
     */
    applySuspendResolution(conflict, executionPlans) {
        const affectedTask = conflict.resolution.affectedTask;
        const suspendDays = conflict.resolution.suspendDays;
        
        return {
            strategy: this.RESOLUTION_STRATEGIES.SUSPEND_LOWER,
            affectedTask,
            suspendDays,
            reason: conflict.resolution.reason,
            // Note: Actual task suspension would be handled by task management system
            requiresTaskUpdate: true
        };
    }

    /**
     * Apply delay resolution
     */
    applyDelayResolution(conflict, executionPlans) {
        const { dependencyType, delayMinutes } = conflict.resolution;
        const [plan1, plan2] = conflict.plans;
        
        // Determine which task should be delayed
        let delayedPlan, referencePlan;
        
        if (dependencyType === 'after') {
            delayedPlan = plan1;
            referencePlan = plan2;
        } else {
            delayedPlan = plan2;
            referencePlan = plan1;
        }
        
        // Calculate new execution time
        const originalTime = new Date(`${delayedPlan.scheduled_date} ${delayedPlan.scheduled_time}`);
        const newTime = new Date(originalTime.getTime() + (delayMinutes * 60000));
        
        // Update the execution plan
        delayedPlan.scheduled_time = newTime.toTimeString().split(' ')[0];
        delayedPlan._originalTime = originalTime;
        delayedPlan._delayReason = conflict.resolution.reason;
        
        return {
            strategy: this.RESOLUTION_STRATEGIES.DELAY_EXECUTION,
            delayedTask: delayedPlan.task_id,
            referenceTask: referencePlan.task_id,
            delayMinutes,
            newExecutionTime: delayedPlan.scheduled_time,
            reason: conflict.resolution.reason
        };
    }

    /**
     * Suspend associated tasks for a given primary task
     * @param {number} primaryTaskId - ID of the primary task
     * @param {number} duration - Suspension duration in days
     * @returns {Array} List of suspended task IDs
     */
    async suspendAssociatedTasks(primaryTaskId, duration) {
        logger.info('Suspending associated tasks', { primaryTaskId, duration });
        
        try {
            const associations = await this.getTaskAssociations([primaryTaskId]);
            const suspendedTasks = [];
            
            for (const assoc of associations) {
                if (assoc.relationship_type === 'priority_based' && 
                    assoc.priority_rule?.strategy === 'suspend_lower') {
                    
                    const associatedTaskId = assoc.associated_task_id;
                    
                    // This would typically update the database to suspend the task
                    // For now, we'll track it for return
                    suspendedTasks.push({
                        taskId: associatedTaskId,
                        suspendedUntil: this.calculateSuspensionEndDate(duration),
                        reason: 'Suspended due to higher priority task execution'
                    });
                    
                    logger.debug('Task suspended', { 
                        taskId: associatedTaskId, 
                        duration,
                        primaryTask: primaryTaskId 
                    });
                }
            }
            
            return suspendedTasks;
            
        } catch (error) {
            logger.error('Failed to suspend associated tasks', { 
                primaryTaskId, 
                error: error.message 
            });
            throw error;
        }
    }

    /**
     * Get task associations from cache or database
     */
    async getTaskAssociations(taskIds) {
        try {
            // Try cache first
            const cacheKey = `associations:${taskIds.sort().join(',')}`;
            let associations = await enhancedCache.cache.get(cacheKey);
            
            if (associations) {
                this.stats.cacheHits++;
                return associations;
            }
            
            // Load from database (placeholder - would be implemented with actual DB calls)
            associations = await this.loadAssociationsFromDB(taskIds);
            
            // Cache the results
            await enhancedCache.cache.set(cacheKey, associations, 3600); // 1 hour TTL
            
            return associations;
            
        } catch (error) {
            logger.error('Failed to get task associations', { taskIds, error: error.message });
            return [];
        }
    }

    /**
     * Utility methods
     */
    getPriorityScore(priority) {
        const scores = { 'high': 100, 'normal': 50, 'low': 25 };
        return scores[priority] || 50;
    }

    getLowerPriorityTask(plan1, plan2) {
        const score1 = this.getPriorityScore(plan1.priority);
        const score2 = this.getPriorityScore(plan2.priority);
        return score1 < score2 ? plan1 : plan2;
    }

    calculateSuspensionEndDate(durationDays) {
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + durationDays);
        return endDate;
    }

    isPlanSkipped(plan, resolutionActions) {
        return resolutionActions.some(action => 
            action.strategy === this.RESOLUTION_STRATEGIES.SKIP_LOWER &&
            action.affectedTask === plan.task_id
        );
    }

    generateConflictSummary(conflicts) {
        const summary = {
            total: conflicts.length,
            byType: {},
            bySeverity: {}
        };
        
        conflicts.forEach(conflict => {
            summary.byType[conflict.type] = (summary.byType[conflict.type] || 0) + 1;
            summary.bySeverity[conflict.severity] = (summary.bySeverity[conflict.severity] || 0) + 1;
        });
        
        return summary;
    }

    generateResolutionSummary(resolutionActions) {
        const summary = {
            total: resolutionActions.length,
            byStrategy: {}
        };
        
        resolutionActions.forEach(action => {
            summary.byStrategy[action.strategy] = (summary.byStrategy[action.strategy] || 0) + 1;
        });
        
        return summary;
    }

    /**
     * Get manager statistics
     */
    getStats() {
        return {
            ...this.stats,
            successRate: this.stats.conflictsDetected > 0 ? 
                ((this.stats.conflictsResolved / this.stats.conflictsDetected) * 100).toFixed(2) + '%' : '0%'
        };
    }

    /**
     * Reset statistics
     */
    resetStats() {
        this.stats = {
            conflictsDetected: 0,
            conflictsResolved: 0,
            tasksSkipped: 0,
            tasksSuspended: 0,
            executionsDelayed: 0,
            cacheHits: 0,
            errors: 0
        };
        
        logger.info('Task association manager statistics reset');
    }

    // Placeholder methods (to be implemented with actual database integration)
    async loadAssociationsFromDB(taskIds) {
        // This would load task associations from the database
        // Implementation will be added when database repositories are ready
        return [];
    }
}

// Create singleton instance
const taskAssociationManager = new TaskAssociationManager();

module.exports = {
    TaskAssociationManager,
    taskAssociationManager
};