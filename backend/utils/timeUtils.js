/**
 * 统一的北京时区时间工具函数
 * 避免时区转换混乱，统一使用北京时区 (UTC+8)
 * 
 * 注意：服务器、数据库、Docker环境都已设置为北京时区
 * 所有时间处理都基于本地时间，不进行时区转换
 */

/**
 * 获取当前北京时间
 * @returns {Date} 北京时间
 */
function beijingTime() {
    // 获取当前UTC时间
    const now = new Date();
    // 转换为北京时间（UTC+8）
    const beijingOffset = 8 * 60; // 北京时间偏移8小时
    const localOffset = now.getTimezoneOffset(); // 本地时区偏移（分钟）
    const beijingTime = new Date(now.getTime() + (beijingOffset + localOffset) * 60 * 1000);
    return beijingTime;
}

/**
 * 格式化日期为 YYYY-MM-DD 格式
 * @param {Date} date - 日期对象，默认当前时间
 * @returns {string} 格式化后的日期字符串
 */
function formatDate(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * 格式化时间为 HH:mm:ss 格式
 * @param {Date} date - 日期对象，默认当前时间
 * @returns {string} 格式化后的时间字符串
 */
function formatTime(date = new Date()) {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
}

/**
 * 格式化日期时间为 YYYY-MM-DD HH:mm:ss 格式
 * @param {Date} date - 日期对象，默认当前时间
 * @returns {string} 格式化后的日期时间字符串
 */
function formatDateTime(date = new Date()) {
    return `${formatDate(date)} ${formatTime(date)}`;
}

/**
 * 获取ISO格式的星期数 (1-7，周一到周日)
 * @param {Date} date - 日期对象，默认当前时间
 * @returns {number} 星期数，1=周一，7=周日
 */
function getISOWeekday(date = new Date()) {
    const day = date.getDay();
    return day === 0 ? 7 : day; // 转换为ISO格式，周一=1, 周日=7
}

/**
 * 获取指定天数前的日期
 * @param {number} days - 天数
 * @param {Date} fromDate - 起始日期，默认当前时间
 * @returns {Date} 指定天数前的日期
 */
function daysAgo(days, fromDate = new Date()) {
    const result = new Date(fromDate);
    result.setDate(result.getDate() - days);
    return result;
}

/**
 * 获取指定天数后的日期
 * @param {number} days - 天数
 * @param {Date} fromDate - 起始日期，默认当前时间
 * @returns {Date} 指定天数后的日期
 */
function daysAfter(days, fromDate = new Date()) {
    const result = new Date(fromDate);
    result.setDate(result.getDate() + days);
    return result;
}

/**
 * 解析时间字符串为Date对象（适用于北京时区）
 * @param {string} timeStr - 时间字符串，如 "2024-01-01 12:00:00"
 * @returns {Date|null} 解析后的Date对象，失败返回null
 */
function parseDateTime(timeStr) {
    if (!timeStr) return null;
    try {
        // 如果字符串不包含时区信息，视为北京时间
        const date = new Date(timeStr);
        if (isNaN(date.getTime())) return null;
        return date;
    } catch (error) {
        return null;
    }
}

/**
 * 比较两个时间字符串（HH:mm:ss 格式）
 * @param {string} time1 - 时间字符串1
 * @param {string} time2 - 时间字符串2
 * @returns {number} 比较结果：-1(time1<time2), 0(相等), 1(time1>time2)
 */
function compareTime(time1, time2) {
    if (!time1 || !time2) return 0;
    
    const parseTime = (timeStr) => {
        const parts = timeStr.split(':').map(Number);
        return parts[0] * 3600 + parts[1] * 60 + (parts[2] || 0);
    };
    
    const seconds1 = parseTime(time1);
    const seconds2 = parseTime(time2);
    
    if (seconds1 < seconds2) return -1;
    if (seconds1 > seconds2) return 1;
    return 0;
}

module.exports = {
    beijingTime,
    formatDate,
    formatTime,
    formatDateTime,
    getISOWeekday,
    daysAgo,
    daysAfter,
    parseDateTime,
    compareTime
};