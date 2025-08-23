import request from '../index'

// 任务管理API - 使用V1版本（V2已删除）
const baseURL = '/mongo/tasks'

/**
 * 获取任务列表
 */
export const getTaskList = (params) => {
  return request.get(baseURL, { params })
}

/**
 * 获取任务详情
 */
export const getTaskDetail = (id) => {
  return request.get(`${baseURL}/${id}`)
}

/**
 * 创建任务
 */
export const createTask = (data) => {
  return request.post(baseURL, data)
}

/**
 * 更新任务
 */
export const updateTask = (id, data) => {
  return request.put(`${baseURL}/${id}`, data)
}

/**
 * 删除任务
 */
export const deleteTask = (id) => {
  return request.delete(`${baseURL}/${id}`)
}

/**
 * 切换任务状态
 */
export const toggleTaskStatus = (id) => {
  return request.patch(`${baseURL}/${id}/toggle`, {})
}

/**
 * 复制任务
 */
export const duplicateTask = (id, data) => {
  return request.post(`${baseURL}/${id}/duplicate`, data)
}

/**
 * 手动执行任务
 */
export const executeTask = (id) => {
  return request.post(`${baseURL}/${id}/execute`, {})
}

/**
 * 获取任务执行历史
 */
export const getTaskHistory = (id, params) => {
  return request.get(`${baseURL}/${id}/history`, { params })
}

/**
 * 获取任务执行计划
 */
export const getTaskPlans = (id, params) => {
  return request.get(`${baseURL}/${id}/plans`, { params })
}

/**
 * 管理任务关联
 */
export const manageTaskAssociations = (id, data) => {
  return request.post(`${baseURL}/${id}/associations`, data)
}

/**
 * 获取任务统计
 */
export const getTaskStatistics = () => {
  return request.get(`${baseURL}/statistics/overview`)
}

/**
 * 批量执行任务
 */
export const batchExecuteTasks = (taskIds) => {
  return request.post('/mongo/tasks/batch-execute', { taskIds })
}

/**
 * 批量切换任务状态
 */
export const batchToggleStatus = (taskIds, targetStatus) => {
  return request.post('/mongo/tasks/batch-toggle-status', { taskIds, targetStatus })
}

/**
 * 批量删除任务
 */
export const batchDeleteTasks = (taskIds) => {
  return request.post('/mongo/tasks/batch-delete', { taskIds })
}

export default {
  getTaskList,
  getTaskDetail,
  createTask,
  updateTask,
  deleteTask,
  toggleTaskStatus,
  duplicateTask,
  executeTask,
  getTaskHistory,
  getTaskPlans,
  manageTaskAssociations,
  getTaskStatistics,
  batchExecuteTasks,
  batchToggleStatus,
  batchDeleteTasks
}