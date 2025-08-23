/**
 * API响应数据解析帮助函数
 * 处理不同格式的API响应，提供统一的数据访问接口
 */

/**
 * 从响应中提取数组数据
 * @param {Object} response - API响应对象
 * @param {String} dataKey - 数据字段名称（如 'files', 'groups', 'tasks'）
 * @returns {Array} 提取的数组数据
 */
export function extractArrayData(response, dataKey) {
  if (!response) return []
  
  // 直接是数组
  if (Array.isArray(response)) {
    return response
  }
  
  // response[dataKey] 格式
  if (response[dataKey] && Array.isArray(response[dataKey])) {
    return response[dataKey]
  }
  
  // response.data[dataKey] 格式
  if (response.data) {
    if (response.data[dataKey] && Array.isArray(response.data[dataKey])) {
      return response.data[dataKey]
    }
    // response.data 直接是数组
    if (Array.isArray(response.data)) {
      return response.data
    }
  }
  
  // response.success && response.data 格式
  if (response.success && response.data) {
    if (Array.isArray(response.data)) {
      return response.data
    }
    if (response.data[dataKey] && Array.isArray(response.data[dataKey])) {
      return response.data[dataKey]
    }
  }
  
  console.warn(`无法从响应中提取 ${dataKey} 数据:`, response)
  return []
}

/**
 * 检查API响应是否成功
 * @param {Object} response - API响应对象
 * @returns {Boolean} 是否成功
 */
export function isApiSuccess(response) {
  if (!response) return false
  
  // 显式的 success 字段
  if (typeof response.success === 'boolean') {
    return response.success
  }
  
  // 有 error 字段表示失败
  if (response.error) {
    return false
  }
  
  // 有数据则认为成功
  if (response.data || Array.isArray(response)) {
    return true
  }
  
  // 有特定的数据字段也认为成功
  const dataKeys = ['files', 'groups', 'tasks', 'users', 'settings']
  for (const key of dataKeys) {
    if (response[key]) {
      return true
    }
  }
  
  return false
}

/**
 * 获取API错误信息
 * @param {Object} response - API响应对象或错误对象
 * @returns {String} 错误信息
 */
export function getApiError(response) {
  if (!response) return '未知错误'
  
  // response.error
  if (response.error) {
    return response.error
  }
  
  // response.message (错误信息)
  if (response.message && !response.success) {
    return response.message
  }
  
  // response.data.error
  if (response.data && response.data.error) {
    return response.data.error
  }
  
  // 错误对象的 message
  if (response.message) {
    return response.message
  }
  
  return '请求失败'
}

/**
 * 安全获取嵌套属性值
 * @param {Object} obj - 对象
 * @param {String} path - 属性路径，如 'data.user.name'
 * @param {*} defaultValue - 默认值
 * @returns {*} 属性值或默认值
 */
export function safeGet(obj, path, defaultValue = null) {
  if (!obj || !path) return defaultValue
  
  const keys = path.split('.')
  let result = obj
  
  for (const key of keys) {
    if (result && typeof result === 'object' && key in result) {
      result = result[key]
    } else {
      return defaultValue
    }
  }
  
  return result
}