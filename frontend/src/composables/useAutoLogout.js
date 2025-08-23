import { ref, onMounted, onUnmounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useAuthStore } from '@/stores/auth'
import { useRouter } from 'vue-router'

/**
 * 自动退出登录组合式函数
 * 5分钟无操作自动退出
 */
export function useAutoLogout() {
  const authStore = useAuthStore()
  const router = useRouter()
  
  const autoLogoutTime = 5 * 60 * 1000 // 5分钟，单位：毫秒
  const warningTime = 4.5 * 60 * 1000 // 4.5分钟时显示警告
  
  let logoutTimer = null
  let warningTimer = null
  let isWarningShown = false
  
  // 需要监听的用户活动事件
  const events = [
    'mousedown',
    'mousemove', 
    'keypress',
    'scroll',
    'touchstart',
    'click'
  ]
  
  // 重置定时器
  function resetTimer() {
    // 清除现有定时器
    if (logoutTimer) {
      clearTimeout(logoutTimer)
    }
    if (warningTimer) {
      clearTimeout(warningTimer)
    }
    
    isWarningShown = false
    
    // 设置警告定时器（4.5分钟后）
    warningTimer = setTimeout(() => {
      if (!isWarningShown && authStore.isLoggedIn) {
        showLogoutWarning()
      }
    }, warningTime)
    
    // 设置自动退出定时器（5分钟后）
    logoutTimer = setTimeout(() => {
      if (authStore.isLoggedIn) {
        performAutoLogout()
      }
    }, autoLogoutTime)
  }
  
  // 显示退出警告
  function showLogoutWarning() {
    if (!authStore.isLoggedIn) return
    
    isWarningShown = true
    
    ElMessageBox.alert(
      '您已经5分钟没有操作了，系统将在30秒后自动退出登录以确保安全。',
      '安全提醒',
      {
        confirmButtonText: '继续使用',
        type: 'warning',
        showClose: false,
        closeOnClickModal: false,
        closeOnPressEscape: false,
        callback: () => {
          // 用户点击"继续使用"，重置定时器
          resetTimer()
        }
      }
    )
    
    // 如果用户30秒内没有响应，强制退出
    setTimeout(() => {
      if (isWarningShown && authStore.isLoggedIn) {
        performAutoLogout()
      }
    }, 30000)
  }
  
  // 执行自动退出
  function performAutoLogout() {
    if (!authStore.isLoggedIn) return
    
    ElMessage({
      message: '长时间未操作，已自动退出登录',
      type: 'info',
      duration: 3000
    })
    
    // 清除用户状态
    authStore.logout()
    
    // 跳转到登录页
    router.push('/login')
  }
  
  // 事件处理器
  function handleUserActivity() {
    if (authStore.isLoggedIn) {
      resetTimer()
    }
  }
  
  // 启动自动退出功能
  function startAutoLogout() {
    if (!authStore.isLoggedIn) return
    
    // 绑定事件监听器
    events.forEach(event => {
      document.addEventListener(event, handleUserActivity, true)
    })
    
    // 初始化定时器
    resetTimer()
    
    console.log('自动退出功能已启动：5分钟无操作将自动退出')
  }
  
  // 停止自动退出功能
  function stopAutoLogout() {
    // 移除事件监听器
    events.forEach(event => {
      document.removeEventListener(event, handleUserActivity, true)
    })
    
    // 清除定时器
    if (logoutTimer) {
      clearTimeout(logoutTimer)
      logoutTimer = null
    }
    if (warningTimer) {
      clearTimeout(warningTimer)
      warningTimer = null
    }
    
    isWarningShown = false
    
    console.log('自动退出功能已停止')
  }
  
  // 组件挂载时启动
  onMounted(() => {
    if (authStore.isLoggedIn) {
      startAutoLogout()
    }
  })
  
  // 组件卸载时清理
  onUnmounted(() => {
    stopAutoLogout()
  })
  
  return {
    startAutoLogout,
    stopAutoLogout,
    resetTimer
  }
}