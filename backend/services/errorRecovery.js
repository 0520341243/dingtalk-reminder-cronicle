/**
 * 错误恢复服务
 * 提供系统级的错误恢复和补偿机制
 */

const logger = require('../utils/logger');
const { query } = require('../config/database');

class ErrorRecoveryService {
    constructor() {
        this.failedTasks = new Map();
        this.retryQueue = [];
        this.maxRetries = 3;
        this.retryInterval = 60000; // 1分钟
    }
    
    /**
     * 记录失败的任务
     */
    async recordFailure(taskId, error, context = {}) {
        try {
            const failureInfo = {
                taskId,
                error: error.message || error,
                stack: error.stack,
                context,
                timestamp: new Date(),
                retryCount: 0
            };
            
            this.failedTasks.set(taskId, failureInfo);
            
            // 记录到数据库
            await query(`
                INSERT INTO task_failures (
                    task_id, error_message, error_stack, 
                    context, failed_at, retry_count
                ) VALUES ($1, $2, $3, $4, $5, $6)
                ON CONFLICT (task_id, failed_at) DO UPDATE
                SET error_message = EXCLUDED.error_message,
                    retry_count = task_failures.retry_count + 1
            `, [
                taskId,
                failureInfo.error,
                failureInfo.stack,
                JSON.stringify(context),
                failureInfo.timestamp,
                0
            ]).catch(err => {
                // 如果表不存在，记录日志但不抛出错误
                logger.warn('无法记录任务失败信息到数据库:', err.message);
            });
            
            // 添加到重试队列
            if (failureInfo.retryCount < this.maxRetries) {
                this.scheduleRetry(taskId, failureInfo);
            }
            
        } catch (error) {
            logger.error('记录任务失败信息时出错:', error);
        }
    }
    
    /**
     * 调度重试
     */
    scheduleRetry(taskId, failureInfo) {
        setTimeout(() => {
            this.retryQueue.push({
                taskId,
                failureInfo,
                scheduledAt: new Date()
            });
            
            logger.info(`任务 ${taskId} 已加入重试队列，第 ${failureInfo.retryCount + 1} 次重试`);
        }, this.retryInterval * (failureInfo.retryCount + 1));
    }
    
    /**
     * 执行重试
     */
    async executeRetry(retryHandler) {
        if (this.retryQueue.length === 0) {
            return;
        }
        
        const retryItem = this.retryQueue.shift();
        const { taskId, failureInfo } = retryItem;
        
        try {
            logger.info(`开始重试任务 ${taskId}...`);
            await retryHandler(taskId, failureInfo.context);
            
            // 重试成功，清除失败记录
            this.failedTasks.delete(taskId);
            logger.info(`任务 ${taskId} 重试成功`);
            
        } catch (error) {
            failureInfo.retryCount++;
            failureInfo.error = error.message;
            
            if (failureInfo.retryCount < this.maxRetries) {
                // 继续重试
                this.scheduleRetry(taskId, failureInfo);
            } else {
                // 达到最大重试次数
                logger.error(`任务 ${taskId} 达到最大重试次数 ${this.maxRetries}，放弃重试`);
                await this.markAsPermanentFailure(taskId, failureInfo);
            }
        }
    }
    
    /**
     * 标记为永久失败
     */
    async markAsPermanentFailure(taskId, failureInfo) {
        try {
            await query(`
                UPDATE tasks 
                SET status = 'failed',
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $1
            `, [taskId]).catch(() => {
                // 忽略更新失败
            });
            
            logger.error(`任务 ${taskId} 已标记为永久失败`, {
                error: failureInfo.error,
                retryCount: failureInfo.retryCount
            });
            
        } catch (error) {
            logger.error('标记任务为永久失败时出错:', error);
        }
    }
    
    /**
     * 恢复系统状态
     */
    async recoverSystemState() {
        try {
            logger.info('开始恢复系统状态...');
            
            // 1. 清理过期的执行锁
            await this.cleanupExpiredLocks();
            
            // 2. 恢复未完成的任务
            await this.recoverIncompleteTasks();
            
            // 3. 修复数据一致性
            await this.fixDataConsistency();
            
            logger.info('系统状态恢复完成');
            
        } catch (error) {
            logger.error('恢复系统状态失败:', error);
        }
    }
    
    /**
     * 清理过期的执行锁
     */
    async cleanupExpiredLocks() {
        try {
            // 清理超过1小时的执行计划
            const result = await query(`
                UPDATE execution_plans
                SET status = 'failed',
                    execution_result = jsonb_build_object(
                        'error', 'Execution timeout',
                        'recovered_at', CURRENT_TIMESTAMP
                    )
                WHERE status = 'executing'
                AND updated_at < CURRENT_TIMESTAMP - INTERVAL '1 hour'
                RETURNING id, task_id
            `).catch(() => ({ rows: [] }));
            
            const rows = Array.isArray(result) ? result : (result.rows || []);
            
            if (rows.length > 0) {
                logger.info(`清理了 ${rows.length} 个超时的执行计划`);
            }
            
        } catch (error) {
            logger.error('清理过期执行锁失败:', error);
        }
    }
    
    /**
     * 恢复未完成的任务
     */
    async recoverIncompleteTasks() {
        try {
            // 查找今天应该执行但还未执行的任务
            const today = new Date().toISOString().split('T')[0];
            const currentTime = new Date().toTimeString().substring(0, 5);
            
            const result = await query(`
                SELECT 
                    ep.id,
                    ep.task_id,
                    ep.scheduled_time,
                    ep.message_content,
                    t.name as task_name
                FROM execution_plans ep
                JOIN tasks t ON t.id = ep.task_id
                WHERE ep.scheduled_date = $1
                AND ep.scheduled_time < $2
                AND ep.status = 'pending'
                AND t.status = 'active'
                ORDER BY ep.scheduled_time
                LIMIT 10
            `, [today, currentTime]).catch(() => ({ rows: [] }));
            
            const rows = Array.isArray(result) ? result : (result.rows || []);
            
            if (rows.length > 0) {
                logger.warn(`发现 ${rows.length} 个未执行的过期任务，需要补偿执行`);
                
                // 将这些任务加入补偿队列
                for (const task of rows) {
                    this.retryQueue.push({
                        taskId: task.task_id,
                        failureInfo: {
                            error: '任务未按时执行',
                            context: task,
                            retryCount: 0
                        },
                        scheduledAt: new Date()
                    });
                }
            }
            
        } catch (error) {
            logger.error('恢复未完成任务失败:', error);
        }
    }
    
    /**
     * 修复数据一致性
     */
    async fixDataConsistency() {
        try {
            // 1. 删除孤儿执行计划（任务已删除）
            await query(`
                DELETE FROM execution_plans
                WHERE task_id NOT IN (SELECT id FROM tasks)
            `).catch(() => {});
            
            // 2. 修复重复的执行计划
            await query(`
                DELETE FROM execution_plans a
                USING execution_plans b
                WHERE a.id < b.id
                AND a.task_id = b.task_id
                AND a.scheduled_date = b.scheduled_date
                AND a.scheduled_time = b.scheduled_time
            `).catch(() => {});
            
            // 3. 清理过期的临时文件关联
            await query(`
                DELETE FROM task_files
                WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '7 days'
                AND is_primary = false
            `).catch(() => {});
            
            logger.debug('数据一致性检查完成');
            
        } catch (error) {
            logger.error('修复数据一致性失败:', error);
        }
    }
    
    /**
     * 获取失败统计
     */
    getFailureStats() {
        const stats = {
            totalFailures: this.failedTasks.size,
            retryQueueLength: this.retryQueue.length,
            failures: []
        };
        
        for (const [taskId, info] of this.failedTasks) {
            stats.failures.push({
                taskId,
                error: info.error,
                retryCount: info.retryCount,
                failedAt: info.timestamp
            });
        }
        
        return stats;
    }
}

// 导出单例
module.exports = new ErrorRecoveryService();