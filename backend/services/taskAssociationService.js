const { Task, TaskAssociation } = require('../models/mongodb');

/**
 * 任务关联服务
 * 处理任务覆盖逻辑
 */
class TaskAssociationService {
  /**
   * 创建或更新任务关联
   * @param {String} primaryTaskId - 主任务ID（高优先级）
   * @param {Array} associations - 关联配置数组
   * @param {String} userId - 操作用户ID
   */
  async manageAssociations(primaryTaskId, associations, userId) {
    try {
      // 先删除该任务的所有现有关联
      await TaskAssociation.deleteMany({ 
        primaryTaskId: primaryTaskId,
        status: 'active'
      });

      if (!associations || associations.length === 0) {
        return { success: true, message: '已清除所有关联' };
      }

      // 验证主任务是否存在
      const primaryTask = await Task.findById(primaryTaskId);
      if (!primaryTask) {
        throw new Error('主任务不存在');
      }

      // 创建新的关联
      const results = [];
      for (const assoc of associations) {
        // 验证被关联任务是否存在
        const associatedTask = await Task.findById(assoc.taskId);
        if (!associatedTask) {
          console.warn(`关联任务 ${assoc.taskId} 不存在，跳过`);
          continue;
        }

        // 检查优先级逻辑（可选）
        // 如果主任务优先级不高于被关联任务，给出警告
        const priorityMap = { high: 3, normal: 2, low: 1 };
        if (priorityMap[primaryTask.priority] <= priorityMap[associatedTask.priority]) {
          console.warn(`警告：主任务优先级不高于被关联任务 ${associatedTask.name}`);
        }

        // 创建关联记录
        // 将开始日期设置为当天的开始时间
        const startDate = new Date(assoc.startDate);
        startDate.setHours(0, 0, 0, 0);
        
        // 将结束日期设置为当天的结束时间（23:59:59.999）
        const endDate = new Date(assoc.endDate);
        endDate.setHours(23, 59, 59, 999);
        
        const association = new TaskAssociation({
          primaryTaskId: primaryTaskId,
          associatedTaskId: assoc.taskId,
          startDate: startDate,
          endDate: endDate,
          duration: assoc.duration,
          description: assoc.description || '',
          status: 'active',
          createdBy: userId,
          updatedBy: userId
        });

        const saved = await association.save();
        results.push(saved);
      }

      return {
        success: true,
        data: results,
        message: `成功创建 ${results.length} 个关联`
      };
    } catch (error) {
      console.error('管理任务关联失败:', error);
      throw error;
    }
  }

  /**
   * 获取任务的所有关联
   * @param {String} taskId - 任务ID
   */
  async getTaskAssociations(taskId) {
    try {
      // 获取该任务作为主任务的关联
      const asPrimary = await TaskAssociation.find({
        primaryTaskId: taskId,
        status: 'active'
      }).populate('associatedTaskId', 'name priority status');

      // 获取该任务作为被关联任务的关联
      const asAssociated = await TaskAssociation.find({
        associatedTaskId: taskId,
        status: 'active'
      }).populate('primaryTaskId', 'name priority status');

      // 格式化返回数据
      const associations = asPrimary.map(a => ({
        id: a._id,
        associatedTaskId: a.associatedTaskId._id,
        associatedTaskName: a.associatedTaskId.name,
        associatedTaskPriority: a.associatedTaskId.priority,
        startDate: a.startDate,
        endDate: a.endDate,
        duration: a.duration,
        description: a.description,
        type: 'suppressing' // 该任务覆盖其他任务
      }));

      // 添加被覆盖信息
      const suppressedBy = asAssociated.map(a => ({
        id: a._id,
        primaryTaskId: a.primaryTaskId._id,
        primaryTaskName: a.primaryTaskId.name,
        primaryTaskPriority: a.primaryTaskId.priority,
        startDate: a.startDate,
        endDate: a.endDate,
        duration: a.duration,
        description: a.description,
        type: 'suppressed' // 该任务被其他任务覆盖
      }));

      // 合并所有关联（既包括该任务覆盖的，也包括覆盖该任务的）
      const allAssociations = [...associations, ...suppressedBy];
      
      return {
        success: true,
        data: allAssociations,  // 返回所有关联
        associations: associations,  // 保留原有字段以兼容
        suppressedBy: suppressedBy   // 保留原有字段以兼容
      };
    } catch (error) {
      console.error('获取任务关联失败:', error);
      throw error;
    }
  }

  /**
   * 删除任务关联
   * @param {String} taskId - 任务ID
   * @param {String} associationId - 关联ID
   */
  async deleteAssociation(taskId, associationId) {
    try {
      const result = await TaskAssociation.findOneAndUpdate(
        {
          _id: associationId,
          $or: [
            { primaryTaskId: taskId },
            { associatedTaskId: taskId }
          ]
        },
        { status: 'cancelled' },
        { new: true }
      );

      if (!result) {
        throw new Error('关联不存在或无权删除');
      }

      return {
        success: true,
        message: '关联已取消'
      };
    } catch (error) {
      console.error('删除任务关联失败:', error);
      throw error;
    }
  }

  /**
   * 检查任务在指定日期是否应该执行
   * 考虑任务覆盖关系和智能覆盖逻辑
   * @param {String} taskId - 任务ID
   * @param {Date} date - 检查日期
   */
  async shouldTaskExecute(taskId, date = new Date()) {
    try {
      // 检查任务是否被其他任务覆盖
      const isSuppressed = await TaskAssociation.isTaskSuppressed(taskId, date);
      
      if (isSuppressed) {
        const suppressingTask = await TaskAssociation.getSuppressingTask(taskId, date);
        
        // 智能覆盖：检查高优先级任务今天是否执行
        if (suppressingTask) {
          // 获取调度规则检查器
          const scheduleRuleChecker = require('./scheduleRuleChecker');
          
          // 检查覆盖任务今天是否应该执行
          const shouldSuppressingTaskRun = scheduleRuleChecker.shouldRunToday(
            suppressingTask.scheduleRule, 
            date
          );
          
          // 只有当高优先级任务今天执行时，才覆盖低优先级任务
          if (shouldSuppressingTaskRun) {
            console.log(`智能覆盖生效：任务 ${suppressingTask.name} 今天执行，覆盖任务 ${taskId}`);
            return {
              shouldExecute: false,
              reason: 'suppressed',
              suppressedBy: {
                id: suppressingTask._id,
                name: suppressingTask.name
              }
            };
          } else {
            // 高优先级任务今天不执行，低优先级任务可以执行
            console.log(`智能覆盖：任务 ${suppressingTask.name} 今天不执行，允许低优先级任务 ${taskId} 执行`);
            return {
              shouldExecute: true,
              reason: 'normal',
              note: '高优先级任务今天不执行'
            };
          }
        }
      }

      return {
        shouldExecute: true,
        reason: 'normal'
      };
    } catch (error) {
      console.error('检查任务执行状态失败:', error);
      // 出错时默认允许执行
      return {
        shouldExecute: true,
        reason: 'error',
        error: error.message
      };
    }
  }

  /**
   * 获取指定日期应该执行的任务列表
   * 过滤掉被覆盖的任务
   * @param {Array} taskIds - 原始任务ID列表
   * @param {Date} date - 执行日期
   */
  async filterExecutableTasks(taskIds, date = new Date()) {
    try {
      const executableTasks = [];
      const suppressedTasks = [];

      for (const taskId of taskIds) {
        const status = await this.shouldTaskExecute(taskId, date);
        
        if (status.shouldExecute) {
          executableTasks.push(taskId);
        } else {
          suppressedTasks.push({
            taskId,
            reason: status.reason,
            suppressedBy: status.suppressedBy
          });
        }
      }

      return {
        executable: executableTasks,
        suppressed: suppressedTasks
      };
    } catch (error) {
      console.error('过滤可执行任务失败:', error);
      // 出错时返回原始列表
      return {
        executable: taskIds,
        suppressed: []
      };
    }
  }

  /**
   * 更新过期的关联状态
   * 应该定期调用（如每天凌晨）
   */
  async updateExpiredAssociations() {
    try {
      const count = await TaskAssociation.updateExpiredAssociations();
      console.log(`更新了 ${count} 个过期的任务关联`);
      return count;
    } catch (error) {
      console.error('更新过期关联失败:', error);
      throw error;
    }
  }

  /**
   * 获取任务的覆盖历史
   * @param {String} taskId - 任务ID
   * @param {Object} options - 查询选项
   */
  async getAssociationHistory(taskId, options = {}) {
    try {
      const { startDate, endDate, includeExpired = false } = options;
      
      const query = {
        $or: [
          { primaryTaskId: taskId },
          { associatedTaskId: taskId }
        ]
      };

      if (!includeExpired) {
        query.status = { $ne: 'cancelled' };
      }

      if (startDate || endDate) {
        query.startDate = {};
        if (startDate) query.startDate.$gte = new Date(startDate);
        if (endDate) query.startDate.$lte = new Date(endDate);
      }

      const associations = await TaskAssociation.find(query)
        .populate('primaryTaskId', 'name')
        .populate('associatedTaskId', 'name')
        .sort({ startDate: -1 });

      return {
        success: true,
        data: associations
      };
    } catch (error) {
      console.error('获取关联历史失败:', error);
      throw error;
    }
  }
}

module.exports = new TaskAssociationService();