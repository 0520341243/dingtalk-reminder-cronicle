import request from '@/api/index.js'

/**
 * V2 任务管理 API
 * 支持复杂调度规则和任务关联的新版本API
 */

// 任务基础管理
export const v2TasksAPI = {
  /**
   * 获取任务列表
   * @param {Object} params - 查询参数
   * @param {number} params.page - 页码
   * @param {number} params.limit - 每页数量
   * @param {string} params.status - 任务状态
   * @param {string} params.priority - 优先级
   * @param {string} params.groupId - 群组ID
   * @param {string} params.search - 搜索关键词
   * @param {string} params.sortBy - 排序字段
   * @param {string} params.sortOrder - 排序方式
   */
  getTasks: (params = {}) => {
    return request({
      url: '/v2/tasks',
      method: 'get',
      params
    })
  },

  /**
   * 获取任务统计信息
   */
  getTaskStatistics: () => {
    return request({
      url: '/api/v2/tasks/statistics',
      method: 'get'
    })
  },

  /**
   * 获取单个任务详情
   * @param {number} taskId - 任务ID
   */
  getTask: (taskId) => {
    return request({
      url: `/v2/tasks/${taskId}`,
      method: 'get'
    })
  },

  /**
   * 创建新任务
   * @param {Object} taskData - 任务数据
   * @param {string} taskData.name - 任务名称
   * @param {string} taskData.description - 任务描述
   * @param {string} taskData.priority - 优先级
   * @param {string} taskData.status - 状态
   * @param {string} taskData.enableTime - 启用时间
   * @param {string} taskData.disableTime - 禁用时间
   * @param {number} taskData.groupId - 群组ID
   * @param {string} taskData.contentSource - 内容来源 ('manual' | 'worksheet')
   * @param {string} taskData.reminderTime - 提醒时间 (manual模式必填)
   * @param {string} taskData.messageContent - 消息内容 (manual模式必填)
   * @param {Object} taskData.fileConfig - 文件配置 (worksheet模式必填)
   * @param {number} taskData.fileConfig.fileId - 文件ID
   * @param {string} taskData.fileConfig.worksheet - 工作表名称
   * @param {string} taskData.messageFormat - 消息格式
   * @param {Array} taskData.atPersons - @人员列表
   * @param {string} taskData.webhookUrl - Webhook URL
   * @param {string} taskData.webhookSecret - Webhook密钥
   * @param {boolean} taskData.enableRetry - 启用重试
   * @param {number} taskData.maxRetries - 最大重试次数
   * @param {boolean} taskData.enableLogging - 启用日志
   * @param {Object} taskData.scheduleRule - 调度规则
   */
  createTask: (taskData) => {
    // 转换调度规则类型，确保与后端枚举匹配
    const processedData = { ...taskData }
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
    
    return request({
      url: '/v2/tasks',
      method: 'post',
      data: processedData
    })
  },

  /**
   * 更新任务
   * @param {number} taskId - 任务ID
   * @param {Object} taskData - 更新数据
   */
  updateTask: (taskId, taskData) => {
    // 转换调度规则类型，确保与后端枚举匹配
    const processedData = { ...taskData }
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
    
    return request({
      url: `/v2/tasks/${taskId}`,
      method: 'put',
      data: processedData
    })
  },

  /**
   * 更新任务状态
   * @param {number} taskId - 任务ID
   * @param {string} status - 新状态
   */
  updateTaskStatus: (taskId, status) => {
    return request({
      url: `/v2/tasks/${taskId}/status`,
      method: 'patch',
      data: { status }
    })
  },

  /**
   * 删除任务
   * @param {number} taskId - 任务ID
   */
  deleteTask: (taskId) => {
    return request({
      url: `/v2/tasks/${taskId}`,
      method: 'delete'
    })
  },

  /**
   * 批量删除任务
   * @param {Array<number>} taskIds - 任务ID数组
   */
  batchDeleteTasks: (taskIds) => {
    return request({
      url: '/v2/tasks/batch-delete',
      method: 'post',
      data: { taskIds }
    })
  },

  /**
   * 批量执行任务
   * @param {Array<number>} taskIds - 任务ID数组
   */
  batchExecuteTasks: (taskIds) => {
    return request({
      url: '/v2/tasks/batch-execute',
      method: 'post',
      data: { taskIds }
    })
  },

  /**
   * 批量切换任务状态
   * @param {Array<number>} taskIds - 任务ID数组
   * @param {string} targetStatus - 目标状态 ('active' | 'paused')
   */
  batchToggleStatus: (taskIds, targetStatus) => {
    return request({
      url: '/v2/tasks/batch-toggle-status',
      method: 'post',
      data: { taskIds, targetStatus }
    })
  },

  /**
   * 切换单个任务状态
   * @param {number} taskId - 任务ID
   */
  toggleTaskStatus: (taskId) => {
    return request({
      url: `/v2/tasks/${taskId}/toggle-status`,
      method: 'post'
    })
  },

  /**
   * 执行单个任务
   * @param {number} taskId - 任务ID
   */
  executeTask: (taskId) => {
    return request({
      url: `/v2/tasks/${taskId}/execute`,
      method: 'post'
    })
  }
}

// 任务关联管理
export const taskAssociationAPI = {
  /**
   * 获取任务关联列表
   * @param {number} taskId - 任务ID
   */
  getTaskAssociations: (taskId) => {
    return request({
      url: `/v2/tasks/${taskId}/associations`,
      method: 'get'
    })
  },

  /**
   * 创建任务关联
   * @param {number} taskId - 主任务ID
   * @param {Object} associationData - 关联数据
   * @param {number} associationData.associatedTaskId - 关联任务ID
   * @param {string} associationData.relationshipType - 关联类型
   * @param {Object} associationData.priorityRule - 优先级规则
   * @param {number} associationData.suspendDuration - 暂停时长
   * @param {string} associationData.description - 描述
   */
  createTaskAssociation: (taskId, associationData) => {
    return request({
      url: `/v2/tasks/${taskId}/associations`,
      method: 'post',
      data: associationData
    })
  },

  /**
   * 删除任务关联
   * @param {number} taskId - 任务ID
   * @param {number} associationId - 关联ID
   */
  deleteTaskAssociation: (taskId, associationId) => {
    return request({
      url: `/v2/tasks/${taskId}/associations/${associationId}`,
      method: 'delete'
    })
  },

  /**
   * 检测任务冲突
   * @param {number} taskId - 任务ID
   */
  getTaskConflicts: (taskId) => {
    return request({
      url: `/v2/tasks/${taskId}/conflicts`,
      method: 'get'
    })
  }
}

// 执行计划管理
export const executionPlanAPI = {
  /**
   * 获取任务执行计划
   * @param {number} taskId - 任务ID
   * @param {Object} params - 查询参数
   * @param {string} params.startDate - 开始日期
   * @param {string} params.endDate - 结束日期
   * @param {string} params.status - 状态
   * @param {number} params.page - 页码
   * @param {number} params.limit - 每页数量
   */
  getTaskExecutionPlans: (taskId, params = {}) => {
    return request({
      url: `/v2/tasks/${taskId}/execution-plans`,
      method: 'get',
      params
    })
  },

  /**
   * 获取任务执行历史
   * @param {number} taskId - 任务ID
   * @param {Object} params - 查询参数
   */
  getTaskExecutionHistory: (taskId, params = {}) => {
    return request({
      url: `/v2/tasks/${taskId}/execution-history`,
      method: 'get',
      params
    })
  },

  /**
   * 重新生成执行计划
   * @param {number} taskId - 任务ID
   * @param {Object} options - 选项
   * @param {number} options.days - 生成天数
   */
  regenerateExecutionPlans: (taskId, options = {}) => {
    return request({
      url: `/v2/tasks/${taskId}/regenerate-plans`,
      method: 'post',
      data: options
    })
  },

  /**
   * 手动触发任务执行
   * @param {number} taskId - 任务ID
   * @param {Object} options - 触发选项
   * @param {number} options.planId - 计划ID
   * @param {boolean} options.isRetry - 是否重试
   * @param {string} options.message - 自定义消息
   */
  triggerTaskExecution: (taskId, options = {}) => {
    return request({
      url: `/v2/tasks/${taskId}/trigger`,
      method: 'post',
      data: options
    })
  }
}

// 调度规则管理
export const scheduleRuleAPI = {
  /**
   * 获取任务调度规则
   * @param {number} taskId - 任务ID
   */
  getScheduleRules: (taskId) => {
    return request({
      url: `/v2/tasks/${taskId}/schedule-rules`,
      method: 'get'
    })
  },

  /**
   * 创建调度规则
   * @param {number} taskId - 任务ID
   * @param {Object} ruleData - 规则数据
   * @param {string} ruleData.ruleType - 规则类型 (byDay/byWeek/byInterval)
   * @param {Object} ruleData.ruleConfig - 规则配置
   * @param {Array} ruleData.timeSlots - 时间段
   * @param {string} ruleData.validFrom - 有效开始时间
   * @param {string} ruleData.validUntil - 有效结束时间
   * @param {boolean} ruleData.isEnabled - 是否启用
   */
  createScheduleRule: (taskId, ruleData) => {
    return request({
      url: `/v2/tasks/${taskId}/schedule-rules`,
      method: 'post',
      data: ruleData
    })
  },

  /**
   * 更新调度规则
   * @param {number} taskId - 任务ID
   * @param {number} ruleId - 规则ID
   * @param {Object} ruleData - 规则数据
   */
  updateScheduleRule: (taskId, ruleId, ruleData) => {
    return request({
      url: `/v2/tasks/${taskId}/schedule-rules/${ruleId}`,
      method: 'put',
      data: ruleData
    })
  },

  /**
   * 删除调度规则
   * @param {number} taskId - 任务ID
   * @param {number} ruleId - 规则ID
   */
  deleteScheduleRule: (taskId, ruleId) => {
    return request({
      url: `/v2/tasks/${taskId}/schedule-rules/${ruleId}`,
      method: 'delete'
    })
  },

  /**
   * 验证调度规则
   * @param {Object} ruleData - 规则数据
   */
  validateScheduleRule: (ruleData) => {
    return request({
      url: '/v2/schedule-rules/validate',
      method: 'post',
      data: ruleData
    })
  },

  /**
   * 预览调度规则执行结果
   * @param {Object} ruleData - 规则数据
   * @param {number} days - 预览天数
   */
  previewScheduleRule: (ruleData, days = 30) => {
    return request({
      url: '/v2/schedule-rules/preview',
      method: 'post',
      data: { ...ruleData, days }
    })
  }
}

// 任务执行历史
export const executionHistoryAPI = {
  /**
   * 获取任务执行历史
   * @param {number} taskId - 任务ID
   * @param {Object} params - 查询参数
   */
  getTaskExecutionHistory: (taskId, params = {}) => {
    return request({
      url: `/v2/tasks/${taskId}/execution-history`,
      method: 'get',
      params
    })
  },

  /**
   * 获取执行历史详情
   * @param {number} executionId - 执行ID
   */
  getExecutionDetail: (executionId) => {
    return request({
      url: `/v2/executions/${executionId}`,
      method: 'get'
    })
  }
}

// 综合统计分析
export const scheduleStatisticsAPI = {
  /**
   * 获取调度系统统计信息
   */
  getScheduleStatistics: () => {
    return request({
      url: '/v2/statistics/schedule',
      method: 'get'
    })
  },

  /**
   * 获取任务性能统计
   * @param {Object} params - 查询参数
   */
  getTaskPerformanceStats: (params = {}) => {
    return request({
      url: '/v2/statistics/performance',
      method: 'get',
      params
    })
  },

  /**
   * 获取系统健康度报告
   */
  getSystemHealthReport: () => {
    return request({
      url: '/v2/statistics/health',
      method: 'get'
    })
  }
}

// 默认导出所有API
export default {
  ...v2TasksAPI,
  taskAssociation: taskAssociationAPI,
  executionPlan: executionPlanAPI,
  scheduleRule: scheduleRuleAPI,
  executionHistory: executionHistoryAPI,
  statistics: scheduleStatisticsAPI
}