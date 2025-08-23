/**
 * ScheduleRule Domain Model - DDD Value Object
 * Represents complex scheduling rules with multiple execution patterns
 * Supports byDay, byWeek, and byInterval scheduling modes
 */

const logger = require('../utils/logger');

class ScheduleRule {
    constructor(data = {}) {
        this.id = data.id || null;
        this.taskId = data.task_id || null;
        this.ruleType = data.rule_type || 'by_day';
        
        // Time configurations
        this.months = data.months || null; // [1,2,3...12] for month selection
        
        // 修复：处理dayMode可能是字符串的情况（从数据库读取）
        if (typeof data.day_mode === 'string') {
            try {
                this.dayMode = JSON.parse(data.day_mode);
            } catch (e) {
                this.dayMode = null;
            }
        } else {
            this.dayMode = data.day_mode || null;
        }
        
        // 修复：处理intervalConfig可能是字符串的情况
        if (typeof data.interval_config === 'string') {
            try {
                this.intervalConfig = JSON.parse(data.interval_config);
            } catch (e) {
                this.intervalConfig = null;
            }
        } else {
            this.intervalConfig = data.interval_config || null;
        }
        this.referenceDate = data.reference_date ? new Date(data.reference_date) : null;
        this.specificDates = data.specific_dates || null; // 特定日期数组 ['2024-01-01', '2024-12-25']
        
        // Execution times - array of TIME values
        this.executionTimes = Array.isArray(data.execution_times) ? data.execution_times : [];
        
        // Metadata
        this.createdAt = data.created_at ? new Date(data.created_at) : new Date();
        this.updatedAt = data.updated_at ? new Date(data.updated_at) : new Date();
    }

    /**
     * Validation methods
     */
    validate() {
        const errors = [];
        
        // Rule type validation - 支持所有增强版调度类型
        const validRuleTypes = [
            'by_day', 'daily',           // 每日
            'by_week', 'weekly',          // 每周
            'by_month', 'monthly',        // 每月
            'by_year', 'yearly',          // 每年
            'by_interval', 'interval',    // 间隔
            'specific_date',              // 特定日期
            'custom'                      // 自定义
        ];
        if (!validRuleTypes.includes(this.ruleType)) {
            errors.push(`Rule type must be one of: ${validRuleTypes.join(', ')}`);
        }
        
        // Execution times validation
        // 如果executionTimes为空数组，可能是工作表模式（从文件读取时间）
        // 这里只警告，不报错，让后续逻辑处理
        if (!Array.isArray(this.executionTimes)) {
            errors.push('Execution times must be an array');
        } else if (this.executionTimes.length === 0) {
            // 允许空数组，可能是工作表模式
            logger.debug('Empty execution times array - might be worksheet mode');
        }
        
        // Validate time format (HH:MM:SS or HH:MM)
        this.executionTimes.forEach((time, index) => {
            if (!this.isValidTimeFormat(time)) {
                errors.push(`Invalid time format at index ${index}: ${time}`);
            }
        });
        
        // Months validation (用于月度和年度任务)
        if (this.months !== null) {
            if (!Array.isArray(this.months) || this.months.length === 0) {
                errors.push('Months must be a non-empty array when specified');
            } else {
                const invalidMonths = this.months.filter(month => month < 1 || month > 12);
                if (invalidMonths.length > 0) {
                    errors.push(`Invalid months: ${invalidMonths.join(', ')}`);
                }
            }
        }
        
        // Rule type specific validations
        switch(this.ruleType) {
            case 'by_day':
            case 'daily':
                errors.push(...this.validateByDayConfig());
                break;
            case 'by_week':
            case 'weekly':
                errors.push(...this.validateByWeekConfig());
                break;
            case 'by_month':
            case 'monthly':
                errors.push(...this.validateByMonthConfig());
                break;
            case 'by_year':
            case 'yearly':
                errors.push(...this.validateByYearConfig());
                break;
            case 'by_interval':
            case 'interval':
                errors.push(...this.validateByIntervalConfig());
                break;
            case 'specific_date':
                errors.push(...this.validateSpecificDateConfig());
                break;
        }
        
        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * Validate time format (HH:MM or HH:MM:SS)
     */
    isValidTimeFormat(timeString) {
        const timeRegex = /^([0-1]?[0-9]|2[0-3]):([0-5][0-9])(:([0-5][0-9]))?$/;
        return timeRegex.test(timeString);
    }

    /**
     * Validate by_day configuration
     */
    validateByDayConfig() {
        const errors = [];
        
        if (!this.dayMode) {
            errors.push('Day mode configuration is required for by_day rule type');
            return errors;
        }
        
        // 支持多种格式
        // 1. everyDay格式: { everyDay: true }
        if (this.dayMode.everyDay === true) {
            return errors; // 有效
        }
        
        // 2. type格式: { type: 'every_day' } 或 { type: 'specific_days', days: [...] }
        if (this.dayMode.type) {
            const validTypes = ['every_day', 'specific_days', 'last_day', 'last_workday', 'nth_weekday'];
            if (!validTypes.includes(this.dayMode.type)) {
                errors.push(`Day type must be one of: ${validTypes.join(', ')}`);
            }
            
            if (this.dayMode.type === 'specific_days' && this.dayMode.days) {
                const invalidDays = this.dayMode.days.filter(day => day < 1 || day > 31);
                if (invalidDays.length > 0) {
                    errors.push(`Invalid days: ${invalidDays.join(', ')}`);
                }
            }
            
            if (this.dayMode.type === 'nth_weekday' && !this.dayMode.nthWeekday) {
                errors.push('nth_weekday type requires nthWeekday field');
            }
            
            return errors;
        }
        
        // 3. 原有的mode格式: { mode: 'specific_days', values: [...] }
        const { mode, values } = this.dayMode;
        if (mode) {
            const validModes = ['specific_days', 'last_day', 'last_workday'];
            
            if (!validModes.includes(mode)) {
                errors.push(`Day mode must be one of: ${validModes.join(', ')}`);
            }
            
            if (mode === 'specific_days') {
                if (!Array.isArray(values) || values.length === 0) {
                    errors.push('Specific days must be provided as non-empty array');
                } else {
                    const invalidDays = values.filter(day => day < 1 || day > 31);
                    if (invalidDays.length > 0) {
                        errors.push(`Invalid days: ${invalidDays.join(', ')}`);
                    }
                }
            }
            
            return errors;
        }
        
        // 如果没有匹配任何格式，报错
        errors.push('Invalid day mode configuration format');
        return errors;
    }

    /**
     * Validate by_week configuration
     */
    validateByWeekConfig() {
        const errors = [];
        
        if (!this.dayMode) {
            // by_week 可以没有dayMode，如果有weekMode的话
            if (!this.weekMode) {
                errors.push('Day mode or week mode configuration is required for by_week rule type');
            }
            return errors;
        }
        
        // 支持多种格式：
        // 1. weekMode格式（来自测试脚本）: {weekdays: [1,2,3,4,5], occurrence: 'every'}
        if (this.dayMode.weekdays !== undefined && this.dayMode.occurrence !== undefined) {
            const weekdays = this.dayMode.weekdays;
            if (!Array.isArray(weekdays) || weekdays.length === 0) {
                errors.push('Weekdays must be a non-empty array');
            } else {
                const invalidWeekdays = weekdays.filter(day => day < 1 || day > 7);
                if (invalidWeekdays.length > 0) {
                    errors.push(`Invalid weekdays (1=Monday...7=Sunday): ${invalidWeekdays.join(', ')}`);
                }
            }
            return errors;
        }
        
        // 2. 直接weekDays数组：{weekDays: [1,2,3,4,5]}
        if (this.dayMode.weekDays !== undefined) {
            // 格式1：直接使用weekDays数组
            const weekDays = this.dayMode.weekDays;
            if (!Array.isArray(weekDays) || weekDays.length === 0) {
                errors.push('Week days must be a non-empty array');
            } else {
                const invalidWeekdays = weekDays.filter(day => day < 0 || day > 6);
                if (invalidWeekdays.length > 0) {
                    errors.push(`Invalid weekdays (0=Sunday, 1=Monday...6=Saturday): ${invalidWeekdays.join(', ')}`);
                }
            }
            return errors;
        }
        
        // 格式2：使用mode和values
        const { mode, values } = this.dayMode;
        const validModes = ['weekdays', 'specific_weekdays'];
        
        if (mode && !validModes.includes(mode)) {
            errors.push(`Week mode must be one of: ${validModes.join(', ')}`);
        }
        
        if (mode === 'specific_weekdays') {
            if (!Array.isArray(values) || values.length === 0) {
                errors.push('Specific weekdays must be provided as non-empty array');
            } else {
                const invalidWeekdays = values.filter(day => day < 0 || day > 6);
                if (invalidWeekdays.length > 0) {
                    errors.push(`Invalid weekdays (0-6): ${invalidWeekdays.join(', ')}`);
                }
            }
        } else if (mode === 'weekdays') {
            // Weekdays mode (Monday-Friday) doesn't need values
            if (values !== undefined && values !== null) {
                errors.push('Weekdays mode should not have values specified');
            }
        }
        
        return errors;
    }

    /**
     * Validate by_interval configuration
     */
    validateByIntervalConfig() {
        const errors = [];
        
        if (!this.intervalConfig) {
            errors.push('Interval configuration is required for by_interval rule type');
            return errors;
        }
        
        const { interval, unit } = this.intervalConfig;
        // 增加支持小时和分钟单位
        const validUnits = ['minutes', 'hours', 'days', 'weeks', 'months', 'years'];
        
        if (!Number.isInteger(interval) || interval <= 0) {
            errors.push('Interval must be a positive integer');
        }
        
        if (!validUnits.includes(unit)) {
            errors.push(`Interval unit must be one of: ${validUnits.join(', ')}`);
        }
        
        if (this.ruleType === 'by_interval' && !this.referenceDate) {
            errors.push('Reference date is required for by_interval rule type');
        }
        
        return errors;
    }

    /**
     * Validate by_month configuration
     */
    validateByMonthConfig() {
        const errors = [];
        
        if (!this.dayMode) {
            // 允许不指定，默认每月1号
            return errors;
        }
        
        // 兼容多种格式：
        // 1. 简单格式：{dayOfMonth: 15}
        // 2. 完整格式：{mode: 'specific_days', values: [15]}
        // 3. 新增格式：{type: 'specific_days', days: [15]}
        // 4. 新增格式：{type: 'specific_weekdays', weekdays: [1, 3]}
        
        if (this.dayMode.dayOfMonth !== undefined) {
            // 简单格式验证
            const day = this.dayMode.dayOfMonth;
            if (!Number.isInteger(day) || day < 1 || day > 31) {
                errors.push('Day of month must be between 1 and 31');
            }
        } else if (this.dayMode.mode) {
            // 完整格式验证
            const { mode, values } = this.dayMode;
            const validModes = ['specific_days', 'last_day', 'first_workday', 'last_workday'];
            
            if (!validModes.includes(mode)) {
                errors.push(`Month day mode must be one of: ${validModes.join(', ')}`);
            }
            
            if (mode === 'specific_days') {
                if (!Array.isArray(values) || values.length === 0) {
                    errors.push('Specific days must be provided for monthly schedule');
                } else {
                    // 支持负数表示倒数第几天，-1表示月末
                    const invalidDays = values.filter(day => {
                        if (day < 0) {
                            // 负数表示倒数第几天，支持-1到-31
                            return day < -31;
                        } else {
                            // 正数表示正数第几天，1-31
                            return day < 1 || day > 31;
                        }
                    });
                    if (invalidDays.length > 0) {
                        errors.push(`Invalid month days: ${invalidDays.join(', ')} (use 1-31 for normal days, -1 for last day, -2 for second to last, etc.)`);
                    }
                }
            }
        } else if (this.dayMode.type) {
            // 新增格式验证（从前端传来的格式）
            const { type, days, weekdays } = this.dayMode;
            const validTypes = ['specific_days', 'specific_weekdays', 'last_day', 'first_workday', 'last_workday'];
            
            if (!validTypes.includes(type)) {
                errors.push(`Month day type must be one of: ${validTypes.join(', ')}`);
            }
            
            if (type === 'specific_days') {
                if (!Array.isArray(days) || days.length === 0) {
                    errors.push('Specific days must be provided for monthly schedule');
                } else {
                    const invalidDays = days.filter(day => {
                        if (typeof day === 'string' && day === 'last') {
                            return false; // 'last' is valid
                        }
                        if (day < 0) {
                            return day < -31;
                        } else {
                            return day < 1 || day > 31;
                        }
                    });
                    if (invalidDays.length > 0) {
                        errors.push(`Invalid month days: ${invalidDays.join(', ')}`);
                    }
                }
            } else if (type === 'specific_weekdays') {
                if (!Array.isArray(weekdays) || weekdays.length === 0) {
                    errors.push('Specific weekdays must be provided for monthly weekday schedule');
                } else {
                    const invalidWeekdays = weekdays.filter(day => day < 0 || day > 6);
                    if (invalidWeekdays.length > 0) {
                        errors.push(`Invalid weekdays (0=Sunday, 1=Monday...6=Saturday): ${invalidWeekdays.join(', ')}`);
                    }
                }
            }
        } else {
            // 如果没有mode字段但也没有dayOfMonth，则报错
            errors.push('Monthly configuration must specify either dayOfMonth, mode, or type');
        }
        
        return errors;
    }

    /**
     * Validate by_year configuration
     */
    validateByYearConfig() {
        const errors = [];
        
        // 年度任务需要指定月份
        if (!this.months || this.months.length === 0) {
            errors.push('Months must be specified for yearly schedule');
        }
        
        // 需要指定日期
        if (!this.dayMode) {
            errors.push('Day configuration is required for yearly schedule');
        } else {
            const { mode, values } = this.dayMode;
            if (mode === 'specific_days' && (!values || values.length === 0)) {
                errors.push('Specific days must be provided for yearly schedule');
            }
        }
        
        return errors;
    }

    /**
     * Validate specific_date configuration
     */
    validateSpecificDateConfig() {
        const errors = [];
        
        // 支持两种格式：
        // 1. specificDates数组
        // 2. dayMode.dates数组
        let datesToValidate = this.specificDates;
        
        if (!datesToValidate && this.dayMode && this.dayMode.dates) {
            datesToValidate = this.dayMode.dates;
        }
        
        if (!datesToValidate || !Array.isArray(datesToValidate) || datesToValidate.length === 0) {
            errors.push('Specific dates must be provided for specific_date rule type');
        } else {
            // 验证日期格式
            datesToValidate.forEach((date, index) => {
                if (!this.isValidDateFormat(date)) {
                    errors.push(`Invalid date format at index ${index}: ${date}. Use YYYY-MM-DD`);
                }
            });
        }
        
        return errors;
    }

    /**
     * Validate date format (YYYY-MM-DD)
     */
    isValidDateFormat(dateString) {
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(dateString)) {
            return false;
        }
        const date = new Date(dateString);
        return date instanceof Date && !isNaN(date);
    }

    /**
     * Check if rule applies to a specific date
     */
    appliesTo(date, currentDate = new Date()) {
        const targetDate = new Date(date);
        
        // Check if month is included (if months filter is set)
        if (this.months && this.months.length > 0) {
            const month = targetDate.getMonth() + 1;
            if (!this.months.includes(month)) {
                return false;
            }
        }
        
        // Check rule type specific conditions
        switch (this.ruleType) {
            case 'by_day':
            case 'daily':
                return this.appliesToByDay(targetDate);
            case 'by_week':
            case 'weekly':
                return this.appliesToByWeek(targetDate);
            case 'by_interval':
            case 'interval':
                return this.appliesToByInterval(targetDate);
            case 'monthly':
                return this.appliesToMonthly(targetDate);
            case 'yearly':
                return this.appliesToYearly(targetDate);
            case 'custom':
                return this.appliesToCustom(targetDate);
            default:
                return false;
        }
    }

    /**
     * Check if by_day rule applies to date
     */
    appliesToByDay(date) {
        // 如果没有dayMode，对于by_day规则，默认为每天执行
        if (!this.dayMode) {
            return true; // 每天都执行
        }
        
        // 如果dayMode是字符串，尝试解析为JSON
        let dayModeObj = this.dayMode;
        if (typeof this.dayMode === 'string') {
            try {
                dayModeObj = JSON.parse(this.dayMode);
            } catch (e) {
                // 如果解析失败，默认为每天执行
                return true;
            }
        }
        
        // 处理type格式的dayMode
        if (dayModeObj.type === 'every_day') {
            return true; // 每天都执行
        }
        
        const { mode, values } = dayModeObj;
        const dayOfMonth = date.getDate();
        const year = date.getFullYear();
        const month = date.getMonth();
        
        switch (mode) {
            case 'specific_days':
                return values && values.includes(dayOfMonth);
                
            case 'last_day':
                // Check if it's the last day of the month
                const nextMonth = new Date(year, month + 1, 0);
                return dayOfMonth === nextMonth.getDate();
                
            case 'last_workday':
                // Find the last workday of the month
                const lastDay = new Date(year, month + 1, 0);
                let lastWorkday = lastDay;
                
                while (lastWorkday.getDay() === 0 || lastWorkday.getDay() === 6) {
                    lastWorkday.setDate(lastWorkday.getDate() - 1);
                }
                
                return dayOfMonth === lastWorkday.getDate();
                
            default:
                // 默认为每天执行
                return true;
        }
    }

    /**
     * Check if by_week rule applies to date
     */
    appliesToByWeek(date) {
        if (!this.dayMode) return false;
        
        const { mode, values } = this.dayMode;
        const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, etc.
        
        switch (mode) {
            case 'weekdays':
                // Monday to Friday (1-5)
                return dayOfWeek >= 1 && dayOfWeek <= 5;
                
            case 'specific_weekdays':
                return values && values.includes(dayOfWeek);
                
            default:
                return false;
        }
    }

    /**
     * Check if by_interval rule applies to date
     */
    appliesToByInterval(date) {
        if (!this.intervalConfig || !this.referenceDate) return false;
        
        const { interval, unit } = this.intervalConfig;
        const targetDate = new Date(date);
        const refDate = new Date(this.referenceDate);
        
        // Calculate the difference based on unit
        let diffInUnits;
        
        switch (unit) {
            case 'days':
                const diffTime = targetDate.getTime() - refDate.getTime();
                diffInUnits = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                break;
                
            case 'weeks':
                const diffTimeWeeks = targetDate.getTime() - refDate.getTime();
                diffInUnits = Math.floor(diffTimeWeeks / (1000 * 60 * 60 * 24 * 7));
                break;
                
            case 'months':
                diffInUnits = (targetDate.getFullYear() - refDate.getFullYear()) * 12 + 
                             (targetDate.getMonth() - refDate.getMonth());
                break;
                
            default:
                return false;
        }
        
        // Check if the difference is divisible by the interval
        return diffInUnits >= 0 && diffInUnits % interval === 0;
    }

    /**
     * Generate execution times for a specific date
     */
    getExecutionTimes(date) {
        if (!this.appliesTo(date)) {
            return [];
        }
        
        return this.executionTimes.map(time => {
            const [hours, minutes, seconds = '00'] = time.split(':');
            const executionDate = new Date(date);
            executionDate.setHours(parseInt(hours), parseInt(minutes), parseInt(seconds), 0);
            return executionDate;
        });
    }

    /**
     * Get next execution date after given date
     */
    getNextExecution(afterDate = new Date()) {
        const startDate = new Date(afterDate);
        startDate.setDate(startDate.getDate() + 1); // Start from tomorrow
        
        // Look ahead for next applicable date (max 1 year)
        const maxDate = new Date(startDate);
        maxDate.setFullYear(maxDate.getFullYear() + 1);
        
        let currentDate = new Date(startDate);
        
        while (currentDate <= maxDate) {
            if (this.appliesTo(currentDate)) {
                const execTimes = this.getExecutionTimes(currentDate);
                if (execTimes.length > 0) {
                    return {
                        date: new Date(currentDate),
                        executionTimes: execTimes
                    };
                }
            }
            
            currentDate.setDate(currentDate.getDate() + 1);
        }
        
        return null;
    }

    /**
     * Get description of the rule for UI display
     */
    getDescription() {
        let description = '';
        
        switch (this.ruleType) {
            case 'by_day':
                description = this.getByDayDescription();
                break;
            case 'by_week':
                description = this.getByWeekDescription();
                break;
            case 'by_interval':
                description = this.getByIntervalDescription();
                break;
        }
        
        // Add execution times
        const timesStr = this.executionTimes.join(', ');
        description += ` at ${timesStr}`;
        
        // Add months filter if applicable
        if (this.months && this.months.length < 12) {
            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                               'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const monthsStr = this.months.map(m => monthNames[m - 1]).join(', ');
            description += ` (only in ${monthsStr})`;
        }
        
        return description;
    }

    getByDayDescription() {
        if (!this.dayMode) return 'Invalid day configuration';
        
        const { mode, values } = this.dayMode;
        
        switch (mode) {
            case 'specific_days':
                const daysStr = values ? values.join(', ') : 'none';
                return `On days ${daysStr} of each month`;
            case 'last_day':
                return 'On the last day of each month';
            case 'last_workday':
                return 'On the last workday of each month';
            default:
                return 'Invalid day mode';
        }
    }

    getByWeekDescription() {
        if (!this.dayMode) return 'Invalid week configuration';
        
        const { mode, values } = this.dayMode;
        const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        
        switch (mode) {
            case 'weekdays':
                return 'On weekdays (Monday-Friday)';
            case 'specific_weekdays':
                const daysStr = values ? values.map(d => weekDays[d]).join(', ') : 'none';
                return `On ${daysStr}`;
            default:
                return 'Invalid week mode';
        }
    }

    getByIntervalDescription() {
        if (!this.intervalConfig) return 'Invalid interval configuration';
        
        const { interval, unit } = this.intervalConfig;
        const unitStr = interval === 1 ? unit.slice(0, -1) : unit;
        
        return `Every ${interval} ${unitStr}`;
    }

    /**
     * Convert to plain object for storage
     */
    toPlainObject() {
        return {
            id: this.id,
            task_id: this.taskId,
            rule_type: this.ruleType,
            months: this.months,
            day_mode: this.dayMode,
            interval_config: this.intervalConfig,
            reference_date: this.referenceDate,
            execution_times: this.executionTimes,
            created_at: this.createdAt,
            updated_at: this.updatedAt
        };
    }

    /**
     * Create from plain object
     */
    static fromPlainObject(data) {
        return new ScheduleRule(data);
    }

    /**
     * Clone schedule rule
     */
    clone() {
        return ScheduleRule.fromPlainObject(this.toPlainObject());
    }


    /**
     * Check if monthly rule applies to date
     */
    appliesToMonthly(date) {
        // For monthly rules, check if this is the correct day of the month
        if (!this.dayMode) {
            return date.getDate() === 1; // Default to first of month
        }
        
        let dayModeObj = this.dayMode;
        if (typeof this.dayMode === 'string') {
            try {
                dayModeObj = JSON.parse(this.dayMode);
            } catch (e) {
                return date.getDate() === 1; // Default fallback
            }
        }
        
        // 处理 specific_days 模式（工作表任务常用）
        if (dayModeObj.mode === 'specific_days' && dayModeObj.values) {
            const dayOfMonth = date.getDate();
            return dayModeObj.values.includes(dayOfMonth);
        }
        
        // 处理简单的 day 字段
        if (dayModeObj.day) {
            return date.getDate() === dayModeObj.day;
        }
        
        return date.getDate() === 1; // Default to first of month
    }

    /**
     * Check if yearly rule applies to date
     */
    appliesToYearly(date) {
        // For yearly rules, check if this is the correct month and day
        if (!this.dayMode) {
            return date.getMonth() === 0 && date.getDate() === 1; // Default to New Year
        }
        
        let dayModeObj = this.dayMode;
        if (typeof this.dayMode === 'string') {
            try {
                dayModeObj = JSON.parse(this.dayMode);
            } catch (e) {
                return date.getMonth() === 0 && date.getDate() === 1; // Default fallback
            }
        }
        
        if (dayModeObj.month && dayModeObj.day) {
            return date.getMonth() + 1 === dayModeObj.month && date.getDate() === dayModeObj.day;
        }
        
        return date.getMonth() === 0 && date.getDate() === 1; // Default to New Year
    }

    /**
     * Check if custom rule applies to date
     */
    appliesToCustom(date) {
        // For custom rules, delegate to interval or cron expression logic
        if (this.intervalConfig) {
            return this.appliesToByInterval(date);
        }
        
        // For now, default to false for custom rules without specific implementation
        return false;
    }
}

module.exports = ScheduleRule;