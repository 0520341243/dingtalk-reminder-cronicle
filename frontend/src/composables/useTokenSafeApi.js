/**
 * Token安全的API调用组合式函数
 * 
 * 特性:
 * - 自动处理Token刷新期间的API调用
 * - Redis缓存友好的请求策略
 * - 防止并发API调用导致的状态混乱
 * - 智能重试机制
 */

import { ref, computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { ElMessage } from 'element-plus'

// API调用状态管理
const apiCallState = {
  activeCalls: new Map(), // 活跃的API调用
  tokenRefreshingCalls: new Set(), // Token刷新期间的调用队列
  lastCallTimestamp: new Map(), // 最后调用时间戳（用于缓存策略）
  cachedResults: new Map() // 缓存的API结果
}

/**
 * 使用Token安全的API调用
 * @param {Object} options 配置选项
 */
export function useTokenSafeApi(options = {}) {
  const {
    cacheTimeout = 5000, // 缓存超时时间（毫秒）
    retryAttempts = 2,    // 重试次数
    retryDelay = 1000     // 重试延迟
  } = options

  const authStore = useAuthStore()
  const loading = ref(false)
  const error = ref(null)

  // 计算是否可以进行API调用
  const canMakeApiCall = computed(() => {
    return authStore.isAuthenticated && !authStore.loading
  })

  /**
   * 安全的API调用包装器
   * @param {Function} apiCall API调用函数
   * @param {Object} callOptions 调用选项
   */
  const safeApiCall = async (apiCall, callOptions = {}) => {
    const {
      key = 'unknown',
      useCache = true,
      skipAuthCheck = false,
      onTokenRefresh = null
    } = callOptions

    // 检查认证状态
    if (!skipAuthCheck && !canMakeApiCall.value) {
      const authError = new Error('用户未认证或认证状态异常')
      authError.code = 'AUTH_REQUIRED'
      throw authError
    }

    // 缓存检查 - 添加数据格式验证
    if (useCache) {
      const lastCall = apiCallState.lastCallTimestamp.get(key)
      if (lastCall && (Date.now() - lastCall) < cacheTimeout) {
        const cachedResult = apiCallState.cachedResults.get(key)
        if (cachedResult && typeof cachedResult === 'object' && cachedResult.data !== undefined) {
          console.log(`[useTokenSafeApi] 使用缓存结果: ${key}`)
          return cachedResult
        }
      }
    }

    // 如果相同的API调用正在进行，等待现有Promise完成
    if (apiCallState.activeCalls.has(key)) {
      console.log(`[useTokenSafeApi] 等待进行中的API调用: ${key}`)
      return await apiCallState.activeCalls.get(key)
    }

    loading.value = true
    error.value = null

    const callPromise = executeApiCallWithRetry(apiCall, key, retryAttempts, retryDelay)
    
    // 存储活跃调用
    apiCallState.activeCalls.set(key, callPromise)
    apiCallState.lastCallTimestamp.set(key, Date.now())

    try {
      const result = await callPromise
      console.log(`[useTokenSafeApi] API调用成功: ${key}`)
      
      // 缓存成功的结果 - 添加防御性检查
      if (useCache && result && typeof result === 'object' && result.data !== undefined) {
        apiCallState.cachedResults.set(key, result)
        
        // 清理过期缓存
        setTimeout(() => {
          apiCallState.cachedResults.delete(key)
        }, cacheTimeout)
      }
      
      return result
    } catch (err) {
      error.value = err
      console.error(`[useTokenSafeApi] API调用失败: ${key}`, err)
      
      // 如果是Token过期错误，触发回调
      if (err.response?.status === 401 && onTokenRefresh) {
        try {
          await onTokenRefresh()
          // Token刷新成功后重试
          return await executeApiCallWithRetry(apiCall, key, 1, 0)
        } catch (refreshErr) {
          console.error(`[useTokenSafeApi] Token刷新后重试失败: ${key}`, refreshErr)
          throw refreshErr
        }
      }
      
      throw err
    } finally {
      loading.value = false
      // 清理活跃调用
      apiCallState.activeCalls.delete(key)
    }
  }

  /**
   * 带重试机制的API调用执行
   */
  const executeApiCallWithRetry = async (apiCall, key, maxRetries, delay) => {
    let lastError = null

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[useTokenSafeApi] 执行API调用 (${attempt + 1}/${maxRetries + 1}): ${key}`)
        const result = await apiCall()
        return result
      } catch (error) {
        lastError = error
        
        // 如果是最后一次尝试，或者是不可重试的错误，直接抛出
        if (attempt === maxRetries || !isRetryableError(error)) {
          break
        }

        // 等待后重试
        if (delay > 0) {
          console.log(`[useTokenSafeApi] ${delay}ms后重试: ${key}`)
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      }
    }

    throw lastError
  }

  /**
   * 判断错误是否可重试
   */
  const isRetryableError = (error) => {
    if (!error.response) {
      // 网络错误通常可重试
      return true
    }

    const status = error.response.status
    
    // 5xx服务器错误和429限流错误可重试
    if (status >= 500 || status === 429) {
      return true
    }

    // 401认证错误在某些情况下可重试（Token刷新场景）
    if (status === 401) {
      return false // 让上层处理Token刷新
    }

    // 其他客户端错误不重试
    return false
  }

  /**
   * 批量API调用（并行执行，但控制并发数）
   */
  const batchApiCalls = async (apiCalls, concurrency = 3) => {
    const results = []
    
    for (let i = 0; i < apiCalls.length; i += concurrency) {
      const batch = apiCalls.slice(i, i + concurrency)
      const batchPromises = batch.map((call, index) => 
        safeApiCall(call.apiCall, { ...call.options, key: `batch-${i + index}` })
      )
      
      const batchResults = await Promise.allSettled(batchPromises)
      results.push(...batchResults)
      
      // 批次间短暂延迟
      if (i + concurrency < apiCalls.length) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }
    
    return results
  }

  /**
   * 清理缓存
   */
  const clearCache = (key) => {
    if (key) {
      apiCallState.lastCallTimestamp.delete(key)
      apiCallState.activeCalls.delete(key)
      apiCallState.cachedResults.delete(key)
    } else {
      // 清理所有缓存
      apiCallState.lastCallTimestamp.clear()
      apiCallState.activeCalls.clear()
      apiCallState.cachedResults.clear()
    }
  }

  /**
   * 取消进行中的API调用
   */
  const cancelApiCall = (key) => {
    if (apiCallState.activeCalls.has(key)) {
      apiCallState.activeCalls.delete(key)
      console.log(`[useTokenSafeApi] 取消API调用: ${key}`)
    }
  }

  return {
    loading,
    error,
    canMakeApiCall,
    safeApiCall,
    batchApiCalls,
    clearCache,
    cancelApiCall,
    apiCallState
  }
}

/**
 * 预定义的常用API调用配置
 */
export const commonApiConfigs = {
  // 文件操作
  fileUpload: {
    key: 'file-upload',
    useCache: false,
    retryAttempts: 1
  },
  fileList: {
    key: 'file-list',
    useCache: true,
    retryAttempts: 2
  },
  
  // 群组操作
  groupCreate: {
    key: 'group-create',
    useCache: false,
    retryAttempts: 1
  },
  groupList: {
    key: 'group-list',
    useCache: true,
    retryAttempts: 2
  },
  
  // 提醒操作
  reminderList: {
    key: 'reminder-list',
    useCache: true,
    retryAttempts: 2
  },
  
  // 仪表板数据
  dashboardStats: {
    key: 'dashboard-stats',
    useCache: true,
    retryAttempts: 3
  }
}

export default useTokenSafeApi