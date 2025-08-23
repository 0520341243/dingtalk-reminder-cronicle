/**
 * Enhanced Cache Manager - Multi-tier caching strategy for DingTalk V2
 * Implements active tasks cache, rule calculation cache, and message template cache
 * Supports 500+ daily reminders with intelligent cache invalidation
 */

const { cacheUtils, redisManager } = require('../config/redis');
const logger = require('./logger');

class EnhancedCacheManager {
    constructor() {
        this.cache = cacheUtils;
        
        // Cache TTL configurations (in seconds)
        this.TTL = {
            ACTIVE_TASKS: 24 * 3600,      // 24 hours
            RULE_CALC: 7 * 24 * 3600,     // 7 days  
            MSG_TEMPLATE: 3600,           // 1 hour
            EXECUTION_PLAN: 24 * 3600,    // 24 hours
            TASK_ASSOCIATIONS: 12 * 3600,  // 12 hours
            CONFLICT_CACHE: 1800,         // 30 minutes
        };
        
        // Cache key prefixes
        this.KEYS = {
            ACTIVE_TASKS: 'v2:active_tasks',
            RULE_CALC: 'v2:rule_calc',
            MSG_TEMPLATE: 'v2:msg_template',
            EXECUTION_PLAN: 'v2:execution_plan',
            TASK_ASSOCIATIONS: 'v2:task_assoc',
            CONFLICT_CACHE: 'v2:conflicts',
            PERFORMANCE_METRICS: 'v2:perf_metrics'
        };
        
        // Performance tracking
        this.metrics = {
            hits: 0,
            misses: 0,
            sets: 0,
            errors: 0,
            lastResetTime: Date.now()
        };
    }

    /**
     * Generate cache key with namespace
     */
    generateKey(prefix, ...identifiers) {
        return [prefix, ...identifiers.filter(Boolean)].join(':');
    }

    /**
     * Active Tasks Cache Layer
     * Cache pattern: "v2:active_tasks:{date}"
     * Stores all active tasks for a specific date
     */
    async getActiveTasks(date) {
        const key = this.generateKey(this.KEYS.ACTIVE_TASKS, date);
        
        try {
            const cached = await this.cache.get(key);
            if (cached) {
                this.metrics.hits++;
                logger.debug('Active tasks cache hit', { date, count: cached.length });
                return cached;
            }
            
            this.metrics.misses++;
            return null;
        } catch (error) {
            this.metrics.errors++;
            logger.error('Failed to get active tasks from cache', { date, error: error.message });
            return null;
        }
    }

    async setActiveTasks(date, tasks) {
        const key = this.generateKey(this.KEYS.ACTIVE_TASKS, date);
        
        try {
            await this.cache.set(key, tasks, this.TTL.ACTIVE_TASKS);
            this.metrics.sets++;
            logger.debug('Active tasks cached', { date, count: tasks.length });
            return true;
        } catch (error) {
            this.metrics.errors++;
            logger.error('Failed to cache active tasks', { date, error: error.message });
            return false;
        }
    }

    /**
     * Rule Calculation Cache Layer
     * Cache pattern: "v2:rule_calc:{rule_id}:{month}"  
     * Stores pre-calculated execution times for rules
     */
    async getRuleCalculation(ruleId, month, year) {
        const key = this.generateKey(this.KEYS.RULE_CALC, ruleId, `${year}-${month}`);
        
        try {
            const cached = await this.cache.get(key);
            if (cached) {
                this.metrics.hits++;
                logger.debug('Rule calculation cache hit', { ruleId, month, year });
                return cached;
            }
            
            this.metrics.misses++;
            return null;
        } catch (error) {
            this.metrics.errors++;
            logger.error('Failed to get rule calculation from cache', { ruleId, month, year, error: error.message });
            return null;
        }
    }

    async setRuleCalculation(ruleId, month, year, calculations) {
        const key = this.generateKey(this.KEYS.RULE_CALC, ruleId, `${year}-${month}`);
        
        try {
            await this.cache.set(key, calculations, this.TTL.RULE_CALC);
            this.metrics.sets++;
            logger.debug('Rule calculation cached', { ruleId, month, year, count: calculations.length });
            return true;
        } catch (error) {
            this.metrics.errors++;
            logger.error('Failed to cache rule calculation', { ruleId, month, year, error: error.message });
            return false;
        }
    }

    /**
     * Message Template Cache Layer
     * Cache pattern: "v2:msg_template:{task_id}"
     * Stores rendered message templates
     */
    async getMessageTemplate(taskId) {
        const key = this.generateKey(this.KEYS.MSG_TEMPLATE, taskId);
        
        try {
            const cached = await this.cache.get(key);
            if (cached) {
                this.metrics.hits++;
                logger.debug('Message template cache hit', { taskId });
                return cached;
            }
            
            this.metrics.misses++;
            return null;
        } catch (error) {
            this.metrics.errors++;
            logger.error('Failed to get message template from cache', { taskId, error: error.message });
            return null;
        }
    }

    async setMessageTemplate(taskId, template) {
        const key = this.generateKey(this.KEYS.MSG_TEMPLATE, taskId);
        
        try {
            await this.cache.set(key, template, this.TTL.MSG_TEMPLATE);
            this.metrics.sets++;
            logger.debug('Message template cached', { taskId });
            return true;
        } catch (error) {
            this.metrics.errors++;
            logger.error('Failed to cache message template', { taskId, error: error.message });
            return false;
        }
    }

    /**
     * Execution Plan Cache Layer
     * Cache pattern: "v2:execution_plan:{date}"
     * Stores generated execution plans for a date
     */
    async getExecutionPlans(date) {
        const key = this.generateKey(this.KEYS.EXECUTION_PLAN, date);
        
        try {
            const cached = await this.cache.get(key);
            if (cached) {
                this.metrics.hits++;
                logger.debug('Execution plans cache hit', { date, count: cached.length });
                return cached;
            }
            
            this.metrics.misses++;
            return null;
        } catch (error) {
            this.metrics.errors++;
            logger.error('Failed to get execution plans from cache', { date, error: error.message });
            return null;
        }
    }

    async setExecutionPlans(date, plans) {
        const key = this.generateKey(this.KEYS.EXECUTION_PLAN, date);
        
        try {
            await this.cache.set(key, plans, this.TTL.EXECUTION_PLAN);
            this.metrics.sets++;
            logger.debug('Execution plans cached', { date, count: plans.length });
            return true;
        } catch (error) {
            this.metrics.errors++;
            logger.error('Failed to cache execution plans', { date, error: error.message });
            return false;
        }
    }

    /**
     * Task Associations Cache Layer
     * Cache pattern: "v2:task_assoc:{task_id}"
     * Stores task associations and priority rules
     */
    async getTaskAssociations(taskId) {
        const key = this.generateKey(this.KEYS.TASK_ASSOCIATIONS, taskId);
        
        try {
            const cached = await this.cache.get(key);
            if (cached) {
                this.metrics.hits++;
                logger.debug('Task associations cache hit', { taskId });
                return cached;
            }
            
            this.metrics.misses++;
            return null;
        } catch (error) {
            this.metrics.errors++;
            logger.error('Failed to get task associations from cache', { taskId, error: error.message });
            return null;
        }
    }

    async setTaskAssociations(taskId, associations) {
        const key = this.generateKey(this.KEYS.TASK_ASSOCIATIONS, taskId);
        
        try {
            await this.cache.set(key, associations, this.TTL.TASK_ASSOCIATIONS);
            this.metrics.sets++;
            logger.debug('Task associations cached', { taskId, count: associations.length });
            return true;
        } catch (error) {
            this.metrics.errors++;
            logger.error('Failed to cache task associations', { taskId, error: error.message });
            return false;
        }
    }

    /**
     * Conflict Detection Cache Layer
     * Cache pattern: "v2:conflicts:{task_id}:{date}"
     * Stores conflict detection results
     */
    async getConflictDetection(taskId, date) {
        const key = this.generateKey(this.KEYS.CONFLICT_CACHE, taskId, date);
        
        try {
            const cached = await this.cache.get(key);
            if (cached) {
                this.metrics.hits++;
                logger.debug('Conflict detection cache hit', { taskId, date });
                return cached;
            }
            
            this.metrics.misses++;
            return null;
        } catch (error) {
            this.metrics.errors++;
            logger.error('Failed to get conflict detection from cache', { taskId, date, error: error.message });
            return null;
        }
    }

    async setConflictDetection(taskId, date, conflicts) {
        const key = this.generateKey(this.KEYS.CONFLICT_CACHE, taskId, date);
        
        try {
            await this.cache.set(key, conflicts, this.TTL.CONFLICT_CACHE);
            this.metrics.sets++;
            logger.debug('Conflict detection cached', { taskId, date });
            return true;
        } catch (error) {
            this.metrics.errors++;
            logger.error('Failed to cache conflict detection', { taskId, date, error: error.message });
            return false;
        }
    }

    /**
     * Batch Preload - Load all daily tasks into Redis at 02:00
     * Optimizes for 500+ daily reminders processing
     */
    async preloadDailyTasks(date) {
        const startTime = Date.now();
        logger.info('Starting daily tasks preload', { date });
        
        try {
            // This would typically load from database
            // Implementation will be added when database models are ready
            const tasks = await this._loadTasksFromDatabase(date);
            const rules = await this._loadActiveRules(date);
            const associations = await this._loadTaskAssociations();
            
            // Cache active tasks
            await this.setActiveTasks(date, tasks);
            
            // Pre-calculate and cache rule executions
            const calculations = [];
            for (const rule of rules) {
                const calc = await this._calculateRuleExecution(rule, date);
                calculations.push(calc);
                
                const month = new Date(date).getMonth() + 1;
                const year = new Date(date).getFullYear();
                await this.setRuleCalculation(rule.id, month, year, calc.executions);
            }
            
            // Cache task associations
            for (const taskId of new Set(tasks.map(t => t.id))) {
                const taskAssoc = associations.filter(a => a.primary_task_id === taskId);
                if (taskAssoc.length > 0) {
                    await this.setTaskAssociations(taskId, taskAssoc);
                }
            }
            
            const duration = Date.now() - startTime;
            logger.info('Daily tasks preload completed', { 
                date, 
                tasks: tasks.length, 
                rules: rules.length,
                duration 
            });
            
            return true;
        } catch (error) {
            logger.error('Failed to preload daily tasks', { date, error: error.message });
            return false;
        }
    }

    /**
     * Intelligent Cache Invalidation
     * Based on task association relationships
     */
    async invalidateAssociatedCache(taskId) {
        try {
            // Get associated task IDs
            const associations = await this.getTaskAssociations(taskId);
            const relatedTaskIds = new Set([taskId]);
            
            if (associations) {
                associations.forEach(assoc => {
                    relatedTaskIds.add(assoc.associated_task_id);
                    relatedTaskIds.add(assoc.primary_task_id);
                });
            }
            
            // Invalidate caches for all related tasks
            const promises = [];
            for (const id of relatedTaskIds) {
                promises.push(this.cache.delPattern(`${this.KEYS.MSG_TEMPLATE}:${id}*`));
                promises.push(this.cache.delPattern(`${this.KEYS.TASK_ASSOCIATIONS}:${id}*`));
                promises.push(this.cache.delPattern(`${this.KEYS.CONFLICT_CACHE}:${id}*`));
            }
            
            await Promise.all(promises);
            logger.info('Associated cache invalidated', { 
                taskId, 
                relatedTasks: Array.from(relatedTaskIds) 
            });
            
        } catch (error) {
            logger.error('Failed to invalidate associated cache', { taskId, error: error.message });
        }
    }

    /**
     * Performance Monitoring
     */
    getPerformanceMetrics() {
        const totalRequests = this.metrics.hits + this.metrics.misses;
        const hitRate = totalRequests > 0 ? (this.metrics.hits / totalRequests * 100).toFixed(2) : 0;
        const uptime = Date.now() - this.metrics.lastResetTime;
        
        return {
            hitRate: `${hitRate}%`,
            hits: this.metrics.hits,
            misses: this.metrics.misses,
            sets: this.metrics.sets,
            errors: this.metrics.errors,
            totalRequests,
            uptime: Math.round(uptime / 1000), // seconds
            redisStatus: redisManager.getStatus()
        };
    }

    /**
     * Reset performance metrics
     */
    resetMetrics() {
        this.metrics = {
            hits: 0,
            misses: 0,
            sets: 0,
            errors: 0,
            lastResetTime: Date.now()
        };
        logger.info('Cache metrics reset');
    }

    /**
     * Cache warming for high-performance scenarios
     * Proactively loads frequently accessed data
     */
    async warmCache(date, days = 7) {
        logger.info('Starting cache warming', { date, days });
        
        const promises = [];
        for (let i = 0; i < days; i++) {
            const targetDate = new Date(date);
            targetDate.setDate(targetDate.getDate() + i);
            const dateStr = targetDate.toISOString().split('T')[0];
            
            promises.push(this.preloadDailyTasks(dateStr));
        }
        
        await Promise.allSettled(promises);
        logger.info('Cache warming completed', { date, days });
    }

    /**
     * Memory usage monitoring and cleanup
     */
    async checkMemoryUsage() {
        if (!redisManager.isReady()) {
            return null;
        }
        
        try {
            const client = redisManager.getClient();
            const info = await client.info('memory');
            const memoryLines = info.split('\n');
            
            const memoryData = {};
            memoryLines.forEach(line => {
                const [key, value] = line.split(':');
                if (key && value) {
                    memoryData[key] = value.trim();
                }
            });
            
            const usedMemory = parseInt(memoryData.used_memory || 0);
            const maxMemory = parseInt(memoryData.maxmemory || 0);
            
            if (maxMemory > 0) {
                const usagePercent = (usedMemory / maxMemory) * 100;
                logger.debug('Redis memory usage', { 
                    used: `${(usedMemory / 1024 / 1024).toFixed(2)}MB`,
                    max: `${(maxMemory / 1024 / 1024).toFixed(2)}MB`,
                    usage: `${usagePercent.toFixed(2)}%`
                });
                
                // Auto-cleanup if memory usage is high
                if (usagePercent > 80) {
                    logger.warn('High Redis memory usage, triggering cleanup', { usage: `${usagePercent.toFixed(2)}%` });
                    await this.performCleanup();
                }
            }
            
            return memoryData;
        } catch (error) {
            logger.error('Failed to check memory usage', { error: error.message });
            return null;
        }
    }

    /**
     * Cleanup expired and low-priority cache entries
     */
    async performCleanup() {
        try {
            // Remove expired message templates (shortest TTL)
            await this.cache.delPattern(`${this.KEYS.MSG_TEMPLATE}:*`);
            
            // Remove old conflict detection cache
            await this.cache.delPattern(`${this.KEYS.CONFLICT_CACHE}:*`);
            
            logger.info('Cache cleanup completed');
        } catch (error) {
            logger.error('Cache cleanup failed', { error: error.message });
        }
    }

    /**
     * Invalidate active tasks cache
     */
    async invalidateActiveTasksCache() {
        try {
            await this.cache.del(this.KEYS.ACTIVE_TASKS);
            logger.info('Active tasks cache invalidated');
        } catch (error) {
            logger.error('Failed to invalidate active tasks cache', { error: error.message });
        }
    }

    /**
     * Invalidate task-specific cache
     */
    async invalidateTaskCache(taskId) {
        try {
            const patterns = [
                `${this.KEYS.EXECUTION_PLAN}:${taskId}:*`,
                `${this.KEYS.TASK_ASSOCIATIONS}:${taskId}:*`,
                `${this.KEYS.RULE_CALC}:${taskId}:*`
            ];
            
            for (const pattern of patterns) {
                await this.cache.delPattern(pattern);
            }
            
            logger.info('Task cache invalidated', { taskId });
        } catch (error) {
            logger.error('Failed to invalidate task cache', { taskId, error: error.message });
        }
    }

    // Private helper methods (to be implemented with actual database calls)
    async _loadTasksFromDatabase(date) {
        // Placeholder - will be implemented when database models are ready
        return [];
    }

    async _loadActiveRules(date) {
        // Placeholder - will be implemented when database models are ready  
        return [];
    }

    async _loadTaskAssociations() {
        // Placeholder - will be implemented when database models are ready
        return [];
    }

    async _calculateRuleExecution(rule, date) {
        // Placeholder - will be implemented with AdvancedScheduleEngine
        return { executions: [] };
    }
}

// Create singleton instance
const enhancedCache = new EnhancedCacheManager();

module.exports = {
    EnhancedCacheManager,
    enhancedCache
};