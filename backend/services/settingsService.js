/**
 * 系统设置服务
 * 管理所有系统级配置，支持动态加载和更新
 */

const { Setting } = require('../models/mongodb');
const logger = require('../utils/logger');
const EventEmitter = require('events');

class SettingsService extends EventEmitter {
  constructor() {
    super();
    this.cachedSettings = null;
    this.lastUpdate = null;
    this.cacheTimeout = 60000; // 缓存60秒
  }

  /**
   * 获取所有设置（带缓存）
   */
  async getSettings(forceRefresh = false) {
    try {
      // 检查缓存是否有效
      if (!forceRefresh && this.cachedSettings && this.lastUpdate) {
        const now = Date.now();
        if (now - this.lastUpdate < this.cacheTimeout) {
          return this.cachedSettings;
        }
      }

      // 从数据库获取所有设置
      const settingDocs = await Setting.find({});
      const settings = this.getDefaultSettings();
      
      // 将数据库中的设置合并到默认设置
      settingDocs.forEach(doc => {
        settings[doc.key] = doc.value;
      });
      
      // 更新缓存
      this.cachedSettings = settings;
      this.lastUpdate = Date.now();
      
      return settings;
    } catch (error) {
      logger.error('获取系统设置失败:', error);
      throw error;
    }
  }
  
  /**
   * 获取默认设置
   */
  getDefaultSettings() {
    return {
      daily_load_time: '02:00',
      max_retry_count: 3,
      retry_interval: 300,
      task_timeout: 30,
      max_concurrent_tasks: 10,
      failure_notification_enabled: true,
      history_retention_days: 90,
      log_retention_days: 30,
      auto_cleanup_enabled: true,
      cleanup_time: '03:00',
      system_error_notification: true,
      task_failure_notification: true,
      daily_report_enabled: false,
      daily_report_time: '09:00',
      notification_webhook: ''
    };
  }

  /**
   * 更新设置
   */
  async updateSettings(updates, userId = null) {
    try {
      // 验证更新的字段
      const validatedUpdates = this.validateSettings(updates);
      
      // 更新数据库，每个设置作为一个文档
      for (const [key, value] of Object.entries(validatedUpdates)) {
        await Setting.findOneAndUpdate(
          { key },
          { 
            key,
            value,
            description: this.getSettingDescription(key),
            updatedAt: new Date()
          },
          { upsert: true, new: true }
        );
      }
      
      // 重新获取所有设置
      const settings = await this.getSettings(true);
      
      // 触发设置更新事件，通知其他组件
      this.emit('settingsUpdated', validatedUpdates);
      
      // 特定设置的处理
      await this.handleSpecialSettings(validatedUpdates);
      
      logger.info('系统设置已更新:', Object.keys(validatedUpdates));
      
      return settings;
    } catch (error) {
      logger.error('更新系统设置失败:', error);
      throw error;
    }
  }
  
  /**
   * 获取设置描述
   */
  getSettingDescription(key) {
    const descriptions = {
      daily_load_time: '每日自动加载提醒计划的时间',
      max_retry_count: '消息发送失败时的最大重试次数',
      retry_interval: '消息发送重试的间隔时间（秒）',
      task_timeout: '任务执行超时时间（秒）',
      max_concurrent_tasks: '最大并发执行任务数',
      failure_notification_enabled: '是否启用任务失败通知',
      history_retention_days: '历史记录保留天数',
      log_retention_days: '日志文件保留天数',
      auto_cleanup_enabled: '是否启用自动清理',
      cleanup_time: '自动清理执行时间',
      system_error_notification: '系统错误通知开关',
      task_failure_notification: '任务失败通知开关',
      daily_report_enabled: '是否启用每日统计报告',
      daily_report_time: '每日统计报告发送时间',
      notification_webhook: '系统通知专用Webhook（可选）'
    };
    return descriptions[key] || key;
  }

  /**
   * 获取单个设置值
   */
  async getSetting(key) {
    try {
      const settings = await this.getSettings();
      return settings[key];
    } catch (error) {
      logger.error(`获取设置 ${key} 失败:`, error);
      throw error;
    }
  }

  /**
   * 批量获取设置值
   */
  async getMultipleSettings(keys) {
    try {
      const settings = await this.getSettings();
      const result = {};
      keys.forEach(key => {
        result[key] = settings[key];
      });
      return result;
    } catch (error) {
      logger.error('批量获取设置失败:', error);
      throw error;
    }
  }

  /**
   * 验证设置值
   */
  validateSettings(updates) {
    const validated = {};
    
    Object.keys(updates).forEach(key => {
      const value = updates[key];
      
      switch (key) {
        case 'daily_load_time':
        case 'cleanup_time':
        case 'daily_report_time':
          // 验证时间格式 HH:mm
          if (/^([01]\d|2[0-3]):([0-5]\d)$/.test(value)) {
            validated[key] = value;
          } else {
            logger.warn(`无效的时间格式 ${key}: ${value}`);
          }
          break;
          
        case 'max_retry_count':
        case 'task_timeout':
        case 'max_concurrent_tasks':
        case 'history_retention_days':
        case 'log_retention_days':
          // 验证数字范围
          const num = parseInt(value);
          if (!isNaN(num) && num >= 0) {
            validated[key] = num;
          } else {
            logger.warn(`无效的数字值 ${key}: ${value}`);
          }
          break;
          
        case 'retry_interval':
          // 重试间隔至少10秒
          const interval = parseInt(value);
          if (!isNaN(interval) && interval >= 10) {
            validated[key] = interval;
          } else {
            logger.warn(`无效的重试间隔: ${value}`);
          }
          break;
          
        case 'failure_notification_enabled':
        case 'auto_cleanup_enabled':
        case 'system_error_notification':
        case 'task_failure_notification':
        case 'daily_report_enabled':
          // 验证布尔值
          validated[key] = Boolean(value);
          break;
          
        case 'notification_webhook':
          // 验证Webhook URL（可以为空）
          if (!value || value.startsWith('http')) {
            validated[key] = value;
          } else {
            logger.warn(`无效的Webhook URL: ${value}`);
          }
          break;
          
        default:
          // 其他字段直接通过
          validated[key] = value;
      }
    });
    
    return validated;
  }

  /**
   * 处理特殊设置（需要立即生效的设置）
   */
  async handleSpecialSettings(updates) {
    // 如果更新了调度相关的设置，通知调度器重新加载
    const schedulerSettings = [
      'daily_load_time',
      'max_retry_count',
      'retry_interval',
      'task_timeout',
      'max_concurrent_tasks'
    ];
    
    const hasSchedulerUpdate = Object.keys(updates).some(key => 
      schedulerSettings.includes(key)
    );
    
    if (hasSchedulerUpdate) {
      this.emit('schedulerSettingsUpdated', updates);
    }
    
    // 如果更新了清理策略，通知清理服务
    const cleanupSettings = [
      'history_retention_days',
      'log_retention_days',
      'auto_cleanup_enabled',
      'cleanup_time'
    ];
    
    const hasCleanupUpdate = Object.keys(updates).some(key => 
      cleanupSettings.includes(key)
    );
    
    if (hasCleanupUpdate) {
      this.emit('cleanupSettingsUpdated', updates);
    }
    
    // 如果更新了通知设置，验证Webhook
    if (updates.notification_webhook) {
      await this.testWebhook(updates.notification_webhook);
    }
  }

  /**
   * 测试Webhook连接
   */
  async testWebhook(webhook) {
    if (!webhook) return true;
    
    try {
      const axios = require('axios');
      const crypto = require('crypto');
      
      // 构造测试消息
      const timestamp = Date.now();
      const testMsg = {
        msgtype: 'text',
        text: {
          content: `[系统测试] 设置更新通知测试 - ${new Date().toLocaleString('zh-CN')}`
        }
      };
      
      // 如果有secret，计算签名
      const secret = process.env.DINGTALK_SECRET;
      if (secret) {
        const stringToSign = `${timestamp}\n${secret}`;
        const sign = crypto
          .createHmac('sha256', secret)
          .update(stringToSign)
          .digest('base64');
        
        const url = `${webhook}&timestamp=${timestamp}&sign=${encodeURIComponent(sign)}`;
        await axios.post(url, testMsg);
      } else {
        await axios.post(webhook, testMsg);
      }
      
      logger.info('Webhook测试成功');
      return true;
    } catch (error) {
      logger.error('Webhook测试失败:', error.message);
      return false;
    }
  }

  /**
   * 重置为默认设置
   */
  async resetToDefaults() {
    try {
      // 删除现有设置
      await Setting.deleteMany({});
      
      // 返回默认设置
      const settings = this.getDefaultSettings();
      
      // 清除缓存
      this.cachedSettings = settings;
      this.lastUpdate = Date.now();
      
      // 触发重置事件
      this.emit('settingsReset');
      
      logger.info('系统设置已重置为默认值');
      
      return settings;
    } catch (error) {
      logger.error('重置系统设置失败:', error);
      throw error;
    }
  }

  /**
   * 导出设置
   */
  async exportSettings() {
    try {
      const settings = await this.getSettings();
      
      // 移除敏感信息
      const exported = { ...settings.toObject() };
      delete exported._id;
      delete exported.__v;
      delete exported.createdAt;
      delete exported.updatedAt;
      delete exported.updated_by;
      
      return exported;
    } catch (error) {
      logger.error('导出设置失败:', error);
      throw error;
    }
  }

  /**
   * 导入设置
   */
  async importSettings(settingsData, userId = null) {
    try {
      // 验证导入的数据
      const validated = this.validateSettings(settingsData);
      
      // 更新设置
      const settings = await this.updateSettings(validated, userId);
      
      logger.info('设置导入成功');
      
      return settings;
    } catch (error) {
      logger.error('导入设置失败:', error);
      throw error;
    }
  }
}

// 创建单例实例
const settingsService = new SettingsService();

module.exports = settingsService;