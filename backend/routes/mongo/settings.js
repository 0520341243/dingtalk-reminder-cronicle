/**
 * 系统设置路由
 */

const express = require('express');
const router = express.Router();
const settingsService = require('../../services/settingsService');
const { mongoAuthMiddleware } = require('../../middleware/mongo-auth');
const adminMiddleware = require('../../middleware/adminMiddleware');
const logger = require('../../utils/logger');
const { Group, Task, File, User, mongoose } = require('../../models/mongodb');
const os = require('os');

/**
 * 获取系统设置
 * GET /api/mongo/settings
 */
router.get('/', mongoAuthMiddleware, async (req, res) => {
  try {
    const settings = await settingsService.getSettings();
    res.json({
      success: true,
      data: settings
    });
  } catch (error) {
    logger.error('获取系统设置失败:', error);
    res.status(500).json({
      success: false,
      message: '获取系统设置失败',
      error: error.message
    });
  }
});

/**
 * 更新系统设置（仅管理员）
 * PUT /api/mongo/settings
 */
router.put('/', mongoAuthMiddleware, adminMiddleware, async (req, res) => {
  try {
    const userId = req.user._id;
    const updates = req.body;
    
    const settings = await settingsService.updateSettings(updates, userId);
    
    res.json({
      success: true,
      message: '系统设置更新成功',
      data: settings
    });
  } catch (error) {
    logger.error('更新系统设置失败:', error);
    res.status(500).json({
      success: false,
      message: '更新系统设置失败',
      error: error.message
    });
  }
});

/**
 * 批量获取设置项
 * POST /api/mongo/settings/batch
 */
router.post('/batch', mongoAuthMiddleware, async (req, res) => {
  try {
    const { keys } = req.body;
    
    if (!Array.isArray(keys)) {
      return res.status(400).json({
        success: false,
        message: 'keys 必须是数组'
      });
    }
    
    const settings = await settingsService.getMultipleSettings(keys);
    
    res.json({
      success: true,
      data: settings
    });
  } catch (error) {
    logger.error('批量获取设置失败:', error);
    res.status(500).json({
      success: false,
      message: '批量获取设置失败',
      error: error.message
    });
  }
});

/**
 * 重置为默认设置（仅管理员）
 * POST /api/mongo/settings/reset
 */
router.post('/reset', mongoAuthMiddleware, adminMiddleware, async (req, res) => {
  try {
    const settings = await settingsService.resetToDefaults();
    
    res.json({
      success: true,
      message: '系统设置已重置为默认值',
      data: settings
    });
  } catch (error) {
    logger.error('重置系统设置失败:', error);
    res.status(500).json({
      success: false,
      message: '重置系统设置失败',
      error: error.message
    });
  }
});

/**
 * 导出设置（仅管理员）
 * GET /api/mongo/settings/export
 */
router.get('/export', mongoAuthMiddleware, adminMiddleware, async (req, res) => {
  try {
    const settings = await settingsService.exportSettings();
    
    res.json({
      success: true,
      data: settings
    });
  } catch (error) {
    logger.error('导出设置失败:', error);
    res.status(500).json({
      success: false,
      message: '导出设置失败',
      error: error.message
    });
  }
});

/**
 * 导入设置（仅管理员）
 * POST /api/mongo/settings/import
 */
router.post('/import', mongoAuthMiddleware, adminMiddleware, async (req, res) => {
  try {
    const userId = req.user._id;
    const settingsData = req.body;
    
    const settings = await settingsService.importSettings(settingsData, userId);
    
    res.json({
      success: true,
      message: '设置导入成功',
      data: settings
    });
  } catch (error) {
    logger.error('导入设置失败:', error);
    res.status(500).json({
      success: false,
      message: '导入设置失败',
      error: error.message
    });
  }
});

/**
 * 测试通知Webhook（仅管理员）
 * POST /api/mongo/settings/test-webhook
 */
router.post('/test-webhook', mongoAuthMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { webhook } = req.body;
    
    if (!webhook) {
      return res.status(400).json({
        success: false,
        message: 'Webhook URL 不能为空'
      });
    }
    
    const result = await settingsService.testWebhook(webhook);
    
    res.json({
      success: result,
      message: result ? 'Webhook 测试成功' : 'Webhook 测试失败'
    });
  } catch (error) {
    logger.error('测试Webhook失败:', error);
    res.status(500).json({
      success: false,
      message: '测试Webhook失败',
      error: error.message
    });
  }
});

/**
 * 获取系统统计信息
 * GET /api/mongo/settings/system-stats
 */
router.get('/system-stats', mongoAuthMiddleware, async (req, res) => {
  try {
    // 获取今日日期范围
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);
    
    // 并行获取统计数据
    const [
      activeGroups,
      todayReminders,
      activeFiles,
      totalUsers,
      totalTasks
    ] = await Promise.all([
      // 活跃群组数（状态为active的群组）
      Group.countDocuments({ status: 'active' }),
      
      // 今日提醒数（今天需要执行的任务）
      Task.countDocuments({
        status: 'active',
        $or: [
          { nextRunAt: { $gte: todayStart, $lte: todayEnd } },
          { lastRunAt: { $gte: todayStart, $lte: todayEnd } }
        ]
      }),
      
      // 活跃文件数（状态为active的文件）
      File.countDocuments({ status: 'active' }),
      
      // 总用户数
      User.countDocuments(),
      
      // 活跃任务总数
      Task.countDocuments({ status: 'active' })
    ]);
    
    // 系统信息
    const systemInfo = {
      nodeVersion: process.version,
      platform: os.platform(),
      osVersion: os.release(),
      hostname: os.hostname(),
      arch: os.arch(),
      cpus: os.cpus().length,
      totalMemory: Math.round(os.totalmem() / 1024 / 1024 / 1024 * 100) / 100, // GB
      freeMemory: Math.round(os.freemem() / 1024 / 1024 / 1024 * 100) / 100, // GB
      uptime: process.uptime(),
      pid: process.pid,
      memoryUsage: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024), // MB
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024), // MB
        rss: Math.round(process.memoryUsage().rss / 1024 / 1024) // MB
      }
    };
    
    res.json({
      success: true,
      data: {
        system: {
          nodeVersion: systemInfo.nodeVersion,
          platform: systemInfo.platform,
          version: systemInfo.osVersion,
          hostname: systemInfo.hostname,
          arch: systemInfo.arch,
          cpus: systemInfo.cpus,
          totalMemory: `${systemInfo.totalMemory} GB`,
          freeMemory: `${systemInfo.freeMemory} GB`,
          pid: systemInfo.pid,
          uptime: systemInfo.uptime,
          memoryUsage: systemInfo.memoryUsage
        },
        database: {
          active_groups: activeGroups,
          today_reminders: todayReminders,
          active_files: activeFiles,
          total_users: totalUsers,
          total_tasks: totalTasks
        },
        timestamp: new Date()
      }
    });
    
  } catch (error) {
    logger.error('获取系统统计信息失败:', error);
    res.status(500).json({
      success: false,
      message: '获取系统统计信息失败',
      error: error.message
    });
  }
});

/**
 * 获取特定设置项
 * GET /api/mongo/settings/:key
 * 注意：这个路由必须放在所有具体路径的路由之后，因为它会匹配所有路径
 */
router.get('/:key', mongoAuthMiddleware, async (req, res) => {
  try {
    const { key } = req.params;
    const value = await settingsService.getSetting(key);
    
    res.json({
      success: true,
      data: {
        key,
        value
      }
    });
  } catch (error) {
    logger.error(`获取设置项 ${req.params.key} 失败:`, error);
    res.status(500).json({
      success: false,
      message: '获取设置项失败',
      error: error.message
    });
  }
});

module.exports = router;