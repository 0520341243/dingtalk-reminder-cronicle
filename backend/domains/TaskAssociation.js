/**
 * TaskAssociation Domain Model - DDD Value Object
 * Represents relationships between tasks for priority and conflict management
 * Supports priority_based, mutual_exclusive, and dependency relationships
 */

const logger = require('../utils/logger');

class TaskAssociation {
    constructor(data = {}) {
        this.id = data.id || null;
        this.primaryTaskId = data.primary_task_id || null;
        this.associatedTaskId = data.associated_task_id || null;
        this.relationshipType = data.relationship_type || 'priority_based';
        
        // Priority and suspension configuration
        this.priorityRule = data.priority_rule || {};
        this.suspendDuration = data.suspend_duration || null; // in days
        
        // Metadata
        this.createdAt = data.created_at ? new Date(data.created_at) : new Date();
    }

    /**
     * Validation methods
     */
    validate() {
        const errors = [];
        
        // Task IDs validation
        if (!this.primaryTaskId) {
            errors.push('Primary task ID is required');
        }
        
        if (!this.associatedTaskId) {
            errors.push('Associated task ID is required');
        }
        
        if (this.primaryTaskId === this.associatedTaskId) {
            errors.push('Task cannot be associated with itself');
        }
        
        // Relationship type validation
        const validTypes = ['priority_based', 'mutual_exclusive', 'dependency'];
        if (!validTypes.includes(this.relationshipType)) {
            errors.push(`Relationship type must be one of: ${validTypes.join(', ')}`);
        }
        
        // Suspend duration validation
        if (this.suspendDuration !== null) {
            if (!Number.isInteger(this.suspendDuration) || this.suspendDuration <= 0) {
                errors.push('Suspend duration must be a positive integer');
            }
        }
        
        // Priority rule validation
        if (this.relationshipType === 'priority_based') {
            errors.push(...this.validatePriorityRule());
        } else if (this.relationshipType === 'dependency') {
            errors.push(...this.validateDependencyRule());
        }
        
        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * Validate priority-based relationship rules
     */
    validatePriorityRule() {
        const errors = [];
        
        if (!this.priorityRule || typeof this.priorityRule !== 'object') {
            errors.push('Priority rule configuration is required for priority-based relationships');
            return errors;
        }
        
        const { strategy, parameters } = this.priorityRule;
        const validStrategies = ['higher_wins', 'first_scheduled', 'suspend_lower'];
        
        if (!strategy || !validStrategies.includes(strategy)) {
            errors.push(`Priority strategy must be one of: ${validStrategies.join(', ')}`);
        }
        
        if (strategy === 'suspend_lower' && !this.suspendDuration) {
            errors.push('Suspend duration is required for suspend_lower strategy');
        }
        
        return errors;
    }

    /**
     * Validate dependency relationship rules
     */
    validateDependencyRule() {
        const errors = [];
        
        if (!this.priorityRule || typeof this.priorityRule !== 'object') {
            errors.push('Dependency rule configuration is required for dependency relationships');
            return errors;
        }
        
        const { dependency_type, delay_minutes } = this.priorityRule;
        const validTypes = ['before', 'after', 'concurrent'];
        
        if (!dependency_type || !validTypes.includes(dependency_type)) {
            errors.push(`Dependency type must be one of: ${validTypes.join(', ')}`);
        }
        
        if (delay_minutes !== undefined) {
            if (!Number.isInteger(delay_minutes) || delay_minutes < 0) {
                errors.push('Delay minutes must be a non-negative integer');
            }
        }
        
        return errors;
    }

    /**
     * Check if this association affects task execution at a specific time
     */
    affectsExecution(primaryTask, associatedTask, executionTime) {
        switch (this.relationshipType) {
            case 'priority_based':
                return this.checkPriorityConflict(primaryTask, associatedTask, executionTime);
            case 'mutual_exclusive':
                return this.checkMutualExclusion(primaryTask, associatedTask, executionTime);
            case 'dependency':
                return this.checkDependency(primaryTask, associatedTask, executionTime);
            default:
                return { hasConflict: false };
        }
    }

    /**
     * Check priority-based conflict
     */
    checkPriorityConflict(primaryTask, associatedTask, executionTime) {
        const { strategy } = this.priorityRule;
        const primaryPriority = this.getPriorityScore(primaryTask.priority);
        const associatedPriority = this.getPriorityScore(associatedTask.priority);
        
        switch (strategy) {
            case 'higher_wins':
                if (primaryPriority < associatedPriority) {
                    return {
                        hasConflict: true,
                        resolution: 'skip_primary',
                        reason: 'Associated task has higher priority'
                    };
                } else if (associatedPriority < primaryPriority) {
                    return {
                        hasConflict: true,
                        resolution: 'skip_associated',
                        reason: 'Primary task has higher priority'
                    };
                }
                break;
                
            case 'first_scheduled':
                // This would need access to scheduling information
                return {
                    hasConflict: true,
                    resolution: 'check_schedule_time',
                    reason: 'First scheduled task wins'
                };
                
            case 'suspend_lower':
                if (primaryPriority > associatedPriority) {
                    return {
                        hasConflict: true,
                        resolution: 'suspend_associated',
                        suspendDays: this.suspendDuration,
                        reason: 'Suspending lower priority task'
                    };
                } else if (associatedPriority > primaryPriority) {
                    return {
                        hasConflict: true,
                        resolution: 'suspend_primary',
                        suspendDays: this.suspendDuration,
                        reason: 'Suspending lower priority task'
                    };
                }
                break;
        }
        
        return { hasConflict: false };
    }

    /**
     * Check mutual exclusion conflict
     */
    checkMutualExclusion(primaryTask, associatedTask, executionTime) {
        // For mutual exclusion, check if both tasks are scheduled at the same time
        // This is a simplified implementation - real implementation would check
        // actual scheduled times from the execution plans
        
        return {
            hasConflict: true,
            resolution: 'skip_lower_priority',
            reason: 'Tasks are mutually exclusive'
        };
    }

    /**
     * Check dependency conflict
     */
    checkDependency(primaryTask, associatedTask, executionTime) {
        const { dependency_type, delay_minutes = 0 } = this.priorityRule;
        
        switch (dependency_type) {
            case 'before':
                return {
                    hasConflict: false,
                    requiresOrdering: true,
                    order: 'primary_first',
                    delayMinutes: delay_minutes
                };
                
            case 'after':
                return {
                    hasConflict: false,
                    requiresOrdering: true,
                    order: 'associated_first',
                    delayMinutes: delay_minutes
                };
                
            case 'concurrent':
                return {
                    hasConflict: false,
                    requiresOrdering: false,
                    synchronized: true
                };
                
            default:
                return { hasConflict: false };
        }
    }

    /**
     * Get priority score for comparison
     */
    getPriorityScore(priority) {
        const scores = {
            'high': 100,
            'normal': 50,
            'low': 25
        };
        return scores[priority] || 50;
    }

    /**
     * Resolve conflict between tasks
     */
    resolveConflict(primaryTask, associatedTask, executionTime) {
        const conflict = this.affectsExecution(primaryTask, associatedTask, executionTime);
        
        if (!conflict.hasConflict && !conflict.requiresOrdering) {
            return {
                action: 'no_action',
                affectedTasks: []
            };
        }
        
        const resolution = {
            action: conflict.resolution || conflict.order,
            affectedTasks: [],
            metadata: {
                reason: conflict.reason,
                associationType: this.relationshipType,
                associationId: this.id
            }
        };
        
        // Add affected tasks based on resolution
        switch (conflict.resolution) {
            case 'skip_primary':
                resolution.affectedTasks.push({
                    taskId: this.primaryTaskId,
                    action: 'skip',
                    reason: conflict.reason
                });
                break;
                
            case 'skip_associated':
            case 'skip_lower_priority':
                resolution.affectedTasks.push({
                    taskId: this.associatedTaskId,
                    action: 'skip',
                    reason: conflict.reason
                });
                break;
                
            case 'suspend_primary':
                resolution.affectedTasks.push({
                    taskId: this.primaryTaskId,
                    action: 'suspend',
                    duration: conflict.suspendDays,
                    reason: conflict.reason
                });
                break;
                
            case 'suspend_associated':
                resolution.affectedTasks.push({
                    taskId: this.associatedTaskId,
                    action: 'suspend',
                    duration: conflict.suspendDays,
                    reason: conflict.reason
                });
                break;
        }
        
        // Handle ordering requirements
        if (conflict.requiresOrdering) {
            resolution.ordering = {
                type: conflict.order,
                delayMinutes: conflict.delayMinutes || 0
            };
        }
        
        return resolution;
    }

    /**
     * Get description of the association for UI display
     */
    getDescription() {
        switch (this.relationshipType) {
            case 'priority_based':
                const strategy = this.priorityRule.strategy || 'unknown';
                return `Priority-based relationship with ${strategy} strategy`;
                
            case 'mutual_exclusive':
                return 'Tasks cannot run simultaneously';
                
            case 'dependency':
                const depType = this.priorityRule.dependency_type || 'unknown';
                const delay = this.priorityRule.delay_minutes || 0;
                return `Dependency relationship: ${depType}${delay > 0 ? ` with ${delay}min delay` : ''}`;
                
            default:
                return 'Unknown relationship type';
        }
    }

    /**
     * Check if association is bidirectional
     */
    isBidirectional() {
        return this.relationshipType === 'mutual_exclusive';
    }

    /**
     * Get reverse association (if applicable)
     */
    getReverse() {
        if (!this.isBidirectional()) {
            return null;
        }
        
        return new TaskAssociation({
            primary_task_id: this.associatedTaskId,
            associated_task_id: this.primaryTaskId,
            relationship_type: this.relationshipType,
            priority_rule: this.priorityRule,
            suspend_duration: this.suspendDuration
        });
    }

    /**
     * Convert to plain object for storage
     */
    toPlainObject() {
        return {
            id: this.id,
            primary_task_id: this.primaryTaskId,
            associated_task_id: this.associatedTaskId,
            relationship_type: this.relationshipType,
            priority_rule: this.priorityRule,
            suspend_duration: this.suspendDuration,
            created_at: this.createdAt
        };
    }

    /**
     * Create from plain object
     */
    static fromPlainObject(data) {
        return new TaskAssociation(data);
    }

    /**
     * Clone association
     */
    clone() {
        return TaskAssociation.fromPlainObject(this.toPlainObject());
    }

    /**
     * Create priority-based association
     */
    static createPriorityBased(primaryTaskId, associatedTaskId, strategy = 'higher_wins', suspendDuration = null) {
        return new TaskAssociation({
            primary_task_id: primaryTaskId,
            associated_task_id: associatedTaskId,
            relationship_type: 'priority_based',
            priority_rule: { strategy },
            suspend_duration: suspendDuration
        });
    }

    /**
     * Create mutual exclusion association
     */
    static createMutualExclusive(primaryTaskId, associatedTaskId) {
        return new TaskAssociation({
            primary_task_id: primaryTaskId,
            associated_task_id: associatedTaskId,
            relationship_type: 'mutual_exclusive',
            priority_rule: {}
        });
    }

    /**
     * Create dependency association
     */
    static createDependency(primaryTaskId, associatedTaskId, dependencyType = 'before', delayMinutes = 0) {
        return new TaskAssociation({
            primary_task_id: primaryTaskId,
            associated_task_id: associatedTaskId,
            relationship_type: 'dependency',
            priority_rule: {
                dependency_type: dependencyType,
                delay_minutes: delayMinutes
            }
        });
    }
}

module.exports = TaskAssociation;