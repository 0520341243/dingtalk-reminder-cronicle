/**
 * MongoDB群组管理API
 * 使用MongoDB替代PostgreSQL进行群组管理
 */

const express = require('express');
const router = express.Router();
const { Group, Task, mongoose } = require('../models/mongodb');
const logger = require('../utils/logger');

/**
 * 获取群组列表
 */
router.get('/', async (req, res) => {
    try {
        const { status = 'all', page = 1, limit = 20 } = req.query;
        
        // 构建查询条件
        const query = {};
        if (status !== 'all' && status) {
            query.status = status;
        }
        
        // 如果不是管理员，只能查看自己创建的群组
        if (req.user && req.user.role !== 'admin') {
            query.createdBy = req.user.mongoId || req.user.id;
        }
        
        // 查询群组
        const groups = await Group
            .find(query)
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .skip((parseInt(page) - 1) * parseInt(limit));
        
        // 获取总数
        const total = await Group.countDocuments(query);
        
        // 获取每个群组的任务数量
        const groupsWithTaskCount = await Promise.all(
            groups.map(async (group) => {
                const taskCount = await Task.countDocuments({ 
                    groupId: group._id,
                    status: 'active'
                });
                
                return {
                    id: group._id,
                    name: group.name,
                    description: group.description,
                    webhookUrl: group.webhookUrl,
                    secret: group.secret,
                    status: group.status,
                    groupType: group.groupType,
                    taskCount,
                    createdAt: group.createdAt,
                    updatedAt: group.updatedAt
                };
            })
        );
        
        res.json({
            success: true,
            groups: groupsWithTaskCount,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(total / parseInt(limit))
            }
        });
        
    } catch (error) {
        logger.error('获取群组列表失败:', error);
        res.status(500).json({
            success: false,
            message: '获取群组列表失败',
            error: error.message
        });
    }
});

/**
 * 获取单个群组详情
 */
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        // 验证ID格式
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: '无效的群组ID'
            });
        }
        
        // 查询群组
        const group = await Group.findById(id);
        
        if (!group) {
            return res.status(404).json({
                success: false,
                message: '群组不存在'
            });
        }
        
        // 获取群组的任务数量
        const taskCount = await Task.countDocuments({ 
            groupId: group._id,
            status: 'active'
        });
        
        // 获取群组的最近任务
        const recentTasks = await Task
            .find({ groupId: group._id })
            .select('name type status nextRunAt')
            .sort({ createdAt: -1 })
            .limit(5);
        
        res.json({
            success: true,
            data: {
                id: group._id,
                name: group.name,
                description: group.description,
                webhookUrl: group.webhookUrl,
                secret: group.secret,
                status: group.status,
                groupType: group.groupType,
                taskCount,
                recentTasks: recentTasks.map(task => ({
                    id: task._id,
                    name: task.name,
                    type: task.type,
                    status: task.status,
                    nextRunAt: task.nextRunAt
                })),
                createdAt: group.createdAt,
                updatedAt: group.updatedAt
            }
        });
        
    } catch (error) {
        logger.error('获取群组详情失败:', error);
        res.status(500).json({
            success: false,
            message: '获取群组详情失败',
            error: error.message
        });
    }
});

/**
 * 批量操作群组
 */
router.post('/batch', async (req, res) => {
    try {
        const { action, groupIds } = req.body;
        
        if (!action || !groupIds || !Array.isArray(groupIds) || groupIds.length === 0) {
            return res.status(400).json({
                success: false,
                error: '无效的批量操作参数'
            });
        }
        
        let updateData = {};
        
        switch (action) {
            case 'activate':
                updateData.status = 'active';
                break;
            case 'deactivate':
                updateData.status = 'inactive';
                break;
            default:
                return res.status(400).json({
                    success: false,
                    error: '不支持的操作类型'
                });
        }
        
        // 批量更新群组状态
        const result = await Group.updateMany(
            { _id: { $in: groupIds } },
            { $set: updateData }
        );
        
        res.json({
            success: true,
            message: `成功${action === 'activate' ? '激活' : '停用'}${result.modifiedCount}个群组`,
            updatedCount: result.modifiedCount,
            updatedIds: groupIds
        });
        
    } catch (error) {
        logger.error('批量操作群组失败:', error);
        res.status(500).json({
            success: false,
            error: '批量操作失败',
            message: error.message
        });
    }
});

/**
 * 创建新群组
 */
router.post('/', async (req, res) => {
    try {
        // 兼容下划线和驼峰命名
        const name = req.body.name;
        const description = req.body.description;
        const webhookUrl = req.body.webhookUrl || req.body.webhook_url;
        const secret = req.body.secret;
        const groupType = req.body.groupType || req.body.group_type || 'regular';
        const status = req.body.status || 'active';
        
        // 验证必填字段
        if (!name || !webhookUrl) {
            return res.status(400).json({
                success: false,
                message: '群组名称和Webhook URL不能为空'
            });
        }
        
        // 检查群组名称是否已存在
        const existingGroup = await Group.findOne({ name });
        if (existingGroup) {
            return res.status(409).json({
                success: false,
                message: '群组名称已存在'
            });
        }
        
        // 创建新群组
        const group = new Group({
            name,
            description,
            webhookUrl,
            secret,
            groupType,
            status,
            createdBy: req.user?.mongoId || req.user?.id
        });
        
        await group.save();
        
        res.status(201).json({
            success: true,
            message: '群组创建成功',
            data: {
                id: group._id,
                name: group.name,
                description: group.description,
                webhookUrl: group.webhookUrl,
                secret: group.secret,
                status: group.status,
                groupType: group.groupType,
                createdAt: group.createdAt
            }
        });
        
    } catch (error) {
        logger.error('创建群组失败:', error);
        res.status(500).json({
            success: false,
            message: '创建群组失败',
            error: error.message
        });
    }
});

/**
 * 更新群组
 */
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        
        // 验证ID格式
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: '无效的群组ID'
            });
        }
        
        // 先查找群组以检查权限
        const existingGroup = await Group.findById(id);
        if (!existingGroup) {
            return res.status(404).json({
                success: false,
                message: '群组不存在'
            });
        }
        
        // 权限检查：只有管理员或群组创建者才能更新群组
        if (req.user.role !== 'admin' && 
            existingGroup.createdBy?.toString() !== req.user.mongoId?.toString() && 
            existingGroup.createdBy?.toString() !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: '您没有权限更新此群组'
            });
        }
        
        // 如果更新名称，检查是否重复
        if (updates.name) {
            const duplicateGroup = await Group.findOne({ 
                name: updates.name,
                _id: { $ne: id }
            });
            
            if (duplicateGroup) {
                return res.status(409).json({
                    success: false,
                    message: '群组名称已被使用'
                });
            }
        }
        
        // 更新群组
        const group = await Group.findByIdAndUpdate(
            id,
            {
                ...updates,
                updatedAt: new Date()
            },
            {
                new: true, // 返回更新后的文档
                runValidators: true // 运行验证器
            }
        );
        
        if (!group) {
            return res.status(404).json({
                success: false,
                message: '群组不存在'
            });
        }
        
        res.json({
            success: true,
            message: '群组更新成功',
            data: {
                id: group._id,
                name: group.name,
                description: group.description,
                webhookUrl: group.webhookUrl,
                secret: group.secret,
                status: group.status,
                groupType: group.groupType,
                updatedAt: group.updatedAt
            }
        });
        
    } catch (error) {
        logger.error('更新群组失败:', error);
        res.status(500).json({
            success: false,
            message: '更新群组失败',
            error: error.message
        });
    }
});

/**
 * 删除群组
 */
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        // 验证ID格式
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: '无效的群组ID'
            });
        }
        
        // 检查群组是否有关联的任务
        const taskCount = await Task.countDocuments({ groupId: id });
        if (taskCount > 0) {
            return res.status(409).json({
                success: false,
                message: `该群组还有 ${taskCount} 个关联任务，请先删除或迁移这些任务`
            });
        }
        
        // 删除群组
        const group = await Group.findByIdAndDelete(id);
        
        if (!group) {
            return res.status(404).json({
                success: false,
                message: '群组不存在'
            });
        }
        
        res.json({
            success: true,
            message: '群组删除成功',
            data: {
                id: group._id,
                name: group.name
            }
        });
        
    } catch (error) {
        logger.error('删除群组失败:', error);
        res.status(500).json({
            success: false,
            message: '删除群组失败',
            error: error.message
        });
    }
});

/**
 * 测试群组Webhook
 */
router.post('/:id/test', async (req, res) => {
    try {
        const { id } = req.params;
        const { message = '这是一条测试消息' } = req.body;
        
        // 验证ID格式
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: '无效的群组ID'
            });
        }
        
        // 查询群组
        const group = await Group.findById(id);
        
        if (!group) {
            return res.status(404).json({
                success: false,
                message: '群组不存在'
            });
        }
        
        // 发送测试消息到钉钉
        const dingTalkBot = require('../services/dingTalkBot');
        const result = await dingTalkBot.sendMessage(
            group.webhookUrl,
            `[测试消息] ${message}`,
            { secret: group.secret }  // 第三个参数应该是options对象
        );
        
        if (result.success) {
            res.json({
                success: true,
                message: '测试消息发送成功'
            });
        } else {
            res.status(500).json({
                success: false,
                message: '测试消息发送失败',
                error: result.error
            });
        }
        
    } catch (error) {
        logger.error('测试群组Webhook失败:', error);
        res.status(500).json({
            success: false,
            message: '测试群组Webhook失败',
            error: error.message
        });
    }
});

/**
 * 删除群组
 */
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        // 查找群组
        const group = await Group.findById(id);
        
        if (!group) {
            return res.status(404).json({
                success: false,
                message: '群组不存在'
            });
        }
        
        // 检查是否有关联的任务
        const { Task } = require('../models/mongodb');
        const taskCount = await Task.countDocuments({ groupId: id });
        
        if (taskCount > 0) {
            return res.status(400).json({
                success: false,
                message: `群组下还有 ${taskCount} 个任务，请先删除任务`
            });
        }
        
        // 删除群组
        await group.deleteOne();
        
        res.json({
            success: true,
            message: '群组删除成功'
        });
        
    } catch (error) {
        logger.error('删除群组失败:', error);
        res.status(500).json({
            success: false,
            message: '删除群组失败',
            error: error.message
        });
    }
});

module.exports = router;