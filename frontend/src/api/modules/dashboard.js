import api from '../index'

export const dashboardApi = {
  // 获取仪表板概览数据
  getOverview() {
    return api.get('/mongo/dashboard/overview')
  },

  // 获取实时状态信息
  getStatus() {
    return api.get('/mongo/dashboard/status')
  },

  // 获取消息发送统计
  getStatistics(params = {}) {
    return api.get('/mongo/dashboard/statistics', { params })
  },

  // 获取错误报告
  getErrors(params = {}) {
    return api.get('/mongo/dashboard/errors', { params })
  },

  // 获取性能指标
  getPerformance(params = {}) {
    return api.get('/mongo/dashboard/performance', { params })
  }
}