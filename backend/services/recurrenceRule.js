/**
 * 重复规则解析器
 * 支持中文自然语言格式的重复规则解析和处理
 * 使用北京时区，不支持多时区
 */

const { beijingTime, formatDate, formatTime } = require('../utils/timeUtils');
const logger = require('../utils/logger');

class RecurrenceRule {
    constructor() {
        // 星期映射
        this.weekdayMap = {
            '周一': 1, '周二': 2, '周三': 3, '周四': 4, '周五': 5, '周六': 6, '周日': 7,
            '星期一': 1, '星期二': 2, '星期三': 3, '星期四': 4, '星期五': 5, '星期六': 6, '星期日': 7,
            '礼拜一': 1, '礼拜二': 2, '礼拜三': 3, '礼拜四': 4, '礼拜五': 5, '礼拜六': 6, '礼拜日': 7
        };

        // 反向星期映射
        this.reverseWeekdayMap = {
            1: '周一', 2: '周二', 3: '周三', 4: '周四', 5: '周五', 6: '周六', 7: '周日'
        };

        // 月份映射
        this.monthMap = {
            '1月': 1, '2月': 2, '3月': 3, '4月': 4, '5月': 5, '6月': 6,
            '7月': 7, '8月': 8, '9月': 9, '10月': 10, '11月': 11, '12月': 12
        };
    }

    /**
     * 解析重复规则字符串
     * @param {string} ruleString - 规则字符串，如"每年1月1日", "每2周周一", "每3日"
     * @returns {Object} 解析结果
     */
    parseRule(ruleString) {
        if (!ruleString || typeof ruleString !== 'string') {
            return { isValid: false, error: '重复规则不能为空' };
        }

        const rule = ruleString.trim();
        
        try {
            // 每年X月Y日 - 如"每年1月1日", "每年2月28日"
            const yearlyMatch = rule.match(/^每年(\d{1,2})月(\d{1,2})日$/);
            if (yearlyMatch) {
                const month = parseInt(yearlyMatch[1]);
                const day = parseInt(yearlyMatch[2]);
                return this.validateYearlyRule(month, day, rule);
            }

            // 每X个月Y日 - 如"每1个月1日", "每3个月15日"  
            const monthlyMatch = rule.match(/^每(\d+)个月(\d{1,2})日$/);
            if (monthlyMatch) {
                const interval = parseInt(monthlyMatch[1]);
                const day = parseInt(monthlyMatch[2]);
                return this.validateMonthlyRule(interval, day, rule);
            }

            // 每X周Y - 如"每1周周一", "每2周周五"
            const weeklyMatch = rule.match(/^每(\d+)周(.+)$/);
            if (weeklyMatch) {
                const interval = parseInt(weeklyMatch[1]);
                const weekdayStr = weeklyMatch[2];
                return this.validateWeeklyRule(interval, weekdayStr, rule);
            }

            // 每X日 - 如"每1日", "每3日"
            const dailyMatch = rule.match(/^每(\d+)日$/);
            if (dailyMatch) {
                const interval = parseInt(dailyMatch[1]);
                return this.validateDailyRule(interval, rule);
            }

            return { 
                isValid: false, 
                error: '不支持的重复规则格式。支持的格式：每年X月Y日、每X个月Y日、每X周Y、每X日' 
            };

        } catch (error) {
            logger.error('重复规则解析错误:', error);
            return { isValid: false, error: '规则解析失败: ' + error.message };
        }
    }

    /**
     * 验证每年规则
     */
    validateYearlyRule(month, day, originalRule) {
        if (month < 1 || month > 12) {
            return { isValid: false, error: '月份必须在1-12之间' };
        }

        // 检查日期的有效性（考虑不同月份的天数）
        const daysInMonth = this.getDaysInMonth(month);
        if (day < 1 || day > daysInMonth.max) {
            return { 
                isValid: false, 
                error: `${month}月的日期必须在1-${daysInMonth.max}之间` 
            };
        }

        return {
            isValid: true,
            type: 'yearly',
            interval: 1,
            month: month,
            day: day,
            originalRule: originalRule,
            description: `每年${month}月${day}日重复`
        };
    }

    /**
     * 验证每月规则
     */
    validateMonthlyRule(interval, day, originalRule) {
        if (interval < 1 || interval > 12) {
            return { isValid: false, error: '月份间隔必须在1-12之间' };
        }

        if (day < 1 || day > 31) {
            return { isValid: false, error: '日期必须在1-31之间' };
        }

        return {
            isValid: true,
            type: 'monthly',
            interval: interval,
            day: day,
            originalRule: originalRule,
            description: `每${interval}个月${day}日重复`
        };
    }

    /**
     * 验证每周规则
     */
    validateWeeklyRule(interval, weekdayStr, originalRule) {
        if (interval < 1 || interval > 52) {
            return { isValid: false, error: '周间隔必须在1-52之间' };
        }

        // 支持多个星期几，用逗号分隔
        const weekdays = weekdayStr.split(/[,，]/).map(w => w.trim());
        const parsedWeekdays = [];

        for (const weekday of weekdays) {
            if (!this.weekdayMap[weekday]) {
                return { 
                    isValid: false, 
                    error: `不支持的星期格式: ${weekday}。支持：周一、周二、...、周日` 
                };
            }
            parsedWeekdays.push(this.weekdayMap[weekday]);
        }

        if (parsedWeekdays.length === 0) {
            return { isValid: false, error: '至少需要指定一个星期几' };
        }

        return {
            isValid: true,
            type: 'weekly',
            interval: interval,
            weekdays: parsedWeekdays,
            originalRule: originalRule,
            description: `每${interval}周${weekdays.join('、')}重复`
        };
    }

    /**
     * 验证每日规则
     */
    validateDailyRule(interval, originalRule) {
        if (interval < 1 || interval > 365) {
            return { isValid: false, error: '日间隔必须在1-365之间' };
        }

        return {
            isValid: true,
            type: 'daily',
            interval: interval,
            originalRule: originalRule,
            description: `每${interval}日重复`
        };
    }

    /**
     * 计算下次执行日期
     * @param {Object} ruleData - 解析后的规则数据
     * @param {Date} fromDate - 起始日期（北京时间）
     * @param {string} time - 执行时间 HH:mm
     * @returns {Date|null} 下次执行日期
     */
    calculateNextOccurrence(ruleData, fromDate = null, time = '09:00') {
        if (!ruleData.isValid) {
            return null;
        }

        const baseDate = fromDate || beijingTime();
        
        try {
            switch (ruleData.type) {
                case 'daily':
                    return this.calculateNextDaily(ruleData, baseDate);
                
                case 'weekly':
                    return this.calculateNextWeekly(ruleData, baseDate);
                
                case 'monthly':
                    return this.calculateNextMonthly(ruleData, baseDate);
                
                case 'yearly':
                    return this.calculateNextYearly(ruleData, baseDate);
                
                default:
                    logger.warn('不支持的重复类型:', ruleData.type);
                    return null;
            }
        } catch (error) {
            logger.error('计算下次执行时间失败:', error);
            return null;
        }
    }

    /**
     * 计算每日重复的下次执行时间
     */
    calculateNextDaily(ruleData, baseDate) {
        const nextDate = new Date(baseDate);
        nextDate.setDate(nextDate.getDate() + ruleData.interval);
        return nextDate;
    }

    /**
     * 计算每周重复的下次执行时间
     */
    calculateNextWeekly(ruleData, baseDate) {
        const currentWeekday = this.getWeekday(baseDate); // 1-7 (周一到周日)
        const targetWeekdays = ruleData.weekdays.sort((a, b) => a - b);
        
        // 找到本周内下一个执行日
        let nextWeekday = null;
        for (const weekday of targetWeekdays) {
            if (weekday > currentWeekday) {
                nextWeekday = weekday;
                break;
            }
        }

        const nextDate = new Date(baseDate);
        
        if (nextWeekday !== null) {
            // 本周内有执行日
            nextDate.setDate(baseDate.getDate() + (nextWeekday - currentWeekday));
        } else {
            // 下周执行
            const daysToAdd = (7 * ruleData.interval) - currentWeekday + targetWeekdays[0];
            nextDate.setDate(baseDate.getDate() + daysToAdd);
        }
        
        return nextDate;
    }

    /**
     * 计算每月重复的下次执行时间
     */
    calculateNextMonthly(ruleData, baseDate) {
        const nextDate = new Date(baseDate);
        
        // 先尝试当月
        nextDate.setDate(ruleData.day);
        
        if (nextDate <= baseDate) {
            // 如果当月日期已过，移动到下个周期
            nextDate.setMonth(nextDate.getMonth() + ruleData.interval);
            nextDate.setDate(ruleData.day);
        }
        
        // 处理月末日期（如31日在2月不存在）
        if (nextDate.getDate() !== ruleData.day) {
            // 日期被自动调整了，设为该月最后一天
            nextDate.setDate(0); // 设为上月最后一天
        }
        
        return nextDate;
    }

    /**
     * 计算每年重复的下次执行时间
     */
    calculateNextYearly(ruleData, baseDate) {
        const nextDate = new Date(baseDate);
        
        // 设置目标月日
        nextDate.setMonth(ruleData.month - 1, ruleData.day);
        
        // 如果今年的日期已过，移到明年
        if (nextDate <= baseDate) {
            nextDate.setFullYear(nextDate.getFullYear() + 1);
        }
        
        // 处理闰年问题（如2月29日在非闰年）
        if (nextDate.getMonth() !== (ruleData.month - 1)) {
            // 日期被调整了，通常是2月29日在非闰年，调整为2月28日
            nextDate.setMonth(ruleData.month - 1, 0); // 设为该月最后一天
        }
        
        return nextDate;
    }

    /**
     * 生成重复任务预览
     * @param {Object} ruleData - 解析后的规则数据
     * @param {Date} startDate - 开始日期
     * @param {string} time - 执行时间
     * @param {number} count - 预览数量
     * @returns {Array} 预览日期数组
     */
    generatePreview(ruleData, startDate, time = '09:00', count = 5) {
        if (!ruleData.isValid) {
            return [];
        }

        const preview = [];
        let currentDate = new Date(startDate);
        
        for (let i = 0; i < count; i++) {
            const nextDate = this.calculateNextOccurrence(ruleData, currentDate, time);
            if (!nextDate) break;
            
            preview.push({
                date: formatDate(nextDate),
                time: time,
                datetime: `${formatDate(nextDate)} ${time}`,
                weekday: this.reverseWeekdayMap[this.getWeekday(nextDate)]
            });
            
            // 为下次计算设置起始日期
            currentDate = new Date(nextDate);
            currentDate.setDate(currentDate.getDate() + 1); // 避免重复
        }
        
        return preview;
    }

    /**
     * 获取星期几 (1-7, 周一到周日)
     */
    getWeekday(date) {
        const day = date.getDay(); // 0-6 (周日到周六)
        return day === 0 ? 7 : day; // 转换为1-7 (周一到周日)
    }

    /**
     * 获取月份天数信息
     */
    getDaysInMonth(month) {
        const daysMap = {
            1: { max: 31 }, 2: { max: 29 }, 3: { max: 31 }, 4: { max: 30 },
            5: { max: 31 }, 6: { max: 30 }, 7: { max: 31 }, 8: { max: 31 },
            9: { max: 30 }, 10: { max: 31 }, 11: { max: 30 }, 12: { max: 31 }
        };
        return daysMap[month] || { max: 31 };
    }

    /**
     * 验证规则字符串并返回详细信息
     * @param {string} ruleString - 规则字符串
     * @returns {Object} 验证结果
     */
    validateAndAnalyze(ruleString) {
        const parseResult = this.parseRule(ruleString);
        
        if (!parseResult.isValid) {
            return parseResult;
        }

        // 生成预览
        const startDate = beijingTime();
        const preview = this.generatePreview(parseResult, startDate, '09:00', 3);
        
        return {
            ...parseResult,
            preview: preview,
            nextExecution: preview.length > 0 ? preview[0] : null
        };
    }

    /**
     * 检查规则是否会产生过多的执行次数
     * @param {Object} ruleData - 规则数据
     * @param {number} maxOccurrences - 最大允许次数
     * @returns {boolean} 是否超出限制
     */
    isExcessiveRule(ruleData, maxOccurrences = 365) {
        if (!ruleData.isValid) return false;

        switch (ruleData.type) {
            case 'daily':
                // 每日执行，一年最多365次
                return ruleData.interval === 1 && maxOccurrences > 365;
            
            case 'weekly':
                // 每周执行，考虑星期几数量
                const weeklyPerYear = 52 * ruleData.weekdays.length / ruleData.interval;
                return weeklyPerYear > maxOccurrences;
            
            case 'monthly':
                // 每月执行
                const monthlyPerYear = 12 / ruleData.interval;
                return monthlyPerYear > maxOccurrences;
            
            case 'yearly':
                // 每年执行，通常不会超出
                return false;
            
            default:
                return false;
        }
    }
}

module.exports = new RecurrenceRule();