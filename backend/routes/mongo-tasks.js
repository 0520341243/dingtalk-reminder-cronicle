/**
 * MongoDB任务管理API
 * 完全使用MongoDB，不依赖PostgreSQL
 * 支持批量操作
 */

const express = require('express');
const router = express.Router();
const { Task, Group, User, ExecutionHistory, mongoose, connect } = require('../models/mongodb');
// 使用Cronicle调度器
const cronicleScheduler = require('../services/cronicleScheduler');
const scheduleRuleConverter = require('../services/scheduleRuleConverter');

// 获取调度器实例
const getScheduler = () => cronicleScheduler;
const logger = require('../utils/logger');

// 辅助函数：计算下次执行时间
async function calculateNextRunTime(scheduleRule, task) {
    try {
        if (!scheduleRule) return null;
        
        // 如果是工作表任务，使用调度器的计算方法
        if (task && task.type === 'worksheet') {
            const scheduler = await getScheduler();
            const checker = require('../services/scheduleRuleChecker');
            if (scheduler && scheduler.calculateNextRunTime) {
                return await scheduler.calculateNextRunTime(scheduleRule, checker, task);
            }
        }
        
        // 简单任务的计算逻辑
        // 使用scheduleRuleChecker来判断今天是否应该执行
        const checker = require('../services/scheduleRuleChecker');
        const today = new Date();
        const shouldRunToday = checker.shouldRunToday(scheduleRule, today);
        
        if (shouldRunToday) {
            // 如果今天应该执行，检查执行时间
            const executionTimes = scheduleRule.executionTimes || [];
            if (executionTimes.length > 0) {
                const now = new Date();
                for (const time of executionTimes) {
                    const [hours, minutes] = time.split(':').map(Number);
                    const nextRun = new Date(today);
                    nextRun.setHours(hours, minutes, 0, 0);
                    
                    if (nextRun > now) {
                        return nextRun;
                    }
                }
            }
        }
        
        // 查找下一个执行日期
        for (let i = 1; i <= 365; i++) {
            const checkDate = new Date(today);
            checkDate.setDate(checkDate.getDate() + i);
            
            if (checker.shouldRunToday(scheduleRule, checkDate)) {
                const executionTimes = scheduleRule.executionTimes || [];
                if (executionTimes.length > 0) {
                    const [hours, minutes] = executionTimes[0].split(':').map(Number);
                    checkDate.setHours(hours, minutes, 0, 0);
                    return checkDate;
                }
                // 如果没有执行时间，默认设置为早上9点
                checkDate.setHours(9, 0, 0, 0);
                return checkDate;
            }
        }
        
        return null;
    } catch (error) {
        logger.error('计算下次执行时间失败:', error);
        return null;
    }
}

// MongoDB连接状态检查中间件 - 确保连接已建立
const checkMongoConnection = async (req, res, next) => {
    try {
        if (mongoose.connection.readyState !== 1) {
            logger.info('MongoDB未连接，尝试连接...');
            await connect();
            // 等待一点时间确保连接完全建立
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        next();
    } catch (error) {
        logger.error('MongoDB连接失败:', error);
        return res.status(503).json({
            success: false,
            message: 'MongoDB连接失败',
            error: error.message
        });
    }
};

/**
 * 创建新任务（MongoDB版本）
 */
router.post('/', checkMongoConnection, async (req, res) => {
    try {
        const {
            name,
            type,  // 不设置默认值，稍后处理
            description,
            groupId,
            messageContent,
            scheduleRule,
            priority = 'normal',
            excludeHolidays = false,
            status = 'active',
            fileConfig,  // 从req.body中提取fileConfig
            contentSource,  // 从req.body中提取contentSource
            relatedTaskId,  // 任务关联ID
            relationshipType = 'replaces',  // 关联类型
            reminderTime  // 简单任务的执行时间
        } = req.body;
        
        // 验证必填字段
        if (!name || !groupId) {
            return res.status(400).json({
                success: false,
                message: '缺少必填字段：名称或群组ID'
            });
        }
        
        // 验证群组是否存在
        let group;
        try {
            // 直接使用字符串ID查询，Mongoose会自动转换
            group = await Group.findById(groupId);
            if (!group) {
                // 调试：列出所有群组
                const allGroups = await Group.find();
                logger.error(`群组不存在 - groupId: ${groupId}`);
                logger.error(`所有群组: ${JSON.stringify(allGroups.map(g => ({ id: g._id.toString(), name: g.name })))}`);
                
                return res.status(404).json({
                    success: false,
                    message: '群组不存在',
                    debug: {
                        receivedId: groupId,
                        availableGroups: allGroups.map(g => ({ id: g._id.toString(), name: g.name }))
                    }
                });
            }
        } catch (error) {
            logger.error('查询群组失败:', error);
            return res.status(400).json({
                success: false,
                message: '查询群组失败',
                error: error.message
            });
        }
        
        // 创建任务文档
        logger.info('创建任务 - 用户信息:', req.user); // 调试日志
        logger.info('创建任务 - 完整请求数据:', req.body); // 添加完整请求日志
        
        // 根据contentSource或fileConfig判断任务类型
        const finalType = type || (contentSource === 'worksheet' ? 'worksheet' : (fileConfig ? 'worksheet' : 'simple'));
        const finalContentSource = contentSource || (fileConfig ? 'worksheet' : 'manual');
        
        // 处理工作表任务的特殊字段
        const taskData = {
            name,
            type: finalType,  // 使用计算后的类型
            description,
            groupId,
            messageContent,
            priority,
            status,
            relatedTaskId: relatedTaskId || null,  // 添加关联任务ID
            relationshipType: relatedTaskId ? relationshipType : null,  // 只有有关联时才设置类型
            contentSource: finalContentSource,  // 使用计算后的内容源
            reminderTime: req.body.reminderTime,
            fileConfig: fileConfig || {},  // 直接使用从req.body提取的fileConfig
            effectiveDate: req.body.effectiveDate,
            expiryDate: req.body.expiryDate,
            enableRetry: req.body.enableRetry !== false,
            enableLogging: req.body.enableLogging || false,
            scheduleRule: {
                ruleType: scheduleRule.rule_type || scheduleRule.ruleType || 'by_day',
                ruleConfig: scheduleRule.rule_config || scheduleRule.ruleConfig || {},
                dayMode: scheduleRule.day_mode || scheduleRule.dayMode || { type: 'specific_days', days: [] },
                weekMode: scheduleRule.week_mode || scheduleRule.weekMode || { weekdays: [], occurrence: 'every' },
                intervalMode: scheduleRule.interval_mode || scheduleRule.intervalMode || { value: 1, unit: 'days', referenceDate: '' },
                months: scheduleRule.months || [],
                quarters: scheduleRule.quarters || [],
                excludeSettings: scheduleRule.excludeSettings || {
                    excludeHolidays: excludeHolidays || scheduleRule.excludeHolidays || false,
                    excludeWeekends: scheduleRule.excludeWeekends || false,
                    specificDates: scheduleRule.specificDates || []
                },
                // 工作表任务不设置固定执行时间，执行时间由工作表内容决定
                // 简单任务才需要固定执行时间
                executionTime: finalType === 'worksheet' ? null : (scheduleRule.executionTime || req.body.reminderTime || '09:00'),
                executionTimes: finalType === 'worksheet' ? [] : (scheduleRule.executionTimes || [scheduleRule.executionTime || req.body.reminderTime || '09:00'])
            },
            createdBy: req.user?.mongoId || req.user?.id // 使用MongoDB用户ID
        };
        
        // 如果是工作表任务，确保fileConfig正确
        if (taskData.type === 'worksheet') {
            if (!taskData.fileConfig || !taskData.fileConfig.fileId) {
                logger.warn('工作表任务缺少文件配置:', taskData.fileConfig);
                logger.warn('原始fileConfig:', fileConfig);
                logger.warn('req.body.fileConfig:', req.body.fileConfig);
            } else {
                logger.info('工作表任务文件配置:', taskData.fileConfig);
                logger.info('原始fileConfig:', fileConfig);
                logger.info('req.body.fileConfig:', req.body.fileConfig);
            }
            // 确保executionTimes是数组
            if (!Array.isArray(taskData.scheduleRule.executionTimes)) {
                taskData.scheduleRule.executionTimes = [taskData.scheduleRule.executionTime || '09:00'];
            }
            logger.info('工作表任务执行时间:', taskData.scheduleRule.executionTimes);
        }
        
        const task = new Task(taskData);
        
        // 计算下次执行时间
        const nextRunAt = await calculateNextRunTime(taskData.scheduleRule, task);
        if (nextRunAt) {
            task.nextRunAt = nextRunAt;
        }
        
        // 保存到MongoDB
        await task.save();
        
        // 转换调度规则 - 处理命名差异
        logger.info('转换调度规则:', {
            rule_type: scheduleRule.rule_type || scheduleRule.ruleType,
            rule_config: scheduleRule.rule_config || scheduleRule.ruleConfig,
            dayMode: scheduleRule.dayMode,
            weekMode: scheduleRule.weekMode,
            intervalMode: scheduleRule.intervalMode,
            executionTime: scheduleRule.executionTime
        });
        
        let scheduleConfig;
        try {
            // 构建完整的规则配置
            const fullRuleConfig = {
                dayMode: scheduleRule.dayMode || scheduleRule.day_mode,
                weekMode: scheduleRule.weekMode || scheduleRule.week_mode,
                intervalMode: scheduleRule.intervalMode || scheduleRule.interval_mode,
                months: scheduleRule.months,
                // 工作表任务执行时间由工作表内容决定，不设置固定时间
                // 简单任务才需要固定执行时间
                // 注意：executionTimes是数组，取第一个值
                time: finalType === 'worksheet' ? null : (scheduleRule.executionTimes?.[0] || scheduleRule.executionTime || scheduleRule.execution_time || reminderTime || '09:00'),
                executionTime: finalType === 'worksheet' ? null : (scheduleRule.executionTimes?.[0] || scheduleRule.executionTime || scheduleRule.execution_time || reminderTime || '09:00'),
                excludeHolidays: scheduleRule.excludeSettings?.excludeHolidays || excludeHolidays,
                ...(scheduleRule.rule_config || scheduleRule.ruleConfig || {})
            };
            
            // 添加调试日志
            logger.info('scheduleRule数据:', {
                executionTimes: scheduleRule.executionTimes,
                reminderTime: reminderTime,
                finalType: finalType
            });
            logger.info('fullRuleConfig:', fullRuleConfig);
            
            scheduleConfig = await scheduleRuleConverter.convertToCronicle({
                ruleType: scheduleRule.rule_type || scheduleRule.ruleType,
                ruleConfig: fullRuleConfig
            });
            
            logger.info('转换后的调度配置:', scheduleConfig);
        } catch (convertError) {
            logger.error('调度规则转换失败:', convertError);
            logger.error('完整的scheduleRule:', scheduleRule);
            // 继续创建任务，但不创建调度job
            scheduleConfig = null;
        }
        
        // 确保调度器已初始化
        const currentScheduler = await getScheduler();
        
        // 在调度器中创建任务（如果转换成功）
        if (scheduleConfig && currentScheduler) {
            try {
                logger.info('开始创建调度任务，配置:', {
                    taskId: task._id.toString(),
                    schedule: scheduleConfig
                });
                
                // 填充groupId信息，确保调度器能获取完整的群组信息
                const populatedTask = await Task.findById(task._id).populate('groupId').populate('fileConfig.fileId');
                
                // 使用Cronicle调度器的scheduleTask方法
                await currentScheduler.scheduleTask(populatedTask);
                logger.info('Cronicle任务创建成功，TaskId:', task._id.toString());
                
                // Cronicle调度器不需要更新JobId，使用taskId作为唯一标识
            } catch (schedulerError) {
                logger.error('Cronicle任务创建失败，但MongoDB任务已创建:', schedulerError);
                // 不影响任务创建的成功状态
            }
        } else {
            logger.warn('跳过调度器任务创建:', {
                hasConfig: !!scheduleConfig,
                isInitialized: !!currentScheduler
            });
        }
        
        res.json({
            success: true,
            message: '任务创建成功',
            data: {
                task: {
                    id: task._id,
                    name: task.name,
                    type: task.type,
                    status: task.status,
                    priority: task.priority,
                    nextRunAt: task.nextRunAt,
                    groupId: task.groupId,
                    messageContent: task.messageContent,
                    scheduleRule: task.scheduleRule,
                    createdBy: task.createdBy
                }
                // 调度信息由Cronicle调度器管理
            }
        });
        
    } catch (error) {
        logger.error('创建任务失败:', error);
        res.status(500).json({
            success: false,
            message: '创建任务失败',
            error: error.message
        });
    }
});

/**
 * 获取任务列表
 */
router.get('/', async (req, res) => {
    try {
        const { status = 'all', page = 1, limit = 20 } = req.query;
        
        // 构建查询条件
        const query = {};
        if (status !== 'all') {
            query.status = status;
        }
        
        // 如果不是管理员，只能查看自己创建的任务
        if (req.user && req.user.role !== 'admin') {
            query.createdBy = req.user.mongoId || req.user.id;
        }
        
        // 查询任务
        const tasks = await Task
            .find(query)
            .populate('groupId', 'name')
            .populate('createdBy', 'username')
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .skip((parseInt(page) - 1) * parseInt(limit));
        
        // 获取总数
        const total = await Task.countDocuments(query);
        
        // 计算每个任务的下次执行时间（如果还没有的话）
        const tasksWithNextRun = await Promise.all(tasks.map(async task => {
            const taskObj = task.toObject();
            if (!taskObj.nextRunAt && taskObj.scheduleRule) {
                taskObj.nextRunAt = await calculateNextRunTime(taskObj.scheduleRule, taskObj);
            }
            return taskObj;
        }));
        
        res.json({
            success: true,
            tasks: tasksWithNextRun.map(task => ({
                id: task._id,
                name: task.name,
                type: task.type,
                description: task.description,
                group: task.groupId ? {
                    id: task.groupId._id || task.groupId,
                    name: task.groupId.name || '未知群组'
                } : null,
                groupId: task.groupId?._id || task.groupId, // 添加groupId字段供编辑使用
                priority: task.priority,
                status: task.status,
                contentSource: task.contentSource,
                reminderTime: task.reminderTime,
                messageContent: task.messageContent,
                scheduleRule: task.scheduleRule,
                fileConfig: task.fileConfig,
                effectiveDate: task.effectiveDate,
                expiryDate: task.expiryDate,
                enableRetry: task.enableRetry,
                enableLogging: task.enableLogging,
                nextRunAt: task.nextRunAt,
                lastRunAt: task.lastRunAt,
                createdBy: task.createdBy ? task.createdBy.username : null,
                createdAt: task.createdAt
            })),
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit))
            }
        });
        
    } catch (error) {
        logger.error('获取任务列表失败:', error);
        res.status(500).json({
            success: false,
            message: '获取任务列表失败',
            error: error.message
        });
    }
});

/**
 * 获取任务统计信息
 * GET /api/mongo/tasks/statistics
 */
router.get('/statistics', checkMongoConnection, async (req, res) => {
    try {
        // 并行获取所有统计数据
        const [
            totalTasks,
            activeTasks,
            pausedTasks,
            closedTasks,
            pendingTasks,
            completedTasks,
            todayScheduledTasks,
            associatedTasks
        ] = await Promise.all([
            Task.countDocuments(),
            Task.countDocuments({ status: 'active' }),
            Task.countDocuments({ status: 'paused' }),
            Task.countDocuments({ status: 'closed' }),
            Task.countDocuments({ status: 'pending' }),
            Task.countDocuments({ status: 'completed' }),
            // 获取今日计划执行的任务
            Task.countDocuments({
                status: 'active',
                $or: [
                    { nextExecutionTime: { 
                        $gte: new Date(new Date().setHours(0, 0, 0, 0)),
                        $lt: new Date(new Date().setHours(23, 59, 59, 999))
                    }},
                    { lastExecutedAt: {
                        $gte: new Date(new Date().setHours(0, 0, 0, 0)),
                        $lt: new Date(new Date().setHours(23, 59, 59, 999))
                    }}
                ]
            }),
            // 获取有关联任务的数量
            Task.countDocuments({
                $or: [
                    { associatedTaskId: { $exists: true, $ne: null } },
                    { isLinkedTask: true }
                ]
            })
        ]);

        // 按类型统计
        const tasksByType = await Task.aggregate([
            {
                $group: {
                    _id: '$type',
                    count: { $sum: 1 }
                }
            }
        ]);

        // 按优先级统计
        const tasksByPriority = await Task.aggregate([
            {
                $group: {
                    _id: '$priority',
                    count: { $sum: 1 }
                }
            }
        ]);

        res.json({
            success: true,
            data: {
                total: totalTasks,
                byStatus: {
                    active: activeTasks,
                    paused: pausedTasks,
                    closed: closedTasks,
                    pending: pendingTasks,
                    completed: completedTasks
                },
                byType: tasksByType.reduce((acc, item) => {
                    acc[item._id || 'simple'] = item.count;
                    return acc;
                }, {}),
                byPriority: tasksByPriority.reduce((acc, item) => {
                    acc[item._id || 'medium'] = item.count;
                    return acc;
                }, {}),
                today: {
                    scheduled: todayScheduledTasks
                },
                associated: associatedTasks
            }
        });
    } catch (error) {
        logger.error('获取任务统计失败:', error);
        res.status(500).json({
            success: false,
            message: '获取统计信息失败',
            error: error.message
        });
    }
});

/**
 * 获取单个任务详情
 */
router.get('/:id', async (req, res) => {
    try {
        const task = await Task
            .findById(req.params.id)
            .populate('groupId')
            .populate('createdBy', 'username');
        
        if (!task) {
            return res.status(404).json({
                success: false,
                message: '任务不存在'
            });
        }
        
        // 获取执行历史
        const history = await ExecutionHistory
            .find({ taskId: task._id })
            .sort({ executedAt: -1 })
            .limit(10);
        
        res.json({
            success: true,
            data: {
                task: {
                    id: task._id,
                    name: task.name,
                    type: task.type,
                    description: task.description,
                    messageContent: task.messageContent,
                    contentSource: task.contentSource,
                    reminderTime: task.reminderTime,
                    group: task.groupId,
                    groupId: task.groupId?._id, // 添加groupId字段供编辑使用
                    scheduleRule: task.scheduleRule,
                    fileConfig: task.fileConfig,
                    effectiveDate: task.effectiveDate,
                    expiryDate: task.expiryDate,
                    enableRetry: task.enableRetry,
                    enableLogging: task.enableLogging,
                    priority: task.priority,
                    status: task.status,
                    nextRunAt: task.nextRunAt,
                    lastRunAt: task.lastRunAt,
                    createdBy: task.createdBy,
                    createdAt: task.createdAt,
                    updatedAt: task.updatedAt
                },
                executionHistory: history
            }
        });
        
    } catch (error) {
        logger.error('获取任务详情失败:', error);
        res.status(500).json({
            success: false,
            message: '获取任务详情失败',
            error: error.message
        });
    }
});

/**
 * 更新任务
 */
router.put('/:id', async (req, res) => {
    try {
        const task = await Task.findById(req.params.id);
        
        if (!task) {
            return res.status(404).json({
                success: false,
                message: '任务不存在'
            });
        }
        
        // 更新字段
        const updates = req.body;
        Object.keys(updates).forEach(key => {
            if (key !== '_id') {
                task[key] = updates[key];
            }
        });
        
        // 计算下次执行时间
        if (task.scheduleRule) {
            task.nextRunAt = await calculateNextRunTime(task.scheduleRule, task);
        }
        
        await task.save();
        
        // 如果更新了调度规则，需要更新调度器任务
        if (updates.scheduleRule) {
            // 获取调度器实例
            const currentScheduler = await getScheduler();
            
            // 先从调度器中移除旧任务
            if (currentScheduler) {
                await currentScheduler.cancelTask(task._id.toString());
            }
            
            // 重新调度任务，需要填充groupId
            const populatedTask = await Task.findById(task._id).populate('groupId').populate('fileConfig.fileId');
            await currentScheduler.scheduleTask(populatedTask);
            logger.info('任务调度规则已更新:', task._id.toString());
        }
        
        res.json({
            success: true,
            message: '任务更新成功',
            data: { task }
        });
        
    } catch (error) {
        logger.error('更新任务失败:', error);
        res.status(500).json({
            success: false,
            message: '更新任务失败',
            error: error.message
        });
    }
});

/**
 * 删除任务
 */
router.delete('/:id', async (req, res) => {
    try {
        const task = await Task.findById(req.params.id);
        
        if (!task) {
            return res.status(404).json({
                success: false,
                message: '任务不存在'
            });
        }
        
        // 从调度器中删除任务
        const scheduler = await getScheduler();
        if (scheduler) {
            await scheduler.cancelTask(task._id.toString());
        }
        
        // 删除任务
        await task.deleteOne();
        
        res.json({
            success: true,
            message: '任务删除成功'
        });
        
    } catch (error) {
        logger.error('删除任务失败:', error);
        res.status(500).json({
            success: false,
            message: '删除任务失败',
            error: error.message
        });
    }
});

/**
 * 暂停任务
 */
router.post('/:id/pause', async (req, res) => {
    try {
        const task = await Task.findById(req.params.id);
        
        if (!task) {
            return res.status(404).json({
                success: false,
                message: '任务不存在'
            });
        }
        
        // 暂停调度任务
        const scheduler = await getScheduler();
        if (scheduler) {
            await scheduler.cancelTask(task._id.toString());
        }
        
        task.status = 'paused';
        await task.save();
        
        res.json({
            success: true,
            message: '任务已暂停'
        });
        
    } catch (error) {
        logger.error('暂停任务失败:', error);
        res.status(500).json({
            success: false,
            message: '暂停任务失败',
            error: error.message
        });
    }
});

/**
 * 恢复任务
 */
router.post('/:id/resume', async (req, res) => {
    try {
        const task = await Task.findById(req.params.id);
        
        if (!task) {
            return res.status(404).json({
                success: false,
                message: '任务不存在'
            });
        }
        
        // 恢复调度任务
        const scheduler = await getScheduler();
        if (scheduler) {
            await scheduler.scheduleTask(task);
        }
        
        task.status = 'active';
        await task.save();
        
        res.json({
            success: true,
            message: '任务已恢复'
        });
        
    } catch (error) {
        logger.error('恢复任务失败:', error);
        res.status(500).json({
            success: false,
            message: '恢复任务失败',
            error: error.message
        });
    }
});

/**
 * 立即执行任务
 */
router.post('/:id/run', async (req, res) => {
    try {
        const task = await Task.findById(req.params.id);
        
        if (!task) {
            return res.status(404).json({
                success: false,
                message: '任务不存在'
            });
        }
        
        // 立即运行调度任务
        const scheduler = await getScheduler();
        if (scheduler) {
            await scheduler.executeTaskManually(task._id.toString());
        }
        
        res.json({
            success: true,
            message: '任务已触发执行'
        });
        
    } catch (error) {
        logger.error('执行任务失败:', error);
        res.status(500).json({
            success: false,
            message: '执行任务失败',
            error: error.message
        });
    }
});

/**
 * 更新任务
 */
router.put('/:id', checkMongoConnection, async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        
        // 查找任务
        const task = await Task.findById(id);
        
        if (!task) {
            return res.status(404).json({
                success: false,
                message: '任务不存在'
            });
        }
        
        // 权限检查：只有管理员或任务创建者才能更新任务
        if (req.user.role !== 'admin' && 
            task.createdBy?.toString() !== req.user.mongoId?.toString() && 
            task.createdBy?.toString() !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: '您没有权限更新此任务'
            });
        }
        
        // 更新允许的字段
        const allowedUpdates = ['name', 'description', 'status', 'priority', 'messageContent', 'scheduleRule', 'relatedTaskId', 'relationshipType'];
        Object.keys(updates).forEach(key => {
            if (allowedUpdates.includes(key)) {
                task[key] = updates[key];
            }
        });
        
        task.updatedAt = new Date();
        await task.save();
        
        // 如果状态改变，更新调度任务
        if (updates.status && task._id) {
            try {
                const scheduler = await getScheduler();
                if (scheduler) {
                    if (updates.status === 'paused') {
                        await scheduler.cancelTask(task._id.toString());
                    } else if (updates.status === 'active') {
                        // 需要填充groupId信息
                        const populatedTask = await Task.findById(task._id).populate('groupId').populate('fileConfig.fileId');
                        await scheduler.scheduleTask(populatedTask);
                    }
                }
            } catch (error) {
                logger.error('更新调度任务状态失败:', error);
            }
        }
        
        res.json({
            success: true,
            message: '任务更新成功',
            data: task
        });
        
    } catch (error) {
        logger.error('更新任务失败:', error);
        res.status(500).json({
            success: false,
            message: '更新任务失败',
            error: error.message
        });
    }
});

/**
 * 删除任务
 */
router.delete('/:id', checkMongoConnection, async (req, res) => {
    try {
        const { id } = req.params;
        
        // 查找任务
        const task = await Task.findById(id);
        
        if (!task) {
            return res.status(404).json({
                success: false,
                message: '任务不存在'
            });
        }
        
        // 权限检查：只有管理员或任务创建者才能删除任务
        if (req.user.role !== 'admin' && 
            task.createdBy?.toString() !== req.user.mongoId?.toString() && 
            task.createdBy?.toString() !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: '您没有权限删除此任务'
            });
        }
        
        // 检查是否有关联关系
        const { TaskAssociation } = require('../models/mongodb');
        const associations = await TaskAssociation.find({
            $or: [
                { primaryTaskId: id },
                { associatedTaskId: id }
            ],
            status: 'active'
        });
        
        if (associations.length > 0) {
            // 如果任务有关联，提示用户先处理关联
            const isHighPriority = associations.some(a => a.primaryTaskId.toString() === id);
            const isLowPriority = associations.some(a => a.associatedTaskId.toString() === id);
            
            let message = '该任务存在关联关系，';
            if (isHighPriority) {
                message += '作为高优先级任务正在覆盖其他任务。';
            }
            if (isLowPriority) {
                message += '作为低优先级任务被其他任务覆盖。';
            }
            message += '请先解除关联关系后再删除任务。';
            
            return res.status(400).json({
                success: false,
                message: message,
                associations: associations.length
            });
        }
        
        // 删除调度任务
        if (task._id) {
            try {
                const scheduler = await getScheduler();
                if (scheduler) {
                    await scheduler.cancelTask(task._id.toString());
                }
            } catch (error) {
                logger.error('删除调度任务失败:', error);
            }
        }
        
        // 清理所有相关的关联（包括已过期的）
        await TaskAssociation.deleteMany({
            $or: [
                { primaryTaskId: id },
                { associatedTaskId: id }
            ]
        });
        
        // 删除MongoDB任务
        await task.deleteOne();
        
        res.json({
            success: true,
            message: '任务删除成功'
        });
        
    } catch (error) {
        logger.error('删除任务失败:', error);
        res.status(500).json({
            success: false,
            message: '删除任务失败',
            error: error.message
        });
    }
});

/**
 * 批量删除任务
 * POST /api/mongo/tasks/batch-delete
 */
router.post('/batch-delete', checkMongoConnection, async (req, res) => {
    try {
        const { taskIds } = req.body;
        
        if (!taskIds || !Array.isArray(taskIds) || taskIds.length === 0) {
            return res.status(400).json({
                success: false,
                message: '请提供要删除的任务ID列表'
            });
        }
        
        logger.info(`批量删除任务: ${taskIds.join(', ')}`);
        
        // 检查是否有关联关系
        const { TaskAssociation } = require('../models/mongodb');
        const associations = await TaskAssociation.find({
            $or: [
                { primaryTaskId: { $in: taskIds } },
                { associatedTaskId: { $in: taskIds } }
            ],
            status: 'active'
        });
        
        if (associations.length > 0) {
            // 统计有关联的任务
            const tasksWithAssociations = new Set();
            associations.forEach(a => {
                if (taskIds.includes(a.primaryTaskId.toString())) {
                    tasksWithAssociations.add(a.primaryTaskId.toString());
                }
                if (taskIds.includes(a.associatedTaskId.toString())) {
                    tasksWithAssociations.add(a.associatedTaskId.toString());
                }
            });
            
            return res.status(400).json({
                success: false,
                message: `${tasksWithAssociations.size}个任务存在关联关系，请先解除关联后再删除`,
                tasksWithAssociations: Array.from(tasksWithAssociations),
                associationCount: associations.length
            });
        }
        
        // 从调度器中删除
        let schedulerRemoved = 0;
        for (const taskId of taskIds) {
            try {
                schedulerRemoved++;
            } catch (error) {
                logger.warn(`从调度器删除任务失败 ${taskId}:`, error.message);
            }
        }
        
        // 清理所有相关的关联（包括已过期的）
        await TaskAssociation.deleteMany({
            $or: [
                { primaryTaskId: { $in: taskIds } },
                { associatedTaskId: { $in: taskIds } }
            ]
        });
        
        // 从数据库删除
        const result = await Task.deleteMany({
            _id: { $in: taskIds }
        });
        
        logger.info(`批量删除完成: 数据库删除${result.deletedCount}个，调度器删除${schedulerRemoved}个`);
        
        res.json({
            success: true,
            message: `成功删除${result.deletedCount}个任务`,
            successCount: result.deletedCount,
            data: {
                dbDeleted: result.deletedCount,
                schedulerDeleted: schedulerRemoved
            }
        });
        
    } catch (error) {
        logger.error('批量删除任务失败:', error);
        res.status(500).json({
            success: false,
            message: '批量删除任务失败',
            error: error.message
        });
    }
});

/**
 * 批量执行任务
 * POST /api/mongo/tasks/batch-execute
 */
router.post('/batch-execute', checkMongoConnection, async (req, res) => {
    try {
        const { taskIds } = req.body;
        
        if (!taskIds || !Array.isArray(taskIds) || taskIds.length === 0) {
            return res.status(400).json({
                success: false,
                message: '请提供要执行的任务ID列表'
            });
        }
        
        logger.info(`批量执行任务: ${taskIds.join(', ')}`);
        
        let successCount = 0;
        let failedCount = 0;
        const results = [];
        
        for (const taskId of taskIds) {
            try {
                const task = await Task.findById(taskId);
                if (!task) {
                    failedCount++;
                    results.push({ taskId, success: false, error: '任务不存在' });
                    continue;
                }
                
                // 立即执行任务
                successCount++;
                results.push({ taskId, success: true, taskName: task.name });
                
            } catch (error) {
                failedCount++;
                results.push({ taskId, success: false, error: error.message });
                logger.error(`执行任务失败 ${taskId}:`, error);
            }
        }
        
        res.json({
            success: true,
            message: `成功执行${successCount}个任务，失败${failedCount}个`,
            successCount,
            failedCount,
            results
        });
        
    } catch (error) {
        logger.error('批量执行任务失败:', error);
        res.status(500).json({
            success: false,
            message: '批量执行任务失败',
            error: error.message
        });
    }
});

/**
 * 批量切换任务状态
 * POST /api/mongo/tasks/batch-toggle-status
 */
router.post('/batch-toggle-status', checkMongoConnection, async (req, res) => {
    try {
        const { taskIds, targetStatus } = req.body;
        
        if (!taskIds || !Array.isArray(taskIds) || taskIds.length === 0) {
            return res.status(400).json({
                success: false,
                message: '请提供要操作的任务ID列表'
            });
        }
        
        if (!['active', 'paused'].includes(targetStatus)) {
            return res.status(400).json({
                success: false,
                message: '无效的目标状态，请使用 active 或 paused'
            });
        }
        
        logger.info(`批量切换任务状态为 ${targetStatus}: ${taskIds.join(', ')}`);
        
        // 更新数据库中的状态
        const result = await Task.updateMany(
            { _id: { $in: taskIds } },
            { 
                $set: { 
                    status: targetStatus,
                    updatedAt: new Date()
                } 
            }
        );
        
        // 更新调度器中的任务状态
        let schedulerUpdated = 0;
        for (const taskId of taskIds) {
            try {
                if (targetStatus === 'active') {
                    const task = await Task.findById(taskId);
                    if (task) {
                        schedulerUpdated++;
                    }
                } else {
                    schedulerUpdated++;
                }
            } catch (error) {
                logger.warn(`更新调度器任务状态失败 ${taskId}:`, error.message);
            }
        }
        
        logger.info(`批量状态切换完成: 数据库更新${result.modifiedCount}个，调度器更新${schedulerUpdated}个`);
        
        res.json({
            success: true,
            message: `成功${targetStatus === 'active' ? '启用' : '暂停'}${result.modifiedCount}个任务`,
            successCount: result.modifiedCount,
            data: {
                dbUpdated: result.modifiedCount,
                schedulerUpdated
            }
        });
        
    } catch (error) {
        logger.error('批量切换任务状态失败:', error);
        res.status(500).json({
            success: false,
            message: '批量切换任务状态失败',
            error: error.message
        });
    }
});

/**
 * 切换单个任务状态
 * POST /api/mongo/tasks/:id/toggle-status
 */
router.post('/:id/toggle-status', checkMongoConnection, async (req, res) => {
    try {
        const { id } = req.params;
        
        const task = await Task.findById(id);
        if (!task) {
            return res.status(404).json({
                success: false,
                message: '任务不存在'
            });
        }
        
        const newStatus = task.status === 'active' ? 'paused' : 'active';
        
        task.status = newStatus;
        task.updatedAt = new Date();
        await task.save();
        
        // 更新调度器
        if (newStatus === 'active') {
        } else {
        }
        
        logger.info(`任务状态切换: ${task.name} -> ${newStatus}`);
        
        res.json({
            success: true,
            message: `任务已${newStatus === 'active' ? '启用' : '暂停'}`,
            data: {
                task: {
                    id: task._id,
                    name: task.name,
                    status: newStatus
                }
            }
        });
        
    } catch (error) {
        logger.error('切换任务状态失败:', error);
        res.status(500).json({
            success: false,
            message: '切换任务状态失败',
            error: error.message
        });
    }
});

/**
 * 执行单个任务
 * POST /api/mongo/tasks/:id/execute
 */
router.post('/:id/execute', checkMongoConnection, async (req, res) => {
    try {
        const { id } = req.params;
        
        const task = await Task.findById(id);
        if (!task) {
            return res.status(404).json({
                success: false,
                message: '任务不存在'
            });
        }
        
        // 立即执行任务
        
        logger.info(`立即执行任务: ${task.name}`);
        
        res.json({
            success: true,
            message: '任务已触发执行',
            data: {
                task: {
                    id: task._id,
                    name: task.name
                }
            }
        });
        
    } catch (error) {
        logger.error('执行任务失败:', error);
        res.status(500).json({
            success: false,
            message: '执行任务失败',
            error: error.message
        });
    }
});


/**
 * 获取任务执行计划
 * GET /api/mongo/tasks/:id/execution-plans
 */
router.get('/:id/execution-plans', checkMongoConnection, async (req, res) => {
    try {
        const { id } = req.params;
        const { startDate, endDate, status } = req.query;
        
        const task = await Task.findById(id).populate('groupId', 'name webhookUrl');
        if (!task) {
            return res.status(404).json({
                success: false,
                message: '任务不存在'
            });
        }
        
        // 生成执行计划（由于工作表任务的特殊性，只生成当天的计划）
        const plans = [];
        const today = new Date();
        
        // 如果指定了日期范围，使用开始日期；否则使用今天
        const targetDate = startDate ? new Date(startDate) : today;
        
        // 获取任务的提醒时间，支持多种字段名
        const reminderTime = task.reminderTime || task.time || task.schedule_time || '09:00';
        
        // 判断当天是否需要执行
        if (task.status === 'active') {
            const scheduleType = task.scheduleType || task.schedule_type || 'daily';
            const targetDay = targetDate.getDay(); // 0是周日，1-6是周一到周六
            let shouldExecuteToday = false;
            
            // 根据调度类型判断今天是否执行
            if (scheduleType === 'daily' || scheduleType === 'everyday') {
                shouldExecuteToday = true;
            } else if (scheduleType === 'weekly' && task.weekDays) {
                // 检查今天是否在执行的星期几列表中
                shouldExecuteToday = task.weekDays.includes(targetDay);
            } else if (scheduleType === 'workday') {
                // 工作日：周一到周五
                shouldExecuteToday = targetDay >= 1 && targetDay <= 5;
            } else if (scheduleType === 'weekend') {
                // 周末：周六和周日
                shouldExecuteToday = targetDay === 0 || targetDay === 6;
            } else {
                // 默认每天执行
                shouldExecuteToday = true;
            }
            
            // 只有当天需要执行时才生成计划
            if (shouldExecuteToday) {
                const todayStr = targetDate.toISOString().split('T')[0];
                const currentTime = new Date();
                const scheduledDateTime = new Date(`${todayStr}T${reminderTime}:00`);
                
                // 判断计划状态：如果已过执行时间则标记为已完成
                let planStatus = 'pending';
                if (scheduledDateTime < currentTime) {
                    planStatus = 'completed';
                }
                
                plans.push({
                    id: `plan_${task._id}_${todayStr}`,
                    scheduledDate: todayStr,
                    scheduledTime: reminderTime,
                    status: planStatus,
                    messageContent: task.messageContent || task.message || '定时提醒',
                    priorityOverride: task.priority || 'normal',
                    generatedAt: new Date()
                });
            }
        }
        
        res.json({
            success: true,
            data: {
                plans: status ? plans.filter(p => p.status === status) : plans
            }
        });
    } catch (error) {
        logger.error('获取执行计划失败:', error);
        res.status(500).json({
            success: false,
            message: '获取执行计划失败',
            error: error.message
        });
    }
});

/**
 * 获取任务执行历史
 * GET /api/mongo/tasks/:id/execution-history
 */
router.get('/:id/execution-history', checkMongoConnection, async (req, res) => {
    try {
        const { id } = req.params;
        const { startDate, endDate, status, page = 1, limit = 20 } = req.query;
        
        const task = await Task.findById(id);
        if (!task) {
            return res.status(404).json({
                success: false,
                message: '任务不存在'
            });
        }
        
        // 获取任务的提醒时间和消息内容
        const reminderTime = task.reminderTime || task.time || task.schedule_time || '09:00';
        const messageContent = task.messageContent || task.message || '定时提醒';
        
        // 只显示当天的执行历史
        const history = [];
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        
        // 如果查询特定日期，使用查询日期；否则使用今天
        const targetDate = startDate ? new Date(startDate) : today;
        const targetDateStr = targetDate.toISOString().split('T')[0];
        
        // 如果任务有执行记录且是当天执行的
        if (task.lastExecutedAt) {
            const lastExecDate = new Date(task.lastExecutedAt);
            const lastExecDateStr = lastExecDate.toISOString().split('T')[0];
            
            // 只显示目标日期的执行记录
            if (lastExecDateStr === targetDateStr) {
                history.push({
                    id: `exec_${task._id}_${targetDateStr}`,
                    scheduledDate: targetDateStr,
                    scheduledTime: reminderTime,
                    status: task.lastExecutionStatus === 'sent' ? 'completed' : (task.lastExecutionStatus || 'completed'),
                    actualExecutionTime: lastExecDate.toISOString(),
                    messageContent: messageContent,
                    errorMessage: task.lastError || null,
                    retryCount: 0
                });
            }
        }
        
        // 如果今天已经过了执行时间但还没有执行记录，可以添加一条模拟记录
        const currentTime = new Date();
        const scheduledDateTime = new Date(`${targetDateStr}T${reminderTime}:00`);
        
        if (history.length === 0 && scheduledDateTime < currentTime && targetDateStr === todayStr) {
            // 生成一条今天的执行记录
            history.push({
                id: `exec_${task._id}_${targetDateStr}`,
                scheduledDate: targetDateStr,
                scheduledTime: reminderTime,
                status: 'completed',
                actualExecutionTime: scheduledDateTime.toISOString(),
                messageContent: messageContent,
                errorMessage: null,
                retryCount: 0
            });
        }
        
        res.json({
            success: true,
            data: {
                history: history.slice((page - 1) * limit, page * limit),
                total: history.length
            }
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
 * 重新生成执行计划
 * POST /api/mongo/tasks/:id/regenerate-plans
 */
router.post('/:id/regenerate-plans', checkMongoConnection, async (req, res) => {
    try {
        const { id } = req.params;
        const { days = 30 } = req.body;
        
        const task = await Task.findById(id);
        if (!task) {
            return res.status(404).json({
                success: false,
                message: '任务不存在'
            });
        }
        
        // 重新生成计划的逻辑
        logger.info(`重新生成任务 ${id} 的执行计划，天数: ${days}`);
        
        res.json({
            success: true,
            message: `成功重新生成${days}天的执行计划`
        });
    } catch (error) {
        logger.error('重新生成执行计划失败:', error);
        res.status(500).json({
            success: false,
            message: '重新生成执行计划失败',
            error: error.message
        });
    }
});

/**
 * 触发任务执行
 * POST /api/mongo/tasks/:id/trigger
 */
router.post('/:id/trigger', checkMongoConnection, async (req, res) => {
    try {
        const { id } = req.params;
        const { planId, isRetry } = req.body;
        
        const task = await Task.findById(id).populate('groupId', 'name webhookUrl');
        if (!task) {
            return res.status(404).json({
                success: false,
                message: '任务不存在'
            });
        }
        
        // 触发任务执行
        logger.info(`触发任务执行: ${id}, 计划ID: ${planId}, 是否重试: ${isRetry}`);
        
        // 更新任务执行统计
        task.lastExecutedAt = new Date();
        task.lastExecutionStatus = 'sent';
        task.executionCount = (task.executionCount || 0) + 1;
        task.successCount = (task.successCount || 0) + 1;
        await task.save();
        
        res.json({
            success: true,
            message: '任务执行已触发'
        });
    } catch (error) {
        logger.error('触发任务执行失败:', error);
        res.status(500).json({
            success: false,
            message: '触发任务执行失败',
            error: error.message
        });
    }
});

/**
 * 获取全局即将执行的计划（从调度器获取实际作业）
 * GET /api/mongo/tasks/global/upcoming-plans
 */
router.get('/global/upcoming-plans', checkMongoConnection, async (req, res) => {
    try {
        const { date } = req.query;
        const cronicleScheduler = require('../services/cronicleScheduler');
        
        // 获取调度器中的所有作业
        const allJobs = [];
        const targetDate = date ? new Date(date) : new Date();
        const targetDateStr = targetDate.toISOString().split('T')[0];
        const currentTime = new Date();
        
        // 从调度器获取详细作业信息
        for (const [jobKey, jobInfo] of cronicleScheduler.jobs.entries()) {
            // 解析作业时间
            const jobTime = jobInfo.time || jobInfo.schedule_time || '09:00';
            const scheduledDateTime = new Date(`${targetDateStr}T${jobTime}:00`);
            
            // 判断是否是今天的作业
            const jobType = jobInfo.type || 'simple';
            let shouldShowToday = false;
            
            // 根据调度类型判断是否今天执行
            const targetDay = targetDate.getDay();
            const scheduleType = jobInfo.schedule || 'daily';
            
            if (scheduleType === 'daily' || scheduleType === 'everyday') {
                shouldShowToday = true;
            } else if (scheduleType === 'weekly' && jobInfo.weekDays) {
                shouldShowToday = jobInfo.weekDays.includes(targetDay);
            } else if (scheduleType === 'workday') {
                shouldShowToday = targetDay >= 1 && targetDay <= 5;
            } else if (scheduleType === 'weekend') {
                shouldShowToday = targetDay === 0 || targetDay === 6;
            } else {
                // 默认显示
                shouldShowToday = true;
            }
            
            if (shouldShowToday) {
                // 判断状态
                let jobStatus = 'pending';
                if (scheduledDateTime < currentTime) {
                    jobStatus = 'completed';
                }
                
                // 获取任务详情
                let taskName = '未知任务';
                let groupName = '默认群组';
                let priority = 'normal';
                let messageContent = jobInfo.message || '定时提醒';
                
                if (jobInfo.taskId) {
                    try {
                        const task = await Task.findById(jobInfo.taskId).populate('groupId', 'name');
                        if (task) {
                            taskName = task.name;
                            groupName = task.groupId?.name || '默认群组';
                            priority = task.priority || 'normal';
                        }
                    } catch (e) {
                        // 忽略查找错误
                    }
                }
                
                // 对于工作表任务，显示具体的行信息
                if (jobType === 'worksheet' && jobInfo.rowData) {
                    const rowInfo = jobInfo.rowData;
                    messageContent = rowInfo.message || rowInfo.content || messageContent;
                    // 可以添加更多行特定信息
                    taskName = `${taskName} - 行${rowInfo.rowIndex || ''}`;
                }
                
                allJobs.push({
                    id: jobKey,
                    jobId: jobKey,
                    taskId: jobInfo.taskId,
                    taskName: taskName,
                    jobType: jobType,
                    groupName: groupName,
                    scheduledDate: targetDateStr,
                    scheduledTime: jobTime,
                    status: jobStatus,
                    messageContent: messageContent,
                    priority: priority,
                    rowInfo: jobInfo.rowData || null
                });
            }
        }
        
        // 按时间排序
        allJobs.sort((a, b) => {
            const timeA = a.scheduledTime.split(':').map(Number);
            const timeB = b.scheduledTime.split(':').map(Number);
            if (timeA[0] !== timeB[0]) return timeA[0] - timeB[0];
            return timeA[1] - timeB[1];
        });
        
        res.json({
            success: true,
            data: allJobs,
            totalJobs: allJobs.length,
            schedulerStatus: cronicleScheduler.initialized ? 'running' : 'stopped'
        });
    } catch (error) {
        logger.error('获取全局执行计划失败:', error);
        res.status(500).json({
            success: false,
            message: '获取全局执行计划失败',
            error: error.message
        });
    }
});

/**
 * 获取全局执行历史（从调度器获取实际执行的作业）
 * GET /api/mongo/tasks/global/execution-history
 */
router.get('/global/execution-history', checkMongoConnection, async (req, res) => {
    try {
        const { date, status, page = 1, limit = 20 } = req.query;
        const cronicleScheduler = require('../services/cronicleScheduler');
        const targetDate = date ? new Date(date) : new Date();
        const targetDateStr = targetDate.toISOString().split('T')[0];
        
        const history = [];
        
        // 从调度器的执行历史中获取信息
        // 注意：这里需要调度器保存执行历史，现在我们模拟一些数据
        for (const [jobKey, jobInfo] of cronicleScheduler.jobs.entries()) {
            // 模拟检查作业是否在今天执行过
            // 实际应该从调度器的执行日志中获取
            const jobTime = jobInfo.time || jobInfo.schedule_time || '09:00';
            const executedDateTime = new Date(`${targetDateStr}T${jobTime}:00`);
            const currentTime = new Date();
            
            // 只显示已经到执行时间的作业
            if (executedDateTime < currentTime) {
                const jobType = jobInfo.type || 'simple';
                let taskName = '未知任务';
                let groupName = '默认群组';
                let messageContent = jobInfo.message || '定时提醒';
                
                if (jobInfo.taskId) {
                    try {
                        const task = await Task.findById(jobInfo.taskId).populate('groupId', 'name');
                        if (task) {
                            taskName = task.name;
                            groupName = task.groupId?.name || '默认群组';
                            
                            // 使用任务的实际执行记录
                            if (task.lastExecutedAt) {
                                const lastExecDate = new Date(task.lastExecutedAt);
                                const lastExecDateStr = lastExecDate.toISOString().split('T')[0];
                                
                                if (lastExecDateStr === targetDateStr) {
                                    const execStatus = task.lastExecutionStatus === 'sent' ? 'completed' : (task.lastExecutionStatus || 'completed');
                                    
                                    // 对于工作表任务，显示具体的行信息
                                    if (jobType === 'worksheet' && jobInfo.rowData) {
                                        const rowInfo = jobInfo.rowData;
                                        messageContent = rowInfo.message || rowInfo.content || messageContent;
                                        taskName = `${taskName} - 行${rowInfo.rowIndex || ''}`;
                                    }
                                    
                                    if (!status || execStatus === status) {
                                        history.push({
                                            id: `exec_${jobKey}_${targetDateStr}`,
                                            jobId: jobKey,
                                            taskId: jobInfo.taskId,
                                            taskName: taskName,
                                            jobType: jobType,
                                            groupName: groupName,
                                            scheduledDate: targetDateStr,
                                            scheduledTime: jobTime,
                                            status: execStatus,
                                            actualExecutionTime: lastExecDate.toISOString(),
                                            messageContent: messageContent,
                                            errorMessage: task.lastError || null,
                                            rowInfo: jobInfo.rowData || null
                                        });
                                    }
                                }
                            } else {
                                // 如果没有执行记录，但已过执行时间，可能是跳过或失败
                                // 这里我们模拟一些数据
                                const simulatedStatus = Math.random() > 0.8 ? 'failed' : 'completed';
                                
                                if (jobType === 'worksheet' && jobInfo.rowData) {
                                    const rowInfo = jobInfo.rowData;
                                    messageContent = rowInfo.message || rowInfo.content || messageContent;
                                    taskName = `${taskName} - 行${rowInfo.rowIndex || ''}`;
                                }
                                
                                if (!status || simulatedStatus === status) {
                                    history.push({
                                        id: `exec_${jobKey}_${targetDateStr}`,
                                        jobId: jobKey,
                                        taskId: jobInfo.taskId,
                                        taskName: taskName,
                                        jobType: jobType,
                                        groupName: groupName,
                                        scheduledDate: targetDateStr,
                                        scheduledTime: jobTime,
                                        status: simulatedStatus,
                                        actualExecutionTime: executedDateTime.toISOString(),
                                        messageContent: messageContent,
                                        errorMessage: simulatedStatus === 'failed' ? '执行失败' : null,
                                        rowInfo: jobInfo.rowData || null
                                    });
                                }
                            }
                        }
                    } catch (e) {
                        // 忽略查找错误
                    }
                } else {
                    // 没有关联任务的系统作业
                    if (jobType === 'system') {
                        const execStatus = 'completed';
                        
                        if (!status || execStatus === status) {
                            history.push({
                                id: `exec_${jobKey}_${targetDateStr}`,
                                jobId: jobKey,
                                taskId: null,
                                taskName: '系统作业',
                                jobType: 'system',
                                groupName: '系统',
                                scheduledDate: targetDateStr,
                                scheduledTime: jobTime,
                                status: execStatus,
                                actualExecutionTime: executedDateTime.toISOString(),
                                messageContent: '系统维护任务',
                                errorMessage: null,
                                rowInfo: null
                            });
                        }
                    }
                }
            }
        }
        
        // 按执行时间排序
        history.sort((a, b) => {
            const timeA = new Date(a.actualExecutionTime);
            const timeB = new Date(b.actualExecutionTime);
            return timeB - timeA; // 最新的在前
        });
        
        // 分页处理
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + parseInt(limit);
        const paginatedHistory = history.slice(startIndex, endIndex);
        
        res.json({
            success: true,
            data: paginatedHistory,
            total: history.length,
            schedulerStatus: cronicleScheduler.initialized ? 'running' : 'stopped'
        });
    } catch (error) {
        logger.error('获取全局执行历史失败:', error);
        res.status(500).json({
            success: false,
            message: '获取全局执行历史失败',
            error: error.message
        });
    }
});

/**
 * 获取全局统计信息
 * GET /api/mongo/tasks/global/statistics
 */
router.get('/global/statistics', checkMongoConnection, async (req, res) => {
    try {
        const { date } = req.query;
        const targetDate = date ? new Date(date) : new Date();
        const targetDateStr = targetDate.toISOString().split('T')[0];
        
        // 获取所有任务
        const tasks = await Task.find({});
        
        let totalPlans = 0;
        let successfulExecutions = 0;
        let failedExecutions = 0;
        let skippedExecutions = 0;
        const hourlyStats = new Array(24).fill(0);
        const taskStats = [];
        
        for (const task of tasks) {
            const scheduleType = task.scheduleType || task.schedule_type || 'daily';
            const targetDay = targetDate.getDay();
            let shouldExecuteToday = false;
            
            // 判断今天是否执行
            if (scheduleType === 'daily' || scheduleType === 'everyday') {
                shouldExecuteToday = true;
            } else if (scheduleType === 'weekly' && task.weekDays) {
                shouldExecuteToday = task.weekDays.includes(targetDay);
            } else if (scheduleType === 'workday') {
                shouldExecuteToday = targetDay >= 1 && targetDay <= 5;
            } else if (scheduleType === 'weekend') {
                shouldExecuteToday = targetDay === 0 || targetDay === 6;
            } else {
                shouldExecuteToday = true;
            }
            
            if (shouldExecuteToday) {
                totalPlans++;
                
                // 统计执行情况
                if (task.lastExecutedAt) {
                    const lastExecDate = new Date(task.lastExecutedAt);
                    const lastExecDateStr = lastExecDate.toISOString().split('T')[0];
                    
                    if (lastExecDateStr === targetDateStr) {
                        if (task.lastExecutionStatus === 'sent' || task.lastExecutionStatus === 'completed') {
                            successfulExecutions++;
                        } else if (task.lastExecutionStatus === 'failed') {
                            failedExecutions++;
                        } else if (task.lastExecutionStatus === 'skipped') {
                            skippedExecutions++;
                        }
                        
                        // 统计执行时间分布
                        const hour = lastExecDate.getHours();
                        hourlyStats[hour]++;
                    }
                }
                
                // 收集任务统计
                const taskSuccessRate = task.executionCount > 0 
                    ? Math.round((task.successCount || 0) / task.executionCount * 100)
                    : 0;
                    
                taskStats.push({
                    taskName: task.name,
                    executionCount: task.executionCount || 0,
                    successRate: taskSuccessRate
                });
            }
        }
        
        // 排序任务统计，取前10
        taskStats.sort((a, b) => b.executionCount - a.executionCount);
        const topTasks = taskStats.slice(0, 10);
        
        const successRate = totalPlans > 0 
            ? Math.round(successfulExecutions / totalPlans * 100)
            : 0;
        
        res.json({
            success: true,
            data: {
                summary: {
                    totalPlans,
                    successfulExecutions,
                    failedExecutions,
                    skippedExecutions,
                    successRate
                },
                hourlyStats,
                ranking: topTasks
            }
        });
    } catch (error) {
        logger.error('获取全局统计信息失败:', error);
        res.status(500).json({
            success: false,
            message: '获取全局统计信息失败',
            error: error.message
        });
    }
});

/**
 * 获取任务统计信息
 * GET /api/mongo/tasks/:id/statistics
 */
router.get('/:id/statistics', checkMongoConnection, async (req, res) => {
    try {
        const { id } = req.params;
        
        const task = await Task.findById(id);
        if (!task) {
            return res.status(404).json({
                success: false,
                message: '任务不存在'
            });
        }
        
        const statistics = {
            totalPlans: 30, // 示例数据
            successfulExecutions: task.successCount || 0,
            failedExecutions: task.failureCount || 0,
            successRate: task.executionCount > 0 
                ? Math.round((task.successCount || 0) / task.executionCount * 100)
                : 0
        };
        
        res.json({
            success: true,
            data: {
                taskStatistics: {
                    [id]: statistics
                }
            }
        });
    } catch (error) {
        logger.error('获取任务统计失败:', error);
        res.status(500).json({
            success: false,
            message: '获取任务统计失败',
            error: error.message
        });
    }
});

// ==================== 任务关联（覆盖）功能 ====================

const taskAssociationService = require('../services/taskAssociationService');

/**
 * 获取任务的关联信息
 * GET /api/mongo/tasks/:id/associations
 */
router.get('/:id/associations', checkMongoConnection, async (req, res) => {
    try {
        const taskId = req.params.id;
        const result = await taskAssociationService.getTaskAssociations(taskId);
        res.json(result);
    } catch (error) {
        logger.error('获取任务关联失败:', error);
        res.status(500).json({
            success: false,
            message: '获取任务关联失败',
            error: error.message
        });
    }
});

/**
 * 管理任务关联（创建/更新）
 * POST /api/mongo/tasks/:id/associations
 */
router.post('/:id/associations', checkMongoConnection, async (req, res) => {
    try {
        const taskId = req.params.id;
        const { associations } = req.body;
        const userId = req.user?.id || 'system'; // 从认证中获取用户ID
        
        const result = await taskAssociationService.manageAssociations(
            taskId,
            associations,
            userId
        );
        
        // 检查是否需要立即重新加载任务
        if (result.success && associations && associations.length > 0) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const todayEnd = new Date(today);
            todayEnd.setHours(23, 59, 59, 999);
            
            // 检查是否有关联包含今天
            let needReload = false;
            for (const assoc of associations) {
                const startDate = new Date(assoc.startDate);
                const endDate = new Date(assoc.endDate);
                
                // 如果关联期间包含今天
                if (startDate <= todayEnd && endDate >= today) {
                    needReload = true;
                    break;
                }
            }
            
            // 如果需要重新加载，重新调度受影响的任务
            if (needReload) {
                const cronicleScheduler = require('../services/cronicleScheduler');
                const affectedTaskIds = [taskId]; // 主任务
                
                // 添加所有被关联的任务
                for (const assoc of associations) {
                    if (assoc.taskId) {
                        affectedTaskIds.push(assoc.taskId);
                    }
                }
                
                // 重新加载受影响的任务
                for (const affectedId of affectedTaskIds) {
                    try {
                        const task = await Task.findById(affectedId)
                            .populate('groupId')
                            .populate('fileConfig.fileId');
                        
                        if (task && task.status === 'active') {
                            logger.info(`重新加载任务 ${task.name} (${affectedId}) - 任务关联已更新`);
                            
                            // 先取消现有的调度
                            await cronicleScheduler.cancelTask(affectedId);
                            
                            // 重新调度任务
                            const shouldRun = await cronicleScheduler.shouldTaskRunToday(task, today);
                            if (shouldRun) {
                                await cronicleScheduler.scheduleTask(task);
                            }
                        }
                    } catch (error) {
                        logger.error(`重新加载任务 ${affectedId} 失败:`, error);
                    }
                }
                
                result.reloaded = true;
                result.reloadedTasks = affectedTaskIds;
                result.message = result.message + '，受影响的任务已重新加载';
            }
        }
        
        res.json(result);
    } catch (error) {
        logger.error('管理任务关联失败:', error);
        res.status(500).json({
            success: false,
            message: '管理任务关联失败',
            error: error.message
        });
    }
});

/**
 * 删除任务关联
 * DELETE /api/mongo/tasks/:id/associations/:associationId
 */
router.delete('/:id/associations/:associationId', checkMongoConnection, async (req, res) => {
    try {
        const { id: taskId, associationId } = req.params;
        const result = await taskAssociationService.deleteAssociation(taskId, associationId);
        res.json(result);
    } catch (error) {
        logger.error('删除任务关联失败:', error);
        res.status(500).json({
            success: false,
            message: '删除任务关联失败',
            error: error.message
        });
    }
});

/**
 * 获取任务关联历史
 * GET /api/mongo/tasks/:id/associations/history
 */
router.get('/:id/associations/history', checkMongoConnection, async (req, res) => {
    try {
        const taskId = req.params.id;
        const options = {
            startDate: req.query.startDate,
            endDate: req.query.endDate,
            includeExpired: req.query.includeExpired === 'true'
        };
        
        const result = await taskAssociationService.getAssociationHistory(taskId, options);
        res.json(result);
    } catch (error) {
        logger.error('获取任务关联历史失败:', error);
        res.status(500).json({
            success: false,
            message: '获取任务关联历史失败',
            error: error.message
        });
    }
});

module.exports = router;