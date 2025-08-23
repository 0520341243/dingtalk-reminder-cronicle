const { query } = require('../config/database');
const { beijingTime, formatDate, formatTime, formatDateTime } = require('../utils/timeUtils');
const { redisManager } = require('../config/redis');
const dingTalkBot = require('./dingTalkBot');
const logger = require('../utils/logger');
const executionLogger = require('./executionLogger');
const path = require('path');
const fs = require('fs').promises;
const excelParser = require('./excelParser');

class V2TaskExecutor {
    constructor() {
        this.isLoading = false;
        this.isExecuting = false;
    }

    /**
     * V2任务系统完整执行流程
     * 1. 每日加载任务
     * 2. 关联任务优先级检查  
     * 3. 调度规则验证
     * 4. 消息时间确定
     * 5. Redis缓存
     */
    async executeV2WorkFlow() {
        if (this.isLoading) {
            logger.info('V2任务系统正在加载中，跳过本次执行');
            return;
        }

        try {
            this.isLoading = true;
            logger.info('🚀 开始执行V2任务系统工作流程');

            const now = beijingTime();
            const today = formatDate(now);

            // 步骤1: 每日加载活跃任务
            const activeTasks = await this.loadActiveTasks(today);
            if (activeTasks.length === 0) {
                logger.info('没有找到活跃的V2任务');
                return;
            }

            logger.info(`📋 加载到 ${activeTasks.length} 个活跃任务`);

            // 步骤2: 关联任务优先级检查
            const prioritizedTasks = await this.checkTaskAssociations(activeTasks);
            logger.info(`🔗 优先级检查完成，有效任务: ${prioritizedTasks.length}`);

            // 步骤3: 调度规则验证
            const scheduledExecutions = await this.validateScheduleRules(prioritizedTasks, today);
            logger.info(`📅 调度规则验证完成，生成执行计划: ${scheduledExecutions.length}`);

            // 步骤4: 消息时间确定
            const executionPlans = await this.determineMessageTiming(scheduledExecutions);
            logger.info(`⏰ 消息时间确定完成，最终执行计划: ${executionPlans.length}`);

            // 步骤5: Redis缓存
            await this.cacheExecutionPlans(executionPlans, today);
            logger.info(`💾 执行计划已缓存到Redis`);

            // 生成执行计划记录到数据库
            await this.saveExecutionPlans(executionPlans);
            logger.info(`📝 执行计划已保存到数据库`);

            logger.info('✅ V2任务系统工作流程执行完成');

        } catch (error) {
            logger.error('❌ V2任务系统工作流程执行失败:', error);
            throw error;
        } finally {
            this.isLoading = false;
        }
    }

    /**
     * 步骤1: 加载活跃任务
     */
    async loadActiveTasks(date) {
        try {
            const tasks = await query(`
                SELECT 
                    t.*,
                    g.name as group_name,
                    g.webhook_url as group_webhook_url,
                    g.secret as group_secret
                FROM tasks t
                LEFT JOIN groups g ON t.group_id = g.id
                WHERE t.status = 'active'
                    AND g.status = 'active'
                    AND (t.enable_time IS NULL OR t.enable_time <= CURRENT_TIMESTAMP)
                    AND (t.disable_time IS NULL OR t.disable_time > CURRENT_TIMESTAMP)
                ORDER BY t.priority DESC, t.created_at ASC
            `);

            logger.info(`加载活跃任务: ${tasks.length} 个`);
            return tasks;

        } catch (error) {
            logger.error('加载活跃任务失败:', error);
            throw error;
        }
    }

    /**
     * 步骤2: 检查任务关联和优先级
     */
    async checkTaskAssociations(tasks) {
        try {
            const prioritizedTasks = [];
            const processedTasks = new Set();

            for (const task of tasks) {
                if (processedTasks.has(task.id)) {
                    continue;
                }

                // 查询任务关联关系
                const associations = await query(`
                    SELECT 
                        ta.*,
                        t_primary.name as primary_name,
                        t_associated.name as associated_name
                    FROM task_associations ta
                    LEFT JOIN tasks t_primary ON ta.primary_task_id = t_primary.id
                    LEFT JOIN tasks t_associated ON ta.associated_task_id = t_associated.id
                    WHERE ta.primary_task_id = ? OR ta.associated_task_id = ?
                `, [task.id, task.id]);

                if (associations.length === 0) {
                    // 无关联任务，直接加入
                    prioritizedTasks.push(task);
                    processedTasks.add(task.id);
                } else {
                    // 处理关联任务优先级
                    const result = await this.processTaskAssociation(task, associations, tasks);
                    result.forEach(t => {
                        if (!processedTasks.has(t.id)) {
                            prioritizedTasks.push(t);
                            processedTasks.add(t.id);
                        }
                    });
                }
            }

            return prioritizedTasks;

        } catch (error) {
            logger.error('检查任务关联失败:', error);
            throw error;
        }
    }

    /**
     * 处理单个任务的关联关系
     */
    async processTaskAssociation(task, associations, allTasks) {
        const result = [];

        for (const assoc of associations) {
            switch (assoc.relationship_type) {
                case 'priority_based':
                    // 优先级关系：高优先级任务先执行
                    if (assoc.primary_task_id === task.id) {
                        result.push(task); // 主任务优先
                        const associatedTask = allTasks.find(t => t.id === assoc.associated_task_id);
                        if (associatedTask) result.push(associatedTask);
                    }
                    break;

                case 'mutual_exclusive':
                    // 互斥关系：只执行优先级更高的任务
                    if (assoc.primary_task_id === task.id) {
                        result.push(task); // 主任务执行，关联任务跳过
                        logger.info(`任务 ${task.name} 与任务 ${assoc.associated_name} 互斥，执行主任务`);
                    }
                    break;

                case 'dependency':
                    // 依赖关系：先执行依赖任务
                    const dependencyTask = allTasks.find(t => t.id === assoc.primary_task_id);
                    if (dependencyTask) result.push(dependencyTask);
                    if (assoc.associated_task_id === task.id) {
                        result.push(task);
                    }
                    break;

                default:
                    result.push(task);
            }
        }

        return result.length > 0 ? result : [task];
    }

    /**
     * 步骤3: 验证调度规则
     */
    async validateScheduleRules(tasks, date) {
        try {
            const scheduledExecutions = [];

            for (const task of tasks) {
                // 获取任务的调度规则
                const scheduleRules = await query(`
                    SELECT * FROM schedule_rules WHERE task_id = ?
                `, [task.id]);

                if (scheduleRules.length === 0) {
                    logger.warn(`任务 ${task.name} 没有配置调度规则，跳过`);
                    continue;
                }

                for (const rule of scheduleRules) {
                    const shouldExecute = await this.checkScheduleRule(rule, date);
                    if (shouldExecute) {
                        scheduledExecutions.push({
                            task: task,
                            scheduleRule: rule,
                            executionDate: date
                        });
                    }
                }
            }

            return scheduledExecutions;

        } catch (error) {
            logger.error('验证调度规则失败:', error);
            throw error;
        }
    }

    /**
     * 检查单个调度规则是否应该在指定日期执行
     */
    async checkScheduleRule(rule, date) {
        const currentDate = new Date(date);
        const month = currentDate.getMonth() + 1;
        const dayOfMonth = currentDate.getDate();
        const dayOfWeek = currentDate.getDay(); // 0=周日, 1=周一, ..., 6=周六

        switch (rule.rule_type) {
            case 'by_day':
                // 按日执行：检查是否在指定月份和日期
                if (rule.months && rule.months.length > 0) {
                    if (!rule.months.includes(month)) {
                        return false;
                    }
                }

                if (rule.day_mode) {
                    const dayConfig = rule.day_mode;
                    if (dayConfig.mode === 'selected_days') {
                        return dayConfig.selectedDays && dayConfig.selectedDays.includes(dayOfMonth);
                    } else if (dayConfig.mode === 'odd') {
                        return dayOfMonth % 2 === 1;
                    } else if (dayConfig.mode === 'even') {
                        return dayOfMonth % 2 === 0;
                    } else if (dayConfig.mode === 'all') {
                        return true;
                    }
                }
                return true;

            case 'by_week':
                // 按周执行：检查是否在指定星期
                if (rule.day_mode && rule.day_mode.weekdays) {
                    return rule.day_mode.weekdays.includes(dayOfWeek);
                }
                return false;

            case 'by_interval':
                // 按间隔执行：检查间隔配置
                if (rule.interval_config && rule.reference_date) {
                    const refDate = new Date(rule.reference_date);
                    const diffTime = currentDate.getTime() - refDate.getTime();
                    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

                    const interval = rule.interval_config.interval || 1;
                    const unit = rule.interval_config.unit || 'days';

                    switch (unit) {
                        case 'days':
                            return diffDays >= 0 && diffDays % interval === 0;
                        case 'weeks':
                            return diffDays >= 0 && diffDays % (interval * 7) === 0;
                        case 'months':
                            const monthDiff = (currentDate.getFullYear() - refDate.getFullYear()) * 12 
                                            + (currentDate.getMonth() - refDate.getMonth());
                            return monthDiff >= 0 && monthDiff % interval === 0;
                        case 'years':
                            const yearDiff = currentDate.getFullYear() - refDate.getFullYear();
                            return yearDiff >= 0 && yearDiff % interval === 0;
                    }
                }
                return false;

            case 'monthly':
                // 月度执行：每月执行一次
                // 默认每月的每一天都执行（简单处理）
                return true;

            case 'daily':
                // 每日执行
                return true;

            case 'weekly':
                // 每周执行：检查是否在指定星期
                if (rule.day_mode && rule.day_mode.weekdays) {
                    return rule.day_mode.weekdays.includes(dayOfWeek);
                }
                // 默认每天都执行
                return true;

            default:
                return false;
        }
    }

    /**
     * 步骤4: 确定消息时间和内容
     */
    async determineMessageTiming(scheduledExecutions) {
        try {
            const executionPlans = [];

            for (const execution of scheduledExecutions) {
                const { task, scheduleRule, executionDate } = execution;

                // 确定执行时间
                let executionTimes = [];
                if (scheduleRule.execution_times && scheduleRule.execution_times.length > 0) {
                    executionTimes = scheduleRule.execution_times;
                } else if (task.reminder_time) {
                    // 使用任务配置的提醒时间
                    executionTimes = [task.reminder_time];
                } else {
                    logger.warn(`任务 ${task.name} 没有配置执行时间，使用默认时间 09:00`);
                    executionTimes = ['09:00:00'];
                }

                // 确定消息内容
                let messageContent = '';
                let messageFormat = 'text';

                if (task.content_source === 'manual') {
                    // 手动输入模式
                    messageContent = task.message_content || `提醒: ${task.name}`;
                } else if (task.content_source === 'worksheet') {
                    // 工作表模式
                    messageContent = await this.getWorksheetMessage(task, executionDate);
                } else {
                    messageContent = `任务提醒: ${task.name}`;
                }

                // 为每个执行时间创建执行计划
                for (const time of executionTimes) {
                    executionPlans.push({
                        task_id: task.id,
                        schedule_rule_id: scheduleRule.id,
                        scheduled_date: executionDate,
                        scheduled_time: time,
                        message_content: messageContent,
                        message_format: messageFormat,
                        webhook_url: task.group_webhook_url,
                        webhook_secret: task.group_secret,
                        priority_override: null,
                        status: 'pending'
                    });
                }
            }

            return executionPlans;

        } catch (error) {
            logger.error('确定消息时间失败:', error);
            throw error;
        }
    }

    /**
     * 从工作表获取消息内容
     */
    async getWorksheetMessage(task, date) {
        try {
            if (!task.file_config || !task.group_id) {
                return `任务提醒: ${task.name}`;
            }

            // 查找群组关联的Excel文件
            const files = await query(`
                SELECT * FROM files 
                WHERE group_id = ? AND status = 'active' AND file_type = 'regular'
                ORDER BY created_at DESC LIMIT 1
            `, [task.group_id]);

            if (files.length === 0) {
                logger.warn(`任务 ${task.name} 未找到关联的Excel文件`);
                return `任务提醒: ${task.name}`;
            }

            const file = files[0];
            const filePath = path.join(process.cwd(), file.file_path);

            // 解析Excel文件
            const parseResult = await excelParser.parseFile(filePath);
            const worksheetName = task.file_config.worksheet || Object.keys(parseResult.worksheets)[0];
            const worksheetData = parseResult.worksheets[worksheetName];

            if (!worksheetData || worksheetData.length === 0) {
                return `任务提醒: ${task.name}`;
            }

            // 根据时间匹配消息内容
            const currentTime = formatTime(beijingTime());
            const matchedReminder = worksheetData.find(item => item.time === currentTime);

            return matchedReminder ? matchedReminder.message : `任务提醒: ${task.name}`;

        } catch (error) {
            logger.error('获取工作表消息失败:', error);
            return `任务提醒: ${task.name}`;
        }
    }

    /**
     * 步骤5: 缓存执行计划到Redis
     */
    async cacheExecutionPlans(executionPlans, date) {
        try {
            const redis = await redisManager.getClient();
            if (!redis) {
                logger.warn('Redis未连接，跳过缓存');
                return;
            }

            const cacheKey = `v2_execution_plans:${date}`;
            const cacheData = JSON.stringify(executionPlans);

            await redis.setex(cacheKey, 24 * 60 * 60, cacheData); // 缓存24小时
            logger.info(`执行计划已缓存到Redis: ${cacheKey}`);

        } catch (error) {
            logger.error('缓存执行计划失败:', error);
            // 不抛出错误，允许系统继续运行
        }
    }

    /**
     * 保存执行计划到数据库
     */
    async saveExecutionPlans(executionPlans) {
        try {
            if (executionPlans.length === 0) {
                return;
            }

            // 批量插入执行计划
            const values = executionPlans.map(plan => [
                plan.task_id,
                plan.schedule_rule_id,
                plan.scheduled_date,
                plan.scheduled_time,
                plan.message_content,
                plan.message_format,
                plan.status,
                plan.webhook_url,
                plan.webhook_secret,
                plan.priority_override
            ]);

            const placeholders = values.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
            
            await query(`
                INSERT INTO execution_plans (
                    task_id, schedule_rule_id, scheduled_date, scheduled_time,
                    message_content, message_format, status, webhook_url, webhook_secret, priority_override
                ) VALUES ${placeholders}
            `, values.flat());

            logger.info(`保存 ${executionPlans.length} 个执行计划到数据库`);

        } catch (error) {
            logger.error('保存执行计划失败:', error);
            throw error;
        }
    }

    /**
     * 执行待处理的V2任务
     */
    async executeV2Tasks() {
        if (this.isExecuting) {
            logger.info('V2任务正在执行中，跳过本次检查');
            return;
        }

        try {
            this.isExecuting = true;
            const now = beijingTime();
            const currentDate = formatDate(now);
            const currentTime = formatTime(now);

            // 获取待执行的任务
            const pendingExecutions = await query(`
                SELECT ep.*, t.name as task_name, t.priority as task_priority, t.group_id
                FROM execution_plans ep
                JOIN tasks t ON ep.task_id = t.id
                WHERE ep.status = 'pending'
                    AND ep.scheduled_date = $1
                    AND ep.scheduled_time <= $2
                ORDER BY COALESCE(ep.priority_override, t.priority) DESC, ep.scheduled_time ASC
            `, [currentDate, currentTime]);

            if (pendingExecutions.length === 0) {
                return;
            }

            logger.info(`📢 开始执行 ${pendingExecutions.length} 个V2任务`);

            for (const execution of pendingExecutions) {
                try {
                    await this.executeSingleTask(execution);
                } catch (error) {
                    logger.error(`执行任务失败 ${execution.task_name}:`, error);
                    
                    // 更新执行状态为失败
                    await query(`
                        UPDATE execution_plans 
                        SET status = 'failed', 
                            executed_at = CURRENT_TIMESTAMP,
                            execution_result = $1
                        WHERE id = $2
                    `, [JSON.stringify({ error: error.message }), execution.id]);
                }
            }

            logger.info('✅ V2任务执行完成');

        } catch (error) {
            logger.error('❌ V2任务执行失败:', error);
        } finally {
            this.isExecuting = false;
        }
    }

    /**
     * 执行单个任务
     */
    async executeSingleTask(execution) {
        try {
            // 开始记录执行时间
            executionLogger.startExecution();
            
            // 更新执行状态为执行中 (不设置executed_at)
            await query(`
                UPDATE execution_plans 
                SET status = 'executing'
                WHERE id = $1
            `, [execution.id]);

            // 发送钉钉消息
            const result = await dingTalkBot.sendMessage(
                execution.webhook_url,
                execution.message_content,
                {
                    secret: execution.webhook_secret,
                    messageType: execution.message_format || 'text',
                    groupId: execution.group_id,
                    reminderId: execution.id
                }
            );

            // 更新执行结果
            const executionResult = {
                success: result.success,
                response: result.response,
                sentAt: formatDateTime(beijingTime())
            };

            if (result.success) {
                // 记录成功的执行历史
                await executionLogger.logSuccess(
                    execution.task_id,
                    execution.schedule_rule_id,
                    execution.message_content,
                    result.response
                );
                
                await query(`
                    UPDATE execution_plans 
                    SET status = 'completed',
                        executed_at = CURRENT_TIMESTAMP,
                        execution_result = $1,
                        retry_count = retry_count + 1
                    WHERE id = $2
                `, [JSON.stringify(executionResult), execution.id]);

                logger.info(`✅ V2任务执行成功: ${execution.task_name}`);
            } else {
                // 记录失败的执行历史
                await executionLogger.logFailure(
                    execution.task_id,
                    execution.schedule_rule_id,
                    execution.message_content,
                    result.message || '钉钉发送失败',
                    execution.retry_count || 0
                );
                
                await query(`
                    UPDATE execution_plans 
                    SET status = 'failed',
                        executed_at = CURRENT_TIMESTAMP,
                        execution_result = $1,
                        retry_count = retry_count + 1
                    WHERE id = $2
                `, [JSON.stringify(executionResult), execution.id]);
                
                logger.error(`❌ V2任务执行失败: ${execution.task_name}`);
            }

        } catch (error) {
            logger.error(`❌ V2任务执行失败: ${execution.task_name}`, error);
            
            // 记录异常的执行历史
            await executionLogger.logFailure(
                execution.task_id,
                execution.schedule_rule_id,
                execution.message_content,
                error.message,
                execution.retry_count || 0
            );
            
            throw error;
        }
    }

    /**
     * 清理过期的执行计划
     */
    async cleanupExpiredPlans() {
        try {
            const daysAgo = formatDate(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)); // 7天前

            const result = await query(`
                DELETE FROM execution_plans 
                WHERE scheduled_date < ? AND status IN ('completed', 'failed')
            `, [daysAgo]);

            if (result.affectedRows > 0) {
                logger.info(`清理过期执行计划: ${result.affectedRows} 条`);
            }

        } catch (error) {
            logger.error('清理过期执行计划失败:', error);
        }
    }
}

module.exports = new V2TaskExecutor();