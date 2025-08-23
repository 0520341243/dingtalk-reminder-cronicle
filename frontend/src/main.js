import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import 'element-plus/theme-chalk/dark/css-vars.css'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import zhCn from 'element-plus/es/locale/lang/zh-cn'

import App from './App.vue'
import router from './router'
import { useAuthStore } from './stores/auth'

// 样式
import './styles/index.scss'

const app = createApp(App)

// Pinia状态管理
const pinia = createPinia()
app.use(pinia)

// 初始化认证状态
const authStore = useAuthStore()
authStore.initAuth()

// 路由
app.use(router)

// Element Plus
app.use(ElementPlus, {
  locale: zhCn,
})

// 注册Element Plus图标
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}

// 路由守卫
router.beforeEach(async (to, from, next) => {
  const authStore = useAuthStore()
  
  // 检查是否需要认证
  if (to.meta.requiresAuth) {
    // 如果没有认证状态，尝试从localStorage恢复token
    if (!authStore.isAuthenticated) {
      const token = localStorage.getItem('token')
      if (token) {
        // 恢复token到store
        authStore.setToken(token)
        
        // 尝试获取用户信息验证token有效性
        try {
          await authStore.fetchUserInfo()
          // token有效，继续导航
          next()
        } catch (error) {
          // token无效或过期，清除并跳转到登录页
          console.warn('Token validation failed:', error.message)
          authStore.logout()
          next('/login')
        }
      } else {
        // 没有token，跳转到登录页
        next('/login')
      }
    } else {
      // 已经认证，直接继续
      next()
    }
  } else if (to.path === '/login' && authStore.isAuthenticated) {
    // 已登录用户访问登录页，重定向到首页
    next('/')
  } else {
    // 不需要认证的路由，直接继续
    next()
  }
})

app.mount('#app')