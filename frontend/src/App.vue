<template>
  <div id="app">
    <router-view />
    <!-- 自动刷新监控组件 (仅在开发环境显示) -->
    <AutoRefreshMonitor v-if="isDevelopment" />
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import AutoRefreshMonitor from '@/components/AutoRefreshMonitor.vue'

const authStore = useAuthStore()

// 检测是否为开发环境
const isDevelopment = import.meta.env.MODE === 'development'

onMounted(() => {
  // 应用启动时尝试恢复用户状态
  const token = localStorage.getItem('token')
  if (token) {
    authStore.setToken(token)
  }
  
  console.log('[App] 应用已启动，自动刷新系统已激活')
  console.log('[App] 开发环境监控:', isDevelopment)
})
</script>

<style lang="scss">
#app {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  color: var(--el-text-color-primary);
  min-height: 100vh;
}

body {
  margin: 0;
  padding: 0;
}

* {
  box-sizing: border-box;
}
</style>