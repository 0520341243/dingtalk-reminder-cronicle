/**
 * 北京时间工具函数
 * 确保整个系统统一使用北京时区（UTC+8）
 */

const logger = require('./logger');

/**
 * 获取北京时间的今天日期（0点0分0秒）
 * @returns {Date} 北京时间今天的开始时间
 */
function getBeijingToday() {
    const now = new Date();
    // 如果服务器本身就是北京时间，直接设置时分秒为0
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    
    logger.debug('获取北京时间今天', {
        now: now.toString(),
        nowISO: now.toISOString(),
        today: today.toString(),
        todayISO: today.toISOString(),
        todayDateString: today.toISOString().split('T')[0]
    });
    
    return today;
}

/**
 * 获取北京时间的当前时间
 * @returns {Date} 北京时间当前时间
 */
function getBeijingNow() {
    const now = new Date();
    const beijingTimeStr = now.toLocaleString("en-US", {timeZone: "Asia/Shanghai"});
    return new Date(beijingTimeStr);
}

/**
 * 将UTC时间转换为北京时间字符串
 * @param {Date} date - UTC时间
 * @param {string} format - 格式化选项 ('date' | 'time' | 'datetime')
 * @returns {string} 北京时间字符串
 */
function toBeiijingString(date, format = 'datetime') {
    const options = {
        timeZone: 'Asia/Shanghai',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    };
    
    if (format === 'time' || format === 'datetime') {
        options.hour = '2-digit';
        options.minute = '2-digit';
        options.second = '2-digit';
        options.hour12 = false;
    }
    
    if (format === 'time') {
        delete options.year;
        delete options.month;
        delete options.day;
    }
    
    return date.toLocaleString('zh-CN', options);
}

/**
 * 获取北京时间的明天日期（0点0分0秒）
 * @returns {Date} 北京时间明天的开始时间
 */
function getBeijingTomorrow() {
    const today = getBeijingToday();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow;
}

/**
 * 获取北京时间的指定日期（0点0分0秒）
 * @param {number} year - 年份
 * @param {number} month - 月份 (1-12)
 * @param {number} day - 日期
 * @returns {Date} 指定的北京时间日期
 */
function getBeijingDate(year, month, day) {
    return new Date(year, month - 1, day, 0, 0, 0, 0);
}

/**
 * 判断给定时间是否是北京时间的今天
 * @param {Date} date - 要检查的时间
 * @returns {boolean} 是否是今天
 */
function isBeijingToday(date) {
    const today = getBeijingToday();
    const tomorrow = getBeijingTomorrow();
    return date >= today && date < tomorrow;
}

/**
 * 格式化为北京时间的日期字符串（YYYY-MM-DD）
 * @param {Date} date - 日期对象
 * @returns {string} YYYY-MM-DD格式的日期字符串
 */
function formatBeijingDate(date) {
    return date.toLocaleDateString("en-CA", {timeZone: "Asia/Shanghai"});
}

/**
 * 格式化为北京时间的时间字符串（HH:MM:SS）
 * @param {Date} date - 日期对象
 * @returns {string} HH:MM:SS格式的时间字符串
 */
function formatBeijingTime(date) {
    const timeStr = date.toLocaleTimeString("zh-CN", {
        timeZone: "Asia/Shanghai",
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    return timeStr;
}

module.exports = {
    getBeijingToday,
    getBeijingNow,
    toBeiijingString,
    getBeijingTomorrow,
    getBeijingDate,
    isBeijingToday,
    formatBeijingDate,
    formatBeijingTime
};