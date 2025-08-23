/**
 * Advanced Schedule Engine - Complex Rule Processing Engine
 * Handles byDay, byWeek, and byInterval scheduling patterns
 * Supports pre-calculation and caching for 500+ daily reminders
 */

const logger = require('../utils/logger');
const { enhancedCache } = require('../utils/enhancedCache');

class AdvancedScheduleEngine {
    constructor() {
        // Performance optimization settings
        this.BATCH_SIZE = 100;
        this.MAX_LOOKAHEAD_DAYS = 365;
        this.CACHE_PRECOMPUTE_DAYS = 30;
        
        // Working days cache (excluding weekends)
        this.workingDaysCache = new Map();
        
        // Statistics tracking
        this.stats = {
            rulesProcessed: 0,
            calculationsPerformed: 0,
            cacheHits: 0,
            cacheMisses: 0,
            errors: 0
        };
    }

    /**
     * Calculate next execution times for a given schedule rule
     * @param {ScheduleRule} rule - Schedule rule object
     * @param {Date} fromDate - Starting date for calculation
     * @param {number} days - Number of days to look ahead
     * @returns {Array} Array of execution times
     */
    async calculateNextExecution(rule, fromDate = new Date(), days = 30) {
        const startTime = Date.now();
        logger.debug('Calculating next execution', {
            ruleId: rule.id,
            ruleType: rule.ruleType,
            fromDate: fromDate.toISOString(),
            days
        });

        try {
            // Check cache first
            const cacheKey = this.generateCacheKey(rule, fromDate, days);
            const cached = await this.getCachedCalculation(cacheKey);
            if (cached) {
                this.stats.cacheHits++;
                return cached;
            }

            this.stats.cacheMisses++;
            
            // Validate rule before processing
            // 如果rule有validate方法则调用，否则跳过验证
            if (typeof rule.validate === 'function') {
                const validation = rule.validate();
                if (!validation.isValid) {
                    throw new Error(`Invalid schedule rule: ${validation.errors.join(', ')}`);
                }
            }

            // Calculate based on rule type - 支持所有增强版调度类型
            let executions = [];
            switch (rule.ruleType) {
                case 'by_day':
                case 'daily':
                    executions = await this.calculateByDay(rule, fromDate, days);
                    break;
                case 'by_week':
                case 'weekly':
                    executions = await this.calculateByWeek(rule, fromDate, days);
                    break;
                case 'by_month':
                case 'monthly':
                    executions = await this.calculateByMonth(rule, fromDate, days);
                    break;
                case 'by_year':
                case 'yearly':
                    executions = await this.calculateByYear(rule, fromDate, days);
                    break;
                case 'by_interval':
                case 'interval':
                    executions = await this.calculateByInterval(rule, fromDate, days);
                    break;
                case 'specific_date':
                    executions = await this.calculateSpecificDates(rule, fromDate, days);
                    break;
                case 'custom':
                    executions = await this.calculateCustom(rule, fromDate, days);
                    break;
                default:
                    throw new Error(`Unsupported rule type: ${rule.ruleType}`);
            }

            // Sort executions by time
            executions.sort((a, b) => a.getTime() - b.getTime());
            
            // Cache the results
            await this.cacheCalculation(cacheKey, executions);
            
            this.stats.rulesProcessed++;
            this.stats.calculationsPerformed++;
            
            const duration = Date.now() - startTime;
            logger.debug('Execution calculation completed', {
                ruleId: rule.id,
                executions: executions.length,
                duration: `${duration}ms`
            });

            return executions;

        } catch (error) {
            this.stats.errors++;
            logger.error('Failed to calculate next execution', {
                ruleId: rule.id,
                error: error.message,
                stack: error.stack
            });
            throw error;
        }
    }

    /**
     * Calculate executions for by_day rule type
     */
    async calculateByDay(rule, fromDate, days) {
        const executions = [];
        const endDate = new Date(fromDate);
        endDate.setDate(endDate.getDate() + days);

        let currentDate = new Date(fromDate);
        
        while (currentDate <= endDate) {
            // Check if rule applies to this date
            if (this.doesRuleApplyToDate(rule, currentDate)) {
                // Generate execution times for this date
                const dayExecutions = this.generateExecutionTimes(rule, currentDate);
                executions.push(...dayExecutions);
            }
            
            currentDate.setDate(currentDate.getDate() + 1);
        }

        return executions;
    }

    /**
     * Calculate executions for by_week rule type
     */
    async calculateByWeek(rule, fromDate, days) {
        const executions = [];
        const endDate = new Date(fromDate);
        endDate.setDate(endDate.getDate() + days);

        let currentDate = new Date(fromDate);
        
        while (currentDate <= endDate) {
            if (this.doesRuleApplyToDate(rule, currentDate)) {
                const dayExecutions = this.generateExecutionTimes(rule, currentDate);
                executions.push(...dayExecutions);
            }
            
            currentDate.setDate(currentDate.getDate() + 1);
        }

        return executions;
    }

    /**
     * Calculate executions for by_interval rule type
     */
    async calculateByInterval(rule, fromDate, days) {
        const executions = [];
        
        if (!rule.referenceDate || !rule.intervalConfig) {
            throw new Error('Reference date and interval config required for by_interval rule');
        }

        const { interval, unit } = rule.intervalConfig;
        const refDate = new Date(rule.referenceDate);
        const endDate = new Date(fromDate);
        endDate.setDate(endDate.getDate() + days);

        // Calculate next occurrence from reference date
        let currentDate = this.getNextIntervalDate(refDate, fromDate, interval, unit);
        
        while (currentDate && currentDate <= endDate) {
            if (this.doesRuleApplyToDate(rule, currentDate)) {
                const dayExecutions = this.generateExecutionTimes(rule, currentDate);
                executions.push(...dayExecutions);
            }
            
            // Calculate next interval date
            currentDate = this.addInterval(currentDate, interval, unit);
        }

        return executions;
    }

    /**
     * Calculate executions for by_month rule type (每月执行)
     */
    async calculateByMonth(rule, fromDate, days) {
        const executions = [];
        const endDate = new Date(fromDate);
        endDate.setDate(endDate.getDate() + days);

        // 修复：验证months字段，如果为空则使用当前月份
        if (!rule.months || rule.months.length === 0) {
            logger.warn('Monthly rule without months specified, using all months', {
                taskId: rule.task_id,
                ruleId: rule.id
            });
            // 默认使用全年12个月
            rule.months = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
        }

        let currentDate = new Date(fromDate);
        
        while (currentDate <= endDate) {
            // 检查月份是否匹配
            const currentMonth = currentDate.getMonth() + 1;
            if (rule.months.includes(currentMonth)) {
                // 检查是否是执行日
                if (this.isMonthlyExecutionDay(rule, currentDate)) {
                    const dayExecutions = this.generateExecutionTimes(rule, currentDate);
                    executions.push(...dayExecutions);
                }
            }
            
            currentDate.setDate(currentDate.getDate() + 1);
        }

        return executions;
    }

    /**
     * Calculate executions for by_year rule type (每年执行)
     */
    async calculateByYear(rule, fromDate, days) {
        const executions = [];
        const endDate = new Date(fromDate);
        endDate.setDate(endDate.getDate() + days);

        let currentDate = new Date(fromDate);
        
        while (currentDate <= endDate) {
            // 检查月份
            const month = currentDate.getMonth() + 1;
            if (rule.months && rule.months.includes(month)) {
                // 检查是否是执行日
                if (this.isMonthlyExecutionDay(rule, currentDate)) {
                    const dayExecutions = this.generateExecutionTimes(rule, currentDate);
                    executions.push(...dayExecutions);
                }
            }
            
            currentDate.setDate(currentDate.getDate() + 1);
        }

        return executions;
    }

    /**
     * Calculate executions for specific_date rule type (特定日期执行)
     */
    async calculateSpecificDates(rule, fromDate, days) {
        const executions = [];
        const endDate = new Date(fromDate);
        endDate.setDate(endDate.getDate() + days);

        if (!rule.specificDates || !Array.isArray(rule.specificDates)) {
            return executions;
        }

        // 遍历所有特定日期
        for (const dateStr of rule.specificDates) {
            const specificDate = new Date(dateStr);
            
            // 检查日期是否在范围内
            if (specificDate >= fromDate && specificDate <= endDate) {
                const dayExecutions = this.generateExecutionTimes(rule, specificDate);
                executions.push(...dayExecutions);
            }
        }

        return executions;
    }

    /**
     * Calculate executions for custom rule type (自定义规则)
     */
    async calculateCustom(rule, fromDate, days) {
        // 自定义规则可以组合多种条件
        // 这里提供一个灵活的框架，可以根据需要扩展
        const executions = [];
        const endDate = new Date(fromDate);
        endDate.setDate(endDate.getDate() + days);

        let currentDate = new Date(fromDate);
        
        while (currentDate <= endDate) {
            // 应用自定义逻辑
            if (this.checkCustomCondition(rule, currentDate)) {
                const dayExecutions = this.generateExecutionTimes(rule, currentDate);
                executions.push(...dayExecutions);
            }
            
            currentDate.setDate(currentDate.getDate() + 1);
        }

        return executions;
    }

    /**
     * Check if a date is a monthly execution day
     */
    isMonthlyExecutionDay(rule, date) {
        // 兼容数据库中的 day_mode 格式
        let dayMode = rule.dayMode || rule.day_mode;
        
        if (!dayMode) {
            // 默认每月1号
            return date.getDate() === 1;
        }

        // 兼容两种格式：
        // 格式1: { mode: 'specific_days', values: [16] }
        // 格式2: { type: 'specific_days', days: [16] }
        const mode = dayMode.mode || dayMode.type;
        const values = dayMode.values || dayMode.days || dayMode.weekdays;
        const dayOfMonth = date.getDate();

        switch (mode) {
            case 'specific_days':
                return values && values.includes(dayOfMonth);
            case 'last_day':
                return this.isLastDayOfMonth(date);
            case 'first_workday':
                return this.isFirstWorkdayOfMonth(date);
            case 'last_workday':
                return this.isLastWorkdayOfMonth(date);
            case 'specific_weekdays':
                // 处理"某几个星期几"的情况
                const dayOfWeek = date.getDay();
                return values && values.includes(dayOfWeek);
            default:
                return false;
        }
    }

    /**
     * Check custom condition for execution
     */
    checkCustomCondition(rule, date) {
        // 可以根据需要实现复杂的自定义逻辑
        // 例如：节假日、工作日、特殊条件等
        return true;
    }

    /**
     * Check if date is first workday of month
     */
    isFirstWorkdayOfMonth(date) {
        const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
        
        // 如果1号是工作日
        if (this.isWorkday(firstDay)) {
            return date.getDate() === 1;
        }
        
        // 找到第一个工作日
        while (!this.isWorkday(firstDay)) {
            firstDay.setDate(firstDay.getDate() + 1);
        }
        
        return date.getDate() === firstDay.getDate();
    }

    /**
     * Check if a rule applies to a specific date
     */
    doesRuleApplyToDate(rule, date) {
        // Check month filter
        if (rule.months && rule.months.length > 0) {
            const month = date.getMonth() + 1;
            if (!rule.months.includes(month)) {
                return false;
            }
        }

        // Check rule-specific conditions
        switch (rule.ruleType) {
            case 'by_day':
            case 'daily':
                return this.checkByDayCondition(rule, date);
            case 'by_week':
            case 'weekly':
                return this.checkByWeekCondition(rule, date);
            case 'by_month':
            case 'monthly':
                return this.isMonthlyExecutionDay(rule, date);
            case 'by_year':
            case 'yearly':
                return this.isMonthlyExecutionDay(rule, date);
            case 'by_interval':
            case 'interval':
                return this.checkByIntervalCondition(rule, date);
            case 'specific_date':
                return this.checkSpecificDateCondition(rule, date);
            case 'custom':
                return this.checkCustomCondition(rule, date);
            default:
                return false;
        }
    }

    /**
     * Check by_day specific conditions
     */
    checkByDayCondition(rule, date) {
        if (!rule.dayMode) return false;

        const dayOfMonth = date.getDate();
        
        // 支持多种格式
        // 1. everyDay格式: { everyDay: true }
        if (rule.dayMode.everyDay === true) {
            return true;
        }
        
        // 2. type格式（来自前端和测试）: { type: 'every_day' }
        if (rule.dayMode.type) {
            switch (rule.dayMode.type) {
                case 'every_day':
                    return true;
                case 'specific_days':
                    return rule.dayMode.days && rule.dayMode.days.includes(dayOfMonth);
                case 'last_day':
                    return this.isLastDayOfMonth(date);
                case 'last_workday':
                    return this.isLastWorkdayOfMonth(date);
                case 'nth_weekday':
                    return this.isNthWeekday(date, rule.dayMode.nthWeekday);
                default:
                    return false;
            }
        }
        
        // 3. 原有的mode格式: { mode: 'specific_days', values: [...] }
        const { mode, values } = rule.dayMode;
        if (mode) {
            switch (mode) {
                case 'specific_days':
                    return values && values.includes(dayOfMonth);
                case 'last_day':
                    return this.isLastDayOfMonth(date);
                case 'last_workday':
                    return this.isLastWorkdayOfMonth(date);
                default:
                    return false;
            }
        }
        
        return false;
    }

    /**
     * Check by_week specific conditions
     */
    checkByWeekCondition(rule, date) {
        // 支持多种格式
        const dayOfWeek = date.getDay(); // 0 = Sunday, 6 = Saturday
        const isoWeekday = dayOfWeek === 0 ? 7 : dayOfWeek; // 1 = Monday, 7 = Sunday
        
        // 1. weekMode格式（来自测试）: { weekdays: [1,2,3,4,5], occurrence: 'every' }
        if (rule.dayMode && rule.dayMode.weekdays && rule.dayMode.occurrence) {
            // 注意：这里weekdays使用1-7格式（1=Monday, 7=Sunday）
            return rule.dayMode.weekdays.includes(isoWeekday);
        }
        
        // 2. 原有的dayMode格式
        if (rule.dayMode) {
            const { mode, values } = rule.dayMode;
            
            // 直接weekDays数组格式
            if (rule.dayMode.weekDays) {
                return rule.dayMode.weekDays.includes(dayOfWeek);
            }
            
            // mode格式
            if (mode) {
                switch (mode) {
                    case 'weekdays':
                        return dayOfWeek >= 1 && dayOfWeek <= 5; // Monday to Friday
                    case 'specific_weekdays':
                        return values && values.includes(dayOfWeek);
                    default:
                        return false;
                }
            }
        }
        
        return false;
    }

    /**
     * Check by_interval specific conditions
     */
    checkByIntervalCondition(rule, date) {
        if (!rule.referenceDate || !rule.intervalConfig) return false;

        const { interval, unit } = rule.intervalConfig;
        const refDate = new Date(rule.referenceDate);
        
        return this.isValidIntervalDate(refDate, date, interval, unit);
    }

    /**
     * Generate execution times for a specific date
     */
    generateExecutionTimes(rule, date) {
        const executions = [];
        
        // 兼容两种字段名
        const executionTimes = rule.executionTimes || rule.execution_times || [];
        
        for (const timeStr of executionTimes) {
            try {
                const [hours, minutes, seconds = '00'] = timeStr.split(':');
                const execTime = new Date(date);
                execTime.setHours(
                    parseInt(hours), 
                    parseInt(minutes), 
                    parseInt(seconds), 
                    0
                );
                
                executions.push(execTime);
            } catch (error) {
                logger.warn('Invalid execution time format', {
                    ruleId: rule.id,
                    timeStr,
                    error: error.message
                });
            }
        }
        
        return executions;
    }

    /**
     * Get next interval date after a given date
     */
    getNextIntervalDate(referenceDate, afterDate, interval, unit) {
        let current = new Date(referenceDate);
        
        // Move to the first occurrence at or after afterDate
        while (current < afterDate) {
            current = this.addInterval(current, interval, unit);
        }
        
        return current;
    }

    /**
     * Check if specific date condition applies
     */
    checkSpecificDateCondition(rule, date) {
        if (!rule.specificDates || !Array.isArray(rule.specificDates)) {
            return false;
        }
        
        const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        return rule.specificDates.includes(dateStr);
    }

    /**
     * Add interval to a date
     */
    addInterval(date, interval, unit) {
        const result = new Date(date);
        
        switch (unit) {
            case 'days':
                result.setDate(result.getDate() + interval);
                break;
            case 'weeks':
                result.setDate(result.getDate() + (interval * 7));
                break;
            case 'months':
                result.setMonth(result.getMonth() + interval);
                break;
            case 'years':
                result.setFullYear(result.getFullYear() + interval);
                break;
            default:
                throw new Error(`Unsupported interval unit: ${unit}`);
        }
        
        return result;
    }

    /**
     * Check if date is valid for interval calculation
     */
    isValidIntervalDate(referenceDate, targetDate, interval, unit) {
        let diffInUnits;
        
        switch (unit) {
            case 'days':
                const diffTime = targetDate.getTime() - referenceDate.getTime();
                diffInUnits = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                break;
                
            case 'weeks':
                const diffTimeWeeks = targetDate.getTime() - referenceDate.getTime();
                diffInUnits = Math.floor(diffTimeWeeks / (1000 * 60 * 60 * 24 * 7));
                break;
                
            case 'months':
                diffInUnits = (targetDate.getFullYear() - referenceDate.getFullYear()) * 12 + 
                             (targetDate.getMonth() - referenceDate.getMonth());
                break;
                
            default:
                return false;
        }
        
        return diffInUnits >= 0 && diffInUnits % interval === 0;
    }

    /**
     * Check if date is the last day of the month
     */
    isLastDayOfMonth(date) {
        const nextDay = new Date(date);
        nextDay.setDate(date.getDate() + 1);
        return nextDay.getMonth() !== date.getMonth();
    }

    /**
     * Check if date is the last working day of the month
     */
    isLastWorkdayOfMonth(date) {
        const year = date.getFullYear();
        const month = date.getMonth();
        
        // Get cached working days or calculate them
        const cacheKey = `workdays_${year}_${month}`;
        let workingDays = this.workingDaysCache.get(cacheKey);
        
        if (!workingDays) {
            workingDays = this.calculateWorkingDaysInMonth(year, month);
            this.workingDaysCache.set(cacheKey, workingDays);
        }
        
        const lastWorkday = Math.max(...workingDays);
        return date.getDate() === lastWorkday;
    }

    /**
     * Calculate working days in a month (excluding weekends)
     */
    calculateWorkingDaysInMonth(year, month) {
        const workingDays = [];
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        
        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(year, month, day);
            const dayOfWeek = date.getDay();
            
            // Exclude weekends (0 = Sunday, 6 = Saturday)
            if (dayOfWeek !== 0 && dayOfWeek !== 6) {
                workingDays.push(day);
            }
        }
        
        return workingDays;
    }
    
    /**
     * Check if date is the nth weekday of the month
     */
    isNthWeekday(date, n) {
        const year = date.getFullYear();
        const month = date.getMonth();
        const workingDays = this.calculateWorkingDaysInMonth(year, month);
        
        // n is 1-based (第1个工作日, 第2个工作日, etc.)
        if (n > 0 && n <= workingDays.length) {
            return date.getDate() === workingDays[n - 1];
        }
        
        return false;
    }

    /**
     * Batch processing for multiple rules
     */
    async batchCalculateExecutions(rules, fromDate = new Date(), days = 30) {
        logger.info('Starting batch execution calculation', {
            rulesCount: rules.length,
            fromDate: fromDate.toISOString(),
            days
        });

        const results = [];
        const batches = this.chunkArray(rules, this.BATCH_SIZE);
        
        for (const batch of batches) {
            const batchPromises = batch.map(rule => 
                this.calculateNextExecution(rule, fromDate, days)
                    .catch(error => {
                        logger.error('Batch calculation error', {
                            ruleId: rule.id,
                            error: error.message
                        });
                        return [];
                    })
            );
            
            const batchResults = await Promise.all(batchPromises);
            results.push(...batchResults);
        }
        
        const totalExecutions = results.reduce((sum, executions) => sum + executions.length, 0);
        logger.info('Batch execution calculation completed', {
            rulesCount: rules.length,
            totalExecutions
        });

        return results;
    }

    /**
     * Pre-compute executions for caching optimization
     */
    async precomputeExecutions(rules, days = this.CACHE_PRECOMPUTE_DAYS) {
        logger.info('Starting execution pre-computation', {
            rulesCount: rules.length,
            days
        });

        const fromDate = new Date();
        const promises = rules.map(rule => {
            const month = fromDate.getMonth() + 1;
            const year = fromDate.getFullYear();
            
            return this.calculateNextExecution(rule, fromDate, days)
                .then(executions => {
                    // Cache by month for efficient retrieval
                    return enhancedCache.setRuleCalculation(rule.id, month, year, executions);
                })
                .catch(error => {
                    logger.error('Pre-computation error', {
                        ruleId: rule.id,
                        error: error.message
                    });
                    return false;
                });
        });

        await Promise.allSettled(promises);
        logger.info('Execution pre-computation completed');
    }

    /**
     * Validate rule complexity to prevent performance issues
     */
    validateRuleComplexity(rule) {
        const complexityScore = this.calculateComplexityScore(rule);
        const MAX_COMPLEXITY = 100;
        
        if (complexityScore > MAX_COMPLEXITY) {
            return {
                valid: false,
                score: complexityScore,
                message: `Rule complexity score (${complexityScore}) exceeds maximum allowed (${MAX_COMPLEXITY})`
            };
        }
        
        return {
            valid: true,
            score: complexityScore
        };
    }

    /**
     * Calculate complexity score for a rule
     */
    calculateComplexityScore(rule) {
        let score = 10; // Base score
        
        // Add complexity based on rule type
        switch (rule.ruleType) {
            case 'by_day':
                score += 20;
                if (rule.dayMode?.mode === 'last_workday') score += 15;
                break;
            case 'by_week':
                score += 15;
                break;
            case 'by_interval':
                score += 25;
                if (rule.intervalConfig?.unit === 'months') score += 10;
                break;
        }
        
        // Add complexity for execution times
        score += (rule.executionTimes?.length || 0) * 5;
        
        // Add complexity for month filtering
        if (rule.months && rule.months.length < 12) {
            score += 10;
        }
        
        return score;
    }

    /**
     * Cache management methods
     */
    generateCacheKey(rule, fromDate, days) {
        const dateStr = fromDate.toISOString().split('T')[0];
        return `rule_calc:${rule.id}:${dateStr}:${days}`;
    }

    async getCachedCalculation(cacheKey) {
        try {
            return await enhancedCache.cache.get(cacheKey);
        } catch (error) {
            logger.warn('Cache retrieval failed', { cacheKey, error: error.message });
            return null;
        }
    }

    async cacheCalculation(cacheKey, executions) {
        try {
            await enhancedCache.cache.set(cacheKey, executions, 3600); // 1 hour TTL
            return true;
        } catch (error) {
            logger.warn('Cache storage failed', { cacheKey, error: error.message });
            return false;
        }
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

    /**
     * Get engine statistics
     */
    getStats() {
        return {
            ...this.stats,
            cacheHitRate: this.stats.cacheHits + this.stats.cacheMisses > 0 ? 
                (this.stats.cacheHits / (this.stats.cacheHits + this.stats.cacheMisses) * 100).toFixed(2) + '%' : '0%',
            workingDaysCacheSize: this.workingDaysCache.size
        };
    }

    /**
     * Reset statistics
     */
    resetStats() {
        this.stats = {
            rulesProcessed: 0,
            calculationsPerformed: 0,
            cacheHits: 0,
            cacheMisses: 0,
            errors: 0
        };
        
        logger.info('Schedule engine statistics reset');
    }

    /**
     * Clear working days cache
     */
    clearCache() {
        this.workingDaysCache.clear();
        logger.info('Working days cache cleared');
    }
}

// Create singleton instance
const advancedScheduleEngine = new AdvancedScheduleEngine();

module.exports = {
    AdvancedScheduleEngine,
    advancedScheduleEngine
};