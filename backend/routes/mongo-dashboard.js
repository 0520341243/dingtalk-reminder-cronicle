/**
 * MongoDB版仪表盘路由
 * 提供系统统计、状态监控等功能
 */

const express = require('express');
const router = express.Router();
const { Task, Group, File, User } = require('../models/mongodb');
const logger = require('../utils/logger');
// 使用Cronicle调度器
const cronicleScheduler = require('../services/cronicleScheduler');
// 获取调度器实例
const getScheduler = () => cronicleScheduler;

/**
 * 获取仪表板概览数据
 */
router.get('/overview', async (req, res) => {
    try {
        // 并行获取所有统计数据
        const [
            totalTasks,
            activeTasks,
            totalGroups,
            activeGroups,
            totalFiles,
            totalUsers,
            todayMessages,
            monthMessages,
            groupActivity
        ] = await Promise.all([
            Task.countDocuments(),
            Task.countDocuments({ status: 'active' }),
            Group.countDocuments(),
            Group.countDocuments({ status: 'active' }),
            File.countDocuments(),
            User.countDocuments(),
            getTodayMessageCount(),
            getMonthMessageCount(),
            getGroupActivity()
        ]);

        res.json({
            success: true,
            data: {
                basicStats: {
                    total_groups: totalGroups,
                    active_groups: activeGroups,
                    total_files: totalFiles,
                    active_files: activeTasks,  // 使用活跃任务数作为活跃文件数
                    total_tasks: totalTasks,
                    active_tasks: activeTasks,
                    total_users: totalUsers
                },
                todayStats: {
                    total_reminders: todayMessages,
                    sent: todayMessages,
                    failed: 0,
                    success_rate: todayMessages > 0 ? 100 : 0
                },
                tasks: {
                    total: totalTasks,
                    active: activeTasks,
                    inactive: totalTasks - activeTasks
                },
                groups: {
                    total: totalGroups,
                    active: activeGroups,
                    inactive: totalGroups - activeGroups
                },
                files: {
                    total: totalFiles
                },
                users: {
                    total: totalUsers
                },
                messages: {
                    today: todayMessages,
                    month: monthMessages
                },
                groupActivity: groupActivity || []
            }
        });
    } catch (error) {
        logger.error('获取仪表板概览数据失败:', error);
        res.status(500).json({
            success: false,
            error: '获取数据失败'
        });
    }
});

/**
 * 获取实时状态信息
 */
router.get('/status', async (req, res) => {
    try {
        const currentScheduler = await getScheduler();
        const schedulerStatus = currentScheduler.getStatus ? currentScheduler.getStatus() : { initialized: currentScheduler.initialized, totalJobs: currentScheduler.jobs?.size || 0 };
        const now = new Date();
        
        // 从调度器获取当前作业信息
        let todayJobs = 0;
        let pendingJobs = 0;
        let executedJobs = 0;
        
        // 统计今日的所有作业
        if (currentScheduler.jobs) {
            // 遍历所有作业，统计今日的作业
            for (const [key, jobInfo] of currentScheduler.jobs.entries()) {
                // 排除系统作业
                if (jobInfo.type !== 'system') {
                    todayJobs++;
                    
                    // 检查作业是否已执行（基于执行时间判断）
                    const jobTime = jobInfo.time;
                    if (jobTime) {
                        const [hours, minutes] = jobTime.split(':').map(Number);
                        const jobDateTime = new Date();
                        jobDateTime.setHours(hours, minutes, 0, 0);
                        
                        if (jobDateTime <= now) {
                            // 时间已过，认为已执行
                            executedJobs++;
                        } else {
                            // 时间未到，待执行
                            pendingJobs++;
                        }
                    } else {
                        // 没有具体时间的作业，检查执行标记
                        if (jobInfo.executed) {
                            executedJobs++;
                        } else {
                            pendingJobs++;
                        }
                    }
                }
            }
        }
        
        // 补充：从任务表获取今日已执行的任务数
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayExecutedTasks = await Task.countDocuments({
            status: 'active',
            lastExecutedAt: { $gte: todayStart }
        });
        
        // 如果数据库记录的执行数更多，使用数据库的数据
        if (todayExecutedTasks > executedJobs) {
            executedJobs = todayExecutedTasks;
        }
        
        // 确保总数至少包含活跃任务数
        if (todayJobs === 0) {
            const activeTasks = await Task.countDocuments({ status: 'active' });
            todayJobs = activeTasks;
            // 重新计算待执行数
            pendingJobs = Math.max(0, todayJobs - executedJobs);
        }

        // 获取最近活动
        const recentActivity = await getRecentActivity();

        res.json({
            success: true,
            data: {
                scheduler: {
                    running: schedulerStatus.initialized || false,
                    jobs: schedulerStatus.totalJobs || 0
                },
                database: {
                    connected: true
                },
                execution: {
                    todayExecuted: executedJobs,
                    pending: pendingJobs,
                    todayTotal: todayJobs
                },
                system: {
                    uptime: process.uptime(),
                    memoryUsage: process.memoryUsage(),
                    nodeVersion: process.version,
                    timestamp: now
                },
                recentActivity: recentActivity || []
            }
        });
    } catch (error) {
        logger.error('获取实时状态失败:', error);
        res.status(500).json({
            success: false,
            error: '获取状态失败'
        });
    }
});

/**
 * 获取消息发送统计
 */
router.get('/statistics', async (req, res) => {
    try {
        const { days = 7 } = req.query;
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - parseInt(days));

        // 获取群组发送统计
        const groups = await Group.find().select('name sendCount failCount lastSendTime');
        
        // 按日期统计
        const dailyStats = [];
        for (let i = 0; i < days; i++) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
            const dayEnd = new Date(dayStart);
            dayEnd.setDate(dayEnd.getDate() + 1);
            
            const dayTasks = await Task.find({
                lastExecutedAt: {
                    $gte: dayStart,
                    $lt: dayEnd
                }
            }).countDocuments();
            
            dailyStats.push({
                date: dayStart.toISOString().split('T')[0],
                sent: dayTasks,
                failed: 0 // TODO: 需要从执行历史中获取
            });
        }

        res.json({
            success: true,
            data: {
                groups: groups.map(g => ({
                    id: g._id,
                    name: g.name,
                    sendCount: g.sendCount || 0,
                    failCount: g.failCount || 0,
                    lastSendTime: g.lastSendTime
                })),
                daily: dailyStats.reverse(),
                total: {
                    sent: groups.reduce((sum, g) => sum + (g.sendCount || 0), 0),
                    failed: groups.reduce((sum, g) => sum + (g.failCount || 0), 0)
                }
            }
        });
    } catch (error) {
        logger.error('获取统计数据失败:', error);
        res.status(500).json({
            success: false,
            error: '获取统计失败'
        });
    }
});

/**
 * 获取错误报告
 */
router.get('/errors', async (req, res) => {
    try {
        const { limit = 50 } = req.query;
        
        // 获取失败的任务
        const failedTasks = await Task.find({
            lastError: { $exists: true, $ne: null }
        })
        .sort({ lastExecutedAt: -1 })
        .limit(parseInt(limit))
        .populate('groupId', 'name');

        res.json({
            success: true,
            data: failedTasks.map(task => ({
                id: task._id,
                name: task.name,
                group: task.groupId?.name || '未知群组',
                error: task.lastError,
                time: task.lastExecutedAt,
                type: task.type
            }))
        });
    } catch (error) {
        logger.error('获取错误报告失败:', error);
        res.status(500).json({
            success: false,
            error: '获取错误报告失败'
        });
    }
});

/**
 * 获取性能指标
 */
router.get('/performance', async (req, res) => {
    try {
        const memUsage = process.memoryUsage();
        const cpuUsage = process.cpuUsage();
        
        // 获取数据库连接状态
        const mongoose = require('mongoose');
        const dbStatus = mongoose.connection.readyState;
        
        res.json({
            success: true,
            data: {
                memory: {
                    used: Math.round(memUsage.heapUsed / 1024 / 1024),
                    total: Math.round(memUsage.heapTotal / 1024 / 1024),
                    rss: Math.round(memUsage.rss / 1024 / 1024),
                    external: Math.round(memUsage.external / 1024 / 1024)
                },
                cpu: {
                    user: cpuUsage.user,
                    system: cpuUsage.system
                },
                database: {
                    status: ['disconnected', 'connected', 'connecting', 'disconnecting'][dbStatus],
                    ready: dbStatus === 1
                },
                uptime: process.uptime(),
                nodeVersion: process.version
            }
        });
    } catch (error) {
        logger.error('获取性能指标失败:', error);
        res.status(500).json({
            success: false,
            error: '获取性能指标失败'
        });
    }
});

/**
 * 辅助函数：获取今日消息数量
 */
async function getTodayMessageCount() {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        const groups = await Group.find({
            lastSendTime: {
                $gte: today,
                $lt: tomorrow
            }
        });
        
        return groups.reduce((sum, g) => sum + (g.sendCount || 0), 0);
    } catch (error) {
        logger.error('获取今日消息数量失败:', error);
        return 0;
    }
}

/**
 * 辅助函数：获取本月消息数量
 */
async function getMonthMessageCount() {
    try {
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        
        const groups = await Group.find({
            lastSendTime: {
                $gte: monthStart,
                $lt: monthEnd
            }
        });
        
        return groups.reduce((sum, g) => sum + (g.sendCount || 0), 0);
    } catch (error) {
        logger.error('获取本月消息数量失败:', error);
        return 0;
    }
}

/**
 * 辅助函数：获取群组活跃度排行
 */
async function getGroupActivity() {
    try {
        const groups = await Group.find()
            .sort({ sendCount: -1 })
            .limit(5)
            .select('name sendCount failCount lastSendTime');
        
        return groups.map(g => ({
            id: g._id,
            name: g.name,
            reminder_count: g.sendCount || 0,
            success_rate: g.sendCount > 0 ? Math.round(((g.sendCount - (g.failCount || 0)) / g.sendCount) * 100) : 0,
            last_activity: g.lastSendTime
        }));
    } catch (error) {
        logger.error('获取群组活跃度失败:', error);
        return [];
    }
}

/**
 * 辅助函数：获取最近活动
 */
async function getRecentActivity() {
    try {
        const tasks = await Task.find({ 
            lastExecutedAt: { $exists: true, $ne: null } 
        })
            .sort({ lastExecutedAt: -1 })
            .limit(10)
            .populate('groupId', 'name');
        
        return tasks.map(t => ({
            id: t._id,
            group_name: t.groupId?.name || '默认群组',
            message_content: t.messageContent || t.message || '定时提醒',
            schedule_time: t.reminderTime || t.schedule_time,
            sent_at: t.lastExecutedAt,
            status: t.lastExecutionStatus || 'sent'
        }));
    } catch (error) {
        logger.error('获取最近活动失败:', error);
        return [];
    }
}

module.exports = router;