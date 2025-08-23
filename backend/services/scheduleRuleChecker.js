/**
 * 调度规则检查器
 * 判断任务是否应该在指定日期执行
 */

const logger = require('../utils/logger');

class ScheduleRuleChecker {
    /**
     * 检查任务是否应该在今天执行
     */
    shouldRunToday(scheduleRule, date = new Date()) {
        return this.shouldRunOnDate(scheduleRule, date);
    }

    /**
     * 检查任务是否应该在指定日期执行
     */
    shouldRunOnDate(scheduleRule, date) {
        try {
            const { ruleType, dayMode, weekMode, intervalMode, months, excludeSettings } = scheduleRule;

            // 检查排除设置
            if (this.isExcluded(date, excludeSettings)) {
                return false;
            }
            
            // 检查年间隔（如果存在）
            if (intervalMode && (intervalMode.yearInterval !== undefined || intervalMode.unit === 'years')) {
                if (!this.checkYearInterval(intervalMode, date)) {
                    return false; // 不在年间隔范围内
                }
            }
            
            // 首先检查月份限制（适用于所有规则类型）
            if (months && months.length > 0) {
                const currentMonth = date.getMonth() + 1; // JavaScript月份从0开始
                if (!months.includes(currentMonth)) {
                    return false; // 不在指定月份内
                }
            }

            // 根据规则类型判断
            switch (ruleType) {
                case 'by_day':
                    return this.checkDayMode(dayMode, date);
                
                case 'by_week':
                    return this.checkWeekMode(weekMode, date);
                
                case 'by_month':
                    // by_month类型主要用于指定每月的某些日期
                    // 月份检查已经在上面完成
                    return this.checkDayMode(dayMode, date);
                
                case 'by_interval':
                    return this.checkIntervalMode(intervalMode, date);
                
                case 'daily':
                    return true; // 每天执行（但受月份限制）
                
                default:
                    logger.warn(`未知的规则类型: ${ruleType}`);
                    return false;
            }
        } catch (error) {
            logger.error('检查调度规则失败:', error);
            return false;
        }
    }

    /**
     * 检查是否被排除
     */
    isExcluded(date, excludeSettings) {
        if (!excludeSettings) {
            return false;
        }

        // 检查是否排除节假日
        if (excludeSettings.excludeHolidays) {
            // TODO: 集成节假日检查
        }

        // 检查是否排除周末
        if (excludeSettings.excludeWeekends) {
            const dayOfWeek = date.getDay();
            if (dayOfWeek === 0 || dayOfWeek === 6) {
                return true;
            }
        }

        // 检查特定排除日期
        if (excludeSettings.specificDates && excludeSettings.specificDates.length > 0) {
            const dateStr = this.formatDate(date);
            if (excludeSettings.specificDates.includes(dateStr)) {
                return true;
            }
        }

        return false;
    }

    /**
     * 检查按天模式
     */
    checkDayMode(dayMode, date) {
        if (!dayMode) {
            return true; // 默认每天
        }

        const { type, days } = dayMode;

        switch (type) {
            case 'every_day':
                return true;
            
            case 'specific_days':
                // 检查是否在指定的日期列表中
                if (!days || days.length === 0) {
                    return true; // 没有指定具体日期，默认每天
                }
                const dayOfMonth = date.getDate();
                return days.includes(dayOfMonth);
            
            case 'workdays':
                // 工作日（周一到周五）
                const dayOfWeek = date.getDay();
                return dayOfWeek >= 1 && dayOfWeek <= 5;
            
            case 'weekends':
                // 周末（周六周日）
                const dow = date.getDay();
                return dow === 0 || dow === 6;
            
            default:
                return true;
        }
    }

    /**
     * 检查按周模式
     */
    checkWeekMode(weekMode, date) {
        if (!weekMode) {
            return false;
        }

        const { weekdays, occurrence } = weekMode;
        const dayOfWeek = date.getDay();

        // 检查是否在指定的星期几
        if (!weekdays || weekdays.length === 0) {
            return false;
        }

        if (!weekdays.includes(dayOfWeek)) {
            return false;
        }

        // 检查是第几个星期
        if (occurrence && occurrence !== 'every') {
            const weekOfMonth = Math.ceil(date.getDate() / 7);
            
            switch (occurrence) {
                case 'first':
                    return weekOfMonth === 1;
                case 'second':
                    return weekOfMonth === 2;
                case 'third':
                    return weekOfMonth === 3;
                case 'fourth':
                    return weekOfMonth === 4;
                case 'last':
                    // 检查是否是本月最后一个该星期几
                    const nextWeek = new Date(date);
                    nextWeek.setDate(date.getDate() + 7);
                    return nextWeek.getMonth() !== date.getMonth();
                default:
                    return true;
            }
        }

        return true;
    }

    /**
     * 检查按月模式
     */
    checkMonthMode(months, date) {
        if (!months || months.length === 0) {
            return true; // 没有指定月份，默认每月
        }

        const currentMonth = date.getMonth() + 1; // JavaScript月份从0开始
        return months.includes(currentMonth);
    }

    /**
     * 检查间隔模式
     */
    checkIntervalMode(intervalMode, date) {
        if (!intervalMode) {
            return false;
        }

        const { value, unit, referenceDate } = intervalMode;

        if (!referenceDate) {
            return false; // 没有参考日期
        }

        const ref = new Date(referenceDate);
        // 标准化日期，去掉时分秒
        ref.setHours(0, 0, 0, 0);
        const checkDate = new Date(date);
        checkDate.setHours(0, 0, 0, 0);
        
        const diff = checkDate.getTime() - ref.getTime();

        switch (unit) {
            case 'days':
                const days = Math.round(diff / (1000 * 60 * 60 * 24));
                return days >= 0 && days % value === 0;
            
            case 'weeks':
                const days_diff = Math.round(diff / (1000 * 60 * 60 * 24));
                // 检查是否是整周数，并且是同一个星期几
                return days_diff >= 0 && days_diff % 7 === 0 && (days_diff / 7) % value === 0;
            
            case 'months':
                // 按月计算需要考虑是否是同一天
                const monthsDiff = this.getMonthsDiff(ref, checkDate);
                const isSameDay = ref.getDate() === checkDate.getDate() || 
                                 (ref.getDate() > 28 && checkDate.getDate() === this.getLastDayOfMonth(checkDate));
                return monthsDiff >= 0 && monthsDiff % value === 0 && isSameDay;
            
            case 'years':
                const yearsDiff = checkDate.getFullYear() - ref.getFullYear();
                const isSameMonthDay = ref.getMonth() === checkDate.getMonth() && 
                                      ref.getDate() === checkDate.getDate();
                
                // 间隔0年 = 一次性任务，只在参考日期执行
                if (value === 0) {
                    return ref.getFullYear() === checkDate.getFullYear() && isSameMonthDay;
                }
                
                // 间隔N年 = 每N年执行一次
                return yearsDiff >= 0 && yearsDiff % value === 0 && isSameMonthDay;
            
            default:
                return false;
        }
    }
    
    /**
     * 获取月份的最后一天
     */
    getLastDayOfMonth(date) {
        const nextMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);
        return nextMonth.getDate();
    }

    /**
     * 计算两个日期之间的月份差
     */
    getMonthsDiff(date1, date2) {
        const years = date2.getFullYear() - date1.getFullYear();
        const months = date2.getMonth() - date1.getMonth();
        return years * 12 + months;
    }

    /**
     * 格式化日期为 YYYY-MM-DD
     */
    formatDate(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    /**
     * 检查年间隔
     */
    checkYearInterval(intervalMode, date) {
        // 如果有 yearInterval 字段，使用它
        if (intervalMode.yearInterval !== undefined) {
            const yearInterval = intervalMode.yearInterval;
            
            if (yearInterval === 0) {
                // 仅今年执行
                return date.getFullYear() === new Date().getFullYear();
            } else if (yearInterval > 1) {
                // 每N年执行，以当前年份为基准计算
                const currentYear = new Date().getFullYear();
                const targetYear = date.getFullYear();
                const yearDiff = targetYear - currentYear;
                
                // 如果是未来年份，检查是否符合间隔
                if (yearDiff >= 0) {
                    return yearDiff % yearInterval === 0;
                }
                return false;
            }
            // yearInterval === 1 表示每年，直接返回true
            return true;
        }
        
        // 兼容旧的年间隔模式（unit === 'years'）
        if (intervalMode.unit === 'years') {
            return this.checkIntervalMode(intervalMode, date);
        }
        
        return true; // 没有年间隔限制
    }
}

module.exports = new ScheduleRuleChecker();