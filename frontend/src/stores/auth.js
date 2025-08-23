import { defineStore } from 'pinia'
import { ref, computed, readonly, nextTick } from 'vue'
import api from '@/api'
import { authApi } from '@/api/modules/auth'

export const useAuthStore = defineStore('auth', () => {
  // 状态
  const token = ref('')
  const user = ref(null)
  const loading = ref(false)

  // 计算属性
  const isAuthenticated = computed(() => !!token.value)
  const isLoggedIn = computed(() => !!token.value) // 别名，用于自动退出逻辑
  const isAdmin = computed(() => user.value?.role === 'admin')

  // 设置token
  function setToken(newToken) {
    token.value = newToken
    if (newToken) {
      localStorage.setItem('token', newToken)
      api.defaults.headers.common['Authorization'] = `Bearer ${newToken}`
    } else {
      localStorage.removeItem('token')
      delete api.defaults.headers.common['Authorization']
    }
  }

  // 设置用户信息
  function setUser(userInfo) {
    user.value = userInfo
    // 强制触发下一个DOM更新周期，确保所有computed属性和UI组件响应变化
    nextTick(() => {
      console.log('[Auth] 用户状态更新完成，触发UI响应:', {
        userId: userInfo?.id,
        role: userInfo?.role,
        isAdminComputed: isAdmin.value
      })
    })
  }

  // 登录
  async function login(credentials) {
    try {
      loading.value = true
      const response = await authApi.login(credentials)
      
      // 兼容MongoDB API和PostgreSQL API的响应格式
      const data = response.data
      const accessToken = data.accessToken || data.token
      const refreshToken = data.refreshToken
      const userInfo = data.user || data
      
      // 使用访问令牌作为主要的认证token
      setToken(accessToken)
      setUser(userInfo)
      
      // 存储刷新令牌
      if (refreshToken) {
        localStorage.setItem('refreshToken', refreshToken)
      }
      
      return { success: true, data: response.data }
    } catch (error) {
      return { 
        success: false, 
        message: error.response?.data?.message || error.response?.data?.error || '登录失败' 
      }
    } finally {
      loading.value = false
    }
  }

  // 刷新token
  async function refreshToken() {
    try {
      const refreshToken = localStorage.getItem('refreshToken')
      if (!refreshToken) {
        throw new Error('No refresh token available')
      }
      
      const response = await authApi.refreshToken(refreshToken)
      const { accessToken, refreshToken: newRefreshToken, user: userInfo } = response.data
      
      // 更新token和用户信息
      setToken(accessToken)
      
      // 确保用户信息正确更新，添加防御性检查和强制响应式更新
      if (userInfo && userInfo.id) {
        // 强制更新用户信息以触发所有computed属性的重新计算
        const previousRole = user.value?.role
        setUser(userInfo)
        
        // 验证 isAdmin 计算属性是否正确更新
        const currentIsAdmin = userInfo.role === 'admin'
        console.log('[Auth] Token刷新成功，用户状态已更新:', { 
          userId: userInfo.id, 
          username: userInfo.username,
          role: userInfo.role,
          previousRole,
          isAdmin: currentIsAdmin,
          isAdminComputed: isAdmin.value,
          stateConsistency: currentIsAdmin === isAdmin.value
        })
        
        // 如果状态不一致，强制触发响应式更新
        if (currentIsAdmin !== isAdmin.value) {
          console.warn('[Auth] 检测到状态不一致，强制刷新用户状态')
          // 通过临时清除再重新设置来强制触发响应式更新
          user.value = null
          await new Promise(resolve => setTimeout(resolve, 10)) // 短暂延迟确保响应式系统处理
          setUser(userInfo)
        }
      } else {
        console.warn('[Auth] Token刷新成功但用户信息缺失，尝试从profile接口获取')
        // 如果用户信息缺失，尝试获取当前用户信息
        await fetchUserInfo()
      }
      
      // 更新刷新令牌（如果返回了新的）
      if (newRefreshToken) {
        localStorage.setItem('refreshToken', newRefreshToken)
      }
      
      return { success: true, accessToken }
    } catch (error) {
      console.error('[Auth] Token刷新失败:', error)
      // 刷新失败，清除所有认证信息
      logout()
      throw error
    }
  }

  // 获取用户信息
  async function fetchUserInfo() {
    try {
      const response = await authApi.getProfile()
      // 兼容不同的响应格式
      const userInfo = response.data?.user || response.user || response.data
      console.log('[Auth] 获取用户信息成功:', userInfo)
      setUser(userInfo)
      return userInfo
    } catch (error) {
      // 只有在401/403错误时才清除token，其他错误可能是网络问题
      if (error.response?.status === 401 || error.response?.status === 403) {
        logout()
      }
      throw error
    }
  }

  // 登出
  function logout() {
    setToken('')
    setUser(null)
    localStorage.removeItem('refreshToken')
  }

  // 修改密码
  async function changePassword(passwordData) {
    try {
      loading.value = true
      await api.post('/auth/change-password', passwordData)
      return { success: true, message: '密码修改成功' }
    } catch (error) {
      return { 
        success: false, 
        message: error.response?.data?.error || '密码修改失败' 
      }
    } finally {
      loading.value = false
    }
  }

  // 初始化认证状态（从localStorage恢复）
  function initAuth() {
    const storedToken = localStorage.getItem('token')
    if (storedToken) {
      setToken(storedToken)
    }
  }

  return {
    // 状态
    token: readonly(token),
    user: readonly(user),
    loading: readonly(loading),
    
    // 计算属性
    isAuthenticated,
    isLoggedIn,
    isAdmin,
    
    // 方法
    setToken,
    setUser,
    login,
    logout,
    refreshToken,
    fetchUserInfo,
    changePassword,
    initAuth
  }
})