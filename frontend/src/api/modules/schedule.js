/**
 * 调度规则 API 模块
 * V2 系统调度相关接口
 */

import api from '../index'

export const scheduleAPI = {
  // 创建调度规则
  async createScheduleRule(taskId, rule) {
    return api.post(`/api/v2/tasks/${taskId}/schedules`, rule)
  },

  // 获取调度规则列表
  async getScheduleRules(taskId) {
    return api.get(`/api/v2/tasks/${taskId}/schedules`)
  },

  // 获取调度规则详情
  async getScheduleRule(taskId, ruleId) {
    return api.get(`/api/v2/tasks/${taskId}/schedules/${ruleId}`)
  },

  // 更新调度规则
  async updateScheduleRule(taskId, ruleId, rule) {
    return api.put(`/api/v2/tasks/${taskId}/schedules/${ruleId}`, rule)
  },

  // 删除调度规则
  async deleteScheduleRule(taskId, ruleId) {
    return api.delete(`/api/v2/tasks/${taskId}/schedules/${ruleId}`)
  },

  // 预览执行计划
  async previewSchedule(rule, days = 30) {
    return api.post('/api/v2/schedules/preview', {
      rule,
      days
    })
  },

  // 验证调度规则
  async validateScheduleRule(rule) {
    return api.post('/api/v2/schedules/validate', { rule })
  },

  // 获取执行计划
  async getExecutionPlans(params = {}) {
    return api.get('/api/v2/execution-plans', { params })
  },

  // 获取任务的执行计划
  async getTaskExecutionPlans(taskId, params = {}) {
    return api.get(`/api/v2/tasks/${taskId}/execution-plans`, { params })
  },

  // 手动触发任务执行
  async triggerTaskExecution(taskId, options = {}) {
    return api.post(`/api/v2/tasks/${taskId}/trigger`, options)
  },

  // 获取执行历史
  async getExecutionHistory(params = {}) {
    return api.get('/api/v2/execution-history', { params })
  },

  // 获取任务的执行历史
  async getTaskExecutionHistory(taskId, params = {}) {
    return api.get(`/api/v2/tasks/${taskId}/execution-history`, { params })
  },

  // 重新生成执行计划
  async regenerateExecutionPlans(taskId, params = {}) {
    return api.post(`/api/v2/tasks/${taskId}/regenerate-plans`, params)
  },

  // 获取调度统计信息
  async getScheduleStatistics() {
    return api.get('/api/v2/schedules/statistics')
  },

  // 获取系统调度状态
  async getSchedulerStatus() {
    return api.get('/api/v2/scheduler/status')
  },

  // 暂停/恢复调度器
  async toggleScheduler(action) {
    return api.post('/api/v2/scheduler/toggle', { action })
  }
}