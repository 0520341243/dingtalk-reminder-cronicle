/**
 * 任务管理 API 模块
 * MongoDB任务相关接口
 */

import api from '../index'

export const taskAPI = {
  // 获取任务列表
  async getTasks(params = {}) {
    return api.get('/mongo/tasks', { params })
  },

  // 获取任务详情
  async getTask(id) {
    return api.get(`/mongo/tasks/${id}`)
  },

  // 创建任务
  async createTask(data) {
    return api.post('/mongo/tasks', data)
  },

  // 更新任务
  async updateTask(id, data) {
    return api.put(`/mongo/tasks/${id}`, data)
  },

  // 删除任务
  async deleteTask(id) {
    return api.delete(`/mongo/tasks/${id}`)
  },

  // 更新任务状态
  async updateTaskStatus(id, status) {
    return api.patch(`/mongo/tasks/${id}/status`, { status })
  },

  // 批量操作任务
  async batchOperateTasks(operation, taskIds) {
    return api.post('/mongo/tasks/batch', {
      operation,
      taskIds
    })
  },

  // 复制任务
  async duplicateTask(id) {
    return api.post(`/mongo/tasks/${id}/duplicate`)
  },

  // 获取任务统计信息
  async getTaskStatistics() {
    return api.get('/mongo/tasks/statistics')
  },

  // 获取任务执行历史
  async getTaskHistory(id, params = {}) {
    return api.get(`/mongo/tasks/${id}/history`, { params })
  },

  // 批量删除任务
  async batchDeleteTasks(taskIds) {
    return api.post('/mongo/tasks/batch-delete', { taskIds })
  },

  // 批量切换任务状态
  async batchToggleStatus(taskIds, status) {
    return api.post('/mongo/tasks/batch-status', { taskIds, status })
  }
}