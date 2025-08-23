/**
 * Execution Plan Generator - High-Performance Batch Processing Engine
 * Generates and manages execution plans for 500+ daily reminders
 * Optimized for memory efficiency and parallel processing
 */

const logger = require('../utils/logger');
const { advancedScheduleEngine } = require('./advancedScheduleEngine');
const { taskAssociationManager } = require('./taskAssociationManager');
const { enhancedCache } = require('../utils/enhancedCache');

class ExecutionPlanGenerator {
    constructor() {
        // Performance configuration
        this.BATCH_SIZE = 50;
        this.MAX_CONCURRENT_BATCHES = 5;
        this.MEMORY_THRESHOLD = 500 * 1024 * 1024; // 500MB
        this.MAX_PLANS_PER_BATCH = 1000;
        
        // Processing statistics
        this.stats = {
            plansGenerated: 0,
            batchesProcessed: 0,
            conflictsResolved: 0,
            cacheHits: 0,
            cacheMisses: 0,
            memoryPeakUsage: 0,
            averageProcessingTime: 0,
            errors: 0,
            lastGenerationTime: null
        };
        
        // Memory monitoring
        this.memoryMonitor = {
            enabled: process.env.NODE_ENV === 'production',
            checkInterval: 30000, // 30 seconds
            timer: null
        };
        
        // Initialize memory monitoring
        if (this.memoryMonitor.enabled) {
            this.startMemoryMonitoring();
        }
    }

    /**
     * Generate execution plans for a date range
     * @param {Date} startDate - Start date for plan generation
     * @param {number} days - Number of days to generate plans for
     * @returns {Object} Generation results with statistics
     */
    async generatePlansForRange(startDate, days = 7) {
        const generationStart = Date.now();
        logger.info('Starting execution plan generation', {
            startDate: startDate.toISOString(),
            days,
            targetCapacity: '500+ daily reminders'
        });

        try {
            // Memory check before starting
            await this.checkMemoryUsage();
            
            // Load active tasks and rules
            const activeTasks = await this.loadActiveTasks();
            const activeRules = this.extractRulesFromTasks(activeTasks);
            
            logger.info('Loaded active tasks and rules', {
                tasks: activeTasks.length,
                rules: activeRules.length
            });
            
            // Generate plans for each day
            const allPlans = [];
            const dailyStats = [];
            
            for (let dayOffset = 0; dayOffset < days; dayOffset++) {
                const targetDate = new Date(startDate);
                targetDate.setDate(targetDate.getDate() + dayOffset);
                
                const dayResult = await this.generatePlansForDay(targetDate, activeTasks, activeRules);
                allPlans.push(...dayResult.plans);
                dailyStats.push({
                    date: targetDate.toISOString().split('T')[0],
                    ...dayResult.stats
                });
                
                // Memory check after each day
                if (dayOffset % 2 === 0) {
                    await this.checkMemoryUsage();
                }
            }
            
            // Process conflicts and associations
            const conflictResult = await this.processConflictsAndAssociations(allPlans);
            
            // Save execution plans in batches
            const saveResult = await this.saveExecutionPlansBatch(conflictResult.finalPlans);
            
            const totalDuration = Date.now() - generationStart;
            this.updateGenerationStats(totalDuration, allPlans.length, conflictResult.conflictsResolved);
            
            const result = {
                success: true,
                summary: {
                    totalPlans: allPlans.length,
                    finalPlans: conflictResult.finalPlans.length,
                    conflictsResolved: conflictResult.conflictsResolved,
                    duration: totalDuration,
                    averagePerDay: Math.round(allPlans.length / days),
                    memoryPeakUsage: this.stats.memoryPeakUsage
                },
                dailyBreakdown: dailyStats,
                performance: {
                    batchesProcessed: this.stats.batchesProcessed,
                    cacheHitRate: this.calculateCacheHitRate(),
                    averageProcessingTime: this.stats.averageProcessingTime
                },
                saved: saveResult
            };
            
            logger.info('Execution plan generation completed', result.summary);
            return result;
            
        } catch (error) {
            this.stats.errors++;
            logger.error('Execution plan generation failed', {
                error: error.message,
                stack: error.stack,
                memoryUsage: process.memoryUsage()
            });
            
            return {
                success: false,
                error: error.message,
                stats: this.stats
            };
        }
    }

    /**
     * Generate execution plans for a single day
     */
    async generatePlansForDay(date, activeTasks, activeRules) {
        const dayStart = Date.now();
        const dateStr = date.toISOString().split('T')[0];
        
        logger.debug('Generating plans for day', { date: dateStr });
        
        try {
            // Check cache first
            const cachedPlans = await enhancedCache.getExecutionPlans(dateStr);
            if (cachedPlans && cachedPlans.length > 0) {
                this.stats.cacheHits++;
                logger.debug('Execution plans loaded from cache', {
                    date: dateStr,
                    count: cachedPlans.length
                });
                
                return {
                    plans: cachedPlans,
                    stats: {
                        plansGenerated: cachedPlans.length,
                        fromCache: true,
                        duration: Date.now() - dayStart
                    }
                };
            }
            
            this.stats.cacheMisses++;
            
            // Generate plans using batch processing
            const plans = await this.generatePlansForTasksBatch(date, activeTasks);
            
            // Cache the results
            if (plans.length > 0) {
                await enhancedCache.setExecutionPlans(dateStr, plans);
            }
            
            const dayDuration = Date.now() - dayStart;
            
            return {
                plans,
                stats: {
                    plansGenerated: plans.length,
                    fromCache: false,
                    duration: dayDuration,
                    memoryUsed: this.getCurrentMemoryUsage()
                }
            };
            
        } catch (error) {
            logger.error('Failed to generate plans for day', {
                date: dateStr,
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Generate plans for tasks using batch processing
     */
    async generatePlansForTasksBatch(date, activeTasks) {
        const allPlans = [];
        const taskBatches = this.chunkArray(activeTasks, this.BATCH_SIZE);
        
        logger.debug('Processing task batches', {
            totalTasks: activeTasks.length,
            batchCount: taskBatches.length,
            batchSize: this.BATCH_SIZE
        });
        
        // Process batches with controlled concurrency
        const concurrentBatches = [];
        for (let i = 0; i < taskBatches.length; i += this.MAX_CONCURRENT_BATCHES) {
            const batchSlice = taskBatches.slice(i, i + this.MAX_CONCURRENT_BATCHES);
            
            const batchPromises = batchSlice.map((taskBatch, batchIndex) =>
                this.processTaskBatch(date, taskBatch, i + batchIndex)
            );
            
            const batchResults = await Promise.allSettled(batchPromises);
            
            // Collect successful results
            batchResults.forEach((result, index) => {
                if (result.status === 'fulfilled') {
                    allPlans.push(...result.value);
                } else {
                    logger.error('Task batch processing failed', {
                        batchIndex: i + index,
                        error: result.reason?.message
                    });
                }
            });
            
            this.stats.batchesProcessed += batchSlice.length;
            
            // Memory check after each concurrent batch set
            await this.checkMemoryUsage();
        }
        
        return allPlans;
    }

    /**
     * Process a single batch of tasks
     */
    async processTaskBatch(date, tasks, batchIndex) {
        const batchStart = Date.now();
        const plans = [];
        
        try {
            for (const task of tasks) {
                const taskPlans = await this.generatePlansForTask(date, task);
                plans.push(...taskPlans);
                
                // Prevent memory buildup
                if (plans.length > this.MAX_PLANS_PER_BATCH) {
                    logger.warn('Batch plan limit reached', {
                        batchIndex,
                        plansGenerated: plans.length,
                        limit: this.MAX_PLANS_PER_BATCH
                    });
                    break;
                }
            }
            
            const batchDuration = Date.now() - batchStart;
            logger.debug('Task batch processed', {
                batchIndex,
                tasks: tasks.length,
                plans: plans.length,
                duration: `${batchDuration}ms`
            });
            
            return plans;
            
        } catch (error) {
            logger.error('Task batch processing error', {
                batchIndex,
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Generate execution plans for a single task
     */
    async generatePlansForTask(date, task) {
        const plans = [];
        
        try {
            // 检查task是否是域模型对象
            if (typeof task.isActive === 'function') {
                // Skip inactive tasks
                if (!task.isActive(date)) {
                    logger.debug(`Task ${task.id} is not active on ${date}`);
                    return plans;
                }
            } else {
                // 如果不是域模型，检查基本状态
                if (task.status !== 'active') {
                    logger.debug(`Task ${task.id} status is not active: ${task.status}`);
                    return plans;
                }
            }
            
            // 检查是否是工作表任务
            const isWorksheetTask = await this.isWorksheetTask(task.id);
            
            if (isWorksheetTask) {
                // 工作表任务：调度规则决定日期，工作表决定时间
                logger.info(`处理工作表任务 ${task.id}，检查日期 ${date.toDateString()}`);
                
                for (const rule of task.scheduleRules || []) {
                    // 检查调度规则是否匹配当天
                    const ruleMatchesDate = await this.checkRuleMatchesDate(rule, date);
                    
                    if (ruleMatchesDate) {
                        logger.info(`任务 ${task.id} 的调度规则匹配日期 ${date.toDateString()}`);
                        
                        // 从工作表获取时间点
                        const worksheetTimes = await this.getWorksheetTimes(task.id);
                        
                        if (worksheetTimes && worksheetTimes.length > 0) {
                            logger.info(`从工作表获取到 ${worksheetTimes.length} 个时间点`);
                            
                            // 为每个工作表时间点创建执行计划
                            for (const timeStr of worksheetTimes) {
                                const execTime = this.combineDateAndTime(date, timeStr);
                                if (execTime) {
                                    const plan = this.createExecutionPlan(task, rule, date, execTime);
                                    plans.push(plan);
                                }
                            }
                        }
                    }
                }
            } else {
                // 非工作表任务：使用原有逻辑
                for (const rule of task.scheduleRules || []) {
                    // 使用增强版调度引擎生成执行时间
                    const executionTimes = await advancedScheduleEngine.calculateNextExecution(
                        rule, 
                        date,
                        1 // 只计算当天
                    );
                    
                    for (const execTime of executionTimes) {
                        // 检查执行时间是否在当天
                        if (execTime.toDateString() === date.toDateString()) {
                            const plan = this.createExecutionPlan(task, rule, date, execTime);
                            plans.push(plan);
                        }
                    }
                }
            }
            
            if (plans.length > 0) {
                logger.info(`Generated ${plans.length} plans for task ${task.id} on ${date.toDateString()}`);
            }
            
            return plans;
            
        } catch (error) {
            logger.error('Failed to generate plans for task', {
                taskId: task.id,
                taskName: task.name,
                error: error.message
            });
            return plans;
        }
    }

    /**
     * Create an execution plan object
     */
    createExecutionPlan(task, rule, date, execTime) {
        // 确保execTime是Date对象
        const executionDate = execTime instanceof Date ? execTime : new Date(execTime);
        
        // 使用本地日期格式，避免UTC转换问题
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const dateString = `${year}-${month}-${day}`;
        
        return {
            id: null, // Will be set when saved to database
            task_id: task.id,
            schedule_rule_id: rule.id,
            scheduled_date: dateString,
            scheduled_time: executionDate.toTimeString().split(' ')[0],
            message_content: this.generateMessageContent(task, executionDate),
            message_format: task.notificationConfig?.messageFormat || 'text',
            status: 'pending',
            priority_override: null,
            webhook_url: task.notificationConfig?.webhookUrl,
            webhook_secret: task.notificationConfig?.webhookSecret,
            at_persons: task.notificationConfig?.atPersons || [],
            executed_at: null,
            execution_result: null,
            retry_count: 0,
            generated_at: new Date(),
            
            // Additional metadata for processing
            task_name: task.name,
            task_priority: task.priority,
            rule_type: rule.ruleType
        };
    }

    /**
     * 检查是否是工作表任务
     */
    async isWorksheetTask(taskId) {
        try {
            const { query } = require('../config/database');
            const result = await query(
                'SELECT COUNT(*) as count FROM task_files WHERE task_id = $1',
                [taskId]
            );
            // 兼容不同的查询结果格式
            const rows = Array.isArray(result) ? result : (result.rows || []);
            if (rows && rows[0]) {
                return parseInt(rows[0].count) > 0;
            }
            return false;
        } catch (error) {
            logger.error('检查工作表任务失败', error);
            return false;
        }
    }

    /**
     * 检查调度规则是否匹配指定日期
     */
    async checkRuleMatchesDate(rule, date) {
        try {
            // 使用增强版调度引擎检查
            const executions = await advancedScheduleEngine.calculateNextExecution(
                rule,
                date,
                1
            );
            
            // 检查返回的执行时间是否在同一天
            for (const exec of executions) {
                if (exec.toDateString() === date.toDateString()) {
                    return true;
                }
            }
            
            return false;
        } catch (error) {
            logger.error('检查规则匹配日期失败', error);
            return false;
        }
    }

    /**
     * 从工作表获取时间点
     */
    async getWorksheetTimes(taskId) {
        try {
            const { query } = require('../config/database');
            
            // 获取任务关联的文件信息
            const fileResult = await query(`
                SELECT 
                    tf.file_id,
                    tf.selected_worksheet,
                    f.file_path
                FROM task_files tf
                JOIN files f ON f.id = tf.file_id
                WHERE tf.task_id = $1 AND tf.is_primary = true
                LIMIT 1
            `, [taskId]);
            
            // 兼容不同的查询结果格式
            const rows = Array.isArray(fileResult) ? fileResult : (fileResult.rows || []);
            
            if (rows.length === 0) {
                return [];
            }
            
            const { file_path, selected_worksheet } = rows[0];
            
            // 解析Excel文件
            const excelParser = require('./excelParser');
            const parseResult = await excelParser.parseFile(file_path);
            
            if (!parseResult || !parseResult.worksheets) {
                return [];
            }
            
            // 获取指定工作表
            const worksheetName = selected_worksheet || Object.keys(parseResult.worksheets)[0];
            const worksheetData = parseResult.worksheets[worksheetName];
            
            if (!worksheetData || !Array.isArray(worksheetData)) {
                return [];
            }
            
            // 提取时间点
            const times = new Set();
            for (const row of worksheetData) {
                const time = row['时间'] || row['Time'] || row['time'];
                if (time) {
                    // 标准化时间格式
                    const normalizedTime = this.normalizeTimeString(time);
                    if (normalizedTime) {
                        times.add(normalizedTime);
                    }
                }
            }
            
            return Array.from(times);
            
        } catch (error) {
            logger.error('获取工作表时间失败', error);
            return [];
        }
    }

    /**
     * 组合日期和时间
     */
    combineDateAndTime(date, timeStr) {
        try {
            const [hours, minutes, seconds = 0] = timeStr.split(':').map(Number);
            const combined = new Date(date);
            combined.setHours(hours, minutes, seconds, 0);
            return combined;
        } catch (error) {
            logger.error('组合日期时间失败', error);
            return null;
        }
    }

    /**
     * 标准化时间字符串
     */
    normalizeTimeString(timeStr) {
        if (!timeStr) return null;
        
        const str = String(timeStr).trim();
        
        // HH:MM:SS 格式
        if (str.match(/^\d{1,2}:\d{2}:\d{2}$/)) {
            return str;
        }
        
        // HH:MM 格式
        if (str.match(/^\d{1,2}:\d{2}$/)) {
            return str + ':00';
        }
        
        return null;
    }

    /**
     * Generate message content for execution plan
     */
    generateMessageContent(task, execTime) {
        if (task.notificationConfig?.messageTemplate) {
            return task.notificationConfig.renderTemplate(
                task.notificationConfig.messageTemplate,
                {
                    task_name: task.name,
                    task_description: task.description,
                    execution_time: execTime.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }),
                    timestamp: new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })
                }
            );
        }
        
        return `${task.name}\n时间：${execTime.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`;
    }

    /**
     * Process conflicts and associations across all plans
     */
    async processConflictsAndAssociations(plans) {
        logger.info('Processing conflicts and associations', { totalPlans: plans.length });
        
        try {
            // Group plans by time slots for conflict detection
            const timeGroups = this.groupPlansByTimeSlot(plans);
            let conflictsResolved = 0;
            const finalPlans = [...plans];
            
            // Process each time slot for conflicts
            for (const [timeSlot, slotPlans] of timeGroups.entries()) {
                if (slotPlans.length > 1) {
                    const conflictAnalysis = await taskAssociationManager.checkPriorityConflicts(slotPlans);
                    
                    if (conflictAnalysis.hasConflicts) {
                        const resolution = await taskAssociationManager.resolveConflicts(
                            conflictAnalysis.conflicts,
                            slotPlans
                        );
                        
                        // Update final plans based on resolution
                        this.applyConflictResolution(finalPlans, resolution);
                        conflictsResolved += resolution.resolvedConflicts;
                    }
                }
            }
            
            return {
                finalPlans: finalPlans.filter(plan => !plan._skipped),
                conflictsResolved
            };
            
        } catch (error) {
            logger.error('Conflict processing failed', { error: error.message });
            return {
                finalPlans: plans,
                conflictsResolved: 0
            };
        }
    }

    /**
     * Group execution plans by time slot
     */
    groupPlansByTimeSlot(plans) {
        const timeGroups = new Map();
        
        plans.forEach(plan => {
            const timeSlot = `${plan.scheduled_date}_${plan.scheduled_time}`;
            
            if (!timeGroups.has(timeSlot)) {
                timeGroups.set(timeSlot, []);
            }
            
            timeGroups.get(timeSlot).push(plan);
        });
        
        return timeGroups;
    }

    /**
     * Apply conflict resolution to plans
     */
    applyConflictResolution(plans, resolution) {
        resolution.resolutionActions.forEach(action => {
            if (action.strategy === 'skip_lower_priority') {
                // Mark affected plans as skipped
                plans.forEach(plan => {
                    if (plan.task_id === action.affectedTask) {
                        plan._skipped = true;
                        plan._skipReason = action.reason;
                    }
                });
            }
        });
    }

    /**
     * Save execution plans to database in batches
     */
    async saveExecutionPlansBatch(plans) {
        logger.info('Saving execution plans in batches', { totalPlans: plans.length });
        
        try {
            const planBatches = this.chunkArray(plans, this.BATCH_SIZE);
            let savedCount = 0;
            
            for (const [index, batch] of planBatches.entries()) {
                try {
                    await this.saveExecutionPlansBatchToDB(batch);
                    savedCount += batch.length;
                    
                    logger.debug('Execution plans batch saved', {
                        batchIndex: index + 1,
                        batchSize: batch.length,
                        totalSaved: savedCount
                    });
                    
                } catch (error) {
                    logger.error('Failed to save execution plans batch', {
                        batchIndex: index + 1,
                        batchSize: batch.length,
                        error: error.message
                    });
                }
            }
            
            return {
                totalPlans: plans.length,
                savedCount,
                batchesProcessed: planBatches.length
            };
            
        } catch (error) {
            logger.error('Batch save failed', { error: error.message });
            throw error;
        }
    }

    /**
     * Memory management and monitoring
     */
    startMemoryMonitoring() {
        this.memoryMonitor.timer = setInterval(() => {
            this.checkMemoryUsage();
        }, this.memoryMonitor.checkInterval);
        
        logger.debug('Memory monitoring started');
    }

    async checkMemoryUsage() {
        const memoryUsage = process.memoryUsage();
        const heapUsed = memoryUsage.heapUsed;
        
        // Update peak usage
        if (heapUsed > this.stats.memoryPeakUsage) {
            this.stats.memoryPeakUsage = heapUsed;
        }
        
        // Check if we're approaching memory limits
        if (heapUsed > this.MEMORY_THRESHOLD) {
            logger.warn('High memory usage detected', {
                heapUsed: `${Math.round(heapUsed / 1024 / 1024)}MB`,
                threshold: `${Math.round(this.MEMORY_THRESHOLD / 1024 / 1024)}MB`
            });
            
            // Trigger garbage collection if available
            if (global.gc) {
                global.gc();
                logger.debug('Garbage collection triggered');
            }
        }
    }

    getCurrentMemoryUsage() {
        return Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
    }

    /**
     * Utility methods
     */
    chunkArray(array, size) {
        const chunks = [];
        for (let i = 0; i < array.length; i += size) {
            chunks.push(array.slice(i, i + size));
        }
        return chunks;
    }

    extractRulesFromTasks(tasks) {
        const rules = [];
        tasks.forEach(task => {
            if (task.scheduleRules) {
                rules.push(...task.scheduleRules);
            }
        });
        return rules;
    }

    calculateCacheHitRate() {
        const total = this.stats.cacheHits + this.stats.cacheMisses;
        if (total === 0) return '0%';
        return `${((this.stats.cacheHits / total) * 100).toFixed(1)}%`;
    }

    updateGenerationStats(duration, plansGenerated, conflictsResolved) {
        this.stats.plansGenerated += plansGenerated;
        this.stats.conflictsResolved += conflictsResolved;
        this.stats.lastGenerationTime = new Date();
        
        // Update average processing time
        const currentAvg = this.stats.averageProcessingTime;
        const totalGenerations = this.stats.batchesProcessed || 1;
        this.stats.averageProcessingTime = (currentAvg * (totalGenerations - 1) + duration) / totalGenerations;
    }

    /**
     * Get generator statistics
     */
    getStats() {
        return {
            ...this.stats,
            cacheHitRate: this.calculateCacheHitRate(),
            memoryPeakUsageMB: Math.round(this.stats.memoryPeakUsage / 1024 / 1024),
            currentMemoryUsageMB: this.getCurrentMemoryUsage(),
            averageProcessingTimeMs: Math.round(this.stats.averageProcessingTime)
        };
    }

    /**
     * Reset statistics
     */
    resetStats() {
        this.stats = {
            plansGenerated: 0,
            batchesProcessed: 0,
            conflictsResolved: 0,
            cacheHits: 0,
            cacheMisses: 0,
            memoryPeakUsage: 0,
            averageProcessingTime: 0,
            errors: 0,
            lastGenerationTime: null
        };
        
        logger.info('Execution plan generator statistics reset');
    }

    /**
     * Cleanup resources
     */
    cleanup() {
        if (this.memoryMonitor.timer) {
            clearInterval(this.memoryMonitor.timer);
            this.memoryMonitor.timer = null;
            logger.debug('Memory monitoring stopped');
        }
    }

    // Placeholder methods (to be implemented with actual database integration)
    async loadActiveTasks() {
        // Load active tasks with schedule rules and notification configs
        return [];
    }

    async saveExecutionPlansBatchToDB(plans) {
        // Save batch of execution plans to database
        logger.debug('Execution plans batch saved to database', { count: plans.length });
    }
}

// Create singleton instance
const executionPlanGenerator = new ExecutionPlanGenerator();

// Cleanup on process exit
process.on('exit', () => {
    executionPlanGenerator.cleanup();
});

// SIGINT handling removed to avoid conflicts with main app graceful shutdown

module.exports = {
    ExecutionPlanGenerator,
    executionPlanGenerator
};