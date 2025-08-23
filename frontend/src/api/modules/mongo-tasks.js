import api from '../index'
import { API_PATHS, API_BACKEND } from '@/config/api.config'

// 移除API_PATHS中的/api前缀，因为api模块已经有baseURL
const getPath = (path) => {
  return path.replace('/api', '')
}

const basePath = getPath(API_PATHS.tasks)

export const tasksApi = {
  // 获取任务列表
  getTasks(params = {}) {
    return api.get(basePath, { params })
  },

  // 获取任务详情
  getTask(id) {
    return api.get(`${basePath}/${id}`)
  },

  // 创建任务
  createTask(data) {
    // MongoDB API的字段名称调整
    if (API_BACKEND === 'mongodb') {
      // 转换字段名称以适配MongoDB API
      const mongoData = {
        ...data,
        scheduleRule: data.schedule_rule ? {
          rule_type: data.schedule_rule.rule_type,
          rule_config: data.schedule_rule.rule_config
        } : data.scheduleRule
      }
      delete mongoData.schedule_rule
      return api.post(basePath, mongoData)
    }
    return api.post(basePath, data)
  },

  // 更新任务
  updateTask(id, data) {
    return api.put(`${basePath}/${id}`, data)
  },

  // 删除任务
  deleteTask(id) {
    return api.delete(`${basePath}/${id}`)
  },

  // 暂停任务
  pauseTask(id) {
    return api.post(`${basePath}/${id}/pause`)
  },

  // 恢复任务
  resumeTask(id) {
    return api.post(`${basePath}/${id}/resume`)
  },

  // 立即执行任务
  executeTask(id) {
    return api.post(`${basePath}/${id}/execute`)
  },

  // 获取任务执行历史
  getTaskHistory(id, params = {}) {
    return api.get(`${basePath}/${id}/history`, { params })
  },

  // 获取即将执行的任务
  getUpcomingTasks(params = {}) {
    return api.get(`${basePath}/upcoming`, { params })
  },

  // 批量操作任务
  batchOperation(action, taskIds) {
    return api.post(`${basePath}/batch`, { action, taskIds })
  },

  // 获取任务统计
  getTaskStats() {
    return api.get(`${basePath}/stats`)
  }
}

// 默认导出
export default tasksApi