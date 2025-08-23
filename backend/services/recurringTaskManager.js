/**
 * 重复任务管理器
 * 负责创建、管理和生成重复提醒任务
 * 使用北京时区，不支持多时区
 */

const { query } = require('../config/database');
const { beijingTime, formatDate, formatTime, formatDateTime } = require('../utils/timeUtils');
const recurrenceRule = require('./recurrenceRule');
const logger = require('../utils/logger');

class RecurringTaskManager {
    constructor() {
        this.maxGenerationDays = 30; // 默认提前30天生成重复任务
        this.maxOccurrences = 365;   // 默认最大执行次数
    }

    /**
     * 创建重复提醒任务
     * @param {Object} taskData - 任务数据
     * @returns {Object} 创建结果
     */
    async createRecurringTask(taskData) {
        const {
            groupId,
            messageContent,
            time,
            repeatRule,
            endDate = null,
            maxOccurrences = null,
            createdBy = null
        } = taskData;

        try {
            // 验证重复规则
            const ruleAnalysis = recurrenceRule.validateAndAnalyze(repeatRule);
            if (!ruleAnalysis.isValid) {
                return {
                    success: false,
                    error: ruleAnalysis.error
                };
            }

            // 检查是否会产生过多任务
            if (recurrenceRule.isExcessiveRule(ruleAnalysis, this.maxOccurrences)) {
                return {
                    success: false,
                    error: `重复规则会产生过多任务（超过${this.maxOccurrences}次），请调整规则`
                };
            }

            // 创建主重复任务记录
            const parentTask = await query(`
                INSERT INTO reminders 
                (group_id, schedule_date, schedule_time, message_content, 
                 repeat_rule, repeat_type, is_recurring, recurring_end_date, 
                 max_occurrences, status, created_by, created_at) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Shanghai')
                RETURNING id
            `, [
                groupId,
                formatDate(beijingTime()), // 今天作为参考日期
                time,
                messageContent,
                repeatRule,
                ruleAnalysis.type,
                true,
                endDate,
                maxOccurrences || this.maxOccurrences,
                createdBy
            ]);

            const parentId = parentTask[0].id;

            // 生成未来的重复任务实例
            const generated = await this.generateFutureOccurrences(parentId, ruleAnalysis, time, endDate, maxOccurrences);

            logger.info(`创建重复任务成功 - 父任务ID: ${parentId}, 生成实例数: ${generated.count}`);

            return {
                success: true,
                parentId: parentId,
                generatedCount: generated.count,
                nextExecution: generated.nextExecution,
                message: `重复任务创建成功，已生成${generated.count}个未来实例`
            };

        } catch (error) {
            logger.error('创建重复任务失败:', error);
            return {
                success: false,
                error: '创建重复任务失败: ' + error.message
            };
        }
    }

    /**
     * 生成重复任务的未来实例
     * @param {number} parentId - 父任务ID
     * @param {Object} ruleData - 规则数据
     * @param {string} time - 执行时间
     * @param {string} endDate - 结束日期
     * @param {number} maxOccurrences - 最大次数
     */
    async generateFutureOccurrences(parentId, ruleData, time, endDate = null, maxOccurrences = null) {
        try {
            // 获取父任务信息
            const [parentTask] = await query(`
                SELECT * FROM reminders WHERE id = ?
            `, [parentId]);

            if (!parentTask) {
                throw new Error('父任务不存在');
            }

            const startDate = beijingTime();
            const cutoffDate = new Date(startDate);
            cutoffDate.setDate(cutoffDate.getDate() + this.maxGenerationDays);

            const endDateTime = endDate ? new Date(endDate) : cutoffDate;
            const actualEndDate = endDateTime < cutoffDate ? endDateTime : cutoffDate;
            const maxCount = maxOccurrences || this.maxOccurrences;

            let generatedCount = 0;
            let currentDate = new Date(startDate);
            let nextExecution = null;

            // 生成重复任务实例
            while (generatedCount < maxCount && currentDate <= actualEndDate) {
                const nextDate = recurrenceRule.calculateNextOccurrence(ruleData, currentDate, time);
                
                if (!nextDate || nextDate > actualEndDate) {
                    break;
                }

                // 插入任务实例
                await query(`
                    INSERT INTO reminders 
                    (group_id, schedule_date, schedule_time, message_content, 
                     parent_reminder_id, is_recurring, status, created_at) 
                    VALUES (?, ?, ?, ?, ?, false, 'pending', CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Shanghai')
                `, [
                    parentTask.group_id,
                    formatDate(nextDate),
                    time,
                    parentTask.message_content,
                    parentId
                ]);

                generatedCount++;
                
                // 记录第一个执行时间
                if (!nextExecution) {
                    nextExecution = {
                        date: formatDate(nextDate),
                        time: time,
                        datetime: formatDateTime(nextDate)
                    };
                }

                // 为下次计算更新当前日期
                currentDate = new Date(nextDate);
                currentDate.setDate(currentDate.getDate() + 1);
            }

            // 更新父任务的下次执行日期
            if (nextExecution) {
                await query(`
                    UPDATE reminders 
                    SET next_occurrence_date = ?, occurrence_count = 0 
                    WHERE id = ?
                `, [nextExecution.date, parentId]);
            }

            logger.info(`为重复任务 ${parentId} 生成了 ${generatedCount} 个实例`);

            return {
                count: generatedCount,
                nextExecution: nextExecution
            };

        } catch (error) {
            logger.error('生成重复任务实例失败:', error);
            throw error;
        }
    }

    /**
     * 删除重复任务
     * @param {number} taskId - 任务ID
     * @param {string} deleteType - 删除类型: 'single' | 'future' | 'all'
     */
    async deleteRecurringTask(taskId, deleteType = 'single') {
        try {
            // 获取任务信息
            const [task] = await query(`
                SELECT * FROM reminders WHERE id = ?
            `, [taskId]);

            if (!task) {
                return { success: false, error: '任务不存在' };
            }

            let deletedCount = 0;

            switch (deleteType) {
                case 'single':
                    // 只删除单个任务
                    await query('DELETE FROM reminders WHERE id = ?', [taskId]);
                    deletedCount = 1;
                    break;

                case 'future':
                    // 删除当前及未来的重复任务
                    if (task.parent_reminder_id) {
                        // 这是一个实例，删除它和之后的所有实例
                        const result = await query(`
                            DELETE FROM reminders 
                            WHERE parent_reminder_id = ? 
                              AND schedule_date >= ?
                        `, [task.parent_reminder_id, task.schedule_date]);
                        deletedCount = result.affectedRows;
                    } else if (task.is_recurring) {
                        // 这是父任务，删除所有未来实例
                        const result = await query(`
                            DELETE FROM reminders 
                            WHERE parent_reminder_id = ? 
                              AND status = 'pending'
                        `, [taskId]);
                        deletedCount = result.affectedRows;
                        
                        // 更新父任务状态
                        await query(`
                            UPDATE reminders 
                            SET status = 'failed', next_occurrence_date = NULL
                            WHERE id = ?
                        `, [taskId]);
                        deletedCount += 1;
                    }
                    break;

                case 'all':
                    // 删除所有相关的重复任务
                    const parentId = task.parent_reminder_id || taskId;
                    
                    // 删除所有实例
                    const instanceResult = await query(`
                        DELETE FROM reminders WHERE parent_reminder_id = ?
                    `, [parentId]);
                    
                    // 删除父任务
                    const parentResult = await query(`
                        DELETE FROM reminders WHERE id = ?
                    `, [parentId]);
                    
                    deletedCount = (instanceResult.affectedRows || 0) + (parentResult.affectedRows || 0);
                    break;

                default:
                    return { success: false, error: '不支持的删除类型' };
            }

            logger.info(`删除重复任务成功 - 任务ID: ${taskId}, 删除类型: ${deleteType}, 删除数量: ${deletedCount}`);

            return {
                success: true,
                deletedCount: deletedCount,
                message: `成功删除 ${deletedCount} 个任务`
            };

        } catch (error) {
            logger.error('删除重复任务失败:', error);
            return {
                success: false,
                error: '删除重复任务失败: ' + error.message
            };
        }
    }

    /**
     * 更新重复任务的执行状态
     * @param {number} taskId - 任务ID
     * @param {string} status - 新状态
     */
    async updateTaskStatus(taskId, status) {
        try {
            const [task] = await query(`
                SELECT * FROM reminders WHERE id = ?
            `, [taskId]);

            if (!task) {
                return { success: false, error: '任务不存在' };
            }

            // 更新任务状态
            await query(`
                UPDATE reminders 
                SET status = ?, updated_at = CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Shanghai'
                WHERE id = ?
            `, [status, taskId]);

            // 如果这是一个重复任务实例且执行成功，更新父任务的统计
            if (task.parent_reminder_id && status === 'sent') {
                await query(`
                    UPDATE reminders 
                    SET occurrence_count = occurrence_count + 1 
                    WHERE id = ?
                `, [task.parent_reminder_id]);

                // 记录执行日志
                await query(`
                    INSERT INTO custom_reminder_logs 
                    (parent_reminder_id, executed_date, executed_time, status, created_at)
                    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Shanghai')
                `, [task.parent_reminder_id, task.schedule_date, task.schedule_time, status]);
            }

            return { success: true };

        } catch (error) {
            logger.error('更新重复任务状态失败:', error);
            return {
                success: false,
                error: '更新状态失败: ' + error.message
            };
        }
    }

    /**
     * 获取重复任务列表
     * @param {Object} filters - 过滤条件
     */
    async getRecurringTasks(filters = {}) {
        try {
            const { groupId, status, createdBy, startDate, endDate, page = 1, limit = 20, includeInstances = false, groupTypeFilter } = filters;

            // 修改查询条件以包括自定义群组的非重复任务
            let whereConditions = [];
            let params = [];
            
            if (groupTypeFilter === 'custom') {
                // 自定义提醒：包括重复任务和自定义群组的单次提醒（主要任务，非子任务）
                whereConditions.push('(r.is_recurring = true OR (g.group_type = ? AND r.parent_reminder_id IS NULL))');
                params.push(groupTypeFilter);
            } else {
                // 其他情况：只查询重复任务
                whereConditions.push('r.is_recurring = true');
            }

            if (groupId) {
                whereConditions.push('r.group_id = ?');
                params.push(groupId);
            }

            if (status) {
                whereConditions.push('r.status = ?');
                params.push(status);
            }

            if (createdBy) {
                whereConditions.push('r.created_by = ?');
                params.push(createdBy);
            }

            // 添加群组类型过滤 (如果之前没有添加的话)
            if (groupTypeFilter && groupTypeFilter !== 'custom') {
                whereConditions.push('g.group_type = ?');
                params.push(groupTypeFilter);
            }

            // 时间筛选 - 按触发执行时间而非创建时间
            if (startDate || endDate) {
                // 对于重复任务，检查是否在指定日期范围内有触发记录
                // 对于单次自定义提醒，检查计划执行时间
                if (startDate && endDate) {
                    whereConditions.push(`(
                        (r.is_recurring = true AND (
                            r.last_execution_time IS NOT NULL AND DATE(r.last_execution_time) BETWEEN ? AND ?
                            OR r.next_execution_time IS NOT NULL AND DATE(r.next_execution_time) BETWEEN ? AND ?
                            OR (r.last_execution_time IS NULL AND r.next_execution_time IS NULL AND DATE(r.created_at) <= ?)
                        ))
                        OR (r.is_recurring = false AND DATE(r.schedule_date) BETWEEN ? AND ?)
                    )`);
                    params.push(startDate, endDate, startDate, endDate, endDate, startDate, endDate);
                } else if (startDate) {
                    whereConditions.push(`(
                        (r.is_recurring = true AND (
                            r.last_execution_time IS NOT NULL AND DATE(r.last_execution_time) >= ?
                            OR r.next_execution_time IS NOT NULL AND DATE(r.next_execution_time) >= ?
                            OR (r.last_execution_time IS NULL AND r.next_execution_time IS NULL AND DATE(r.created_at) >= ?)
                        ))
                        OR (r.is_recurring = false AND DATE(r.schedule_date) >= ?)
                    )`);
                    params.push(startDate, startDate, startDate, startDate);
                } else if (endDate) {
                    whereConditions.push(`(
                        (r.is_recurring = true AND (
                            r.last_execution_time IS NOT NULL AND DATE(r.last_execution_time) <= ?
                            OR r.next_execution_time IS NOT NULL AND DATE(r.next_execution_time) <= ?
                            OR (r.last_execution_time IS NULL AND r.next_execution_time IS NULL AND DATE(r.created_at) <= ?)
                        ))
                        OR (r.is_recurring = false AND DATE(r.schedule_date) <= ?)
                    )`);
                    params.push(endDate, endDate, endDate, endDate);
                }
            }

            const whereClause = whereConditions.join(' AND ');
            const offset = (page - 1) * limit;

            // 获取重复任务列表
            const tasks = await query(`
                SELECT r.*, g.name as group_name,
                       CASE 
                           WHEN r.is_recurring = true THEN 
                               (SELECT COUNT(*) FROM reminders WHERE parent_reminder_id = r.id AND status = 'sent')
                           ELSE 
                               (CASE WHEN r.status = 'sent' THEN 1 ELSE 0 END)
                       END as executed_count,
                       CASE 
                           WHEN r.is_recurring = true THEN 
                               (SELECT COUNT(*) FROM reminders WHERE parent_reminder_id = r.id AND status = 'pending')
                           ELSE 
                               (CASE WHEN r.status = 'pending' THEN 1 ELSE 0 END)
                       END as pending_count,
                       CASE 
                           WHEN r.is_recurring = true THEN 
                               (SELECT COUNT(*) FROM reminders WHERE parent_reminder_id = r.id AND status = 'failed')
                           ELSE 
                               (CASE WHEN r.status = 'failed' THEN 1 ELSE 0 END)
                       END as failed_count
                FROM reminders r
                JOIN groups g ON r.group_id = g.id
                WHERE ${whereClause}
                ORDER BY r.created_at DESC
                LIMIT ? OFFSET ?
            `, [...params, limit, offset]);

            // 获取总数
            const [countResult] = await query(`
                SELECT COUNT(*) as total
                FROM reminders r
                JOIN groups g ON r.group_id = g.id
                WHERE ${whereClause}
            `, params);

            // 如果需要包含实例，获取每个任务的实例
            if (includeInstances) {
                for (const task of tasks) {
                    const instances = await query(`
                        SELECT * FROM reminders 
                        WHERE parent_reminder_id = ? 
                        ORDER BY schedule_date ASC, schedule_time ASC
                        LIMIT 10
                    `, [task.id]);
                    task.instances = instances;
                }
            }

            return {
                success: true,
                tasks: tasks,
                total: countResult.total,
                page: page,
                limit: limit
            };

        } catch (error) {
            logger.error('获取重复任务列表失败:', error);
            return {
                success: false,
                error: '获取任务列表失败: ' + error.message
            };
        }
    }

    /**
     * 定期维护重复任务（生成新的实例）
     */
    async maintainRecurringTasks() {
        try {
            logger.info('开始维护重复任务...');

            // 查找需要生成新实例的重复任务
            const activeTasks = await query(`
                SELECT r.* FROM reminders r
                WHERE r.is_recurring = true 
                  AND r.status = 'pending'
                  AND (r.recurring_end_date IS NULL OR r.recurring_end_date > CURRENT_DATE)
                  AND (r.max_occurrences IS NULL OR r.occurrence_count < r.max_occurrences)
            `);

            let totalGenerated = 0;

            for (const task of activeTasks) {
                try {
                    // 检查是否需要生成新实例
                    const [lastInstance] = await query(`
                        SELECT schedule_date FROM reminders 
                        WHERE parent_reminder_id = ? 
                        ORDER BY schedule_date DESC 
                        LIMIT 1
                    `, [task.id]);

                    if (lastInstance) {
                        const lastDate = new Date(lastInstance.schedule_date);
                        const daysAhead = Math.ceil((lastDate - beijingTime()) / (1000 * 60 * 60 * 24));
                        
                        if (daysAhead >= this.maxGenerationDays) {
                            continue; // 已经生成足够多的未来实例
                        }
                    }

                    // 解析重复规则并生成新实例
                    const ruleData = recurrenceRule.parseRule(task.repeat_rule);
                    if (ruleData.isValid) {
                        const generated = await this.generateFutureOccurrences(
                            task.id,
                            ruleData,
                            formatTime(task.schedule_time),
                            task.recurring_end_date,
                            task.max_occurrences
                        );
                        totalGenerated += generated.count;
                    }

                } catch (error) {
                    logger.error(`维护重复任务 ${task.id} 失败:`, error);
                }
            }

            logger.info(`重复任务维护完成，总共生成 ${totalGenerated} 个新实例`);

            return {
                success: true,
                generatedCount: totalGenerated
            };

        } catch (error) {
            logger.error('维护重复任务失败:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * 计算重复任务的总应执行次数
     * @param {Object} task - 任务对象
     * @returns {number} 总次数
     */
    calculateTotalOccurrences(task) {
        if (!task.repeat_rule) return 0;
        
        const today = new Date();
        const currentYear = today.getFullYear();
        
        // 确定结束日期
        let endDate;
        if (task.recurring_end_date) {
            endDate = new Date(task.recurring_end_date);
        } else {
            // 如果没有结束日期，默认到今年年底
            endDate = new Date(currentYear, 11, 31); // 12月31日
        }
        
        // 确定开始日期
        const startDate = task.created_at ? new Date(task.created_at) : new Date(task.schedule_date || today);
        
        // 根据重复规则计算总次数
        const rule = task.repeat_rule?.toLowerCase() || '';
        const daysDiff = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
        
        if (rule.includes('每日') || rule.includes('daily')) {
            return Math.max(0, daysDiff);
        }
        
        if (rule.includes('每周') || rule.includes('weekly')) {
            return Math.max(0, Math.floor(daysDiff / 7));
        }
        
        if (rule.includes('每月') || rule.includes('monthly')) {
            const monthsDiff = (endDate.getFullYear() - startDate.getFullYear()) * 12 + 
                              (endDate.getMonth() - startDate.getMonth()) + 1;
            return Math.max(0, monthsDiff);
        }
        
        if (rule.includes('每年') || rule.includes('yearly')) {
            return Math.max(0, endDate.getFullYear() - startDate.getFullYear() + 1);
        }
        
        // 默认情况
        return task.pending_count + task.executed_count || 0;
    }

    /**
     * 检查今天是否安排了此重复任务
     * @param {Object} task - 任务对象 
     * @param {string} todayStr - 今天日期字符串
     * @returns {boolean}
     */
    async isTodayScheduled(task, todayStr) {
        if (!task.repeat_rule) return false;
        
        if (task.is_recurring) {
            // 检查是否有今天的子任务实例
            const [result] = await query(`
                SELECT COUNT(*) as count FROM reminders 
                WHERE parent_reminder_id = ? AND schedule_date = ?
            `, [task.id, todayStr]);
            return result.count > 0;
        } else {
            // 单次任务直接检查日期
            return task.schedule_date === todayStr;
        }
    }
    
    /**
     * 检查今天的任务是否已完成
     * @param {Object} task - 任务对象
     * @param {string} todayStr - 今天日期字符串  
     * @returns {boolean}
     */
    async isTodayCompleted(task, todayStr) {
        if (task.is_recurring) {
            // 检查今天的子任务是否已完成
            const [result] = await query(`
                SELECT COUNT(*) as count FROM reminders 
                WHERE parent_reminder_id = ? 
                  AND schedule_date = ? 
                  AND status = 'sent'
            `, [task.id, todayStr]);
            return result.count > 0;
        } else {
            // 单次任务检查状态
            return task.schedule_date === todayStr && task.status === 'sent';
        }
    }

    /**
     * 从配置获取设置值
     */
    async loadSettings() {
        try {
            const settings = await query(`
                SELECT setting_key, setting_value FROM settings 
                WHERE setting_key IN (
                    'recurring_generation_days', 
                    'max_recurring_occurrences'
                )
            `);

            for (const setting of settings) {
                switch (setting.setting_key) {
                    case 'recurring_generation_days':
                        this.maxGenerationDays = parseInt(setting.setting_value) || 30;
                        break;
                    case 'max_recurring_occurrences':
                        this.maxOccurrences = parseInt(setting.setting_value) || 365;
                        break;
                }
            }

            logger.info(`重复任务设置已加载 - 生成天数: ${this.maxGenerationDays}, 最大次数: ${this.maxOccurrences}`);

        } catch (error) {
            logger.error('加载重复任务设置失败:', error);
        }
    }
}

const manager = new RecurringTaskManager();
module.exports = manager;
module.exports.calculateTotalOccurrences = manager.calculateTotalOccurrences.bind(manager);
module.exports.isTodayScheduled = manager.isTodayScheduled.bind(manager);
module.exports.isTodayCompleted = manager.isTodayCompleted.bind(manager);