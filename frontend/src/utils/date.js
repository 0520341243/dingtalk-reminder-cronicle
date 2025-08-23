/**
 * 日期时间格式化工具函数
 */

/**
 * 格式化日期
 * @param {string|Date} date 日期
 * @param {string} format 格式
 * @returns {string} 格式化后的日期字符串
 */
export function formatDate(date, format = 'YYYY-MM-DD') {
  if (!date) return ''
  
  const d = new Date(date)
  if (isNaN(d.getTime())) return ''
  
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  
  switch (format) {
    case 'YYYY-MM-DD':
      return `${year}-${month}-${day}`
    case 'MM-DD':
      return `${month}-${day}`
    case 'MM月DD日':
      return `${parseInt(month)}月${parseInt(day)}日`
    case 'YYYY年MM月DD日':
      return `${year}年${parseInt(month)}月${parseInt(day)}日`
    default:
      return `${year}-${month}-${day}`
  }
}

/**
 * 格式化时间
 * @param {string|Date} date 日期时间
 * @param {string} format 格式
 * @returns {string} 格式化后的时间字符串
 */
export function formatTime(date, format = 'HH:mm:ss') {
  if (!date) return ''
  
  const d = new Date(date)
  if (isNaN(d.getTime())) return ''
  
  const hours = String(d.getHours()).padStart(2, '0')
  const minutes = String(d.getMinutes()).padStart(2, '0')
  const seconds = String(d.getSeconds()).padStart(2, '0')
  
  switch (format) {
    case 'HH:mm:ss':
      return `${hours}:${minutes}:${seconds}`
    case 'HH:mm':
      return `${hours}:${minutes}`
    case 'HH时mm分':
      return `${parseInt(hours)}时${parseInt(minutes)}分`
    default:
      return `${hours}:${minutes}:${seconds}`
  }
}

/**
 * 格式化日期时间
 * @param {string|Date} date 日期时间
 * @param {string} format 格式
 * @returns {string} 格式化后的日期时间字符串
 */
export function formatDateTime(date, format = 'YYYY-MM-DD HH:mm:ss') {
  if (!date) return ''
  
  const d = new Date(date)
  if (isNaN(d.getTime())) return ''
  
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hours = String(d.getHours()).padStart(2, '0')
  const minutes = String(d.getMinutes()).padStart(2, '0')
  const seconds = String(d.getSeconds()).padStart(2, '0')
  
  switch (format) {
    case 'YYYY-MM-DD HH:mm:ss':
      return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
    case 'YYYY-MM-DD HH:mm':
      return `${year}-${month}-${day} ${hours}:${minutes}`
    case 'MM-DD HH:mm':
      return `${month}-${day} ${hours}:${minutes}`
    case 'MM月DD日 HH:mm':
      return `${parseInt(month)}月${parseInt(day)}日 ${hours}:${minutes}`
    case 'YYYY年MM月DD日 HH时mm分':
      return `${year}年${parseInt(month)}月${parseInt(day)}日 ${parseInt(hours)}时${parseInt(minutes)}分`
    default:
      return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
  }
}

/**
 * 获取相对时间描述
 * @param {string|Date} date 日期时间
 * @returns {string} 相对时间描述
 */
export function getRelativeTime(date) {
  if (!date) return ''
  
  const d = new Date(date)
  if (isNaN(d.getTime())) return ''
  
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  
  if (days > 30) {
    return formatDateTime(date, 'YYYY-MM-DD HH:mm')
  } else if (days > 0) {
    return `${days}天前`
  } else if (hours > 0) {
    return `${hours}小时前`
  } else if (minutes > 0) {
    return `${minutes}分钟前`
  } else if (seconds > 0) {
    return `${seconds}秒前`
  } else {
    return '刚刚'
  }
}

/**
 * 获取星期名称
 * @param {string|Date} date 日期
 * @param {string} format 格式 'short' | 'long'
 * @returns {string} 星期名称
 */
export function getWeekdayName(date, format = 'short') {
  if (!date) return ''
  
  const d = new Date(date)
  if (isNaN(d.getTime())) return ''
  
  const weekdays = format === 'short' 
    ? ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
    : ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
  
  return weekdays[d.getDay()]
}

/**
 * 判断是否为今天
 * @param {string|Date} date 日期
 * @returns {boolean} 是否为今天
 */
export function isToday(date) {
  if (!date) return false
  
  const d = new Date(date)
  if (isNaN(d.getTime())) return false
  
  const today = new Date()
  return d.toDateString() === today.toDateString()
}

/**
 * 判断是否为明天
 * @param {string|Date} date 日期
 * @returns {boolean} 是否为明天
 */
export function isTomorrow(date) {
  if (!date) return false
  
  const d = new Date(date)
  if (isNaN(d.getTime())) return false
  
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  return d.toDateString() === tomorrow.toDateString()
}

/**
 * 判断是否为昨天
 * @param {string|Date} date 日期
 * @returns {boolean} 是否为昨天
 */
export function isYesterday(date) {
  if (!date) return false
  
  const d = new Date(date)
  if (isNaN(d.getTime())) return false
  
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  return d.toDateString() === yesterday.toDateString()
}

/**
 * 获取日期范围描述
 * @param {string|Date} startDate 开始日期
 * @param {string|Date} endDate 结束日期
 * @returns {string} 日期范围描述
 */
export function getDateRangeDescription(startDate, endDate) {
  if (!startDate || !endDate) return ''
  
  const start = formatDate(startDate, 'MM月DD日')
  const end = formatDate(endDate, 'MM月DD日')
  
  if (start === end) {
    return start
  }
  
  return `${start} 至 ${end}`
}

/**
 * 获取时间段描述
 * @param {string} time 时间 HH:mm 格式
 * @returns {string} 时间段描述
 */
export function getTimePeriodDescription(time) {
  if (!time) return ''
  
  const [hours] = time.split(':').map(Number)
  
  if (hours >= 0 && hours < 6) {
    return '凌晨'
  } else if (hours >= 6 && hours < 12) {
    return '上午'
  } else if (hours >= 12 && hours < 14) {
    return '中午'
  } else if (hours >= 14 && hours < 18) {
    return '下午'
  } else if (hours >= 18 && hours < 22) {
    return '晚上'
  } else {
    return '深夜'
  }
}

/**
 * 计算两个日期之间的天数差
 * @param {string|Date} date1 日期1
 * @param {string|Date} date2 日期2
 * @returns {number} 天数差
 */
export function getDaysDifference(date1, date2) {
  const d1 = new Date(date1)
  const d2 = new Date(date2)
  
  if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return 0
  
  const timeDiff = Math.abs(d2.getTime() - d1.getTime())
  return Math.ceil(timeDiff / (1000 * 60 * 60 * 24))
}

/**
 * 获取当前月份的第一天和最后一天
 * @param {string|Date} date 日期
 * @returns {object} {firstDay, lastDay}
 */
export function getMonthRange(date = new Date()) {
  const d = new Date(date)
  const year = d.getFullYear()
  const month = d.getMonth()
  
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  
  return {
    firstDay: formatDate(firstDay),
    lastDay: formatDate(lastDay)
  }
}

/**
 * 获取当前周的第一天（周一）和最后一天（周日）
 * @param {string|Date} date 日期
 * @returns {object} {firstDay, lastDay}
 */
export function getWeekRange(date = new Date()) {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1) // 周一为起始
  
  const firstDay = new Date(d.setDate(diff))
  const lastDay = new Date(d.setDate(diff + 6))
  
  return {
    firstDay: formatDate(firstDay),
    lastDay: formatDate(lastDay)
  }
}