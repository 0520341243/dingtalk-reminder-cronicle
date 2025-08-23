/**
 * 前端统一时间工具函数
 * 避免时区转换混乱，直接使用数据库返回的时间进行格式化
 * 
 * 注意：
 * 1. 服务器、数据库都已设置为北京时区
 * 2. 前端不进行时区转换，直接格式化显示
 * 3. 所有时间都基于北京时区 (UTC+8)
 */

/**
 * 格式化日期为 YYYY-MM-DD 格式
 * @param {Date|string} date - 日期对象或日期字符串
 * @returns {string} 格式化后的日期字符串
 */
export function formatDate(date) {
  if (!date) return '-'
  
  const dateObj = typeof date === 'string' ? new Date(date) : date
  if (isNaN(dateObj.getTime())) return '-'
  
  const year = dateObj.getFullYear()
  const month = String(dateObj.getMonth() + 1).padStart(2, '0')
  const day = String(dateObj.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * 格式化时间为 HH:mm:ss 格式
 * @param {Date|string} date - 日期对象或日期字符串
 * @returns {string} 格式化后的时间字符串
 */
export function formatTime(date) {
  if (!date) return '-'
  
  const dateObj = typeof date === 'string' ? new Date(date) : date
  if (isNaN(dateObj.getTime())) return '-'
  
  const hours = String(dateObj.getHours()).padStart(2, '0')
  const minutes = String(dateObj.getMinutes()).padStart(2, '0')
  const seconds = String(dateObj.getSeconds()).padStart(2, '0')
  return `${hours}:${minutes}:${seconds}`
}

/**
 * 格式化日期时间为 YYYY-MM-DD HH:mm:ss 格式
 * @param {Date|string} dateTime - 日期时间对象或字符串
 * @returns {string} 格式化后的日期时间字符串
 */
export function formatDateTime(dateTime) {
  if (!dateTime) return '-'
  
  const dateObj = typeof dateTime === 'string' ? new Date(dateTime) : dateTime
  if (isNaN(dateObj.getTime())) return '-'
  
  return `${formatDate(dateObj)} ${formatTime(dateObj)}`
}

/**
 * 格式化本地日期为 YYYY-MM-DD（用于表单输入）
 * @param {Date} date - 日期对象，默认当前时间
 * @returns {string} 本地日期字符串
 */
export function formatDateToLocal(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * 获取指定天数前的日期
 * @param {number} days - 天数
 * @param {Date} fromDate - 起始日期，默认当前时间
 * @returns {Date} 指定天数前的日期
 */
export function daysAgo(days, fromDate = new Date()) {
  const result = new Date(fromDate)
  result.setDate(result.getDate() - days)
  return result
}

/**
 * 获取指定天数后的日期
 * @param {number} days - 天数
 * @param {Date} fromDate - 起始日期，默认当前时间
 * @returns {Date} 指定天数后的日期
 */
export function daysAfter(days, fromDate = new Date()) {
  const result = new Date(fromDate)
  result.setDate(result.getDate() + days)
  return result
}

/**
 * 比较两个时间字符串（HH:mm:ss 格式）
 * @param {string} time1 - 时间字符串1
 * @param {string} time2 - 时间字符串2
 * @returns {number} 比较结果：-1(time1<time2), 0(相等), 1(time1>time2)
 */
export function compareTime(time1, time2) {
  if (!time1 || !time2) return 0
  
  const parseTime = (timeStr) => {
    const parts = timeStr.split(':').map(Number)
    return parts[0] * 3600 + parts[1] * 60 + (parts[2] || 0)
  }
  
  const seconds1 = parseTime(time1)
  const seconds2 = parseTime(time2)
  
  if (seconds1 < seconds2) return -1
  if (seconds1 > seconds2) return 1
  return 0
}

/**
 * 获取当前北京时间
 * @returns {Date} 当前时间
 */
export function beijingTime() {
  return new Date() // 浏览器会自动使用本地时区，这里假设用户在北京时区
}

// 默认导出常用函数
export default {
  formatDate,
  formatTime,
  formatDateTime,
  formatDateToLocal,
  daysAgo,
  daysAfter,
  compareTime,
  beijingTime
}