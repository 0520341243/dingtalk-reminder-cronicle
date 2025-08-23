/**
 * 执行历史记录服务
 * 记录任务执行的结果到execution_history表
 */

const { query } = require('../config/database');
const logger = require('../utils/logger');

class ExecutionLogger {
    /**
     * 记录任务执行成功
     */
    async logSuccess(taskId, scheduleRuleId, messageContent, webhookResponse = null) {
        try {
            const sql = `
                INSERT INTO execution_history (
                    task_id, 
                    schedule_rule_id, 
                    status, 
                    message_content, 
                    webhook_response,
                    execution_result,
                    executed_at
                ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
                RETURNING id
            `;
            
            const executionResult = {
                success: true,
                timestamp: new Date().toISOString(),
                duration: Date.now() - this.startTime || 0
            };
            
            const params = [
                taskId,
                scheduleRuleId || null,
                'completed',
                messageContent,
                webhookResponse ? JSON.stringify(webhookResponse) : null,
                JSON.stringify(executionResult)
            ];
            
            const result = await query(sql, params);
            logger.info(`执行历史记录成功: 任务${taskId}`, { historyId: result[0]?.id });
            return result[0]?.id;
        } catch (error) {
            logger.error('记录执行历史失败', { taskId, error: error.message });
            return null;
        }
    }
    
    /**
     * 记录任务执行失败
     */
    async logFailure(taskId, scheduleRuleId, messageContent, errorMessage, retryCount = 0) {
        try {
            const sql = `
                INSERT INTO execution_history (
                    task_id, 
                    schedule_rule_id, 
                    status, 
                    message_content, 
                    error_message,
                    retry_count,
                    execution_result,
                    executed_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
                RETURNING id
            `;
            
            const executionResult = {
                success: false,
                error: errorMessage,
                timestamp: new Date().toISOString(),
                duration: Date.now() - this.startTime || 0
            };
            
            const params = [
                taskId,
                scheduleRuleId || null,
                retryCount > 0 ? 'retrying' : 'failed',
                messageContent,
                errorMessage,
                retryCount,
                JSON.stringify(executionResult)
            ];
            
            const result = await query(sql, params);
            logger.info(`执行失败记录成功: 任务${taskId}`, { 
                historyId: result[0]?.id,
                error: errorMessage 
            });
            return result[0]?.id;
        } catch (error) {
            logger.error('记录执行失败历史失败', { taskId, error: error.message });
            return null;
        }
    }
    
    /**
     * 记录任务跳过
     */
    async logSkipped(taskId, scheduleRuleId, reason) {
        try {
            const sql = `
                INSERT INTO execution_history (
                    task_id, 
                    schedule_rule_id, 
                    status, 
                    message_content,
                    execution_result,
                    executed_at
                ) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
                RETURNING id
            `;
            
            const executionResult = {
                success: false,
                skipped: true,
                reason: reason,
                timestamp: new Date().toISOString()
            };
            
            const params = [
                taskId,
                scheduleRuleId || null,
                'skipped',
                `任务跳过: ${reason}`,
                JSON.stringify(executionResult)
            ];
            
            const result = await query(sql, params);
            logger.info(`执行跳过记录成功: 任务${taskId}`, { 
                historyId: result[0]?.id,
                reason 
            });
            return result[0]?.id;
        } catch (error) {
            logger.error('记录跳过历史失败', { taskId, error: error.message });
            return null;
        }
    }
    
    /**
     * 获取任务执行统计
     */
    async getTaskStatistics(taskId, days = 30) {
        try {
            const sql = `
                SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
                    SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
                    SUM(CASE WHEN status = 'skipped' THEN 1 ELSE 0 END) as skipped,
                    SUM(CASE WHEN status = 'retrying' THEN 1 ELSE 0 END) as retrying,
                    AVG(CASE 
                        WHEN status = 'completed' AND execution_result->>'duration' IS NOT NULL 
                        THEN (execution_result->>'duration')::int 
                        ELSE NULL 
                    END) as avg_duration
                FROM execution_history
                WHERE task_id = $1
                AND executed_at >= CURRENT_TIMESTAMP - INTERVAL '${days} days'
            `;
            
            const result = await query(sql, [taskId]);
            
            if (result && result[0]) {
                const stats = result[0];
                return {
                    total: parseInt(stats.total) || 0,
                    completed: parseInt(stats.completed) || 0,
                    failed: parseInt(stats.failed) || 0,
                    skipped: parseInt(stats.skipped) || 0,
                    retrying: parseInt(stats.retrying) || 0,
                    successRate: stats.total > 0 ? 
                        ((stats.completed / stats.total) * 100).toFixed(2) + '%' : '0%',
                    avgDuration: Math.round(stats.avg_duration) || 0
                };
            }
            
            return {
                total: 0,
                completed: 0,
                failed: 0,
                skipped: 0,
                retrying: 0,
                successRate: '0%',
                avgDuration: 0
            };
        } catch (error) {
            logger.error('获取任务统计失败', { taskId, error: error.message });
            return null;
        }
    }
    
    /**
     * 开始记录执行时间
     */
    startExecution() {
        this.startTime = Date.now();
    }
    
    /**
     * 清理旧的执行历史（保留最近N天）
     */
    async cleanupOldHistory(daysToKeep = 90) {
        try {
            const sql = `
                DELETE FROM execution_history
                WHERE executed_at < CURRENT_TIMESTAMP - INTERVAL '${daysToKeep} days'
                RETURNING id
            `;
            
            const result = await query(sql);
            const deletedCount = result ? result.length : 0;
            
            if (deletedCount > 0) {
                logger.info(`清理了 ${deletedCount} 条旧的执行历史记录`);
            }
            
            return deletedCount;
        } catch (error) {
            logger.error('清理执行历史失败', { error: error.message });
            return 0;
        }
    }
}

module.exports = new ExecutionLogger();