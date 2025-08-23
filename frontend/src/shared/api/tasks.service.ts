/**
 * 统一的任务管理 API 服务
 * 整合了 tasks.js、tasksV2.js 和 v2Tasks.js 的所有功能
 * 
 * 迁移说明：
 * - taskAPI (from tasks.js) -> 基础任务管理功能
 * - tasksV2API (from tasksV2.js) -> V2版本的简化API
 * - v2TasksAPI (from v2Tasks.js) -> 完整的V2功能，包括任务关联和执行计划
 */

import type { ApiResponse } from '../types/api.types';

// ==================== 类型定义 ====================

export interface Task {
  id: string;
  name: string;
  description?: string;
  status: 'active' | 'inactive' | 'completed' | 'pending';
  priority: 'high' | 'medium' | 'low';
  groupId?: string;
  enableTime?: string;
  disableTime?: string;
  contentSource?: 'manual' | 'worksheet';
  reminderTime?: string;
  messageContent?: string;
  fileConfig?: {
    fileId: number;
    worksheet: string;
  };
  scheduleRule?: ScheduleRule;
  createdAt?: string;
  updatedAt?: string;
}

export interface ScheduleRule {
  ruleType: 'by_day' | 'by_week' | 'by_interval' | 'monthly' | 'yearly' | 'custom';
  dayMode?: {
    type: 'every_day' | 'workdays' | 'weekends' | 'custom';
    customDays?: number[];
  };
  weekDays?: number[];
  interval?: {
    value: number;
    unit: 'days' | 'weeks' | 'months';
  };
  monthDay?: number;
  yearMonth?: number;
  yearDay?: number;
  excludeWeekends?: boolean;
  excludeHolidays?: boolean;
  specificDates?: string[];
  excludeDates?: string[];
}

export interface TaskAssociation {
  id: string;
  mainTaskId: string;
  associatedTaskId: string;
  priority: number;
  effectiveFrom?: string;
  effectiveTo?: string;
}

export interface ExecutionPlan {
  taskId: string;
  executionTimes: string[];
  nextExecution?: string;
  lastExecution?: string;
}

export interface TaskStatistics {
  total: number;
  active: number;
  inactive: number;
  completed: number;
  todayExecutions: number;
  weekExecutions: number;
  monthExecutions: number;
}

// ==================== 服务接口 ====================

export interface TasksService {
  // ========== 基础任务管理 (from tasks.js) ==========
  getTasks(params?: any): Promise<ApiResponse<Task[]>>;
  getTask(id: string): Promise<ApiResponse<Task>>;
  createTask(data: Partial<Task>): Promise<ApiResponse<Task>>;
  updateTask(id: string, data: Partial<Task>): Promise<ApiResponse<Task>>;
  deleteTask(id: string): Promise<ApiResponse<void>>;
  updateTaskStatus(id: string, status: Task['status']): Promise<ApiResponse<void>>;
  batchOperateTasks(operation: string, taskIds: string[]): Promise<ApiResponse<void>>;
  duplicateTask(id: string): Promise<ApiResponse<Task>>;
  getTaskStatistics(): Promise<ApiResponse<TaskStatistics>>;
  getTaskHistory(id: string, params?: any): Promise<ApiResponse<any[]>>;
  batchDeleteTasks(taskIds: string[]): Promise<ApiResponse<void>>;
  batchToggleStatus(taskIds: string[], status: Task['status']): Promise<ApiResponse<void>>;

  // ========== V2 简化功能 (from tasksV2.js) ==========
  toggleTaskStatus(id: string): Promise<ApiResponse<void>>;
  testTaskSchedule(id: string, params?: any): Promise<ApiResponse<any>>;
  exportTasks(params?: any): Promise<Blob>;
  importTasks(file: File): Promise<ApiResponse<any>>;

  // ========== V2 高级功能 (from v2Tasks.js) ==========
  // 任务关联管理
  getTaskAssociations(taskId: string): Promise<ApiResponse<TaskAssociation[]>>;
  createTaskAssociation(data: Partial<TaskAssociation>): Promise<ApiResponse<TaskAssociation>>;
  updateTaskAssociation(id: string, data: Partial<TaskAssociation>): Promise<ApiResponse<TaskAssociation>>;
  deleteTaskAssociation(id: string): Promise<ApiResponse<void>>;
  
  // 执行计划管理
  getExecutionPlan(taskId: string, params?: any): Promise<ApiResponse<ExecutionPlan>>;
  previewExecutionPlan(scheduleRule: ScheduleRule, params?: any): Promise<ApiResponse<string[]>>;
  
  // 批量操作增强
  batchUpdateTasks(taskIds: string[], updates: Partial<Task>): Promise<ApiResponse<void>>;
  batchDuplicateTasks(taskIds: string[]): Promise<ApiResponse<Task[]>>;
  
  // 执行历史增强
  getExecutionHistory(taskId: string, params?: any): Promise<ApiResponse<any[]>>;
  clearExecutionHistory(taskId: string): Promise<ApiResponse<void>>;
  
  // 调度统计
  getScheduleStatistics(params?: any): Promise<ApiResponse<any>>;
  getUpcomingExecutions(params?: any): Promise<ApiResponse<any[]>>;
}

// ==================== 服务实现工厂 ====================

/**
 * 创建统一的任务服务实例
 * @param apiClient API 客户端实例（axios 或其他 HTTP 客户端）
 */
export function createTasksService(apiClient: any): TasksService {
  // 处理调度规则类型映射
  const processScheduleRule = (data: any) => {
    if (!data.scheduleRule) return data;
    
    const processed = { ...data };
    const ruleTypeMapping: Record<string, string> = {
      'daily': 'by_day',
      'weekly': 'by_week',
      'interval': 'by_interval',
      'monthly': 'monthly',
      'yearly': 'yearly',
      'custom': 'custom'
    };
    
    if (processed.scheduleRule.ruleType === 'daily') {
      processed.scheduleRule.ruleType = 'by_day';
      if (!processed.scheduleRule.dayMode) {
        processed.scheduleRule.dayMode = { type: 'every_day' };
      }
    } else if (ruleTypeMapping[processed.scheduleRule.ruleType]) {
      processed.scheduleRule.ruleType = ruleTypeMapping[processed.scheduleRule.ruleType];
    }
    
    return processed;
  };

  return {
    // ========== 基础任务管理 ==========
    getTasks: (params) => apiClient.get('/mongo/tasks', { params }),
    getTask: (id) => apiClient.get(`/mongo/tasks/${id}`),
    createTask: (data) => apiClient.post('/mongo/tasks', processScheduleRule(data)),
    updateTask: (id, data) => apiClient.put(`/mongo/tasks/${id}`, processScheduleRule(data)),
    deleteTask: (id) => apiClient.delete(`/mongo/tasks/${id}`),
    updateTaskStatus: (id, status) => apiClient.patch(`/mongo/tasks/${id}/status`, { status }),
    batchOperateTasks: (operation, taskIds) => apiClient.post('/mongo/tasks/batch', { operation, taskIds }),
    duplicateTask: (id) => apiClient.post(`/mongo/tasks/${id}/duplicate`),
    getTaskStatistics: () => apiClient.get('/mongo/tasks/statistics'),
    getTaskHistory: (id, params) => apiClient.get(`/mongo/tasks/${id}/history`, { params }),
    batchDeleteTasks: (taskIds) => apiClient.post('/mongo/tasks/batch-delete', { taskIds }),
    batchToggleStatus: (taskIds, status) => apiClient.post('/mongo/tasks/batch-status', { taskIds, status }),

    // ========== V2 简化功能 ==========
    toggleTaskStatus: (id) => apiClient.patch(`/mongo/tasks/${id}/toggle`),
    testTaskSchedule: (id, params) => apiClient.post(`/mongo/tasks/${id}/test-schedule`, params),
    exportTasks: async (params) => {
      const response = await apiClient.get('/mongo/tasks/export', { 
        params,
        responseType: 'blob'
      });
      return response.data;
    },
    importTasks: (file) => {
      const formData = new FormData();
      formData.append('file', file);
      return apiClient.post('/mongo/tasks/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
    },

    // ========== V2 高级功能 ==========
    // 任务关联
    getTaskAssociations: (taskId) => apiClient.get(`/v2/tasks/${taskId}/associations`),
    createTaskAssociation: (data) => apiClient.post('/v2/tasks/associations', data),
    updateTaskAssociation: (id, data) => apiClient.put(`/v2/tasks/associations/${id}`, data),
    deleteTaskAssociation: (id) => apiClient.delete(`/v2/tasks/associations/${id}`),
    
    // 执行计划
    getExecutionPlan: (taskId, params) => apiClient.get(`/v2/tasks/${taskId}/execution-plan`, { params }),
    previewExecutionPlan: (scheduleRule, params) => apiClient.post('/v2/tasks/preview-execution', { scheduleRule, ...params }),
    
    // 批量操作
    batchUpdateTasks: (taskIds, updates) => apiClient.patch('/v2/tasks/batch', { taskIds, updates: processScheduleRule(updates) }),
    batchDuplicateTasks: (taskIds) => apiClient.post('/v2/tasks/batch-duplicate', { taskIds }),
    
    // 执行历史
    getExecutionHistory: (taskId, params) => apiClient.get(`/v2/tasks/${taskId}/execution-history`, { params }),
    clearExecutionHistory: (taskId) => apiClient.delete(`/v2/tasks/${taskId}/execution-history`),
    
    // 调度统计
    getScheduleStatistics: (params) => apiClient.get('/v2/tasks/schedule-statistics', { params }),
    getUpcomingExecutions: (params) => apiClient.get('/v2/tasks/upcoming-executions', { params })
  };
}

// ==================== 导出便捷访问 ====================

// 为了兼容旧代码，导出不同的命名风格
export const taskAPI = createTasksService;
export const tasksV2API = createTasksService;
export const v2TasksAPI = createTasksService;
export const taskAssociationAPI = {
  getAssociations: (taskId: string, apiClient: any) => 
    createTasksService(apiClient).getTaskAssociations(taskId),
  createAssociation: (data: any, apiClient: any) => 
    createTasksService(apiClient).createTaskAssociation(data),
  updateAssociation: (id: string, data: any, apiClient: any) => 
    createTasksService(apiClient).updateTaskAssociation(id, data),
  deleteAssociation: (id: string, apiClient: any) => 
    createTasksService(apiClient).deleteTaskAssociation(id)
};

export const executionPlanAPI = {
  getExecutionPlan: (taskId: string, params: any, apiClient: any) => 
    createTasksService(apiClient).getExecutionPlan(taskId, params),
  previewExecution: (rule: any, params: any, apiClient: any) => 
    createTasksService(apiClient).previewExecutionPlan(rule, params)
};

export const scheduleStatisticsAPI = {
  getStatistics: (params: any, apiClient: any) => 
    createTasksService(apiClient).getScheduleStatistics(params),
  getUpcoming: (params: any, apiClient: any) => 
    createTasksService(apiClient).getUpcomingExecutions(params)
};