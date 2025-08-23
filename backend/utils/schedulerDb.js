/**
 * 调度器数据库操作优化工具
 * 专门为调度器优化连接使用，减少连接竞争
 */

const { pool } = require('../config/database');
const logger = require('./logger');

class SchedulerDb {
    constructor() {
        this.activeConnections = new Map(); // 跟踪活跃连接
        this.connectionTimeout = 30000; // 30秒连接超时
    }

    /**
     * 批量获取提醒 - 使用单个连接
     * @param {string} currentDate - 当前日期
     * @param {number} hour - 小时
     * @param {number} minute - 分钟
     * @returns {Array} 提醒列表
     */
    async batchGetReminders(currentDate, hour, minute) {
        const client = await pool.connect();
        const startTime = Date.now();
        
        try {
            // 使用单个查询获取所有需要的数据
            const result = await client.query(`
                SELECT r.*, g.name as group_name, g.webhook_url, g.secret
                FROM reminders r
                JOIN groups g ON r.group_id = g.id
                WHERE r.schedule_date = $1 
                  AND EXTRACT(HOUR FROM r.schedule_time) = $2
                  AND EXTRACT(MINUTE FROM r.schedule_time) = $3
                  AND r.status = 'pending'
                  AND g.status = 'active'
                ORDER BY r.schedule_time ASC
            `, [currentDate, hour, minute]);

            const duration = Date.now() - startTime;
            logger.debug('调度器批量获取提醒完成', {
                count: result.rows.length,
                duration: `${duration}ms`,
                date: currentDate,
                time: `${hour}:${minute}`
            });

            return result.rows;

        } catch (error) {
            const duration = Date.now() - startTime;
            logger.error('调度器批量获取提醒失败', {
                error: error.message,
                duration: `${duration}ms`,
                date: currentDate,
                time: `${hour}:${minute}`
            });
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * 批量更新提醒状态 - 优化版本
     * @param {Array} reminderIds - 提醒ID数组
     * @param {string} status - 新状态
     * @param {Object} options - 可选参数
     */
    async batchUpdateReminderStatus(reminderIds, status, options = {}) {
        if (reminderIds.length === 0) return { affectedRows: 0 };

        const client = await pool.connect();
        const startTime = Date.now();
        
        try {
            let updateQuery;
            let params;

            if (status === 'sending') {
                // 批量标记为处理中
                updateQuery = `
                    UPDATE reminders 
                    SET status = 'sending', updated_at = CURRENT_TIMESTAMP
                    WHERE id = ANY($1) AND status = 'pending'
                `;
                params = [reminderIds];
            } else if (status === 'sent') {
                // 批量标记为已发送
                updateQuery = `
                    UPDATE reminders 
                    SET status = 'sent', 
                        sent_at = CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Shanghai',
                        error_message = NULL, 
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = ANY($1) AND status = 'sending'
                `;
                params = [reminderIds];
            } else if (status === 'failed') {
                // 批量标记为失败
                updateQuery = `
                    UPDATE reminders 
                    SET status = 'failed', 
                        error_message = $2, 
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = ANY($1) AND status = 'sending'
                `;
                params = [reminderIds, options.errorMessage || '发送失败'];
            }

            const result = await client.query(updateQuery, params);
            
            const duration = Date.now() - startTime;
            logger.debug('调度器批量更新状态完成', {
                count: result.rowCount,
                status,
                duration: `${duration}ms`,
                reminderIds: reminderIds.length + ' items'
            });

            return { affectedRows: result.rowCount };

        } catch (error) {
            const duration = Date.now() - startTime;
            logger.error('调度器批量更新状态失败', {
                error: error.message,
                status,
                count: reminderIds.length,
                duration: `${duration}ms`
            });
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * 单个提醒状态更新 - 用于发送后的状态更新
     * @param {number} reminderId - 提醒ID
     * @param {string} status - 新状态
     * @param {Object} options - 可选参数
     */
    async updateSingleReminderStatus(reminderId, status, options = {}) {
        const startTime = Date.now();
        
        try {
            let updateQuery;
            let params;

            if (status === 'sent') {
                updateQuery = `
                    UPDATE reminders 
                    SET status = 'sent', 
                        sent_at = CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Shanghai',
                        error_message = NULL, 
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = $1 AND status = 'sending'
                `;
                params = [reminderId];
            } else if (status === 'failed') {
                updateQuery = `
                    UPDATE reminders 
                    SET status = 'failed', 
                        error_message = $2, 
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = $1 AND status = 'sending'
                `;
                params = [reminderId, options.errorMessage || '发送失败'];
            }

            // 使用连接池直接查询（短查询）
            const result = await pool.query(updateQuery, params);
            
            const duration = Date.now() - startTime;
            logger.debug('调度器单个状态更新完成', {
                reminderId,
                status,
                affected: result.rowCount,
                duration: `${duration}ms`
            });

            return { affectedRows: result.rowCount };

        } catch (error) {
            const duration = Date.now() - startTime;
            logger.error('调度器单个状态更新失败', {
                reminderId,
                status,
                error: error.message,
                duration: `${duration}ms`
            });
            throw error;
        }
    }

    /**
     * 检查数据库时间 - 优化版本
     */
    async checkDatabaseTime() {
        const startTime = Date.now();
        
        try {
            // 使用连接池直接查询（快速查询）
            const result = await pool.query(`
                SELECT CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Shanghai' as db_time
            `);
            
            const duration = Date.now() - startTime;
            logger.debug('数据库时间检查完成', {
                duration: `${duration}ms`
            });

            return new Date(result.rows[0].db_time);

        } catch (error) {
            const duration = Date.now() - startTime;
            logger.error('数据库时间检查失败', {
                error: error.message,
                duration: `${duration}ms`
            });
            throw error;
        }
    }

    /**
     * 获取今日提醒统计 - 用于调度器监控
     * @param {string} currentDate - 当前日期
     */
    async getTodayReminderStats(currentDate) {
        const startTime = Date.now();
        
        try {
            const result = await pool.query(`
                SELECT 
                    COUNT(*) as total_reminders,
                    SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
                    SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent,
                    SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
                    SUM(CASE WHEN status = 'sending' THEN 1 ELSE 0 END) as sending
                FROM reminders 
                WHERE schedule_date = $1
            `, [currentDate]);
            
            const duration = Date.now() - startTime;
            const stats = result.rows[0];
            
            logger.debug('获取今日提醒统计完成', {
                ...stats,
                duration: `${duration}ms`
            });

            return {
                total: parseInt(stats.total_reminders) || 0,
                pending: parseInt(stats.pending) || 0,
                sent: parseInt(stats.sent) || 0,
                failed: parseInt(stats.failed) || 0,
                sending: parseInt(stats.sending) || 0
            };

        } catch (error) {
            const duration = Date.now() - startTime;
            logger.error('获取今日提醒统计失败', {
                error: error.message,
                duration: `${duration}ms`
            });
            return {
                total: 0, pending: 0, sent: 0, failed: 0, sending: 0
            };
        }
    }

    /**
     * 批量插入提醒 - 用于加载今日计划
     * @param {Array} reminders - 提醒数据数组
     */
    async batchInsertReminders(reminders) {
        if (reminders.length === 0) return { affectedRows: 0 };

        const client = await pool.connect();
        const startTime = Date.now();
        
        try {
            // 构建批量插入语句
            const valuesClauses = reminders.map((_, index) => {
                const base = index * 7;
                return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7})`;
            }).join(', ');

            const insertQuery = `
                INSERT INTO reminders (group_id, schedule_date, schedule_time, 
                                     message_content, worksheet_name, file_name, is_temp)
                VALUES ${valuesClauses}
            `;

            // 展平参数数组
            const params = reminders.flat();
            
            const result = await client.query(insertQuery, params);
            
            const duration = Date.now() - startTime;
            logger.info('调度器批量插入提醒完成', {
                inserted: result.rowCount,
                expected: reminders.length,
                duration: `${duration}ms`
            });

            return { affectedRows: result.rowCount };

        } catch (error) {
            const duration = Date.now() - startTime;
            logger.error('调度器批量插入提醒失败', {
                error: error.message,
                count: reminders.length,
                duration: `${duration}ms`
            });
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * 修复异常状态 - 定时任务使用
     */
    async fixAbnormalStates() {
        const client = await pool.connect();
        const startTime = Date.now();
        
        try {
            // 修复卡在sending状态超过1小时的记录
            const result = await client.query(`
                UPDATE reminders 
                SET status = 'pending', updated_at = CURRENT_TIMESTAMP
                WHERE status = 'sending' 
                  AND updated_at < CURRENT_TIMESTAMP - INTERVAL '1 hour'
            `);
            
            const duration = Date.now() - startTime;
            if (result.rowCount > 0) {
                logger.info('修复异常sending状态完成', {
                    fixed: result.rowCount,
                    duration: `${duration}ms`
                });
            }

            return { fixedCount: result.rowCount };

        } catch (error) {
            const duration = Date.now() - startTime;
            logger.error('修复异常状态失败', {
                error: error.message,
                duration: `${duration}ms`
            });
            return { fixedCount: 0 };
        } finally {
            client.release();
        }
    }

    /**
     * 获取调度器数据库操作统计
     */
    getOperationStats() {
        const { getPoolStats } = require('../config/database');
        const poolStats = getPoolStats();
        
        return {
            pool_stats: poolStats,
            active_scheduler_connections: this.activeConnections.size,
            connection_timeout: this.connectionTimeout + 'ms',
            optimization_enabled: true
        };
    }

    /**
     * 清理过期的临时提醒
     * @param {string} cutoffDate - 截止日期
     */
    async cleanupExpiredTempReminders(cutoffDate) {
        const client = await pool.connect();
        const startTime = Date.now();
        
        try {
            const result = await client.query(`
                DELETE FROM reminders 
                WHERE is_temp = TRUE 
                  AND status IN ('sent', 'failed')
                  AND schedule_date < $1
            `, [cutoffDate]);
            
            const duration = Date.now() - startTime;
            if (result.rowCount > 0) {
                logger.info('清理过期临时提醒完成', {
                    cleaned: result.rowCount,
                    cutoff_date: cutoffDate,
                    duration: `${duration}ms`
                });
            }

            return { cleanedCount: result.rowCount };

        } catch (error) {
            const duration = Date.now() - startTime;
            logger.error('清理过期临时提醒失败', {
                error: error.message,
                duration: `${duration}ms`
            });
            return { cleanedCount: 0 };
        } finally {
            client.release();
        }
    }
}

// 创建单例实例
const schedulerDb = new SchedulerDb();

module.exports = schedulerDb;