/**
 * 统一的任务API适配器
 * 
 * 此文件作为过渡方案，将旧的三个API文件的功能统一到一个文件中
 * 保持向后兼容，允许现有代码继续工作
 * 
 * 迁移路径：
 * 1. 先使用此适配器确保功能正常
 * 2. 逐步更新各组件使用新的统一API
 * 3. 最终删除旧的API文件
 */

import api from '../index'

// ==================== 原 tasks.js 的 taskAPI ====================
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

// ==================== 原 tasksV2.js 的导出函数 ====================
const baseURL = '/mongo/tasks'

export const getTaskList = (params) => {
  return api.get(baseURL, { params })
}

export const getTaskDetail = (id) => {
  return api.get(`${baseURL}/${id}`)
}

export const createTask = (data) => {
  return api.post(baseURL, data)
}

export const updateTask = (id, data) => {
  return api.put(`${baseURL}/${id}`, data)
}

export const deleteTask = (id) => {
  return api.delete(`${baseURL}/${id}`)
}

export const toggleTaskStatus = (id) => {
  return api.patch(`${baseURL}/${id}/toggle`, {})
}

export const duplicateTask = (id) => {
  return api.post(`${baseURL}/${id}/duplicate`)
}

export const batchDeleteTasks = (ids) => {
  return api.post(`${baseURL}/batch-delete`, { taskIds: ids })  // 修改为 taskIds
}

export const batchToggleStatus = (ids, status) => {
  return api.post(`${baseURL}/batch-toggle-status`, { taskIds: ids, targetStatus: status })  // 修改路径和参数名
}

export const batchExecuteTasks = (ids) => {
  return api.post(`${baseURL}/batch-execute`, { taskIds: ids })  // 添加批量执行
}

export const testSchedule = (id, params) => {
  return api.post(`${baseURL}/${id}/test-schedule`, params)
}

export const getExecutionHistory = (id, params) => {
  return api.get(`${baseURL}/${id}/execution-history`, { params })
}

// tasksV2API 默认导出
const tasksV2API = {
  getTaskList,
  getTaskDetail,
  createTask,
  updateTask,
  deleteTask,
  toggleTaskStatus,
  duplicateTask,
  batchDeleteTasks,
  batchToggleStatus,
  batchExecuteTasks,
  testSchedule,
  getExecutionHistory,
  // 添加任务关联相关方法
  manageTaskAssociations: (taskId, data) => taskAssociationAPI.manageTaskAssociations(taskId, data)
}

export default tasksV2API

// ==================== 原 v2Tasks.js 的复杂功能 ====================

// 辅助函数：处理调度规则类型映射
const processScheduleRule = (data) => {
  const processedData = { ...data }
  if (processedData.scheduleRule) {
    // 将前端的 'daily' 转换为后端的 'by_day'
    if (processedData.scheduleRule.ruleType === 'daily') {
      processedData.scheduleRule.ruleType = 'by_day'
      // 设置为每天执行
      if (!processedData.scheduleRule.dayMode) {
        processedData.scheduleRule.dayMode = { type: 'every_day' }
      }
    }
    // 确保其他类型也正确映射
    const ruleTypeMapping = {
      'weekly': 'by_week',
      'interval': 'by_interval',
      'monthly': 'monthly',
      'yearly': 'yearly',
      'custom': 'custom'
    }
    if (ruleTypeMapping[processedData.scheduleRule.ruleType]) {
      processedData.scheduleRule.ruleType = ruleTypeMapping[processedData.scheduleRule.ruleType]
    }
  }
  return processedData
}

// V2 任务管理 API - 使用MongoDB路径
export const v2TasksAPI = {
  getTasks: (params = {}) => {
    return api({
      url: '/mongo/tasks',
      method: 'get',
      params
    })
  },

  getTaskStatistics: () => {
    return api({
      url: '/mongo/tasks/statistics',
      method: 'get'
    })
  },

  getTask: (taskId) => {
    return api({
      url: `/mongo/tasks/${taskId}`,
      method: 'get'
    })
  },

  createTask: (taskData) => {
    return api({
      url: '/mongo/tasks',
      method: 'post',
      data: processScheduleRule(taskData)
    })
  },

  updateTask: (taskId, taskData) => {
    return api({
      url: `/mongo/tasks/${taskId}`,
      method: 'put',
      data: processScheduleRule(taskData)
    })
  },

  deleteTask: (taskId) => {
    return api({
      url: `/mongo/tasks/${taskId}`,
      method: 'delete'
    })
  },

  batchDelete: (taskIds) => {
    return api({
      url: '/mongo/tasks/batch',
      method: 'delete',
      data: { taskIds }
    })
  },

  toggleStatus: (taskId) => {
    return api({
      url: `/mongo/tasks/${taskId}/toggle-status`,
      method: 'patch'
    })
  },

  batchToggleStatus: (taskIds, status) => {
    return api({
      url: '/mongo/tasks/batch/toggle-status',
      method: 'patch',
      data: { taskIds, status }
    })
  },

  duplicateTask: (taskId) => {
    return api({
      url: `/mongo/tasks/${taskId}/duplicate`,
      method: 'post'
    })
  },

  testSchedule: (taskId, dateRange) => {
    return api({
      url: `/mongo/tasks/${taskId}/test-schedule`,
      method: 'post',
      data: dateRange
    })
  }
}

// 任务关联管理 API
export const taskAssociationAPI = {
  // 获取任务的关联信息
  getTaskAssociations: (taskId) => {
    return api.get(`/mongo/tasks/${taskId}/associations`)
  },

  // 管理任务关联（创建/更新）
  manageTaskAssociations: (taskId, data) => {
    return api.post(`/mongo/tasks/${taskId}/associations`, data)
  },

  // 删除任务关联
  deleteTaskAssociation: (taskId, associationId) => {
    return api.delete(`/mongo/tasks/${taskId}/associations/${associationId}`)
  },

  // 兼容旧API
  getAssociations: (taskId) => {
    return api({
      url: `/v2/tasks/${taskId}/associations`,
      method: 'get'
    })
  },

  createAssociation: (associationData) => {
    return api({
      url: '/v2/tasks/associations',
      method: 'post',
      data: associationData
    })
  },

  updateAssociation: (associationId, associationData) => {
    return api({
      url: `/v2/tasks/associations/${associationId}`,
      method: 'put',
      data: associationData
    })
  },

  deleteAssociation: (associationId) => {
    return api({
      url: `/v2/tasks/associations/${associationId}`,
      method: 'delete'
    })
  },

  batchCreateAssociations: (associations) => {
    return api({
      url: '/v2/tasks/associations/batch',
      method: 'post',
      data: { associations }
    })
  }
}

// 执行计划管理 API
export const executionPlanAPI = {
  getExecutionPlan: (taskId, params = {}) => {
    return api({
      url: `/v2/tasks/${taskId}/execution-plan`,
      method: 'get',
      params
    })
  },

  previewExecutionPlan: (scheduleRule, dateRange) => {
    return api({
      url: '/v2/tasks/preview-execution',
      method: 'post',
      data: { scheduleRule: processScheduleRule({ scheduleRule }).scheduleRule, ...dateRange }
    })
  },

  getUpcomingExecutions: (params = {}) => {
    return api({
      url: '/v2/tasks/upcoming-executions',
      method: 'get',
      params
    })
  },

  // 获取任务执行计划
  getTaskExecutionPlans: (taskId, params = {}) => {
    return api({
      url: `/mongo/tasks/${taskId}/execution-plans`,
      method: 'get',
      params
    })
  },

  // 获取任务执行历史
  getTaskExecutionHistory: (taskId, params = {}) => {
    return api({
      url: `/mongo/tasks/${taskId}/execution-history`,
      method: 'get',
      params
    })
  },

  // 重新生成执行计划
  regenerateExecutionPlans: (taskId, params = {}) => {
    return api({
      url: `/mongo/tasks/${taskId}/regenerate-plans`,
      method: 'post',
      data: params
    })
  },

  // 触发任务执行
  triggerTaskExecution: (taskId, params = {}) => {
    return api({
      url: `/mongo/tasks/${taskId}/trigger`,
      method: 'post',
      data: params
    })
  }
}

// 调度统计 API
export const scheduleStatisticsAPI = {
  getDailyStatistics: (date) => {
    return api({
      url: '/v2/tasks/statistics/daily',
      method: 'get',
      params: { date }
    })
  },

  getWeeklyStatistics: (startDate, endDate) => {
    return api({
      url: '/v2/tasks/statistics/weekly',
      method: 'get',
      params: { startDate, endDate }
    })
  },

  getMonthlyStatistics: (year, month) => {
    return api({
      url: '/v2/tasks/statistics/monthly',
      method: 'get',
      params: { year, month }
    })
  },

  getTaskExecutionStats: (taskId, params = {}) => {
    return api({
      url: `/v2/tasks/${taskId}/statistics`,
      method: 'get',
      params
    })
  },

  // 获取调度统计（用于执行计划对话框）
  getScheduleStatistics: (taskId) => {
    return api({
      url: `/mongo/tasks/${taskId}/statistics`,
      method: 'get'
    })
  }
}

// 执行历史管理 API
export const executionHistoryAPI = {
  getHistory: (taskId, params = {}) => {
    return api({
      url: `/v2/tasks/${taskId}/execution-history`,
      method: 'get',
      params
    })
  },

  clearHistory: (taskId) => {
    return api({
      url: `/v2/tasks/${taskId}/execution-history`,
      method: 'delete'
    })
  },

  getFailedExecutions: (params = {}) => {
    return api({
      url: '/v2/tasks/execution-history/failed',
      method: 'get',
      params
    })
  },

  retryFailedExecution: (executionId) => {
    return api({
      url: `/v2/tasks/execution-history/${executionId}/retry`,
      method: 'post'
    })
  }
}