/**
 * Schedule Rule Converter - 调度规则转换器
 * 将复杂的调度规则转换为Cronicle可识别的格式
 * 支持所有REQUIREMENTS.md中定义的调度类型
 */

const logger = require('../utils/logger');
const holidayManager = require('./holidayManager');

class ScheduleRuleConverter {
    constructor() {
        // 规则类型映射
        this.ruleTypes = {
            DAILY: 'daily',
            WEEKLY: 'weekly', 
            MONTHLY: 'monthly',
            YEARLY: 'yearly',
            BY_DAY: 'by_day',
            BY_WEEK: 'by_week',
            BY_MONTH: 'by_month',
            BY_YEAR: 'by_year',
            BY_INTERVAL: 'by_interval',
            BY_QUARTER: 'by_quarter',
            SPECIFIC_DATE: 'specific_date',
            CUSTOM: 'custom'
        };
        
        // 星期映射
        this.weekDayMap = {
            0: 'sunday',
            1: 'monday',
            2: 'tuesday',
            3: 'wednesday',
            4: 'thursday',
            5: 'friday',
            6: 'saturday'
        };
    }
    
    /**
     * 将调度规则转换为Cronicle格式
     * @param {Object} rule - 原始调度规则
     * @returns {Object} Cronicle格式的调度配置
     */
    async convertToCronicle(rule) {
        const { ruleType, ruleConfig } = rule;
        
        logger.debug('转换调度规则为Cronicle格式:', { ruleType, ruleConfig });
        
        try {
            switch (ruleType) {
                case this.ruleTypes.DAILY:
                    return this.convertDaily(ruleConfig);
                    
                case this.ruleTypes.WEEKLY:
                    return this.convertWeekly(ruleConfig);
                    
                case this.ruleTypes.MONTHLY:
                    return this.convertMonthly(ruleConfig);
                    
                case this.ruleTypes.YEARLY:
                    return this.convertYearly(ruleConfig);
                    
                case this.ruleTypes.BY_DAY:
                    return this.convertByDay(ruleConfig);
                    
                case this.ruleTypes.BY_WEEK:
                    return this.convertByWeek(ruleConfig);
                    
                case this.ruleTypes.BY_MONTH:
                    return this.convertByMonth(ruleConfig);
                    
                case this.ruleTypes.BY_INTERVAL:
                    return this.convertByInterval(ruleConfig);
                    
                case this.ruleTypes.BY_QUARTER:
                    return this.convertByQuarter(ruleConfig);
                    
                case this.ruleTypes.SPECIFIC_DATE:
                    return this.convertSpecificDate(ruleConfig);
                    
                case this.ruleTypes.CUSTOM:
                    return this.convertCustom(ruleConfig);
                    
                default:
                    throw new Error(`不支持的规则类型: ${ruleType}`);
            }
        } catch (error) {
            logger.error('规则转换失败:', error);
            throw error;
        }
    }
    
    /**
     * 转换每日规则为Cronicle timing格式
     */
    convertDaily(config) {
        const { time, excludeWeekends, excludeHolidays } = config;
        const [hours, minutes] = time.split(':').map(Number);
        
        const timing = {
            hours: [hours],
            minutes: [minutes]
        };
        
        // 如果排除周末，只在工作日执行
        if (excludeWeekends) {
            timing.weekdays = [1, 2, 3, 4, 5]; // 周一到周五
        }
        
        return {
            type: 'timing',
            timing,
            timezone: 'Asia/Shanghai',
            excludeHolidays: excludeHolidays || false
        };
    }
    
    /**
     * 转换每周规则为Cronicle timing格式
     */
    convertWeekly(config) {
        const { weekdays, days, time } = config;
        const [hours, minutes] = time.split(':').map(Number);
        
        // 兼容两种属性名：weekdays（新）和days（旧）
        const daysArray = weekdays || days || [];
        
        const timing = {
            hours: [hours],
            minutes: [minutes],
            weekdays: daysArray // Cronicle使用0-6表示周日到周六
        };
        
        return {
            type: 'timing',
            timing,
            timezone: 'Asia/Shanghai'
        };
    }
    
    /**
     * 转换每月规则为Cronicle timing格式
     */
    convertMonthly(config) {
        const { dayMode, time, months = [] } = config;
        const [hours, minutes] = time.split(':').map(Number);
        
        const timing = {
            hours: [hours],
            minutes: [minutes]
        };
        
        // 如果指定了月份
        if (months.length > 0) {
            timing.months = months;
        }
        
        // 根据日期模式设置
        switch (dayMode.mode) {
            case 'specific_days':
                // 特定日期
                timing.days = dayMode.values;
                break;
                
            case 'last_day':
                // 每月最后一天
                timing.days = [-1]; // Cronicle用-1表示最后一天
                break;
                
            case 'first_workday':
                // 每月第一个工作日
                timing.days = [1];
                timing.weekdays = [1, 2, 3, 4, 5]; // 限制为工作日
                break;
                
            case 'last_workday':
                // 每月最后一个工作日
                timing.days = [-1];
                timing.weekdays = [1, 2, 3, 4, 5];
                break;
                
            case 'specific_weekdays':
                // 某几个星期几（如每月第二个周一）
                const { weekdays, occurrence } = dayMode;
                timing.weekdays = weekdays;
                timing.weekday_occurrence = occurrence; // 第几个星期
                break;
                
            default:
                // 默认每月1号
                timing.days = [1];
        }
        
        return {
            type: 'timing',
            timing,
            timezone: 'Asia/Shanghai'
        };
    }
    
    /**
     * 转换每年规则为Cronicle timing格式
     */
    convertYearly(config) {
        const { month, day, time } = config;
        const [hours, minutes] = time.split(':').map(Number);
        
        const timing = {
            hours: [hours],
            minutes: [minutes],
            months: [month],
            days: [day]
        };
        
        return {
            type: 'timing',
            timing,
            timezone: 'Asia/Shanghai'
        };
    }
    
    /**
     * 转换按天规则为Cronicle timing格式
     */
    convertByDay(config) {
        const { dayMode = {}, months = [], time, excludeHolidays } = config;
        const executionTime = time || config.executionTime || '09:00';
        const [hours, minutes] = executionTime.split(':').map(Number);
        
        const timing = {
            hours: [hours],
            minutes: [minutes]
        };
        
        // 如果指定了月份
        if (months.length > 0) {
            timing.months = months;
        }
        
        // 根据不同的天模式生成表达式
        const mode = dayMode.type || dayMode.mode || 'daily';
        
        switch (mode) {
            case 'every_n_days':
                // 每N天 - 使用间隔类型
                return {
                    type: 'interval',
                    interval: dayMode.interval * 24 * 60 * 60 * 1000, // 转换为毫秒
                    startDate: dayMode.startDate || new Date(),
                    timezone: 'Asia/Shanghai',
                    excludeHolidays
                };
                
            case 'workdays_only':
                // 仅工作日
                timing.weekdays = [1, 2, 3, 4, 5]; // 周一到周五
                return {
                    type: 'timing',
                    timing,
                    timezone: 'Asia/Shanghai',
                    excludeHolidays: true
                };
                
            case 'specific_days':
            case 'specific_days_of_month':
                // 每月特定几天
                const days = dayMode.days || dayMode.values || [];
                if (days.length > 0) {
                    timing.days = days;
                }
                break;
                
            case 'daily':
            default:
                // 每天执行
                break;
        }
        
        return {
            type: 'timing',
            timing,
            timezone: 'Asia/Shanghai',
            excludeHolidays
        };
    }
    
    /**
     * 转换按周规则为Cronicle timing格式
     */
    convertByWeek(config) {
        const weekData = config.weekConfig || config.weekMode || {};
        const time = config.time || config.executionTime || '09:00';
        const [hours, minutes] = time.split(':').map(Number);
        const months = config.months || [];
        
        const timing = {
            hours: [hours],
            minutes: [minutes]
        };
        
        // 处理星期几数组
        const weekdays = weekData.weekdays || [];
        if (weekdays.length > 0) {
            timing.weekdays = weekdays;
        }
        
        // 如果指定了月份
        if (months.length > 0) {
            timing.months = months;
        }
        
        return {
            type: 'timing',
            timing,
            timezone: 'Asia/Shanghai'
        };
    }
    
    /**
     * 转换按月规则为Cronicle timing格式
     */
    convertByMonth(config) {
        const { months, dayMode, time } = config;
        
        // 复用convertMonthly逻辑
        return this.convertMonthly({
            months,
            dayMode,
            time
        });
    }
    
    /**
     * 转换间隔规则为Cronicle格式
     */
    convertByInterval(config) {
        const intervalData = config.intervalMode || config;
        const { interval, value, unit, startDate, referenceDate } = intervalData;
        const actualInterval = interval || value || 1;
        const actualStartDate = startDate || referenceDate || new Date();
        
        let intervalMs;
        
        // 转换单位为毫秒
        switch (unit) {
            case 'minutes':
                intervalMs = actualInterval * 60 * 1000;
                break;
            case 'hours':
                intervalMs = actualInterval * 60 * 60 * 1000;
                break;
            case 'days':
                intervalMs = actualInterval * 24 * 60 * 60 * 1000;
                break;
            case 'weeks':
                intervalMs = actualInterval * 7 * 24 * 60 * 60 * 1000;
                break;
            case 'months':
                // 月份需要特殊处理，因为月份天数不同
                // 使用平均值30.44天
                intervalMs = actualInterval * 30.44 * 24 * 60 * 60 * 1000;
                break;
            case 'years':
                // 年使用365.25天（考虑闰年）
                intervalMs = actualInterval * 365.25 * 24 * 60 * 60 * 1000;
                break;
            default:
                throw new Error(`不支持的间隔单位: ${unit}`);
        }
        
        return {
            type: 'interval',
            interval: intervalMs,
            startDate: actualStartDate,
            timezone: 'Asia/Shanghai'
        };
    }
    
    /**
     * 转换季度规则为Cronicle timing格式
     */
    convertByQuarter(config) {
        const { quarters, dayMode, time } = config;
        const [hours, minutes] = time.split(':').map(Number);
        
        // 将季度转换为月份
        const monthsByQuarter = {
            1: [1, 2, 3],
            2: [4, 5, 6],
            3: [7, 8, 9],
            4: [10, 11, 12]
        };
        
        const months = [];
        for (const quarter of quarters) {
            months.push(...monthsByQuarter[quarter]);
        }
        
        const timing = {
            hours: [hours],
            minutes: [minutes],
            months
        };
        
        // 处理日期模式
        if (dayMode) {
            switch (dayMode.mode) {
                case 'first_day':
                    timing.days = [1];
                    break;
                case 'last_day':
                    timing.days = [-1];
                    break;
                case 'specific_day':
                    timing.days = [dayMode.day];
                    break;
                case 'first_workday':
                    timing.days = [1];
                    timing.weekdays = [1, 2, 3, 4, 5];
                    break;
            }
        } else {
            timing.days = [1]; // 默认每月1号
        }
        
        return {
            type: 'timing',
            timing,
            timezone: 'Asia/Shanghai',
            quarters // 保留季度信息供后续使用
        };
    }
    
    /**
     * 转换特定日期规则为Cronicle格式
     */
    convertSpecificDate(config) {
        const { dates, time } = config;
        const [hours, minutes] = time.split(':').map(Number);
        
        // 对于特定日期，创建一次性任务
        const scheduleTimes = dates.map(date => {
            const scheduleDate = new Date(date);
            scheduleDate.setHours(hours, minutes, 0, 0);
            return scheduleDate;
        });
        
        return {
            type: 'once',
            dates: scheduleTimes,
            timezone: 'Asia/Shanghai'
        };
    }
    
    /**
     * 转换自定义规则
     */
    convertCustom(config) {
        // 自定义规则可能需要特殊处理
        return {
            type: 'custom',
            handler: config.handler || 'defaultCustomHandler',
            config: {
                ...config,
                timezone: 'Asia/Shanghai'
            }
        };
    }
    
    /**
     * 生成人类可读的调度描述
     */
    generateDescription(rule) {
        const { ruleType, ruleConfig } = rule;
        
        let description = '';
        
        switch (ruleType) {
            case this.ruleTypes.DAILY:
                description = `每天 ${ruleConfig.time}`;
                if (ruleConfig.excludeWeekends) {
                    description += ' (排除周末)';
                }
                if (ruleConfig.excludeHolidays) {
                    description += ' (排除节假日)';
                }
                break;
                
            case this.ruleTypes.WEEKLY:
                const daysArray = ruleConfig.weekdays || ruleConfig.days || [];
                const weekDays = daysArray.map(d => this.weekDayMap[d]).join('、');
                description = `每周 ${weekDays} ${ruleConfig.time}`;
                break;
                
            case this.ruleTypes.MONTHLY:
                if (ruleConfig.dayMode.mode === 'last_day') {
                    description = `每月最后一天 ${ruleConfig.time}`;
                } else if (ruleConfig.dayMode.mode === 'specific_days') {
                    description = `每月 ${ruleConfig.dayMode.values.join('、')} 号 ${ruleConfig.time}`;
                }
                break;
                
            case this.ruleTypes.BY_QUARTER:
                const quarters = ruleConfig.quarters.map(q => `第${q}季度`).join('、');
                description = `${quarters} ${ruleConfig.time}`;
                break;
                
            case this.ruleTypes.BY_INTERVAL:
                description = `每 ${ruleConfig.interval} ${ruleConfig.unit}`;
                break;
                
            default:
                description = `自定义规则 (${ruleType})`;
        }
        
        return description;
    }
    
    /**
     * 批量转换规则
     */
    async batchConvert(rules) {
        const results = [];
        
        for (const rule of rules) {
            try {
                const cronicleConfig = await this.convertToCronicle(rule);
                results.push({
                    success: true,
                    ruleId: rule.id,
                    config: cronicleConfig,
                    description: this.generateDescription(rule)
                });
            } catch (error) {
                results.push({
                    success: false,
                    ruleId: rule.id,
                    error: error.message
                });
            }
        }
        
        return results;
    }

    /**
     * 将调度规则转换为Cronicle的timing格式
     * 这是主要的转换方法，供Cronicle调度器使用
     */
    convertToCronicleTiming(scheduleRule) {
        if (!scheduleRule) return {};
        
        const timing = {};
        const { ruleType, dayMode, weekMode, intervalMode, months, time_point } = scheduleRule;
        
        // 处理时间点
        if (time_point) {
            const [hour, minute] = time_point.split(':').map(Number);
            timing.hours = [hour];
            timing.minutes = [minute];
        }
        
        // 处理月份
        if (months && months.length > 0) {
            timing.months = months;
        }
        
        // 根据规则类型设置timing
        switch (ruleType) {
            case 'daily':
                // 每天执行，timing中只需要时间
                break;
                
            case 'by_day':
                // 按日期执行
                if (dayMode?.days && dayMode.days.length > 0) {
                    timing.days = dayMode.days;
                }
                break;
                
            case 'by_week':
                // 按星期执行
                if (weekMode?.weekdays && weekMode.weekdays.length > 0) {
                    timing.weekdays = weekMode.weekdays;
                }
                break;
                
            case 'by_interval':
                // 间隔执行 - 返回特殊格式
                if (intervalMode) {
                    return {
                        type: 'interval',
                        interval: this.convertIntervalToMs(intervalMode),
                        startDate: intervalMode.startDate || new Date()
                    };
                }
                break;
                
            case 'by_month':
                // 按月执行
                if (dayMode?.days && dayMode.days.length > 0) {
                    timing.days = dayMode.days;
                }
                break;
                
            case 'by_quarter':
                // 按季度执行
                if (scheduleRule.quarters) {
                    const quarterMonths = [];
                    const monthsByQuarter = {
                        1: [1, 2, 3],
                        2: [4, 5, 6],
                        3: [7, 8, 9],
                        4: [10, 11, 12]
                    };
                    for (const quarter of scheduleRule.quarters) {
                        quarterMonths.push(...monthsByQuarter[quarter]);
                    }
                    timing.months = quarterMonths;
                }
                if (dayMode?.day) {
                    timing.days = [dayMode.day];
                }
                break;
        }
        
        return timing;
    }
    
    /**
     * 将间隔配置转换为毫秒
     */
    convertIntervalToMs(intervalMode) {
        if (!intervalMode) return 24 * 60 * 60 * 1000; // 默认一天
        
        const { value, unit } = intervalMode;
        const interval = value || intervalMode.interval || 1;
        
        switch (unit) {
            case 'minutes':
                return interval * 60 * 1000;
            case 'hours':
                return interval * 60 * 60 * 1000;
            case 'day':
            case 'days':
                return interval * 24 * 60 * 60 * 1000;
            case 'week':
            case 'weeks':
                return interval * 7 * 24 * 60 * 60 * 1000;
            case 'month':
            case 'months':
                return interval * 30.44 * 24 * 60 * 60 * 1000;
            case 'year':
            case 'years':
                return interval * 365.25 * 24 * 60 * 60 * 1000;
            default:
                return 24 * 60 * 60 * 1000; // 默认一天
        }
    }
    
    // 保留向后兼容的方法名
    async convertToAgenda(rule) {
        logger.warn('convertToAgenda已废弃，请使用convertToCronicle');
        return this.convertToCronicle(rule);
    }
}

// 导出单例
module.exports = new ScheduleRuleConverter();