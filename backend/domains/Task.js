/**
 * Task Domain Model - DDD Aggregate Root
 * Represents a schedulable task with complex rules and associations
 * Part of DingTalk Reminder System V2 Architecture
 */

const logger = require('../utils/logger');

class Task {
    constructor(data = {}) {
        // Core properties
        this.id = data.id || null;
        this.name = data.name || '';
        this.description = data.description || '';
        this.priority = data.priority || 'normal';
        this.status = data.status || 'active';
        
        // Time boundaries
        this.enableTime = data.enable_time ? new Date(data.enable_time) : null;
        this.disableTime = data.disable_time ? new Date(data.disable_time) : null;
        
        // Relationships
        this.groupId = data.group_id || null;
        this.createdBy = data.created_by || null;
        
        // Metadata
        this.createdAt = data.created_at ? new Date(data.created_at) : new Date();
        this.updatedAt = data.updated_at ? new Date(data.updated_at) : new Date();
        
        // Domain aggregates
        this.scheduleRules = [];
        this.associations = [];
        this.notificationConfig = null;
    }

    /**
     * Domain Methods - Business Logic
     */

    /**
     * Check if task is currently active
     */
    isActive(currentTime = new Date()) {
        if (this.status !== 'active') {
            return false;
        }
        
        if (this.enableTime && currentTime < this.enableTime) {
            return false;
        }
        
        if (this.disableTime && currentTime > this.disableTime) {
            return false;
        }
        
        return true;
    }

    /**
     * Validate task properties
     */
    validate() {
        const errors = [];
        
        // Name validation
        if (!this.name || this.name.trim().length === 0) {
            errors.push('Task name is required');
        }
        
        if (this.name.length > 255) {
            errors.push('Task name must be less than 255 characters');
        }
        
        // Priority validation
        const validPriorities = ['high', 'normal', 'low'];
        if (!validPriorities.includes(this.priority)) {
            errors.push(`Priority must be one of: ${validPriorities.join(', ')}`);
        }
        
        // Status validation
        const validStatuses = ['active', 'paused', 'expired'];
        if (!validStatuses.includes(this.status)) {
            errors.push(`Status must be one of: ${validStatuses.join(', ')}`);
        }
        
        // Time validation
        if (this.enableTime && this.disableTime && this.enableTime >= this.disableTime) {
            errors.push('Enable time must be before disable time');
        }
        
        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * Check if task can be scheduled at a given time
     */
    canScheduleAt(dateTime) {
        if (!this.isActive(dateTime)) {
            return {
                canSchedule: false,
                reason: 'Task is not active at the specified time'
            };
        }
        
        // Check schedule rules
        if (this.scheduleRules.length === 0) {
            return {
                canSchedule: false,
                reason: 'No schedule rules defined for task'
            };
        }
        
        return {
            canSchedule: true,
            reason: null
        };
    }

    /**
     * Calculate priority score for conflict resolution
     */
    getPriorityScore() {
        const priorityScores = {
            'high': 100,
            'normal': 50,
            'low': 25
        };
        
        return priorityScores[this.priority] || 50;
    }

    /**
     * Add schedule rule to task
     */
    addScheduleRule(scheduleRule) {
        if (!scheduleRule) {
            throw new Error('Schedule rule is required');
        }
        
        // Validate rule
        const validation = scheduleRule.validate();
        if (!validation.isValid) {
            throw new Error(`Invalid schedule rule: ${validation.errors.join(', ')}`);
        }
        
        this.scheduleRules.push(scheduleRule);
        this.updatedAt = new Date();
        
        logger.debug('Schedule rule added to task', {
            taskId: this.id,
            ruleType: scheduleRule.ruleType,
            rulesCount: this.scheduleRules.length
        });
    }

    /**
     * Remove schedule rule from task
     */
    removeScheduleRule(ruleId) {
        const initialLength = this.scheduleRules.length;
        this.scheduleRules = this.scheduleRules.filter(rule => rule.id !== ruleId);
        
        if (this.scheduleRules.length < initialLength) {
            this.updatedAt = new Date();
            logger.debug('Schedule rule removed from task', {
                taskId: this.id,
                ruleId,
                remainingRules: this.scheduleRules.length
            });
        }
    }

    /**
     * Add task association
     */
    addAssociation(association) {
        if (!association) {
            throw new Error('Association is required');
        }
        
        // Prevent self-association
        if (association.associatedTaskId === this.id) {
            throw new Error('Task cannot be associated with itself');
        }
        
        // Check for duplicate associations
        const exists = this.associations.some(assoc => 
            assoc.associatedTaskId === association.associatedTaskId &&
            assoc.relationshipType === association.relationshipType
        );
        
        if (exists) {
            throw new Error('Association already exists');
        }
        
        this.associations.push(association);
        this.updatedAt = new Date();
        
        logger.debug('Task association added', {
            taskId: this.id,
            associatedTaskId: association.associatedTaskId,
            relationshipType: association.relationshipType
        });
    }

    /**
     * Remove task association
     */
    removeAssociation(associationId) {
        const initialLength = this.associations.length;
        this.associations = this.associations.filter(assoc => assoc.id !== associationId);
        
        if (this.associations.length < initialLength) {
            this.updatedAt = new Date();
            logger.debug('Task association removed', {
                taskId: this.id,
                associationId,
                remainingAssociations: this.associations.length
            });
        }
    }

    /**
     * Set notification configuration
     */
    setNotificationConfig(config) {
        if (!config) {
            throw new Error('Notification config is required');
        }
        
        const validation = config.validate();
        if (!validation.isValid) {
            throw new Error(`Invalid notification config: ${validation.errors.join(', ')}`);
        }
        
        this.notificationConfig = config;
        this.updatedAt = new Date();
        
        logger.debug('Notification config set for task', {
            taskId: this.id,
            webhookUrl: config.webhookUrl ? 'configured' : 'not configured'
        });
    }

    /**
     * Get all associated task IDs for cache invalidation
     */
    getAssociatedTaskIds() {
        const ids = new Set([this.id]);
        
        this.associations.forEach(assoc => {
            ids.add(assoc.associatedTaskId);
        });
        
        return Array.from(ids);
    }

    /**
     * Convert to plain object for storage/serialization
     */
    toPlainObject() {
        return {
            id: this.id,
            name: this.name,
            description: this.description,
            priority: this.priority,
            status: this.status,
            enable_time: this.enableTime,
            disable_time: this.disableTime,
            group_id: this.groupId,
            created_by: this.createdBy,
            created_at: this.createdAt,
            updated_at: this.updatedAt,
            schedule_rules: this.scheduleRules.map(rule => rule.toPlainObject()),
            associations: this.associations.map(assoc => assoc.toPlainObject()),
            notification_config: this.notificationConfig ? this.notificationConfig.toPlainObject() : null
        };
    }

    /**
     * Create from plain object (for deserialization)
     */
    static fromPlainObject(data) {
        const task = new Task(data);
        
        // Load schedule rules if present
        if (data.schedule_rules && Array.isArray(data.schedule_rules)) {
            const ScheduleRule = require('./ScheduleRule');
            task.scheduleRules = data.schedule_rules.map(ruleData => 
                ScheduleRule.fromPlainObject(ruleData)
            );
        }
        
        // Load associations if present
        if (data.associations && Array.isArray(data.associations)) {
            const TaskAssociation = require('./TaskAssociation');
            task.associations = data.associations.map(assocData => 
                TaskAssociation.fromPlainObject(assocData)
            );
        }
        
        // Load notification config if present
        if (data.notification_config) {
            const NotificationConfig = require('./NotificationConfig');
            task.notificationConfig = NotificationConfig.fromPlainObject(data.notification_config);
        }
        
        return task;
    }

    /**
     * Clone task (useful for testing and modifications)
     */
    clone() {
        return Task.fromPlainObject(this.toPlainObject());
    }

    /**
     * Update task properties
     */
    update(updateData) {
        const allowedFields = ['name', 'description', 'priority', 'status', 'enable_time', 'disable_time'];
        
        allowedFields.forEach(field => {
            if (updateData.hasOwnProperty(field) && updateData[field] !== undefined) {
                if (field.includes('_time') && updateData[field]) {
                    this[field.replace('_', '')] = new Date(updateData[field]);
                } else {
                    this[field.replace('_', '')] = updateData[field];
                }
            }
        });
        
        this.updatedAt = new Date();
        
        // Validate after update
        const validation = this.validate();
        if (!validation.isValid) {
            throw new Error(`Invalid task update: ${validation.errors.join(', ')}`);
        }
        
        logger.debug('Task updated', {
            taskId: this.id,
            updatedFields: Object.keys(updateData).filter(key => allowedFields.includes(key))
        });
    }

    /**
     * Mark task as expired
     */
    expire() {
        this.status = 'expired';
        this.updatedAt = new Date();
        
        logger.info('Task marked as expired', { taskId: this.id, name: this.name });
    }

    /**
     * Pause task
     */
    pause() {
        if (this.status === 'expired') {
            throw new Error('Cannot pause expired task');
        }
        
        this.status = 'paused';
        this.updatedAt = new Date();
        
        logger.info('Task paused', { taskId: this.id, name: this.name });
    }

    /**
     * Resume task
     */
    resume() {
        if (this.status === 'expired') {
            throw new Error('Cannot resume expired task');
        }
        
        this.status = 'active';
        this.updatedAt = new Date();
        
        logger.info('Task resumed', { taskId: this.id, name: this.name });
    }
}

module.exports = Task;