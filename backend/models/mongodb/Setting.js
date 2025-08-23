const mongoose = require('mongoose');

const settingSchema = new mongoose.Schema({
  // 基础设置
  daily_load_time: {
    type: String,
    default: '02:00',
    description: '每日自动加载提醒计划的时间'
  },
  
  // 任务执行配置
  max_retry_count: {
    type: Number,
    default: 3,
    min: 0,
    max: 10,
    description: '消息发送失败时的最大重试次数'
  },
  retry_interval: {
    type: Number,
    default: 300,
    min: 10,
    max: 3600,
    description: '消息发送重试的间隔时间（秒）'
  },
  task_timeout: {
    type: Number,
    default: 30,
    min: 5,
    max: 300,
    description: '任务执行超时时间（秒）'
  },
  max_concurrent_tasks: {
    type: Number,
    default: 10,
    min: 1,
    max: 50,
    description: '最大并发执行任务数'
  },
  failure_notification_enabled: {
    type: Boolean,
    default: true,
    description: '是否启用任务失败通知'
  },
  
  // 数据保留策略
  history_retention_days: {
    type: Number,
    default: 90,
    min: 7,
    max: 365,
    description: '历史记录保留天数'
  },
  log_retention_days: {
    type: Number,
    default: 30,
    min: 7,
    max: 90,
    description: '日志文件保留天数'
  },
  auto_cleanup_enabled: {
    type: Boolean,
    default: true,
    description: '是否启用自动清理'
  },
  cleanup_time: {
    type: String,
    default: '03:00',
    description: '自动清理执行时间'
  },
  
  // 系统通知设置
  system_error_notification: {
    type: Boolean,
    default: true,
    description: '系统错误通知开关'
  },
  task_failure_notification: {
    type: Boolean,
    default: true,
    description: '任务失败通知开关'
  },
  daily_report_enabled: {
    type: Boolean,
    default: false,
    description: '是否启用每日统计报告'
  },
  daily_report_time: {
    type: String,
    default: '09:00',
    description: '每日统计报告发送时间'
  },
  notification_webhook: {
    type: String,
    default: '',
    description: '系统通知专用Webhook（可选）'
  },
  
  // 元数据
  updated_at: {
    type: Date,
    default: Date.now
  },
  updated_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true,
  collection: 'settings'
});

// 确保只有一条设置记录
settingSchema.statics.getSettings = async function() {
  let settings = await this.findOne();
  if (!settings) {
    settings = await this.create({});
  }
  return settings;
};

// 更新设置
settingSchema.statics.updateSettings = async function(updates, userId = null) {
  const settings = await this.getSettings();
  
  Object.keys(updates).forEach(key => {
    if (settingSchema.obj[key] !== undefined) {
      settings[key] = updates[key];
    }
  });
  
  settings.updated_at = new Date();
  if (userId) {
    settings.updated_by = userId;
  }
  
  await settings.save();
  return settings;
};

// 获取特定设置值
settingSchema.statics.getSetting = async function(key) {
  const settings = await this.getSettings();
  return settings[key];
};

// 批量获取设置值
settingSchema.statics.getMultipleSettings = async function(keys) {
  const settings = await this.getSettings();
  const result = {};
  keys.forEach(key => {
    result[key] = settings[key];
  });
  return result;
};

// 检查模型是否已经存在，避免重复定义
module.exports = mongoose.models.Setting || mongoose.model('Setting', settingSchema);