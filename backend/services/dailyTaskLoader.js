/**
 * Daily Task Loader - 每日任务加载器
 * 系统启动时和每天凌晨2点加载当天的所有任务计划
 */

const { query } = require('../config/database');
const logger = require('../utils/logger');
const excelParser = require('./excelParser');
const { advancedScheduleEngine } = require('./advancedScheduleEngine');

class DailyTaskLoader {
    constructor() {
        this.loadedPlans = new Map(); // 缓存已加载的执行计划
    }
    
    /**
     * 加载今天的所有执行计划
     */
    async loadTodayPlans() {
        const startTime = Date.now();
        const today = new Date();
        const todayStr = this.formatDate(today);
        const currentTime = this.formatTime(today);
        
        logger.info(`开始加载今天(${todayStr})的执行计划...`);
        
        try {
            // 1. 清理之前的缓存 - 完全清空以释放内存
            this.loadedPlans.clear();
            
            // 强制垃圾回收（如果启用）
            if (global.gc) {
                global.gc();
            }
            
            // 2. 获取所有活动任务
            const tasks = await this.getActiveTasks();
            logger.info(`找到 ${tasks.length} 个活动任务`);
            
            let totalPlans = 0;
            let worksheetTasks = 0;
            let simpleTasks = 0;
            
            // 3. 为每个任务生成执行计划
            for (const task of tasks) {
                try {
                    const plans = await this.generateTaskPlans(task, today, currentTime);
                    
                    if (plans.length > 0) {
                        this.loadedPlans.set(task.id, plans);
                        totalPlans += plans.length;
                        
                        if (task.task_type === 'worksheet') {
                            worksheetTasks++;
                        } else {
                            simpleTasks++;
                        }
                        
                        logger.info(`任务 ${task.id}(${task.name}) 生成了 ${plans.length} 个执行计划`);
                    }
                } catch (error) {
                    logger.error(`为任务 ${task.id} 生成执行计划失败:`, error);
                }
            }
            
            const duration = Date.now() - startTime;
            logger.info(`✅ 执行计划加载完成:`, {
                totalTasks: tasks.length,
                worksheetTasks,
                simpleTasks,
                totalPlans,
                duration: `${duration}ms`
            });
            
            // 4. 将执行计划保存到数据库
            await this.saveExecutionPlans(todayStr);
            
            return {
                success: true,
                totalTasks: tasks.length,
                totalPlans,
                worksheetTasks,
                simpleTasks,
                duration
            };
            
        } catch (error) {
            logger.error('加载今天的执行计划失败:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    /**
     * 获取所有活动任务
     */
    async getActiveTasks() {
        const result = await query(`
            SELECT 
                t.id,
                t.name,
                t.task_type,
                t.message_content,
                t.group_id,
                t.status,
                t.enable_time,
                t.disable_time,
                sr.id as rule_id,
                sr.rule_type,
                sr.months,
                sr.day_mode,
                sr.execution_times
            FROM tasks t
            LEFT JOIN schedule_rules sr ON sr.task_id = t.id
            WHERE t.status = 'active'
            ORDER BY t.id
        `);
        
        // 兼容不同的查询结果格式
        const rows = Array.isArray(result) ? result : (result.rows || []);
        
        // 按任务ID分组
        const taskMap = new Map();
        
        for (const row of rows) {
            if (!taskMap.has(row.id)) {
                taskMap.set(row.id, {
                    id: row.id,
                    name: row.name,
                    task_type: row.task_type,
                    message_content: row.message_content,
                    group_id: row.group_id,
                    status: row.status,
                    enable_time: row.enable_time,
                    disable_time: row.disable_time,
                    scheduleRules: []
                });
            }
            
            // 添加调度规则
            if (row.rule_id) {
                taskMap.get(row.id).scheduleRules.push({
                    id: row.rule_id,
                    ruleType: row.rule_type,
                    rule_type: row.rule_type,
                    months: row.months,
                    day_mode: row.day_mode,
                    dayMode: row.day_mode,
                    executionTimes: row.execution_times,
                    execution_times: row.execution_times
                });
            }
        }
        
        return Array.from(taskMap.values());
    }
    
    /**
     * 为任务生成执行计划
     */
    async generateTaskPlans(task, today, currentTime) {
        const plans = [];
        
        // 检查任务是否在启用时间范围内
        if (!this.isTaskActive(task, today)) {
            return plans;
        }
        
        // 处理工作表任务
        if (task.task_type === 'worksheet') {
            // 检查调度规则是否匹配今天
            for (const rule of task.scheduleRules) {
                if (await this.checkRuleMatchesToday(rule, today)) {
                    // 从工作表获取执行计划，传递rule.id
                    const worksheetPlans = await this.getWorksheetPlans(task.id, rule.id, today, currentTime);
                    plans.push(...worksheetPlans);
                }
            }
        } else {
            // 处理简单任务
            for (const rule of task.scheduleRules) {
                if (await this.checkRuleMatchesToday(rule, today)) {
                    // 生成执行时间
                    const executionTimes = rule.executionTimes || rule.execution_times || [];
                    
                    for (const timeStr of executionTimes) {
                        // 过滤已经过去的时间
                        if (this.isTimeInFuture(timeStr, currentTime)) {
                            plans.push({
                                task_id: task.id,
                                schedule_rule_id: rule.id,
                                scheduled_time: timeStr,
                                message_content: task.message_content,
                                status: 'pending'
                            });
                        }
                    }
                }
            }
        }
        
        return plans;
    }
    
    /**
     * 检查任务是否在活动时间范围内
     */
    isTaskActive(task, date) {
        const dateStr = this.formatDate(date);
        
        // 检查启用时间
        if (task.enable_time) {
            const enableDate = new Date(task.enable_time);
            if (date < enableDate) {
                return false;
            }
        }
        
        // 检查禁用时间
        if (task.disable_time) {
            const disableDate = new Date(task.disable_time);
            if (date > disableDate) {
                return false;
            }
        }
        
        return true;
    }
    
    /**
     * 检查调度规则是否匹配今天
     */
    async checkRuleMatchesToday(rule, today) {
        try {
            // 对于工作表任务，只需要检查日期是否匹配，不需要检查执行时间
            // 因为执行时间将从工作表中动态加载
            const isWorksheetTask = (!rule.executionTimes || rule.executionTimes.length === 0) &&
                                   (!rule.execution_times || rule.execution_times.length === 0);
            
            if (isWorksheetTask) {
                // 对于工作表任务，直接检查日期规则
                return this.checkDateRuleMatches(rule, today);
            } else {
                // 对于简单任务，使用原有逻辑
                const executions = await advancedScheduleEngine.calculateNextExecution(
                    rule,
                    today,
                    1 // 只检查今天
                );
                
                // 检查是否有在今天的执行
                for (const exec of executions) {
                    if (exec.toDateString() === today.toDateString()) {
                        return true;
                    }
                }
                
                return false;
            }
        } catch (error) {
            logger.error('检查调度规则失败:', error);
            
            // 降级到简单检查
            return this.checkDateRuleMatches(rule, today);
        }
    }
    
    /**
     * 检查日期规则是否匹配
     */
    checkDateRuleMatches(rule, today) {
        const ruleType = rule.rule_type || rule.ruleType;
        
        if (ruleType === 'monthly') {
            const month = today.getMonth() + 1;
            const day = today.getDate();
            
            // 检查月份
            if (rule.months && rule.months.includes(month)) {
                // 检查日期
                const dayMode = rule.day_mode || rule.dayMode;
                if (dayMode) {
                    const days = dayMode.days || dayMode.values;
                    if (days && days.includes(day)) {
                        return true;
                    }
                }
            }
        } else if (ruleType === 'daily') {
            // 每日任务总是匹配
            return true;
        } else if (ruleType === 'weekly') {
            // 检查星期
            const dayOfWeek = today.getDay();
            const dayMode = rule.day_mode || rule.dayMode;
            if (dayMode) {
                const weekdays = dayMode.weekdays || dayMode.values;
                if (weekdays && weekdays.includes(dayOfWeek)) {
                    return true;
                }
            }
        }
        
        return false;
    }
    
    /**
     * 从工作表获取执行计划
     */
    async getWorksheetPlans(taskId, ruleId, today, currentTime) {
        const plans = [];
        
        try {
            // 获取任务关联的文件
            const fileResult = await query(`
                SELECT 
                    tf.file_id,
                    tf.selected_worksheet,
                    f.file_path
                FROM task_files tf
                JOIN files f ON f.id = tf.file_id
                WHERE tf.task_id = $1 AND tf.is_primary = true
                LIMIT 1
            `, [taskId]);
            
            const rows = Array.isArray(fileResult) ? fileResult : (fileResult.rows || []);
            
            if (rows.length === 0) {
                return plans;
            }
            
            const { file_path, selected_worksheet } = rows[0];
            
            // 解析Excel文件
            const parseResult = await excelParser.parseFile(file_path);
            
            if (!parseResult || !parseResult.worksheets) {
                return plans;
            }
            
            // 获取指定工作表
            const worksheetName = selected_worksheet || Object.keys(parseResult.worksheets)[0];
            const worksheetData = parseResult.worksheets[worksheetName];
            
            if (!worksheetData || !Array.isArray(worksheetData)) {
                return plans;
            }
            
            // 生成执行计划
            for (const row of worksheetData) {
                const time = row['时间'] || row['Time'] || row['time'];
                const message = row['消息内容'] || row['Message'] || row['message'] || 
                               row['内容'] || row['Content'] || row['content'];
                
                if (time) {
                    const normalizedTime = this.normalizeTimeString(time);
                    
                    // 过滤已经过去的时间
                    if (normalizedTime && this.isTimeInFuture(normalizedTime, currentTime)) {
                        plans.push({
                            task_id: taskId,
                            schedule_rule_id: ruleId,  // 添加规则ID
                            scheduled_time: normalizedTime,
                            message_content: message || '',
                            status: 'pending'
                        });
                    }
                }
            }
            
            logger.info(`从工作表 ${worksheetName} 加载了 ${plans.length} 个未来的执行计划`);
            
        } catch (error) {
            logger.error(`获取任务 ${taskId} 的工作表计划失败:`, error);
        }
        
        return plans;
    }
    
    /**
     * 检查时间是否在未来
     */
    isTimeInFuture(timeStr, currentTime) {
        // 比较HH:MM格式的时间
        return timeStr > currentTime;
    }
    
    /**
     * 标准化时间字符串
     */
    normalizeTimeString(timeStr) {
        if (!timeStr) return null;
        
        const str = String(timeStr).trim();
        
        // HH:MM:SS 格式
        if (str.match(/^\d{1,2}:\d{2}:\d{2}$/)) {
            return str.substring(0, 5); // 返回 HH:MM
        }
        
        // HH:MM 格式
        if (str.match(/^\d{1,2}:\d{2}$/)) {
            return str;
        }
        
        return null;
    }
    
    /**
     * 格式化日期
     */
    formatDate(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
    
    /**
     * 格式化时间
     */
    formatTime(date) {
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${hours}:${minutes}`;
    }
    
    /**
     * 保存执行计划到数据库
     */
    async saveExecutionPlans(dateStr) {
        try {
            let savedCount = 0;
            
            for (const [taskId, plans] of this.loadedPlans) {
                for (const plan of plans) {
                    try {
                        await query(`
                            INSERT INTO execution_plans (
                                task_id, schedule_rule_id, scheduled_date, scheduled_time,
                                message_content, message_format, status,
                                created_at, updated_at
                            ) VALUES (
                                $1, $2, $3, $4, $5, 'text', 'pending',
                                CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
                            )
                            ON CONFLICT (task_id, scheduled_date, scheduled_time) 
                            DO UPDATE SET 
                                message_content = EXCLUDED.message_content,
                                updated_at = CURRENT_TIMESTAMP
                        `, [
                            plan.task_id,
                            plan.schedule_rule_id || null,
                            dateStr,
                            plan.scheduled_time,
                            plan.message_content || ''
                        ]);
                        
                        savedCount++;
                    } catch (error) {
                        logger.error(`保存执行计划失败 [任务${plan.task_id}]:`, error);
                    }
                }
            }
            
            logger.info(`成功保存 ${savedCount} 个执行计划到数据库`);
            
        } catch (error) {
            logger.error('保存执行计划失败:', error);
        }
    }
    
    /**
     * 获取加载的计划
     */
    getLoadedPlans() {
        const result = [];
        for (const [taskId, plans] of this.loadedPlans) {
            result.push({
                taskId,
                plansCount: plans.length,
                plans
            });
        }
        return result;
    }
}

// 导出单例
module.exports = new DailyTaskLoader();