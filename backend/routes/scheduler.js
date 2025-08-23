/**
 * Cronicle调度器控制路由
 */

const express = require('express');
const router = express.Router();
const cronicleScheduler = require('../services/cronicleScheduler');
const logger = require('../utils/logger');

/**
 * 获取调度器状态
 */
router.get('/status', async (req, res) => {
    try {
        const status = cronicleScheduler.getStatus();
        res.json({
            success: true,
            data: {
                ...status,
                scheduler: 'Cronicle',
                version: '1.0.0'
            }
        });
    } catch (error) {
        logger.error('获取调度器状态失败:', error);
        res.status(500).json({
            success: false,
            message: '获取调度器状态失败',
            error: error.message
        });
    }
});

/**
 * 启动调度器
 */
router.post('/start', async (req, res) => {
    try {
        if (cronicleScheduler.initialized) {
            return res.json({
                success: true,
                message: '调度器已在运行中'
            });
        }
        
        const { Task, File } = require('../models/mongodb');
        await cronicleScheduler.initialize({ Task, File });
        
        res.json({
            success: true,
            message: '调度器启动成功'
        });
    } catch (error) {
        logger.error('启动调度器失败:', error);
        res.status(500).json({
            success: false,
            message: '启动调度器失败',
            error: error.message
        });
    }
});

/**
 * 停止调度器
 */
router.post('/stop', async (req, res) => {
    try {
        await cronicleScheduler.stop();
        res.json({
            success: true,
            message: '调度器已停止'
        });
    } catch (error) {
        logger.error('停止调度器失败:', error);
        res.status(500).json({
            success: false,
            message: '停止调度器失败',
            error: error.message
        });
    }
});

/**
 * 重新加载任务
 */
router.post('/reload', async (req, res) => {
    try {
        const result = await cronicleScheduler.loadTodayTasks();
        
        if (result && result.success) {
            res.json({
                success: true,
                message: `成功重新加载任务：${result.loadedCount}/${result.totalActive}个任务已调度`,
                data: {
                    loadedCount: result.loadedCount,
                    totalActive: result.totalActive,
                    timestamp: result.timestamp
                }
            });
        } else {
            res.json({
                success: false,
                message: '任务重新加载失败',
                error: result ? result.error : '未知错误'
            });
        }
    } catch (error) {
        logger.error('重新加载任务失败:', error);
        res.status(500).json({
            success: false,
            message: '重新加载任务失败',
            error: error.message
        });
    }
});

/**
 * 重启调度器
 */
router.post('/restart', async (req, res) => {
    try {
        await cronicleScheduler.stop();
        
        const { Task, File } = require('../models/mongodb');
        await cronicleScheduler.initialize({ Task, File });
        
        res.json({
            success: true,
            message: '调度器重启成功'
        });
    } catch (error) {
        logger.error('重启调度器失败:', error);
        res.status(500).json({
            success: false,
            message: '重启调度器失败',
            error: error.message
        });
    }
});

/**
 * 清理临时文件和过期作业
 */
router.post('/cleanup', async (req, res) => {
    try {
        await cronicleScheduler.cleanupExpiredJobs();
        res.json({
            success: true,
            message: '清理完成'
        });
    } catch (error) {
        logger.error('清理失败:', error);
        res.status(500).json({
            success: false,
            message: '清理失败',
            error: error.message
        });
    }
});

/**
 * 获取所有作业列表
 */
router.get('/jobs', async (req, res) => {
    try {
        const jobs = [];
        for (const [key, jobInfo] of cronicleScheduler.jobs.entries()) {
            jobs.push({
                id: key,
                type: jobInfo.type,
                taskId: jobInfo.taskId,
                schedule: jobInfo.schedule,
                time: jobInfo.time,
                message: jobInfo.message ? jobInfo.message.substring(0, 50) + '...' : null
            });
        }
        
        res.json({
            success: true,
            data: {
                total: jobs.length,
                jobs: jobs
            }
        });
    } catch (error) {
        logger.error('获取作业列表失败:', error);
        res.status(500).json({
            success: false,
            message: '获取作业列表失败',
            error: error.message
        });
    }
});

/**
 * 获取作业详细列表
 */
router.get('/jobs/detailed', async (req, res) => {
    try {
        const detailedJobs = await cronicleScheduler.getDetailedJobs();
        
        res.json({
            success: true,
            data: {
                total: detailedJobs.total,
                jobs: detailedJobs.jobs,
                summary: detailedJobs.summary,
                lastUpdate: cronicleScheduler.lastExecutionTime,
                schedulerStatus: cronicleScheduler.initialized ? 'running' : 'stopped'
            }
        });
    } catch (error) {
        logger.error('获取详细作业列表失败:', error);
        res.status(500).json({
            success: false,
            message: '获取详细作业列表失败',
            error: error.message
        });
    }
});

/**
 * 获取执行历史（从调度器获取已完成的作业）
 */
router.get('/jobs/history', async (req, res) => {
    try {
        const { date, status, page = 1, limit = 20 } = req.query;
        const targetDate = date ? new Date(date) : new Date();
        const targetDateStr = targetDate.toISOString().split('T')[0];
        
        // 获取当前时间，用于判断是否已执行
        const now = new Date();
        const currentDateStr = now.toISOString().split('T')[0];
        const currentTimeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        
        const jobs = [];
        
        // 从调度器获取所有作业信息
        for (const [jobKey, jobInfo] of cronicleScheduler.jobs.entries()) {
            // 跳过系统作业
            if (jobInfo.type === 'system') continue;
            
            let jobData = {
                jobId: jobKey,
                type: jobInfo.type,
                taskId: jobInfo.taskId,
                schedule: jobInfo.schedule,
                status: 'completed'
            };
            
            // 解析执行时间
            let scheduledTime = null;
            
            if (jobInfo.type === 'worksheet') {
                scheduledTime = jobInfo.time;
                jobData.message = jobInfo.message;
                const keyParts = jobKey.split(':');
                if (keyParts.length >= 3) {
                    jobData.worksheetRow = keyParts[2];
                }
            } else if (jobInfo.type === 'simple' && jobInfo.schedule) {
                const cronParts = jobInfo.schedule.split(' ');
                if (cronParts.length >= 2) {
                    const minutes = cronParts[0];
                    const hours = cronParts[1];
                    if (minutes !== '*' && hours !== '*') {
                        scheduledTime = `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}`;
                    }
                }
            }
            
            if (scheduledTime) {
                jobData.scheduledTime = scheduledTime;
                const scheduledDateTime = new Date(`${targetDateStr}T${scheduledTime}:00`);
                jobData.actualExecutionTime = scheduledDateTime;
                
                // 判断是否已执行
                // 如果选择的是今天，只显示当前时间之前的作业
                // 如果选择的是过去的日期，显示所有作业
                // 如果选择的是未来的日期，不显示任何作业
                let shouldShow = false;
                
                if (targetDateStr < currentDateStr) {
                    // 过去的日期，显示所有作业
                    shouldShow = true;
                } else if (targetDateStr === currentDateStr) {
                    // 今天，只显示已过时间的作业
                    shouldShow = scheduledTime <= currentTimeStr;
                } else {
                    // 未来的日期，不显示
                    shouldShow = false;
                }
                
                if (!shouldShow) {
                    continue;
                }
                
                // 获取任务信息
                if (jobInfo.taskId && cronicleScheduler.taskModel) {
                    try {
                        const Task = cronicleScheduler.taskModel;
                        const task = await Task.findById(jobInfo.taskId)
                            .populate('groupId', 'name');
                        
                        if (task) {
                            jobData.taskName = task.name;
                            jobData.groupName = task.groupId?.name || '默认群组';
                            
                            if (jobInfo.type === 'worksheet' && jobData.worksheetRow) {
                                jobData.taskName = `${task.name} - ${scheduledTime}`;
                                jobData.jobType = 'worksheet';
                            } else {
                                jobData.jobType = 'simple';
                            }
                            
                            if (jobInfo.type === 'simple') {
                                jobData.message = task.messageContent || task.message || '定时提醒';
                            }
                        }
                    } catch (err) {
                        logger.warn('获取任务信息失败:', err);
                    }
                }
                
                // 根据状态过滤
                if (!status || jobData.status === status) {
                    jobs.push(jobData);
                }
            }
        }
        
        // 按执行时间倒序排序
        jobs.sort((a, b) => {
            if (a.scheduledTime && b.scheduledTime) {
                return b.scheduledTime.localeCompare(a.scheduledTime);
            }
            return 0;
        });
        
        // 分页
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + parseInt(limit);
        const paginatedJobs = jobs.slice(startIndex, endIndex);
        
        res.json({
            success: true,
            data: paginatedJobs,
            total: jobs.length,
            page: parseInt(page),
            limit: parseInt(limit),
            date: targetDateStr
        });
    } catch (error) {
        logger.error('获取执行历史失败:', error);
        res.status(500).json({
            success: false,
            message: '获取执行历史失败',
            error: error.message
        });
    }
});

/**
 * 获取今日作业计划（用于全局执行计划）
 */
router.get('/jobs/today', async (req, res) => {
    try {
        const { date } = req.query;
        const targetDate = date ? new Date(date) : new Date();
        const targetDateStr = targetDate.toISOString().split('T')[0];
        const currentTime = new Date();
        const jobs = [];
        
        // 从调度器获取所有作业信息
        for (const [jobKey, jobInfo] of cronicleScheduler.jobs.entries()) {
            // 跳过系统作业
            if (jobInfo.type === 'system') continue;
            
            let jobData = {
                jobId: jobKey,
                type: jobInfo.type,
                taskId: jobInfo.taskId,
                schedule: jobInfo.schedule,
                status: 'pending'
            };
            
            // 解析执行时间
            let scheduledTime = null;
            
            if (jobInfo.type === 'worksheet') {
                // 工作表任务有明确的时间
                scheduledTime = jobInfo.time;
                jobData.message = jobInfo.message;
                
                // 从jobKey中提取行信息
                const keyParts = jobKey.split(':');
                if (keyParts.length >= 3) {
                    jobData.worksheetRow = keyParts[2];
                }
            } else if (jobInfo.type === 'simple' && jobInfo.schedule) {
                // 从cron表达式解析时间
                const cronParts = jobInfo.schedule.split(' ');
                if (cronParts.length >= 2) {
                    const minutes = cronParts[0];
                    const hours = cronParts[1];
                    if (minutes !== '*' && hours !== '*') {
                        scheduledTime = `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}`;
                    }
                }
            }
            
            if (scheduledTime) {
                jobData.scheduledTime = scheduledTime;
                const scheduledDateTime = new Date(`${targetDateStr}T${scheduledTime}:00`);
                
                // 判断状态
                if (scheduledDateTime < currentTime) {
                    jobData.status = 'completed';
                } else {
                    jobData.status = 'pending';
                }
                
                // 获取任务信息
                if (jobInfo.taskId && cronicleScheduler.taskModel) {
                    try {
                        const Task = cronicleScheduler.taskModel;
                        const task = await Task.findById(jobInfo.taskId)
                            .populate('groupId', 'name');
                        
                        if (task) {
                            jobData.taskName = task.name;
                            jobData.groupName = task.groupId?.name || '默认群组';
                            jobData.priority = task.priority || 'normal';
                            
                            // 检查任务是否被覆盖
                            const taskAssociationService = require('../services/taskAssociationService');
                            const executionStatus = await taskAssociationService.shouldTaskExecute(jobInfo.taskId, targetDate);
                            jobData.isSuppressed = !executionStatus.shouldExecute && executionStatus.reason === 'suppressed';
                            jobData.suppressedBy = executionStatus.suppressedBy || null;
                            
                            // 对于工作表任务，添加行信息到任务名
                            if (jobInfo.type === 'worksheet' && jobData.worksheetRow) {
                                jobData.taskName = `${task.name} - ${scheduledTime}`;
                                jobData.jobType = 'worksheet';
                            } else {
                                jobData.jobType = 'simple';
                            }
                            
                            // 如果是简单任务，使用任务的消息内容
                            if (jobInfo.type === 'simple') {
                                jobData.message = task.messageContent || task.message || '定时提醒';
                            }
                        }
                    } catch (err) {
                        logger.warn('获取任务信息失败:', err);
                    }
                }
                
                jobs.push(jobData);
            }
        }
        
        // 按执行时间排序
        jobs.sort((a, b) => {
            if (a.scheduledTime && b.scheduledTime) {
                return a.scheduledTime.localeCompare(b.scheduledTime);
            }
            return 0;
        });
        
        res.json({
            success: true,
            data: jobs,
            total: jobs.length,
            date: targetDateStr
        });
    } catch (error) {
        logger.error('获取今日作业计划失败:', error);
        res.status(500).json({
            success: false,
            message: '获取今日作业计划失败',
            error: error.message
        });
    }
});

/**
 * 获取作业统计信息
 */
router.get('/jobs/statistics', async (req, res) => {
    try {
        const { date } = req.query;
        const targetDate = date ? new Date(date) : new Date();
        const targetDateStr = targetDate.toISOString().split('T')[0];
        const currentTime = new Date();
        
        let totalJobs = 0;
        let completedJobs = 0;
        let pendingJobs = 0;
        let worksheetJobs = 0;
        let simpleJobs = 0;
        const hourlyStats = {};
        const taskStats = {};
        
        // 初始化24小时统计
        for (let i = 0; i < 24; i++) {
            hourlyStats[i] = 0;
        }
        
        // 从调度器获取所有作业信息进行统计
        for (const [jobKey, jobInfo] of cronicleScheduler.jobs.entries()) {
            // 跳过系统作业
            if (jobInfo.type === 'system') continue;
            
            // 解析执行时间
            let scheduledTime = null;
            let hour = null;
            
            if (jobInfo.type === 'worksheet') {
                scheduledTime = jobInfo.time;
                worksheetJobs++;
            } else if (jobInfo.type === 'simple' && jobInfo.schedule) {
                const cronParts = jobInfo.schedule.split(' ');
                if (cronParts.length >= 2) {
                    const minutes = cronParts[0];
                    const hours = cronParts[1];
                    if (minutes !== '*' && hours !== '*') {
                        scheduledTime = `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}`;
                    }
                }
                simpleJobs++;
            }
            
            if (scheduledTime) {
                totalJobs++;
                hour = parseInt(scheduledTime.split(':')[0]);
                hourlyStats[hour] = (hourlyStats[hour] || 0) + 1;
                
                const scheduledDateTime = new Date(`${targetDateStr}T${scheduledTime}:00`);
                if (scheduledDateTime < currentTime) {
                    completedJobs++;
                } else {
                    pendingJobs++;
                }
                
                // 统计任务执行情况
                if (jobInfo.taskId) {
                    if (!taskStats[jobInfo.taskId]) {
                        taskStats[jobInfo.taskId] = {
                            taskId: jobInfo.taskId,
                            taskName: '未知任务',
                            executionCount: 0,
                            successCount: 0,
                            failedCount: 0
                        };
                    }
                    taskStats[jobInfo.taskId].executionCount++;
                    
                    // 如果已执行，默认为成功（实际应该从执行日志中获取）
                    if (scheduledDateTime < currentTime) {
                        taskStats[jobInfo.taskId].successCount++;
                    }
                }
            }
        }
        
        // 获取任务名称
        if (cronicleScheduler.taskModel) {
            const Task = cronicleScheduler.taskModel;
            for (const taskId of Object.keys(taskStats)) {
                try {
                    const task = await Task.findById(taskId);
                    if (task) {
                        taskStats[taskId].taskName = task.name;
                    }
                } catch (err) {
                    // 忽略错误
                }
            }
        }
        
        // 计算成功率
        const successRate = totalJobs > 0 ? Math.round((completedJobs / totalJobs) * 100) : 0;
        
        // 生成任务排行（按执行次数排序）
        const ranking = Object.values(taskStats)
            .sort((a, b) => b.executionCount - a.executionCount)
            .slice(0, 10)
            .map(stat => ({
                taskName: stat.taskName,
                executionCount: stat.executionCount,
                successRate: stat.executionCount > 0 
                    ? Math.round((stat.successCount / stat.executionCount) * 100)
                    : 0
            }));
        
        res.json({
            success: true,
            data: {
                summary: {
                    totalPlans: totalJobs,
                    successfulExecutions: completedJobs,
                    failedExecutions: 0, // 暂时没有失败统计
                    skippedExecutions: 0, // 暂时没有跳过统计
                    successRate: successRate,
                    worksheetJobs: worksheetJobs,
                    simpleJobs: simpleJobs,
                    pendingJobs: pendingJobs
                },
                hourlyStats: hourlyStats,
                ranking: ranking,
                date: targetDateStr
            }
        });
    } catch (error) {
        logger.error('获取作业统计失败:', error);
        res.status(500).json({
            success: false,
            message: '获取作业统计失败',
            error: error.message
        });
    }
});

module.exports = router;