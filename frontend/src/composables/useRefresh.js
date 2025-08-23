/**
 * 全局自动刷新机制 - Vue 3 Composition API
 * 
 * 功能特性：
 * - 智能防抖动刷新，避免频繁API调用
 * - Token认证感知，避免与认证系统冲突
 * - Redis缓存友好，优化网络请求
 * - 事件驱动更新，支持组件间通信
 * - 可配置刷新策略和间隔
 */

import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { ElMessage } from 'element-plus'

// 全局事件总线
class GlobalEventBus {
  constructor() {
    this.events = {}
    this.refreshQueue = new Set()
    this.isRefreshing = false
  }

  // 订阅事件
  on(event, callback) {
    if (!this.events[event]) {
      this.events[event] = []
    }
    this.events[event].push(callback)
  }

  // 取消订阅
  off(event, callback) {
    if (!this.events[event]) return
    this.events[event] = this.events[event].filter(cb => cb !== callback)
  }

  // 触发事件
  emit(event, ...args) {
    if (!this.events[event]) return
    this.events[event].forEach(callback => {
      try {
        callback(...args)
      } catch (error) {
        console.error(`[GlobalEventBus] 事件处理器执行失败 - ${event}:`, error)
      }
    })
  }

  // 添加到刷新队列
  queueRefresh(key, refreshFn, delay = 500) {
    if (this.isRefreshing) {
      console.log(`[GlobalEventBus] 刷新中，跳过 ${key}`)
      return
    }

    this.refreshQueue.add({ key, refreshFn, timestamp: Date.now() })
    
    // 防抖动处理
    clearTimeout(this.refreshTimer)
    this.refreshTimer = setTimeout(() => {
      this.processRefreshQueue()
    }, delay)
  }

  // 处理刷新队列
  async processRefreshQueue() {
    if (this.refreshQueue.size === 0 || this.isRefreshing) return

    this.isRefreshing = true
    console.log(`[GlobalEventBus] 开始批量刷新，队列大小: ${this.refreshQueue.size}`)

    const refreshItems = Array.from(this.refreshQueue)
    this.refreshQueue.clear()

    try {
      // 并行执行刷新任务，但限制并发数
      const concurrentLimit = 3
      for (let i = 0; i < refreshItems.length; i += concurrentLimit) {
        const batch = refreshItems.slice(i, i + concurrentLimit)
        await Promise.all(
          batch.map(async ({ key, refreshFn }) => {
            try {
              await refreshFn()
              console.log(`[GlobalEventBus] 刷新成功: ${key}`)
            } catch (error) {
              console.error(`[GlobalEventBus] 刷新失败: ${key}`, error)
              // 如果是认证错误，不显示错误消息（让auth store处理）
              if (!error.response || error.response.status !== 401) {
                ElMessage.error(`刷新${key}失败`)
              }
            }
          })
        )
        
        // 批次间短暂延迟，避免服务器压力
        if (i + concurrentLimit < refreshItems.length) {
          await new Promise(resolve => setTimeout(resolve, 100))
        }
      }
    } finally {
      this.isRefreshing = false
      console.log('[GlobalEventBus] 批量刷新完成')
    }
  }
}

// 全局事件总线实例
const globalEventBus = new GlobalEventBus()

/**
 * 智能刷新配置
 */
const REFRESH_CONFIG = {
  // 防抖动延迟
  debounceDelay: 500,
  // 自动刷新间隔（毫秒）
  autoRefreshInterval: 30000, // 30秒
  // 最大重试次数
  maxRetries: 3,
  // 重试延迟
  retryDelay: 1000,
  // 需要自动刷新的页面
  autoRefreshPages: ['files', 'groups', 'reminders', 'dashboard'],
  // Token刷新冷却时间
  tokenRefreshCooldown: 5000
}

/**
 * 使用智能刷新的组合式函数
 * @param {Object} options 配置选项
 * @param {Function} options.fetchFn 数据获取函数
 * @param {String} options.key 唯一标识键
 * @param {Boolean} options.autoRefresh 是否启用自动刷新
 * @param {Number} options.interval 自动刷新间隔
 * @param {Array} options.events 监听的事件列表
 */
export function useSmartRefresh(options = {}) {
  const {
    fetchFn,
    key = 'default',
    autoRefresh = false,
    interval = REFRESH_CONFIG.autoRefreshInterval,
    events = [],
    dependencies = []
  } = options

  const authStore = useAuthStore()
  const loading = ref(false)
  const error = ref(null)
  const lastRefresh = ref(null)
  const retryCount = ref(0)

  // 计算属性：是否可以刷新
  const canRefresh = computed(() => {
    // 检查认证状态
    if (!authStore.isAuthenticated) {
      return false
    }
    
    // 检查是否在Token刷新冷却期
    const now = Date.now()
    const cooldownEnd = lastRefresh.value + REFRESH_CONFIG.tokenRefreshCooldown
    if (lastRefresh.value && now < cooldownEnd) {
      return false
    }
    
    return !loading.value
  })

  // 手动刷新函数
  const refresh = async (force = false) => {
    if (!force && !canRefresh.value) {
      console.log(`[useSmartRefresh] 跳过刷新 - ${key}, canRefresh: ${canRefresh.value}`)
      return
    }

    if (!fetchFn) {
      console.warn(`[useSmartRefresh] 缺少fetchFn - ${key}`)
      return
    }

    loading.value = true
    error.value = null

    try {
      console.log(`[useSmartRefresh] 开始刷新 - ${key}`)
      await fetchFn()
      lastRefresh.value = Date.now()
      retryCount.value = 0
      console.log(`[useSmartRefresh] 刷新成功 - ${key}`)
      
      // 触发刷新完成事件
      globalEventBus.emit('refresh:complete', key)
    } catch (err) {
      error.value = err
      console.error(`[useSmartRefresh] 刷新失败 - ${key}:`, err)

      // 自动重试机制
      if (retryCount.value < REFRESH_CONFIG.maxRetries) {
        retryCount.value++
        console.log(`[useSmartRefresh] 开始重试 ${retryCount.value}/${REFRESH_CONFIG.maxRetries} - ${key}`)
        
        setTimeout(() => {
          refresh(true)
        }, REFRESH_CONFIG.retryDelay * retryCount.value)
      } else {
        console.error(`[useSmartRefresh] 重试次数已达上限 - ${key}`)
        // 如果不是认证错误，显示错误消息
        if (!err.response || err.response.status !== 401) {
          ElMessage.error(`刷新数据失败: ${key}`)
        }
      }
    } finally {
      loading.value = false
    }
  }

  // 队列刷新函数（防抖动）
  const queueRefresh = () => {
    globalEventBus.queueRefresh(key, refresh, REFRESH_CONFIG.debounceDelay)
  }

  // 自动刷新定时器
  let autoRefreshTimer = null

  // 启动自动刷新
  const startAutoRefresh = () => {
    if (autoRefreshTimer) return

    autoRefreshTimer = setInterval(() => {
      if (canRefresh.value && document.visibilityState === 'visible') {
        refresh()
      }
    }, interval)

    console.log(`[useSmartRefresh] 启动自动刷新 - ${key}, 间隔: ${interval}ms`)
  }

  // 停止自动刷新
  const stopAutoRefresh = () => {
    if (autoRefreshTimer) {
      clearInterval(autoRefreshTimer)
      autoRefreshTimer = null
      console.log(`[useSmartRefresh] 停止自动刷新 - ${key}`)
    }
  }

  // 事件处理器
  const eventHandlers = {}

  // 监听指定事件
  events.forEach(event => {
    eventHandlers[event] = () => {
      console.log(`[useSmartRefresh] 收到事件 ${event} - ${key}`)
      queueRefresh()
    }
    globalEventBus.on(event, eventHandlers[event])
  })

  // 初始化函数
  const initialize = async () => {
    console.log(`[useSmartRefresh] 组件挂载 - ${key}`)
    
    // 初始数据加载
    await nextTick()
    if (fetchFn && canRefresh.value) {
      await refresh(true)
    }

    // 启动自动刷新（如果启用）
    if (autoRefresh) {
      startAutoRefresh()
    }

    // 监听页面可见性变化
    document.addEventListener('visibilitychange', handleVisibilityChange)
  }

  // 组件挂载时的初始化 - 不使用async
  onMounted(() => {
    initialize()
  })

  // 组件卸载时的清理
  onUnmounted(() => {
    console.log(`[useSmartRefresh] 组件卸载 - ${key}`)
    
    // 停止自动刷新
    stopAutoRefresh()

    // 取消事件监听
    events.forEach(event => {
      if (eventHandlers[event]) {
        globalEventBus.off(event, eventHandlers[event])
      }
    })

    // 移除页面可见性监听
    document.removeEventListener('visibilitychange', handleVisibilityChange)
  })

  // 页面可见性变化处理
  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible' && canRefresh.value) {
      // 页面重新可见时刷新数据
      queueRefresh()
    }
  }

  return {
    loading,
    error,
    lastRefresh,
    retryCount,
    canRefresh,
    refresh,
    queueRefresh,
    startAutoRefresh,
    stopAutoRefresh
  }
}

/**
 * 全局事件触发器
 */
export const refreshEvents = {
  // 文件相关事件
  fileUploaded: (fileInfo) => globalEventBus.emit('file:uploaded', fileInfo),
  fileDeleted: (fileId) => globalEventBus.emit('file:deleted', fileId),
  filesChanged: () => globalEventBus.emit('files:changed'),

  // 群组相关事件
  groupCreated: (groupInfo) => globalEventBus.emit('group:created', groupInfo),
  groupCopied: (copyInfo) => globalEventBus.emit('group:copied', copyInfo),
  groupUpdated: (groupId) => globalEventBus.emit('group:updated', groupId),
  groupDeleted: (groupId) => globalEventBus.emit('group:deleted', groupId),
  groupsChanged: () => globalEventBus.emit('groups:changed'),

  // 提醒相关事件
  reminderCreated: (reminderInfo) => globalEventBus.emit('reminder:created', reminderInfo),
  reminderUpdated: (reminderId) => globalEventBus.emit('reminder:updated', reminderId),
  reminderDeleted: (reminderId) => globalEventBus.emit('reminder:deleted', reminderId),
  remindersChanged: () => globalEventBus.emit('reminders:changed'),

  // 系统事件
  dataChanged: () => globalEventBus.emit('data:changed'),
  authChanged: () => globalEventBus.emit('auth:changed')
}

/**
 * 页面级别的智能刷新配置
 */
export const pageRefreshConfig = {
  files: {
    key: 'files',
    autoRefresh: true,
    interval: 30000,
    events: ['file:uploaded', 'file:deleted', 'files:changed', 'data:changed']
  },
  groups: {
    key: 'groups',
    autoRefresh: true,
    interval: 30000,
    events: ['group:created', 'group:copied', 'group:updated', 'group:deleted', 'groups:changed', 'data:changed']
  },
  reminders: {
    key: 'reminders',
    autoRefresh: true,
    interval: 20000,
    events: ['reminder:created', 'reminder:updated', 'reminder:deleted', 'reminders:changed', 'data:changed']
  },
  dashboard: {
    key: 'dashboard',
    autoRefresh: true,
    interval: 15000,
    events: ['data:changed', 'auth:changed']
  },
  settings: {
    key: 'settings',
    autoRefresh: false,
    events: ['data:changed']
  }
}

export default {
  useSmartRefresh,
  refreshEvents,
  pageRefreshConfig,
  REFRESH_CONFIG
}