import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/Login.vue'),
    meta: { title: '登录' }
  },
  {
    path: '/',
    component: () => import('@/layouts/MainLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      {
        path: '',
        name: 'Dashboard',
        component: () => import('@/views/Dashboard.vue'),
        meta: { title: '仪表板', icon: 'DataBoard' }
      },
      {
        path: '/groups',
        name: 'Groups',
        component: () => import('@/views/Groups.vue'),
        meta: { title: '群组管理', icon: 'UserFilled' }
      },
      {
        path: '/files',
        name: 'Files',
        component: () => import('@/views/Files.vue'),
        meta: { title: '文件管理', icon: 'FolderOpened' }
      },
      {
        path: '/task-management',
        name: 'TaskManagement',
        component: () => import('@/views/TaskManagement.vue'),
        meta: { title: '任务管理', icon: 'AlarmClock' }
      },
      {
        path: '/test-schedule',
        name: 'TestSchedule',
        component: () => import('@/views/TestScheduleRule.vue'),
        meta: { title: '调度规则测试', icon: 'Calendar' }
      },
      {
        path: '/settings',
        name: 'Settings',
        component: () => import('@/views/Settings.vue'),
        meta: { title: '系统设置', icon: 'Setting', requiresAdmin: true }
      },
      {
        path: '/profile',
        name: 'Profile',
        component: () => import('@/views/Profile.vue'),
        meta: { title: '个人资料', icon: 'User', hidden: true }
      }
    ]
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: () => import('@/views/NotFound.vue'),
    meta: { title: '页面未找到' }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// 设置页面标题
router.afterEach((to) => {
  document.title = to.meta.title ? `${to.meta.title} - 钉钉提醒系统` : '钉钉提醒系统'
})

export default router