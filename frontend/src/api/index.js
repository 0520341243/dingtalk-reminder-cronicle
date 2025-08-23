import axios from 'axios'
import { ElMessage } from 'element-plus'
import router from '@/router'
import { API_PATHS } from '@/config/api.config'

let isRefreshing = false
let failedQueue = []
let refreshPromise = null // 缓存刷新Promise以防止重复刷新

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error)
    } else {
      prom.resolve(token)
    }
  })
  
  failedQueue = []
  refreshPromise = null // 清除刷新Promise缓存
}

// 动态设置API基础URL - 支持局域网访问
const getBaseURL = () => {
  // 开发环境使用vite代理
  if (import.meta.env.DEV) {
    return '/api'
  }
  // 生产环境根据访问地址动态调整
  const hostname = window.location.hostname
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://localhost:3000/api'
  }
  // 局域网或其他地址
  return `http://${hostname}:3000/api`
}

// 创建axios实例
const api = axios.create({
  baseURL: getBaseURL(),
  timeout: 30000,
  withCredentials: true, // 允许携带cookie
  headers: {
    'Content-Type': 'application/json'
  }
})

// 从cookie中获取CSRF token
function getCsrfToken() {
  const name = 'csrf-token='
  const decodedCookie = decodeURIComponent(document.cookie)
  const cookies = decodedCookie.split(';')
  
  for (let cookie of cookies) {
    cookie = cookie.trim()
    if (cookie.indexOf(name) === 0) {
      return cookie.substring(name.length)
    }
  }
  return null
}

// 请求拦截器
api.interceptors.request.use(
  (config) => {
    // 从localStorage获取token
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    
    // 添加CSRF token
    const csrfToken = getCsrfToken()
    if (csrfToken) {
      config.headers['x-csrf-token'] = csrfToken
    }
    
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// 响应拦截器
api.interceptors.response.use(
  (response) => {
    return response
  },
  async (error) => {
    const { response } = error
    const originalRequest = error.config

    if (response && response.status === 401 && !originalRequest._retry) {
      // 跳过特定的认证API，避免无限循环
      const authPath = API_PATHS.auth.replace('/api', '')
      if (originalRequest.url.includes(`${authPath}/refresh`) || 
          originalRequest.url.includes(`${authPath}/login`) ||
          originalRequest.url.includes(`${authPath}/profile`)) {
        if (!originalRequest.url.includes(`${authPath}/profile`)) {
          localStorage.removeItem('token')
          localStorage.removeItem('refreshToken')
          router.push('/login')
          ElMessage.error('登录已过期，请重新登录')
        }
        return Promise.reject(error)
      }

      if (isRefreshing) {
        // 如果正在刷新token，将请求加入队列
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        }).then(token => {
          originalRequest.headers.Authorization = `Bearer ${token}`
          return api(originalRequest)
        }).catch(err => {
          return Promise.reject(err)
        })
      }

      originalRequest._retry = true
      isRefreshing = true

      try {
        // 如果已有刷新Promise在进行中，复用该Promise避免重复刷新
        if (!refreshPromise) {
          // 动态导入auth store，避免循环依赖
          const { useAuthStore } = await import('@/stores/auth')
          const authStore = useAuthStore()
          
          refreshPromise = authStore.refreshToken()
        }
        
        const result = await refreshPromise
        processQueue(null, result.accessToken)
        
        // 确保所有后续请求使用新的token
        originalRequest.headers.Authorization = `Bearer ${result.accessToken}`
        
        // 额外验证：确保auth store状态正确更新
        const { useAuthStore } = await import('@/stores/auth')
        const authStore = useAuthStore()
        
        // 动态导入刷新事件系统，触发认证状态变更
        try {
          const { refreshEvents } = await import('@/composables/useRefresh')
          refreshEvents.authChanged()
          console.log('[API] 触发认证状态变更事件')
        } catch (error) {
          console.warn('[API] 无法导入刷新事件系统:', error)
        }
        
        console.log('[API] Token刷新完成，当前用户状态:', {
          isAuthenticated: authStore.isAuthenticated,
          isAdmin: authStore.isAdmin,
          userRole: authStore.user?.role,
          tokenUpdated: !!result.accessToken,
          queueSize: failedQueue.length
        })
        
        return api(originalRequest)
      } catch (refreshError) {
        processQueue(refreshError, null)
        localStorage.removeItem('token')
        localStorage.removeItem('refreshToken')
        router.push('/login')
        ElMessage.error('登录已过期，请重新登录')
        return Promise.reject(refreshError)
      } finally {
        isRefreshing = false
      }
    }

    if (response) {
      switch (response.status) {
        case 403:
          ElMessage.error('没有权限访问此资源')
          break
        
        case 404:
          ElMessage.error('请求的资源不存在')
          break
        
        case 500:
          ElMessage.error('服务器内部错误')
          break
        
        default:
          // 只有在不是认证相关和文件上传相关的错误时才显示通用错误消息
          if (!error.config.url.includes('/auth/') && !error.config.url.includes('/files/upload')) {
            ElMessage.error(response.data?.error || '请求失败')
          }
      }
    } else if (error.code === 'ECONNABORTED') {
      ElMessage.error('请求超时，请检查网络连接')
    } else {
      ElMessage.error('网络错误，请检查连接')
    }

    return Promise.reject(error)
  }
)

export default api