/**
 * 工作表执行管理器
 * 负责管理工作表任务的执行计划和调度
 */

const logger = require('../utils/logger');
const { query } = require('../config/database');
const { beijingTime, formatDate, formatTime } = require('../utils/timeUtils');
const worksheetTaskHandler = require('./worksheetTaskHandler');

class WorksheetExecutionManager {
    constructor() {
        // 存储当天的工作表执行计划
        // Map结构: taskId -> Array of { time, message }
        this.dailyExecutionPlans = new Map();
        this.lastLoadDate = null;
    }

    /**
     * 加载当天的工作表任务执行计划
     * 在每天凌晨2点调用
     */
    async loadDailyWorksheetTasks() {
        try {
            const now = beijingTime();
            const today = formatDate(now);
            
            logger.info(`开始加载 ${today} 的工作表任务执行计划`);
            
            // 清空旧的执行计划
            this.dailyExecutionPlans.clear();
            this.lastLoadDate = today;
            
            // 获取所有启用的工作表任务
            const tasks = await this.getActiveWorksheetTasks();
            logger.info(`找到 ${tasks.length} 个活跃的工作表任务`);
            
            let totalPlans = 0;
            
            for (const task of tasks) {
                // 检查调度规则是否匹配今天
                const shouldRunToday = await this.checkScheduleRule(task, now);
                
                if (shouldRunToday) {
                    // 加载工作表中的所有时间点和内容
                    const executionPlans = await this.loadWorksheetContent(task);
                    
                    if (executionPlans && executionPlans.length > 0) {
                        this.dailyExecutionPlans.set(task.id, executionPlans);
                        totalPlans += executionPlans.length;
                        
                        logger.info(`任务 ${task.name} (ID: ${task.id}) 加载了 ${executionPlans.length} 个执行计划`);
                    }
                }
            }
            
            logger.info(`✅ 加载完成，共 ${totalPlans} 个执行计划`);
            return totalPlans;
            
        } catch (error) {
            logger.error('加载工作表任务执行计划失败:', error);
            throw error;
        }
    }

    /**
     * 获取所有活跃的工作表任务
     */
    async getActiveWorksheetTasks() {
        try {
            const result = await query(`
                SELECT 
                    t.id,
                    t.name,
                    t.description,
                    t.status,
                    t.group_id,
                    sr.id as schedule_rule_id,
                    sr.rule_type,
                    sr.months,
                    sr.day_mode,
                    sr.execution_times,
                    tf.file_id,
                    tf.selected_worksheet,
                    f.file_path,
                    f.original_name
                FROM tasks t
                JOIN schedule_rules sr ON t.id = sr.task_id
                JOIN task_files tf ON t.id = tf.task_id AND tf.is_primary = true
                JOIN files f ON tf.file_id = f.id
                WHERE t.status = 'active'
                    AND (t.enable_time IS NULL OR t.enable_time <= CURRENT_TIMESTAMP)
                    AND (t.disable_time IS NULL OR t.disable_time > CURRENT_TIMESTAMP)
            `);
            
            return result || [];
            
        } catch (error) {
            logger.error('获取活跃工作表任务失败:', error);
            return [];
        }
    }

    /**
     * 检查调度规则是否匹配指定日期
     */
    async checkScheduleRule(task, date) {
        try {
            // 如果没有调度规则，默认每天执行
            if (!task.rule_type) {
                return true;
            }
            
            const ScheduleRule = require('../domains/ScheduleRule');
            const rule = new ScheduleRule({
                rule_type: task.rule_type,
                months: task.months,
                day_mode: task.day_mode,
                execution_times: task.execution_times || []
            });
            
            // 检查规则是否适用于今天
            return rule.appliesTo(date);
            
        } catch (error) {
            logger.error(`检查调度规则失败 (任务ID: ${task.id}):`, error);
            return false;
        }
    }

    /**
     * 加载工作表内容
     */
    async loadWorksheetContent(task) {
        try {
            // 使用WorksheetTaskHandler获取工作表数据
            const worksheetData = await worksheetTaskHandler.getWorksheetData(
                task.file_path,
                task.selected_worksheet
            );
            
            if (!worksheetData || worksheetData.length === 0) {
                logger.warn(`工作表没有数据: ${task.file_path}`);
                return [];
            }
            
            // 获取当前时间用于过滤
            const now = beijingTime();
            const currentHour = now.getHours();
            const currentMinute = now.getMinutes();
            const currentTimeInMinutes = currentHour * 60 + currentMinute;
            
            // 提取所有时间点和内容
            const executionPlans = [];
            let skippedCount = 0;
            
            for (const row of worksheetData) {
                const time = worksheetTaskHandler.normalizeTime(
                    row['时间'] || row['time'] || row['Time']
                );
                const message = row['消息内容'] || row['内容'] || 
                               row['message'] || row['Message'] || row['content'];
                
                if (time && message) {
                    // 解析时间
                    const [hours, minutes] = time.split(':').map(Number);
                    const timeInMinutes = hours * 60 + minutes;
                    
                    // 智能过滤：跳过已过期的时间点
                    if (timeInMinutes < currentTimeInMinutes) {
                        skippedCount++;
                        logger.debug(`跳过已过期的时间点: ${time} (当前时间: ${formatTime(now)})`);
                        continue;
                    }
                    
                    executionPlans.push({
                        taskId: task.id,
                        taskName: task.name,
                        groupId: task.group_id,
                        scheduleRuleId: task.schedule_rule_id,
                        time: time,
                        message: message,
                        executed: false
                    });
                }
            }
            
            // 按时间排序
            executionPlans.sort((a, b) => {
                const timeA = a.time.split(':').map(Number);
                const timeB = b.time.split(':').map(Number);
                return (timeA[0] * 60 + timeA[1]) - (timeB[0] * 60 + timeB[1]);
            });
            
            if (skippedCount > 0) {
                logger.info(`智能过滤：跳过了 ${skippedCount} 个已过期的时间点，保留 ${executionPlans.length} 个待执行时间点`);
            }
            
            return executionPlans;
            
        } catch (error) {
            logger.error(`加载工作表内容失败 (任务ID: ${task.id}):`, error);
            return [];
        }
    }

    /**
     * 执行到期的工作表任务
     * 每分钟调用一次
     */
    async executeWorksheetTasks() {
        try {
            const now = beijingTime();
            const currentTime = formatTime(now);
            const today = formatDate(now);
            
            // 如果日期变了，重新加载
            if (this.lastLoadDate !== today) {
                await this.loadDailyWorksheetTasks();
            }
            
            // 执行到期的任务
            let executedCount = 0;
            let totalMessagesCount = 0;
            
            for (const [taskId, plans] of this.dailyExecutionPlans) {
                // 收集当前时间需要执行的所有消息
                const currentTimePlans = plans.filter(plan => 
                    plan.time === currentTime && !plan.executed
                );
                
                if (currentTimePlans.length > 0) {
                    logger.info(`📋 工作表任务 ${currentTimePlans[0].taskName} 在 ${currentTime} 有 ${currentTimePlans.length} 条消息待发送`);
                    totalMessagesCount += currentTimePlans.length;
                    
                    // 获取任务详情
                    const taskResult = await query(`
                        SELECT t.*, g.webhook_url, g.secret
                        FROM tasks t
                        LEFT JOIN groups g ON t.group_id = g.id
                        WHERE t.id = $1
                    `, [taskId]);
                    
                    if (taskResult && taskResult.length > 0) {
                        const task = taskResult[0];
                        
                        // 批量发送当前时间点的所有消息
                        for (let i = 0; i < currentTimePlans.length; i++) {
                            const plan = currentTimePlans[i];
                            logger.info(`发送消息 ${i + 1}/${currentTimePlans.length}: ${plan.message.substring(0, 50)}...`);
                            
                            const success = await worksheetTaskHandler.sendReminder(task, {
                                time: plan.time,
                                message: plan.message
                            });
                            
                            if (success) {
                                plan.executed = true;
                                executedCount++;
                                logger.info(`✅ 消息 ${i + 1} 发送成功`);
                            } else {
                                logger.error(`❌ 消息 ${i + 1} 发送失败`);
                            }
                            
                            // 添加短暂延迟，避免发送过快（最后一条不延迟）
                            if (i < currentTimePlans.length - 1) {
                                await new Promise(resolve => setTimeout(resolve, 1000));
                            }
                        }
                        
                        logger.info(`📊 任务 ${currentTimePlans[0].taskName} 执行完成，成功发送 ${executedCount} 条消息`);
                    }
                }
            }
            
            if (executedCount > 0) {
                logger.info(`✅ 共执行了 ${executedCount}/${totalMessagesCount} 个工作表消息推送`);
            }
            
            return executedCount;
            
        } catch (error) {
            logger.error('执行工作表任务失败:', error);
            return 0;
        }
    }

    /**
     * 获取当前的执行计划状态
     */
    getExecutionStatus() {
        const status = {
            loadDate: this.lastLoadDate,
            totalTasks: this.dailyExecutionPlans.size,
            totalPlans: 0,
            executedPlans: 0,
            pendingPlans: 0,
            tasks: []
        };
        
        for (const [taskId, plans] of this.dailyExecutionPlans) {
            const executed = plans.filter(p => p.executed).length;
            const pending = plans.filter(p => !p.executed).length;
            
            status.totalPlans += plans.length;
            status.executedPlans += executed;
            status.pendingPlans += pending;
            
            status.tasks.push({
                taskId: taskId,
                taskName: plans[0]?.taskName,
                total: plans.length,
                executed: executed,
                pending: pending
            });
        }
        
        return status;
    }

    /**
     * 手动重新加载某个任务的执行计划
     */
    async reloadTask(taskId) {
        try {
            const tasks = await query(`
                SELECT 
                    t.id,
                    t.name,
                    sr.rule_type,
                    sr.months,
                    sr.day_mode,
                    sr.execution_times,
                    tf.file_id,
                    tf.selected_worksheet,
                    f.file_path
                FROM tasks t
                JOIN schedule_rules sr ON t.id = sr.task_id
                JOIN task_files tf ON t.id = tf.task_id AND tf.is_primary = true
                JOIN files f ON tf.file_id = f.id
                WHERE t.id = $1 AND t.status = 'active'
            `, [taskId]);
            
            if (tasks && tasks.length > 0) {
                const task = tasks[0];
                const now = beijingTime();
                
                if (await this.checkScheduleRule(task, now)) {
                    const executionPlans = await this.loadWorksheetContent(task);
                    this.dailyExecutionPlans.set(taskId, executionPlans);
                    
                    logger.info(`重新加载任务 ${task.name} 的执行计划，共 ${executionPlans.length} 个`);
                    return executionPlans.length;
                }
            }
            
            return 0;
            
        } catch (error) {
            logger.error(`重新加载任务失败 (ID: ${taskId}):`, error);
            return 0;
        }
    }
}

module.exports = new WorksheetExecutionManager();