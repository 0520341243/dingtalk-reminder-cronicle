/**
 * 工作表任务执行器
 * 负责在指定时间执行工作表中的提醒
 */

const { Group } = require('../models/mongodb');
const dingTalkBot = require('./dingTalkBot');
const logger = require('../utils/logger');
const worksheetTaskLoader = require('./worksheetTaskLoader');

class WorksheetExecutor {
    constructor() {
        this.isRunning = false;
        this.checkInterval = null;
    }

    /**
     * 启动执行器
     * 每分钟检查一次是否有需要执行的工作表提醒
     */
    start() {
        if (this.isRunning) {
            logger.warn('工作表执行器已在运行');
            return;
        }

        logger.info('启动工作表执行器...');
        this.isRunning = true;

        // 立即执行一次检查
        this.checkAndExecute();

        // 每分钟检查一次
        this.checkInterval = setInterval(() => {
            this.checkAndExecute();
        }, 60 * 1000); // 60秒
    }

    /**
     * 停止执行器
     */
    stop() {
        if (!this.isRunning) {
            return;
        }

        logger.info('停止工作表执行器...');
        this.isRunning = false;

        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
    }

    /**
     * 检查并执行当前时间的提醒
     */
    async checkAndExecute() {
        try {
            const now = new Date();
            const currentTime = this.formatTime(now);
            
            // 获取当前时间的执行计划
            const plans = worksheetTaskLoader.getExecutionPlansForTime(now);
            
            if (plans.length === 0) {
                return;
            }

            logger.info(`当前时间 ${currentTime} 有 ${plans.length} 个工作表提醒需要执行`);

            // 执行每个计划
            for (const plan of plans) {
                await this.executePlan(plan);
            }

        } catch (error) {
            logger.error('检查工作表执行计划失败:', error);
        }
    }

    /**
     * 执行单个计划
     */
    async executePlan(plan) {
        try {
            const { taskName, groupId, time, message, worksheet } = plan;
            
            logger.info(`执行工作表提醒: ${taskName} - ${time}`, {
                worksheet,
                message: message.substring(0, 50) + '...'
            });

            // 获取群组信息
            const group = await Group.findById(groupId);
            if (!group) {
                logger.error(`群组不存在: ${groupId}`);
                return false;
            }

            // 发送消息到钉钉
            const result = await dingTalkBot.sendMessage(
                group.webhookUrl,
                message,
                { secret: group.secret }
            );

            if (result.success) {
                logger.info(`工作表提醒发送成功: ${taskName} - ${time}`);
                
                // 更新群组统计
                group.sendCount = (group.sendCount || 0) + 1;
                group.lastSendTime = new Date();
                await group.save();
            } else {
                logger.error(`工作表提醒发送失败: ${taskName} - ${time}`, result.error);
                
                // 更新失败统计
                group.failCount = (group.failCount || 0) + 1;
                await group.save();
            }

            return result.success;

        } catch (error) {
            logger.error('执行工作表计划失败:', error);
            return false;
        }
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
}

module.exports = new WorksheetExecutor();