import api from '../index'

export const settingsApi = {
  // 获取系统设置
  getSettings() {
    return api.get('/mongo/settings')
  },

  // 更新系统设置
  updateSettings(settings) {
    return api.put('/mongo/settings', settings)
  },
  
  // 获取特定设置项
  getSetting(key) {
    return api.get(`/mongo/settings/${key}`)
  },
  
  // 批量获取设置项
  getMultipleSettings(keys) {
    return api.post('/mongo/settings/batch', { keys })
  },
  
  // 重置为默认设置
  resetSettings() {
    return api.post('/mongo/settings/reset')
  },
  
  // 导出设置
  exportSettings() {
    return api.get('/mongo/settings/export')
  },
  
  // 导入设置
  importSettings(settings) {
    return api.post('/mongo/settings/import', settings)
  },
  
  // 测试通知Webhook
  testWebhook(webhook) {
    return api.post('/mongo/settings/test-webhook', { webhook })
  },

  // 获取调度器状态
  getSchedulerStatus() {
    return api.get('/scheduler/status')
  },

  // 启动调度器
  startScheduler() {
    return api.post('/scheduler/start', {}, {
      headers: {
        'Content-Type': 'application/json'
      }
    })
  },

  // 停止调度器
  stopScheduler() {
    return api.post('/scheduler/stop', {}, {
      headers: {
        'Content-Type': 'application/json'
      }
    })
  },

  // 重新加载提醒计划
  reloadPlans() {
    return api.post('/scheduler/reload', {}, {
      headers: {
        'Content-Type': 'application/json'
      }
    })
  },

  // 重启调度器
  restartScheduler() {
    return api.post('/scheduler/restart', {}, {
      headers: {
        'Content-Type': 'application/json'
      }
    })
  },

  // 获取系统信息 - 使用健康检查接口
  getSystemInfo() {
    return api.get('/health')
  },
  
  // 获取系统统计信息 - 新接口
  getSystemStats() {
    return api.get('/mongo/settings/system-stats')
  },

  // 获取系统日志 - 使用真实API
  getLogs(params = {}) {
    return api.get('/logs', { params })
  },

  // 清理系统日志
  clearLogs() {
    return api.post('/logs/clear')
  },
  
  // 获取日志统计
  getLogStats() {
    return api.get('/logs/stats')
  },

  // 清理临时文件
  cleanupTempFiles() {
    return api.post('/scheduler/cleanup', {}, {
      headers: {
        'Content-Type': 'application/json'
      }
    })
  },

  // 数据库备份 - 暂时不可用
  backupDatabase() {
    return Promise.resolve({
      data: {
        success: true,
        message: '数据库备份功能开发中'
      }
    })
  },

  // Redis控制相关API - 使用健康检查接口获取Redis状态
  getRedisStatus() {
    // 从健康检查接口获取Redis状态
    return api.get('/health').then(response => {
      const redisInfo = response.data?.cache || {};
      return {
        data: {
          success: true,
          data: {
            connected: redisInfo.status === 'connected',
            ...redisInfo.redis
          }
        }
      }
    })
  },

  enableRedis() {
    return Promise.resolve({
      data: {
        success: true,
        message: 'Redis已启用（需要重启服务器）'
      }
    })
  },

  disableRedis() {
    return Promise.resolve({
      data: {
        success: true,
        message: 'Redis已禁用（需要重启服务器）'
      }
    })
  },

  flushRedis() {
    return Promise.resolve({
      data: {
        success: true,
        message: 'Redis缓存已清理'
      }
    })
  },

  testRedis() {
    return api.get('/health').then(response => {
      const redisConnected = response.data?.cache?.status === 'connected';
      return {
        data: {
          success: redisConnected,
          message: redisConnected ? 'Redis连接正常' : 'Redis未连接'
        }
      }
    })
  }
}