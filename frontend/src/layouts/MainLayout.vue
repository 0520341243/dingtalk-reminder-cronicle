<template>
  <div class="main-layout">
    <el-container>
      <!-- 桌面端侧边栏 -->
      <el-aside width="240px" class="sidebar desktop-sidebar">
        <div class="logo">
          <h2>钉钉提醒系统</h2>
        </div>
        <el-menu
          :default-active="$route.path"
          class="sidebar-menu"
          router
          unique-opened
        >
          <el-menu-item index="/">
            <el-icon><DataBoard /></el-icon>
            <span>仪表板</span>
          </el-menu-item>
          <el-menu-item index="/groups">
            <el-icon><UserFilled /></el-icon>
            <span>群组管理</span>
          </el-menu-item>
          <el-menu-item index="/files">
            <el-icon><FolderOpened /></el-icon>
            <span>文件管理</span>
          </el-menu-item>
          <el-menu-item index="/task-management">
            <el-icon><AlarmClock /></el-icon>
            <span>任务管理</span>
          </el-menu-item>
          <el-menu-item index="/settings">
            <el-icon><Setting /></el-icon>
            <span>系统设置</span>
          </el-menu-item>
        </el-menu>
      </el-aside>

      <!-- 移动端抽屉导航 -->
      <el-drawer
        v-model="mobileDrawerVisible"
        direction="ltr"
        :with-header="false"
        :size="280"
        :z-index="3000"
        :modal="true"
        :close-on-click-modal="true"
        class="mobile-drawer"
      >
        <div class="mobile-sidebar">
          <div class="logo">
            <h2>钉钉提醒系统</h2>
          </div>
          <el-menu
            :default-active="$route.path"
            class="sidebar-menu"
            router
            unique-opened
            @select="closeMobileDrawer"
          >
            <el-menu-item index="/">
              <el-icon><DataBoard /></el-icon>
              <span>仪表板</span>
            </el-menu-item>
            <el-menu-item index="/groups">
              <el-icon><UserFilled /></el-icon>
              <span>群组管理</span>
            </el-menu-item>
            <el-menu-item index="/files">
              <el-icon><FolderOpened /></el-icon>
              <span>文件管理</span>
            </el-menu-item>
            <el-menu-item index="/task-management">
              <el-icon><AlarmClock /></el-icon>
              <span>任务管理</span>
            </el-menu-item>
            <el-menu-item index="/settings">
              <el-icon><Setting /></el-icon>
              <span>系统设置</span>
            </el-menu-item>
          </el-menu>
        </div>
      </el-drawer>

      <!-- 主内容区域 -->
      <el-container>
        <!-- 顶部导航 -->
        <el-header class="header">
          <div class="header-left">
            <!-- 移动端汉堡菜单按钮 -->
            <el-button
              class="mobile-menu-toggle"
              type="text"
              @click="toggleMobileDrawer"
            >
              <el-icon size="20"><Menu /></el-icon>
            </el-button>
            
            <!-- 页面标题 -->
            <div class="page-title-container">
              <h3 class="page-title">{{ getPageTitle() }}</h3>
              <el-breadcrumb separator="/" class="breadcrumb-desktop">
                <el-breadcrumb-item>{{ $route.meta.title || '首页' }}</el-breadcrumb-item>
              </el-breadcrumb>
            </div>
          </div>
          <div class="header-right">
            <el-dropdown>
              <span class="user-info">
                <el-icon><User /></el-icon>
                <span class="username-desktop">用户</span>
              </span>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item @click="$router.push('/profile')">个人资料</el-dropdown-item>
                  <el-dropdown-item divided @click="logout">退出登录</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
        </el-header>

        <!-- 主内容 -->
        <el-main class="main-content">
          <router-view />
        </el-main>
      </el-container>
    </el-container>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useAutoLogout } from '@/composables/useAutoLogout'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

// 移动端抽屉状态
const mobileDrawerVisible = ref(false)

// 启用自动退出功能
const { resetTimer } = useAutoLogout()

// 页面标题映射
const pageTitleMap = {
  '/': '仪表板',
  '/groups': '群组管理',
  '/files': '文件管理', 
  '/reminders': '常规提醒',
  '/task-management': '任务管理',
  '/settings': '系统设置',
  '/profile': '个人资料'
}

// 获取当前页面标题
const getPageTitle = () => {
  return pageTitleMap[route.path] || route.meta.title || '首页'
}

// 切换移动端抽屉
const toggleMobileDrawer = () => {
  mobileDrawerVisible.value = !mobileDrawerVisible.value
}

// 关闭移动端抽屉
const closeMobileDrawer = () => {
  mobileDrawerVisible.value = false
}

const logout = () => {
  // 使用认证store的logout方法
  authStore.logout()
  router.push('/login')
}
</script>

<style scoped>
.main-layout {
  height: 100vh;
}

/* 桌面端侧边栏样式 */
.desktop-sidebar {
  background-color: #304156;
  color: white;
}

.mobile-sidebar {
  background-color: #304156;
  color: white;
  height: 100%;
}

.logo {
  padding: 20px;
  text-align: center;
  border-bottom: 1px solid #434a5a;
}

.logo h2 {
  margin: 0;
  color: white;
  font-size: 18px;
}

.sidebar-menu {
  border: none;
  background-color: transparent;
}

.sidebar-menu .el-menu-item {
  color: #bfcbd9;
  padding: 0 20px;
  height: 50px;
  line-height: 50px;
}

.sidebar-menu .el-menu-item:hover,
.sidebar-menu .el-menu-item.is-active {
  background-color: #263445;
  color: #409eff;
}

/* 顶部导航样式 */
.header {
  background-color: white;
  border-bottom: 1px solid #e6e6e6;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 20px;
  position: relative;
  z-index: 10;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
  flex: 1;
}

.header-right {
  display: flex;
  align-items: center;
}

/* 移动端菜单按钮 */
.mobile-menu-toggle {
  display: none;
  padding: 8px;
  min-height: auto;
  color: #606266;
}

/* 页面标题 */
.page-title-container {
  flex: 1;
}

.page-title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  display: none;
}

.breadcrumb-desktop {
  display: block;
}

/* 用户信息 */
.user-info {
  display: flex;
  align-items: center;
  gap: 5px;
  cursor: pointer;
  color: #606266;
}

.username-desktop {
  display: inline;
}

/* 主内容区 */
.main-content {
  background-color: #f5f5f5;
  padding: 20px;
}

/* 移动端抽屉样式 */
.mobile-drawer :deep(.el-drawer__body) {
  padding: 0;
  background-color: #304156;
}

.mobile-drawer :deep(.el-drawer__header) {
  display: none;
}

.mobile-drawer :deep(.el-drawer) {
  border-radius: 0 16px 16px 0;
  box-shadow: 2px 0 16px rgba(0, 0, 0, 0.3);
}

/* 移动端菜单项触摸优化 */
.mobile-sidebar .sidebar-menu .el-menu-item {
  min-height: 56px;
  line-height: 56px;
  padding: 0 24px;
  font-size: 16px;
  transition: all 0.3s ease;
  -webkit-tap-highlight-color: transparent;
}

.mobile-sidebar .sidebar-menu .el-menu-item:active {
  background-color: #1c2836;
}

.mobile-sidebar .sidebar-menu .el-menu-item .el-icon {
  margin-right: 12px;
  font-size: 18px;
}

/* 移动端适配 */
@media (max-width: 767px) {
  /* 隐藏桌面端侧边栏 */
  .desktop-sidebar {
    display: none !important;
  }
  
  /* 显示移动端菜单按钮 */
  .mobile-menu-toggle {
    display: flex;
  }
  
  /* 移动端页面标题显示 */
  .page-title {
    display: block;
  }
  
  .breadcrumb-desktop {
    display: none;
  }
  
  /* 移动端用户信息只显示图标 */
  .username-desktop {
    display: none;
  }
  
  /* 移动端主内容区域 */
  .main-content {
    padding: 12px;
  }
  
  /* 移动端头部调整 */
  .header {
    padding: 0 16px;
    height: 56px;
  }
  
  .header-left {
    gap: 12px;
  }
  
  .page-title {
    font-size: 16px;
    font-weight: 500;
  }
}

/* 平板端适配 */
@media (min-width: 768px) and (max-width: 991px) {
  .main-content {
    padding: 16px;
  }
  
  .desktop-sidebar {
    width: 200px !important;
  }
  
  .logo h2 {
    font-size: 16px;
  }
  
  .sidebar-menu .el-menu-item {
    padding: 0 16px;
    height: 45px;
    line-height: 45px;
    font-size: 14px;
  }
}

/* 大屏幕优化 */
@media (min-width: 1200px) {
  .main-content {
    padding: 24px;
  }
}
</style>