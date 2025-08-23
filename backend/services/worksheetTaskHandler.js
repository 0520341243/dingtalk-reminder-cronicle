/**
 * 工作表任务处理器 - 处理基于Excel工作表的任务执行
 */
const logger = require('../utils/logger');
const { query } = require('../config/database');
const excelParser = require('./excelParser');
const dingTalkBot = require('./dingTalkBot');
const executionLogger = require('./executionLogger');
const path = require('path');
const fs = require('fs').promises;

class WorksheetTaskHandler {
    constructor() {
        this.cache = new Map(); // 缓存解析过的工作表数据
        this.cacheTimeout = 5 * 60 * 1000; // 5分钟缓存
    }

    /**
     * 执行工作表任务
     */
    async executeWorksheetTask(task, currentTime) {
        try {
            logger.info(`开始执行工作表任务: ${task.name}`, {
                taskId: task.id,
                time: currentTime
            });

            // 获取任务关联的文件信息
            const fileInfo = await this.getTaskFileInfo(task.id);
            if (!fileInfo) {
                logger.error(`任务 ${task.id} 没有关联的工作表文件`);
                return false;
            }

            // 解析工作表数据
            const worksheetData = await this.getWorksheetData(
                fileInfo.file_path,
                fileInfo.selected_worksheet
            );

            if (!worksheetData || worksheetData.length === 0) {
                logger.warn(`工作表没有数据: ${fileInfo.file_path}`);
                return false;
            }

            // 获取当前时间的提醒
            const currentTimeStr = this.formatTime(currentTime);
            const reminders = this.findRemindersForTime(worksheetData, currentTimeStr);

            if (reminders.length === 0) {
                logger.debug(`当前时间 ${currentTimeStr} 没有需要发送的提醒`);
                return false;
            }

            // 发送提醒
            let successCount = 0;
            for (const reminder of reminders) {
                const success = await this.sendReminder(task, reminder);
                if (success) successCount++;
            }

            logger.info(`工作表任务执行完成: ${successCount}/${reminders.length} 个提醒发送成功`);
            return successCount > 0;

        } catch (error) {
            logger.error(`执行工作表任务失败: ${task.name}`, error);
            return false;
        }
    }

    /**
     * 获取任务文件信息
     */
    async getTaskFileInfo(taskId) {
        try {
            const result = await query(`
                SELECT 
                    tf.file_id,
                    tf.selected_worksheet,
                    f.file_path,
                    f.original_name
                FROM task_files tf
                JOIN files f ON f.id = tf.file_id
                WHERE tf.task_id = $1 AND tf.is_primary = true
                LIMIT 1
            `, [taskId]);

            return result.rows[0] || null;
        } catch (error) {
            logger.error('获取任务文件信息失败', error);
            return null;
        }
    }

    /**
     * 获取工作表数据（带缓存）
     */
    async getWorksheetData(filePath, worksheetName) {
        const cacheKey = `${filePath}:${worksheetName}`;
        
        // 检查缓存
        if (this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (Date.now() - cached.timestamp < this.cacheTimeout) {
                logger.debug('使用缓存的工作表数据');
                return cached.data;
            }
        }

        try {
            // 解析Excel文件
            const fullPath = path.resolve(process.cwd(), filePath);
            const fileExists = await fs.access(fullPath).then(() => true).catch(() => false);
            
            if (!fileExists) {
                logger.error(`文件不存在: ${fullPath}`);
                return null;
            }

            const parseResult = await excelParser.parseFile(fullPath);
            
            if (!parseResult || !parseResult.worksheets) {
                logger.error('解析Excel文件失败');
                return null;
            }

            // 获取指定工作表或第一个工作表
            const targetWorksheet = worksheetName || Object.keys(parseResult.worksheets)[0];
            const data = parseResult.worksheets[targetWorksheet];

            // 更新缓存
            this.cache.set(cacheKey, {
                data: data,
                timestamp: Date.now()
            });

            return data;
        } catch (error) {
            logger.error('解析工作表数据失败', error);
            return null;
        }
    }

    /**
     * 查找指定时间的提醒
     */
    findRemindersForTime(worksheetData, timeStr) {
        const reminders = [];
        
        for (const row of worksheetData) {
            // 检查时间字段（支持多种格式）
            const rowTime = this.normalizeTime(row['时间'] || row['time'] || row['Time']);
            
            if (rowTime === timeStr) {
                const message = row['消息内容'] || row['内容'] || row['message'] || row['Message'];
                if (message) {
                    reminders.push({
                        time: rowTime,
                        message: message,
                        raw: row
                    });
                }
            }
        }

        return reminders;
    }

    /**
     * 发送提醒
     */
    async sendReminder(task, reminder) {
        try {
            // 开始记录执行时间
            executionLogger.startExecution();
            
            // 防止发送测试连接消息
            if (reminder.message && (
                reminder.message.includes('测试连接') || 
                reminder.message.includes('test connection') ||
                reminder.message.includes('连接测试')
            )) {
                logger.warn(`跳过测试连接消息: ${reminder.message}`);
                return false;
            }
            
            // 获取webhook信息
            const webhookInfo = await this.getWebhookInfo(task);
            if (!webhookInfo) {
                logger.error(`任务 ${task.id} 没有webhook配置`);
                
                // 记录跳过的执行历史
                await executionLogger.logSkipped(
                    task.id,
                    task.schedule_rule_id || null,
                    '没有webhook配置'
                );
                
                return false;
            }

            logger.info(`准备发送工作表提醒: 任务ID=${task.id}, 时间=${reminder.time || 'N/A'}, 消息预览=${reminder.message.substring(0, 100)}...`);

            // 发送到钉钉 - 修正参数传递
            const result = await dingTalkBot.sendMessage(
                webhookInfo.webhook_url,
                reminder.message,
                {
                    groupId: task.group_id,
                    reminderId: task.id,
                    secret: webhookInfo.webhook_secret || webhookInfo.secret
                }
            );

            if (result && result.success) {
                // 记录成功的执行历史
                await executionLogger.logSuccess(
                    task.id,
                    task.schedule_rule_id || null,
                    reminder.message,
                    result.response
                );
                
                // 记录发送日志
                await this.logSendRecord(task.id, reminder);

                logger.info(`提醒发送成功: ${reminder.message.substring(0, 50)}...`);
                return true;
            } else {
                // 记录失败的执行历史
                await executionLogger.logFailure(
                    task.id,
                    task.schedule_rule_id || null,
                    reminder.message,
                    result?.message || '钉钉发送失败',
                    0
                );
                
                logger.error(`提醒发送失败: ${result?.message}`);
                return false;
            }

        } catch (error) {
            logger.error('发送提醒失败', error);
            
            // 记录异常的执行历史
            await executionLogger.logFailure(
                task.id,
                task.schedule_rule_id || null,
                reminder.message,
                error.message,
                0
            );
            
            return false;
        }
    }

    /**
     * 获取webhook信息
     */
    async getWebhookInfo(task) {
        try {
            // 先尝试从通知配置获取
            const configResult = await query(`
                SELECT webhook_url, webhook_secret
                FROM notification_configs
                WHERE task_id = $1
                LIMIT 1
            `, [task.id]);

            if (configResult.rows.length > 0) {
                return configResult.rows[0];
            }

            // 然后从群组获取
            if (task.group_id) {
                const groupResult = await query(`
                    SELECT webhook_url, secret as webhook_secret
                    FROM groups
                    WHERE id = $1
                `, [task.group_id]);

                if (groupResult.rows.length > 0) {
                    return groupResult.rows[0];
                }
            }

            return null;
        } catch (error) {
            logger.error('获取webhook信息失败', error);
            return null;
        }
    }

    /**
     * 记录发送日志
     */
    async logSendRecord(taskId, reminder) {
        try {
            await query(`
                INSERT INTO send_logs (
                    reminder_id, task_id, send_time, status, 
                    message_content, created_at
                ) VALUES (
                    NULL, $1, CURRENT_TIMESTAMP, 'success',
                    $2, CURRENT_TIMESTAMP
                )
            `, [taskId, reminder.message]);
        } catch (error) {
            logger.error('记录发送日志失败', error);
        }
    }

    /**
     * 格式化时间为HH:MM格式
     */
    formatTime(date) {
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${hours}:${minutes}`;
    }

    /**
     * 标准化时间格式
     */
    normalizeTime(timeStr) {
        if (!timeStr) return null;
        
        // 处理各种时间格式
        const timeString = String(timeStr).trim();
        
        // 如果是HH:MM:SS格式，去掉秒
        if (timeString.match(/^\d{1,2}:\d{2}:\d{2}$/)) {
            return timeString.substring(0, 5);
        }
        
        // 如果是HH:MM格式，直接返回
        if (timeString.match(/^\d{1,2}:\d{2}$/)) {
            const [h, m] = timeString.split(':');
            return `${h.padStart(2, '0')}:${m}`;
        }
        
        return null;
    }

    /**
     * 清理缓存
     */
    clearCache() {
        this.cache.clear();
        logger.info('工作表缓存已清理');
    }
}

module.exports = new WorksheetTaskHandler();