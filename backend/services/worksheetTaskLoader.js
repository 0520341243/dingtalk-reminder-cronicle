/**
 * 工作表任务加载器
 * 根据需求书要求，动态加载工作表任务的执行计划
 */

const { Task, File, Group } = require('../models/mongodb');
const excelParser = require('./excelParser');
const logger = require('../utils/logger');
const path = require('path');
const scheduleRuleChecker = require('./scheduleRuleChecker');

class WorksheetTaskLoader {
    constructor() {
        this.loadedTasks = new Map(); // 记录已加载的任务
    }

    /**
     * 加载所有工作表任务的今日执行计划
     * 根据需求书：每日调度器运行时，检查所有复杂任务的调度规则
     */
    async loadDailyWorksheetTasks() {
        try {
            logger.info('开始加载工作表任务的今日执行计划...');
            
            // 查询所有激活的工作表任务
            const worksheetTasks = await Task.find({
                type: 'worksheet',
                status: 'active'
            }).populate('groupId');

            let loadedCount = 0;
            let skippedCount = 0;
            const today = new Date();

            for (const task of worksheetTasks) {
                try {
                    // 检查调度规则是否匹配今天
                    const shouldRunToday = await this.checkScheduleRule(task, today);
                    
                    if (!shouldRunToday) {
                        logger.debug(`任务 ${task.name} 今天不执行，跳过`);
                        skippedCount++;
                        continue;
                    }

                    // 加载工作表内容并创建今日执行计划
                    const loaded = await this.loadWorksheetTask(task, today);
                    if (loaded) {
                        loadedCount++;
                    } else {
                        skippedCount++;
                    }
                } catch (error) {
                    logger.error(`加载任务 ${task.name} 失败:`, error);
                    skippedCount++;
                }
            }

            logger.info(`工作表任务加载完成: 加载 ${loadedCount} 个，跳过 ${skippedCount} 个`);
            return { loadedCount, skippedCount, total: worksheetTasks.length };

        } catch (error) {
            logger.error('加载工作表任务失败:', error);
            throw error;
        }
    }

    /**
     * 加载单个工作表任务
     * 根据需求书：动态加载对应工作表中的所有时间点和内容
     */
    async loadWorksheetTask(task, date = new Date()) {
        try {
            // 检查是否有文件配置
            if (!task.fileConfig || !task.fileConfig.fileId) {
                logger.warn(`任务 ${task.name} 缺少文件配置`);
                return false;
            }

            // 获取文件信息
            const file = await File.findById(task.fileConfig.fileId);
            if (!file) {
                logger.error(`任务 ${task.name} 的文件不存在: ${task.fileConfig.fileId}`);
                return false;
            }

            // 解析Excel文件
            const filePath = path.resolve(process.cwd(), file.filePath);
            const parseResult = await excelParser.parseFile(filePath);
            
            if (!parseResult || !parseResult.worksheets) {
                logger.error(`解析文件失败: ${filePath}`);
                return false;
            }

            // 获取指定的工作表
            const worksheetName = task.fileConfig.worksheet;
            const worksheetData = parseResult.worksheets[worksheetName];
            
            if (!worksheetData || worksheetData.length === 0) {
                logger.warn(`工作表 ${worksheetName} 没有数据`);
                return false;
            }

            logger.info(`任务 ${task.name} 加载工作表 ${worksheetName}，共 ${worksheetData.length} 条提醒`);

            // 为每个时间点创建执行计划（智能过滤过期时间）
            const executionPlans = [];
            const now = new Date();
            const currentTimeStr = this.formatTime(now);
            let filteredCount = 0;
            
            for (const item of worksheetData) {
                if (item.time && item.message) {
                    // 智能过滤：如果是今天的任务，过滤掉已过期的时间点
                    if (this.isSameDay(date, now)) {
                        // 比较时间字符串（HH:MM:SS格式）
                        if (item.time < currentTimeStr) {
                            logger.debug(`过滤过期时间点: ${item.time} < ${currentTimeStr}`);
                            filteredCount++;
                            continue;
                        }
                    }
                    
                    executionPlans.push({
                        taskId: task._id,
                        taskName: task.name,
                        groupId: task.groupId,
                        time: item.time,
                        message: item.message || item.content,
                        date: date,
                        worksheet: worksheetName
                    });
                }
            }

            // 记录已加载的任务
            this.loadedTasks.set(task._id.toString(), {
                taskName: task.name,
                worksheet: worksheetName,
                plans: executionPlans,
                loadedAt: new Date()
            });

            if (filteredCount > 0) {
                logger.info(`任务 ${task.name} 创建了 ${executionPlans.length} 个执行计划（过滤了 ${filteredCount} 个过期时间点）`);
            } else {
                logger.info(`任务 ${task.name} 创建了 ${executionPlans.length} 个执行计划`);
            }
            return executionPlans;

        } catch (error) {
            logger.error(`加载工作表任务失败: ${task.name}`, error);
            return false;
        }
    }

    /**
     * 检查任务的调度规则是否匹配指定日期
     */
    async checkScheduleRule(task, date) {
        try {
            if (!task.scheduleRule) {
                logger.warn(`任务 ${task.name} 没有调度规则`);
                return false;
            }

            // 使用调度规则检查器判断是否应该在指定日期执行
            return scheduleRuleChecker.shouldRunOnDate(task.scheduleRule, date);
        } catch (error) {
            logger.error(`检查调度规则失败: ${task.name}`, error);
            return false;
        }
    }

    /**
     * 获取指定时间的执行计划
     */
    getExecutionPlansForTime(time) {
        const plans = [];
        const timeStr = this.formatTime(time);

        for (const [taskId, taskData] of this.loadedTasks.entries()) {
            for (const plan of taskData.plans) {
                if (plan.time === timeStr) {
                    plans.push(plan);
                }
            }
        }

        return plans;
    }

    /**
     * 格式化时间为 HH:MM:SS
     */
    formatTime(date) {
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
        return `${hours}:${minutes}:${seconds}`;
    }

    /**
     * 判断两个日期是否是同一天
     */
    isSameDay(date1, date2) {
        return date1.getFullYear() === date2.getFullYear() &&
               date1.getMonth() === date2.getMonth() &&
               date1.getDate() === date2.getDate();
    }

    /**
     * 清理过期的执行计划
     */
    clearExpiredPlans() {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        for (const [taskId, taskData] of this.loadedTasks.entries()) {
            // 清理不是今天的计划
            const planDate = new Date(taskData.loadedAt);
            const loadedDay = new Date(planDate.getFullYear(), planDate.getMonth(), planDate.getDate());
            
            if (loadedDay.getTime() !== today.getTime()) {
                this.loadedTasks.delete(taskId);
                logger.debug(`清理过期的执行计划: ${taskData.taskName}`);
            }
        }
    }

    /**
     * 手动重新加载所有工作表任务
     * 用于"重新加载计划"按钮
     */
    async reloadAllTasks() {
        logger.info('手动重新加载所有工作表任务...');
        
        // 清空现有加载的任务
        this.loadedTasks.clear();
        
        // 重新加载
        return await this.loadDailyWorksheetTasks();
    }
}

module.exports = new WorksheetTaskLoader();