/**
 * Cronicle调度器 - 完整实现
 * 基于内存的轻量级调度器，使用node-cron实现
 */

const cron = require('node-cron');
const logger = require('../utils/logger');
const dingTalkBot = require('./dingTalkBot');
const excelParser = require('./excelParser');
const scheduleRuleConverter = require('./scheduleRuleConverter');
const settingsService = require('./settingsService');
const path = require('path');

class CronicleScheduler {
  constructor() {
    this.jobs = new Map(); // 存储所有作业
    this.initialized = false;
    this.taskModel = null;
    this.fileModel = null;
    this.lastExecutionTime = null; // 记录最后执行时间
  }

  /**
   * 初始化调度器
   */
  async initialize(models = {}) {
    try {
      logger.info('🔧 Initializing Cronicle Scheduler...');
      
      // 设置数据模型
      this.taskModel = models.Task;
      this.fileModel = models.File;
      
      // 初始化系统作业
      await this.initializeSystemJobs();
      
      // 加载今天的任务
      await this.loadTodayTasks();
      
      this.initialized = true;
      logger.info('✅ Cronicle Scheduler initialized successfully');
      
      return true;
    } catch (error) {
      logger.error('Failed to initialize Cronicle Scheduler:', error);
      throw error;
    }
  }

  /**
   * 初始化系统作业
   */
  async initializeSystemJobs() {
    // 获取系统设置
    const settings = await settingsService.getSettings();
    
    // 每日加载任务（使用动态时间）
    const [loadHour, loadMinute] = (settings.daily_load_time || '02:00').split(':').map(Number);
    const dailyLoaderSchedule = `${loadMinute} ${loadHour} * * *`;
    
    const dailyLoaderJob = cron.schedule(dailyLoaderSchedule, async () => {
      logger.info('Running daily task loader...');
      await this.loadTodayTasks();
    }, {
      scheduled: true,
      timezone: 'Asia/Shanghai'
    });
    
    this.jobs.set('system:daily-loader', {
      type: 'system',
      schedule: dailyLoaderSchedule,
      job: dailyLoaderJob
    });

    // 数据清理作业（使用动态时间）
    if (settings.auto_cleanup_enabled) {
      const [cleanupHour, cleanupMinute] = (settings.cleanup_time || '03:00').split(':').map(Number);
      const cleanupSchedule = `${cleanupMinute} ${cleanupHour} * * *`;
      
      const cleanupJob = cron.schedule(cleanupSchedule, async () => {
        logger.info('Running data cleanup...');
        await this.cleanupExpiredData(settings);
      }, {
        scheduled: true,
        timezone: 'Asia/Shanghai'
      });
      
      this.jobs.set('system:cleanup', {
        type: 'system',
        schedule: cleanupSchedule,
        job: cleanupJob
      });
    }
    
    // 每日统计报告
    if (settings.daily_report_enabled) {
      const [reportHour, reportMinute] = (settings.daily_report_time || '09:00').split(':').map(Number);
      const reportSchedule = `${reportMinute} ${reportHour} * * *`;
      
      const reportJob = cron.schedule(reportSchedule, async () => {
        logger.info('Generating daily report...');
        await this.sendDailyReport(settings);
      }, {
        scheduled: true,
        timezone: 'Asia/Shanghai'
      });
      
      this.jobs.set('system:daily-report', {
        type: 'system',
        schedule: reportSchedule,
        job: reportJob
      });
    }

    // 监听设置更新事件
    settingsService.on('schedulerSettingsUpdated', async (updates) => {
      logger.info('调度器设置已更新，重新初始化系统作业...');
      await this.reinitializeSystemJobs();
    });

    logger.info('System jobs initialized with dynamic settings');
  }
  
  /**
   * 重新初始化系统作业
   */
  async reinitializeSystemJobs() {
    // 停止所有系统作业
    for (const [jobId, jobInfo] of this.jobs.entries()) {
      if (jobInfo.type === 'system') {
        jobInfo.job.stop();
        this.jobs.delete(jobId);
      }
    }
    
    // 重新初始化
    await this.initializeSystemJobs();
    
    // 重新加载今天的任务（当设置更新时立即生效）
    logger.info('设置更新后重新加载今日任务...');
    await this.loadTodayTasks();
  }

  /**
   * 加载今天需要执行的任务
   */
  async loadTodayTasks() {
    if (!this.taskModel) {
      logger.warn('Task model not initialized');
      return;
    }

    try {
      // 记录执行时间
      this.lastExecutionTime = new Date();
      
      // 清理所有非系统任务作业
      logger.info('Cleaning up existing task jobs before reloading...');
      for (const [key, jobInfo] of this.jobs.entries()) {
        // 只清理任务作业，保留系统作业
        if (jobInfo.type !== 'system') {
          if (jobInfo.job) {
            jobInfo.job.stop();
          }
          this.jobs.delete(key);
        }
      }
      
      // 获取所有活动任务
      const activeTasks = await this.taskModel.find({ 
        status: 'active' 
      }).populate('groupId').populate('fileConfig.fileId');

      const today = new Date();
      let loadedCount = 0;

      for (const task of activeTasks) {
        const shouldRun = await this.shouldTaskRunToday(task, today);
        if (shouldRun) {
          await this.scheduleTask(task);
          loadedCount++;
        }
      }

      logger.info(`Loaded ${loadedCount} tasks for today out of ${activeTasks.length} active tasks`);
      
      // 返回加载结果
      return {
        success: true,
        loadedCount,
        totalActive: activeTasks.length,
        timestamp: this.lastExecutionTime
      };
    } catch (error) {
      logger.error('Failed to load today tasks:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 判断任务今天是否应该执行
   */
  async shouldTaskRunToday(task, date = new Date()) {
    try {
      const rule = task.scheduleRule;
      if (!rule) return false;

      // 使用scheduleRuleChecker判断
      const checker = require('./scheduleRuleChecker');
      return await checker.shouldRunToday(rule, date);
    } catch (error) {
      logger.error(`Error checking if task ${task._id} should run today:`, error);
      return false;
    }
  }

  /**
   * 计算下次执行时间
   */
  async calculateNextRunTime(scheduleRule, checker, task) {
    try {
      if (!scheduleRule || !checker) return null;
      
      const now = new Date();
      const checkDate = new Date(now);
      
      // 对于工作表任务，需要特殊处理
      if (task && task.type === 'worksheet') {
        // 获取工作表任务的下次执行时间
        return await this.getWorksheetNextRunTime(task, scheduleRule, checker);
      }
      
      // 简单任务的计算逻辑
      // 尝试找到未来30天内的下次执行时间
      for (let i = 0; i < 30; i++) {
        checkDate.setDate(checkDate.getDate() + 1);
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

  /**
   * 获取工作表任务的下次执行时间
   */
  async getWorksheetNextRunTime(task, scheduleRule, checker) {
    try {
      const now = new Date();
      const today = new Date(now);
      today.setHours(0, 0, 0, 0);
      
      // 首先检查今天是否应该运行
      if (checker.shouldRunToday(scheduleRule, now)) {
        // 查找今天剩余的作业
        const todayJobs = [];
        for (const [jobId, jobInfo] of this.jobs.entries()) {
          if (jobInfo.taskId === task._id.toString() && jobInfo.type === 'worksheet') {
            const [hours, minutes] = jobInfo.time.split(':').map(Number);
            const jobTime = new Date(today);
            jobTime.setHours(hours, minutes, 0, 0);
            
            // 如果时间还没过，加入候选列表
            if (jobTime > now) {
              todayJobs.push(jobTime);
            }
          }
        }
        
        // 如果今天还有任务，返回最近的一个
        if (todayJobs.length > 0) {
          todayJobs.sort((a, b) => a - b);
          return todayJobs[0];
        }
      }
      
      // 查找未来30天内下一个运行日
      const checkDate = new Date(today);
      for (let i = 1; i <= 30; i++) {
        checkDate.setDate(checkDate.getDate() + 1);
        if (checker.shouldRunToday(scheduleRule, checkDate)) {
          // 对于工作表任务，返回那天的第一个任务时间
          // 这里我们暂时返回那天的早上时间，实际执行时会从Excel加载
          checkDate.setHours(0, 0, 0, 0);
          
          // 尝试获取工作表中的第一个时间
          const firstTime = await this.getFirstWorksheetTime(task);
          if (firstTime) {
            const [hours, minutes] = firstTime.split(':').map(Number);
            checkDate.setHours(hours, minutes, 0, 0);
          }
          
          return checkDate;
        }
      }
      
      return null;
    } catch (error) {
      logger.error('获取工作表任务下次执行时间失败:', error);
      return null;
    }
  }

  /**
   * 获取工作表中的第一个时间
   */
  async getFirstWorksheetTime(task) {
    try {
      if (!task.fileConfig || !task.fileConfig.fileId) {
        return null;
      }

      const file = await this.fileModel.findById(task.fileConfig.fileId);
      if (!file) {
        return null;
      }

      const filePath = path.resolve(file.filePath || file.path);
      const parseResult = await excelParser.parseFile(filePath);
      const worksheetData = parseResult.worksheets[task.fileConfig.worksheet];
      
      if (!worksheetData || worksheetData.length === 0) {
        return null;
      }

      // 过滤已过期的提醒并排序
      const currentDate = new Date();
      const filteredData = excelParser.filterExpiredReminders(worksheetData, currentDate);
      
      if (filteredData.length > 0 && filteredData[0].time) {
        return filteredData[0].time;
      }
      
      return null;
    } catch (error) {
      logger.error('获取工作表第一个时间失败:', error);
      return null;
    }
  }

  /**
   * 调度单个任务
   */
  async scheduleTask(task) {
    try {
      const taskId = task._id.toString();
      
      // 如果任务已存在，先取消
      await this.cancelTask(taskId);

      // 检查任务是否被覆盖（仅用于日志记录，实际检查在执行时进行）
      const taskAssociationService = require('./taskAssociationService');
      const today = new Date();
      const executionStatus = await taskAssociationService.shouldTaskExecute(taskId, today);
      
      if (!executionStatus.shouldExecute && executionStatus.reason === 'suppressed') {
        logger.info(`任务 ${taskId} (${task.name}) 当前被覆盖，将跳过执行。覆盖任务: ${executionStatus.suppressedBy?.name}`);
      }

      if (task.type === 'worksheet') {
        // 工作表任务
        await this.scheduleWorksheetTask(task);
      } else {
        // 简单任务
        await this.scheduleSimpleTask(task);
      }

      // 更新任务的下次执行时间
      const scheduleRuleChecker = require('./scheduleRuleChecker');
      const nextRunAt = await this.calculateNextRunTime(task.scheduleRule, scheduleRuleChecker, task);
      if (nextRunAt && this.taskModel) {
        await this.taskModel.findByIdAndUpdate(taskId, { nextRunAt });
      }
      
      logger.info(`Task ${taskId} scheduled successfully`);
      return true;
    } catch (error) {
      logger.error(`Failed to schedule task ${task._id}:`, error);
      throw error;
    }
  }

  /**
   * 调度简单任务
   */
  async scheduleSimpleTask(task) {
    const taskId = task._id.toString();
    const { scheduleRule, groupId } = task;

    // 转换为cron表达式
    const cronExpression = this.convertToCronExpression(scheduleRule);
    if (!cronExpression) {
      logger.warn(`Cannot convert schedule rule to cron for task ${taskId}`);
      return;
    }

    // 创建cron作业
    const job = cron.schedule(cronExpression, async () => {
      // 在执行前检查任务是否应该在今天执行（考虑年间隔等规则）
      const shouldRun = await this.shouldTaskRunToday(task);
      if (shouldRun) {
        await this.executeSimpleTask(task);
      } else {
        logger.debug(`Task ${taskId} skipped - not scheduled for today based on year interval or other rules`);
      }
    }, {
      scheduled: true,
      timezone: 'Asia/Shanghai'
    });

    this.jobs.set(`task:${taskId}`, {
      type: 'simple',
      taskId,
      schedule: cronExpression,
      job
    });
  }

  /**
   * 调度工作表任务
   */
  async scheduleWorksheetTask(task) {
    const taskId = task._id.toString();
    const { fileConfig, groupId } = task;

    if (!fileConfig || !fileConfig.fileId) {
      logger.warn(`Task ${taskId} has no file configuration`);
      return;
    }

    try {
      // 获取文件信息
      const file = await this.fileModel.findById(fileConfig.fileId);
      if (!file) {
        logger.warn(`File not found for task ${taskId}`);
        return;
      }

      // 解析Excel文件
      const filePath = path.resolve(file.filePath || file.path);
      const parseResult = await excelParser.parseFile(filePath);
      const worksheetData = parseResult.worksheets[fileConfig.worksheet];
      
      if (!worksheetData || worksheetData.length === 0) {
        logger.warn(`No data found in worksheet ${fileConfig.worksheet} for task ${taskId}`);
        return;
      }

      // 智能时间过滤：过滤掉已过期的提醒
      const currentDate = new Date();
      const filteredData = excelParser.filterExpiredReminders(worksheetData, currentDate);
      
      if (filteredData.length === 0) {
        logger.warn(`All reminders in worksheet ${fileConfig.worksheet} for task ${taskId} have expired`);
        return;
      }
      
      const expiredCount = worksheetData.length - filteredData.length;
      if (expiredCount > 0) {
        logger.info(`Filtered out ${expiredCount} expired reminders for task ${taskId}`);
      }

      // 为每个未过期的时间点创建作业
      for (const row of filteredData) {
        const { time, message } = row;
        if (!time || !message) continue;

        // 解析时间
        const [hours, minutes] = time.split(':').map(Number);
        const cronExpression = `${minutes} ${hours} * * *`;

        const jobId = `worksheet:${taskId}:${time.replace(/:/g, '')}`;
        
        // 创建cron作业
        const job = cron.schedule(cronExpression, async () => {
          await this.executeWorksheetTask(task, message, time);
        }, {
          scheduled: true,
          timezone: 'Asia/Shanghai'
        });

        this.jobs.set(jobId, {
          type: 'worksheet',
          taskId,
          time,
          message,
          schedule: cronExpression,
          job
        });
      }

      logger.info(`Scheduled ${filteredData.length} jobs (out of ${worksheetData.length} total) for worksheet task ${taskId}`);
    } catch (error) {
      logger.error(`Failed to schedule worksheet task ${taskId}:`, error);
    }
  }

  /**
   * 执行简单任务（带重试机制）
   */
  async executeSimpleTask(task) {
    const taskId = task._id.toString();
    
    // 检查任务是否被覆盖
    const taskAssociationService = require('./taskAssociationService');
    const executionStatus = await taskAssociationService.shouldTaskExecute(taskId, new Date());
    
    if (!executionStatus.shouldExecute && executionStatus.reason === 'suppressed') {
      logger.info(`任务 ${task.name} (ID: ${taskId}) 被覆盖，跳过执行。覆盖任务: ${executionStatus.suppressedBy?.name}`);
      
      // 记录被覆盖的执行历史
      await this.updateExecutionRecord(task._id, false, '任务被覆盖，未执行');
      return; // 直接返回，不执行
    }
    
    const settings = await settingsService.getSettings();
    const maxRetries = settings.max_retry_count || 3;
    const retryInterval = settings.retry_interval || 300; // 秒
    
    let retryCount = 0;
    let success = false;
    let lastError = null;
    
    while (!success && retryCount <= maxRetries) {
      try {
        const { name, messageContent, groupId } = task;
        
        if (retryCount > 0) {
          logger.info(`重试执行任务 ${name} (第 ${retryCount} 次重试)`);
        } else {
          logger.info(`Executing simple task: ${name}`);
        }
        
        this.lastExecutionTime = new Date().toISOString(); // 记录执行时间
        logger.info(`Message content: ${messageContent}`);
        logger.info(`GroupId type: ${typeof groupId}, has webhookUrl: ${groupId?.webhookUrl ? 'yes' : 'no'}`);
        
        // 发送钉钉消息
        if (groupId && groupId.webhookUrl) {
          await dingTalkBot.sendMessage(
            groupId.webhookUrl,
            messageContent || `任务提醒: ${name}`,
            {
              secret: groupId.secret,
              groupId: groupId._id,
              timeout: settings.task_timeout * 1000 || 30000 // 使用任务超时设置
            }
          );
        }
        
        // 更新执行记录和时间
        await this.updateExecutionRecord(task._id, true);
        
        // 更新最后执行时间和下次执行时间
        if (this.taskModel) {
          const scheduleRuleChecker = require('./scheduleRuleChecker');
          const nextRunAt = await this.calculateNextRunTime(task.scheduleRule, scheduleRuleChecker, task);
          await this.taskModel.findByIdAndUpdate(taskId, { 
            lastRunAt: new Date(),
            nextRunAt
          });
        }
        
        success = true;
        logger.info(`任务 ${task.name} 执行成功`);
        
      } catch (error) {
        lastError = error;
        retryCount++;
        
        if (retryCount <= maxRetries) {
          logger.warn(`任务 ${task.name} 执行失败，将在 ${retryInterval} 秒后重试 (${retryCount}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, retryInterval * 1000));
        } else {
          logger.error(`任务 ${task.name} 执行失败，已达到最大重试次数`, error);
        }
      }
    }
    
    if (!success) {
      // 发送失败通知（如果启用）
      const settings = await settingsService.getSettings();
      if (settings.task_failure_notification) {
        const webhook = settings.notification_webhook || process.env.DINGTALK_WEBHOOK;
        if (webhook) {
          const failureMessage = `
【任务执行失败通知】
任务名称：${task.name}
失败时间：${new Date().toLocaleString('zh-CN')}
重试次数：${maxRetries}
错误信息：${lastError?.message || '未知错误'}
          `.trim();
          
          try {
            await dingTalkBot.sendMessage(webhook, failureMessage);
          } catch (notifyError) {
            logger.error('发送失败通知时出错:', notifyError);
          }
        }
      }
      
      await this.updateExecutionRecord(task._id, false, lastError?.message);
    }
  }

  /**
   * 执行工作表任务
   */
  async executeWorksheetTask(task, message, time) {
    try {
      const taskId = task._id.toString();
      const { name, groupId } = task;
      
      // 检查任务是否被覆盖
      const taskAssociationService = require('./taskAssociationService');
      const executionStatus = await taskAssociationService.shouldTaskExecute(taskId, new Date());
      
      if (!executionStatus.shouldExecute && executionStatus.reason === 'suppressed') {
        logger.info(`工作表任务 ${name} (ID: ${taskId}, 时间: ${time}) 被覆盖，跳过执行。覆盖任务: ${executionStatus.suppressedBy?.name}`);
        
        // 记录被覆盖的执行历史
        await this.updateExecutionRecord(task._id, false, '任务被覆盖，未执行', { time, message });
        return; // 直接返回，不执行
      }
      
      logger.info(`Executing worksheet task: ${name} at ${time}`);
      this.lastExecutionTime = new Date().toISOString(); // 记录执行时间
      logger.info(`Task groupId type: ${typeof groupId}, value:`, groupId);
      
      // 调试：检查groupId的详细信息
      if (groupId) {
        logger.info(`GroupId fields: _id=${groupId._id}, webhookUrl=${groupId.webhookUrl ? 'exists' : 'missing'}, secret=${groupId.secret ? 'exists' : 'missing'}`);
      } else {
        logger.warn(`GroupId is null or undefined for task ${task._id}`);
      }
      
      // 发送钉钉消息
      if (groupId && groupId.webhookUrl) {
        await dingTalkBot.sendMessage(
          groupId.webhookUrl,
          message,
          {
            secret: groupId.secret,
            groupId: groupId._id
          }
        );
      }
      
      // 更新执行记录
      await this.updateExecutionRecord(task._id, true, null, { time, message });
      
      // 更新最后执行时间
      if (this.taskModel) {
        await this.taskModel.findByIdAndUpdate(task._id, { 
          lastRunAt: new Date()
        });
      }
    } catch (error) {
      logger.error(`Failed to execute worksheet task ${task._id} at ${time}:`, error);
      await this.updateExecutionRecord(task._id, false, error.message, { time });
    }
  }

  /**
   * 更新执行记录
   */
  async updateExecutionRecord(taskId, success, error = null, metadata = {}) {
    try {
      if (!this.taskModel) return;

      const update = {
        lastExecutedAt: new Date(),
        lastExecutionStatus: success ? 'sent' : 'failed',
        $inc: { executionCount: 1 }
      };

      if (success) {
        update.$inc.successCount = 1;
      } else {
        update.$inc.failureCount = 1;
        update.lastError = error;
      }

      await this.taskModel.findByIdAndUpdate(taskId, update);
    } catch (err) {
      logger.error(`Failed to update execution record for task ${taskId}:`, err);
    }
  }

  /**
   * 转换调度规则为cron表达式
   */
  convertToCronExpression(scheduleRule) {
    try {
      if (!scheduleRule) return null;

      const { ruleType, dayMode, weekMode, intervalMode, executionTimes, months } = scheduleRule;
      
      // 获取执行时间
      const time = executionTimes && executionTimes[0] ? executionTimes[0] : '09:00';
      const [hours, minutes] = time.split(':').map(Number);

      // 处理年间隔的特殊情况
      // 注意：对于年间隔=0（今年执行）的任务，cron表达式只是作为今年的调度
      // shouldTaskRunToday 方法会根据年间隔决定是否执行
      
      // 处理月份限制
      const monthStr = months && months.length > 0 ? months.join(',') : '*';

      switch (ruleType) {
        case 'by_day':
          if (dayMode && dayMode.type === 'specific_days' && dayMode.days) {
            // 特定日期
            const days = dayMode.days.join(',');
            return `${minutes} ${hours} ${days} ${monthStr} *`;
          } else {
            // 每天
            return `${minutes} ${hours} * ${monthStr} *`;
          }
          
        case 'by_week':
          if (weekMode && weekMode.weekdays) {
            // 特定星期
            const weekdays = weekMode.weekdays.join(',');
            return `${minutes} ${hours} * ${monthStr} ${weekdays}`;
          }
          break;
          
        case 'by_interval':
          // 间隔任务
          // 对于带年间隔的任务，我们仍然创建常规的cron表达式
          // 但是执行时会通过 shouldTaskRunToday 来判断是否真的执行
          if (intervalMode && intervalMode.unit === 'days') {
            // 每天检查，但实际执行由 shouldTaskRunToday 决定
            return `${minutes} ${hours} * ${monthStr} *`;
          } else if (intervalMode && intervalMode.unit === 'weeks') {
            // 每周检查
            return `${minutes} ${hours} * ${monthStr} 0`; // 周日
          } else if (intervalMode && intervalMode.unit === 'months') {
            // 每月检查
            return `${minutes} ${hours} 1 ${monthStr} *`; // 每月1号
          } else {
            // 默认每天检查
            return `${minutes} ${hours} * ${monthStr} *`;
          }
          
        default:
          // 默认每天执行，具体是否执行由 shouldTaskRunToday 决定
          return `${minutes} ${hours} * ${monthStr} *`;
      }
    } catch (error) {
      logger.error('Error converting schedule rule to cron:', error);
      return null;
    }
  }

  /**
   * 取消任务
   */
  async cancelTask(taskId) {
    const taskIdStr = taskId.toString();
    
    // 取消所有相关作业
    for (const [key, jobInfo] of this.jobs.entries()) {
      if (key.includes(taskIdStr)) {
        try {
          jobInfo.job.stop();
          this.jobs.delete(key);
          logger.info(`Cancelled job: ${key}`);
        } catch (error) {
          logger.error(`Failed to cancel job ${key}:`, error);
        }
      }
    }
    
    return true;
  }

  /**
   * 清理过期作业
   */
  async cleanupExpiredJobs() {
    try {
      let cleanedCount = 0;
      
      for (const [key, jobInfo] of this.jobs.entries()) {
        // 跳过系统作业
        if (jobInfo.type === 'system') continue;
        
        // 检查任务是否还存在且活动
        if (jobInfo.taskId) {
          const task = await this.taskModel.findById(jobInfo.taskId);
          if (!task || task.status !== 'active') {
            jobInfo.job.stop();
            this.jobs.delete(key);
            cleanedCount++;
          }
        }
      }
      
      logger.info(`Cleaned up ${cleanedCount} expired jobs`);
    } catch (error) {
      logger.error('Failed to cleanup expired jobs:', error);
    }
  }

  /**
   * 获取详细的作业列表
   */
  async getDetailedJobs() {
    try {
      const detailedJobs = [];
      
      for (const [key, jobInfo] of this.jobs.entries()) {
        let taskDetails = null;
        let groupDetails = null;
        
        // 获取任务详情
        if (jobInfo.taskId) {
          try {
            const task = await this.taskModel.findById(jobInfo.taskId)
              .populate('groupId', 'name webhookUrl');
            
            if (task) {
              taskDetails = {
                id: task._id,
                name: task.name,
                type: task.type,
                status: task.status,
                priority: task.priority,
                messageContent: task.messageContent ? 
                  task.messageContent.substring(0, 100) + '...' : null,
                lastRunAt: task.lastRunAt,
                nextRunAt: task.nextRunAt
              };
              
              if (task.groupId) {
                groupDetails = {
                  id: task.groupId._id,
                  name: task.groupId.name,
                  webhookUrl: task.groupId.webhookUrl ? 
                    task.groupId.webhookUrl.substring(0, 50) + '...' : null
                };
              }
            }
          } catch (error) {
            logger.error(`获取任务详情失败 ${jobInfo.taskId}:`, error);
          }
        }
        
        // 构建详细作业信息
        detailedJobs.push({
          id: key,
          type: jobInfo.type,
          status: jobInfo.job ? 'active' : 'inactive',
          schedule: jobInfo.schedule,
          time: jobInfo.time,
          cron: jobInfo.cron || null,
          task: taskDetails,
          group: groupDetails,
          message: jobInfo.message ? 
            jobInfo.message.substring(0, 100) + '...' : null,
          createdAt: jobInfo.createdAt || this.lastLoadTime,
          nextRun: jobInfo.job && jobInfo.job.nextInvocation ? 
            jobInfo.job.nextInvocation() : null
        });
      }
      
      // 按类型和时间排序
      detailedJobs.sort((a, b) => {
        // 首先按类型排序：system > simple > worksheet
        const typeOrder = { system: 0, simple: 1, worksheet: 2 };
        const typeCompare = (typeOrder[a.type] || 3) - (typeOrder[b.type] || 3);
        if (typeCompare !== 0) return typeCompare;
        
        // 然后按时间排序
        if (a.time && b.time) {
          return a.time.localeCompare(b.time);
        }
        return 0;
      });
      
      return detailedJobs;
    } catch (error) {
      logger.error('获取详细作业列表失败:', error);
      throw error;
    }
  }

  /**
   * 获取调度器状态
   */
  getStatus() {
    const jobsByType = {};
    
    for (const [key, jobInfo] of this.jobs.entries()) {
      const type = jobInfo.type || 'unknown';
      jobsByType[type] = (jobsByType[type] || 0) + 1;
    }
    
    // 获取下次执行时间 - 特别是系统作业的下次执行时间
    let nextExecutionTime = null;
    let earliestTime = null;
    
    // 查找系统每日加载任务的下次执行时间
    const dailyLoaderJob = this.jobs.get('system:daily-loader');
    if (dailyLoaderJob && dailyLoaderJob.schedule) {
      // 从cron表达式计算下次执行时间（北京时间）
      const [minute, hour] = dailyLoaderJob.schedule.split(' ');
      const next = new Date();
      next.setHours(parseInt(hour), parseInt(minute), 0, 0);
      
      // 如果今天的时间已过，则设置为明天
      if (next <= new Date()) {
        next.setDate(next.getDate() + 1);
      }
      
      // 格式化为北京时间字符串
      const year = next.getFullYear();
      const month = String(next.getMonth() + 1).padStart(2, '0');
      const day = String(next.getDate()).padStart(2, '0');
      const hours = String(next.getHours()).padStart(2, '0');
      const minutes = String(next.getMinutes()).padStart(2, '0');
      nextExecutionTime = `${year}-${month}-${day} ${hours}:${minutes}`;
    }
    
    // 如果没有每日加载任务，查找其他任务的最早执行时间
    if (!nextExecutionTime) {
      for (const [key, jobInfo] of this.jobs.entries()) {
        if (jobInfo.time) {
          const jobTime = new Date(jobInfo.time);
          if (!earliestTime || jobTime < earliestTime) {
            earliestTime = jobTime;
            nextExecutionTime = jobInfo.time;
          }
        }
      }
    }
    
    // 格式化最后执行时间
    let formattedLastExecutionTime = null;
    if (this.lastExecutionTime) {
      const last = new Date(this.lastExecutionTime);
      const year = last.getFullYear();
      const month = String(last.getMonth() + 1).padStart(2, '0');
      const day = String(last.getDate()).padStart(2, '0');
      const hours = String(last.getHours()).padStart(2, '0');
      const minutes = String(last.getMinutes()).padStart(2, '0');
      const seconds = String(last.getSeconds()).padStart(2, '0');
      formattedLastExecutionTime = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    }
    
    return {
      initialized: this.initialized,
      running: this.initialized,  // 兼容前端期望的字段
      totalJobs: this.jobs.size,
      tasksCount: this.jobs.size, // 兼容前端期望的字段
      jobsByType,
      uptime: process.uptime(),
      nextExecutionTime,
      lastExecutionTime: formattedLastExecutionTime
    };
  }
  
  /**
   * 获取详细的作业列表
   */
  async getDetailedJobs() {
    const jobs = [];
    const taskAssociationService = require('./taskAssociationService');
    const today = new Date();
    
    for (const [key, jobInfo] of this.jobs.entries()) {
      let taskDetails = null;
      let isSuppressed = false;
      let suppressedBy = null;
      
      // 如果有taskId，获取任务详情
      if (jobInfo.taskId && this.taskModel) {
        try {
          const task = await this.taskModel.findById(jobInfo.taskId)
            .populate('groupId', 'name webhookUrl')
            .populate('fileConfig.fileId', 'originalName');
            
          if (task) {
            // 检查任务是否被覆盖
            const executionStatus = await taskAssociationService.shouldTaskExecute(jobInfo.taskId, today);
            isSuppressed = !executionStatus.shouldExecute && executionStatus.reason === 'suppressed';
            suppressedBy = executionStatus.suppressedBy;
            
            taskDetails = {
              id: task._id,
              name: task.name,
              type: task.type,
              status: task.status,
              priority: task.priority,  // 添加优先级字段
              groupName: task.groupId?.name || '未知群组',
              fileName: task.fileConfig?.fileId?.originalName || null,
              worksheet: task.fileConfig?.worksheet || null,
              messageContent: task.messageContent,
              scheduleRule: task.scheduleRule,
              lastRunAt: task.lastRunAt,
              nextRunAt: task.nextRunAt,
              createdAt: task.createdAt,
              // 添加覆盖状态信息
              isSuppressed: isSuppressed,
              suppressedBy: suppressedBy
            };
          }
        } catch (error) {
          logger.error(`获取任务详情失败 ${jobInfo.taskId}:`, error);
        }
      }
      
      // 解析cron表达式获取下次执行时间
      let nextRun = null;
      if (jobInfo.schedule && jobInfo.type !== 'worksheet') {
        try {
          const cronJob = cron.schedule(jobInfo.schedule, () => {}, { 
            scheduled: false,
            timezone: 'Asia/Shanghai'
          });
          // 这里可以添加计算下次执行时间的逻辑
          nextRun = jobInfo.time || null;
        } catch (error) {
          // 忽略解析错误
        }
      }
      
      jobs.push({
        id: key,
        type: jobInfo.type,
        taskId: jobInfo.taskId,
        schedule: jobInfo.schedule,
        time: jobInfo.time,
        message: jobInfo.message,
        nextRun: nextRun,
        taskDetails: taskDetails,
        status: this.getJobStatus(jobInfo),
        createdAt: jobInfo.createdAt || null,
        // 添加覆盖状态信息
        isSuppressed: isSuppressed,
        suppressedBy: suppressedBy
      });
    }
    
    // 按类型和时间排序
    jobs.sort((a, b) => {
      // 系统作业优先
      if (a.type === 'system' && b.type !== 'system') return -1;
      if (a.type !== 'system' && b.type === 'system') return 1;
      
      // 按时间排序
      if (a.time && b.time) {
        return new Date(a.time) - new Date(b.time);
      }
      
      return 0;
    });
    
    return {
      total: jobs.length,
      jobs: jobs,
      summary: {
        system: jobs.filter(j => j.type === 'system').length,
        simple: jobs.filter(j => j.type === 'simple').length,
        worksheet: jobs.filter(j => j.type === 'worksheet').length,
        active: jobs.filter(j => j.status === 'active').length,
        pending: jobs.filter(j => j.status === 'pending').length
      }
    };
  }
  
  /**
   * 获取作业状态
   */
  getJobStatus(jobInfo) {
    if (!jobInfo.job) return 'stopped';
    
    // 检查作业是否正在运行
    // node-cron没有直接的运行状态，我们根据类型判断
    if (jobInfo.type === 'system') {
      return 'active'; // 系统作业始终活动
    }
    
    // 检查是否过期
    if (jobInfo.time) {
      const jobTime = new Date(jobInfo.time);
      const now = new Date();
      if (jobTime < now) {
        return 'expired';
      }
    }
    
    return 'active';
  }

  /**
   * 停止调度器
   */
  async stop() {
    logger.info('Stopping Cronicle Scheduler...');
    
    // 停止所有作业
    for (const [key, jobInfo] of this.jobs.entries()) {
      try {
        jobInfo.job.stop();
      } catch (error) {
        logger.error(`Failed to stop job ${key}:`, error);
      }
    }
    
    this.jobs.clear();
    this.initialized = false;
    
    logger.info('Cronicle Scheduler stopped');
  }

  /**
   * 清理过期数据
   */
  async cleanupExpiredData(settings) {
    try {
      const now = new Date();
      
      // 清理历史记录
      if (settings.history_retention_days > 0) {
        const historyExpireDate = new Date(now);
        historyExpireDate.setDate(historyExpireDate.getDate() - settings.history_retention_days);
        
        // 这里添加清理历史记录的逻辑
        logger.info(`清理 ${settings.history_retention_days} 天前的历史记录`);
      }
      
      // 清理日志文件
      if (settings.log_retention_days > 0) {
        const logExpireDate = new Date(now);
        logExpireDate.setDate(logExpireDate.getDate() - settings.log_retention_days);
        
        // 这里添加清理日志文件的逻辑
        logger.info(`清理 ${settings.log_retention_days} 天前的日志文件`);
      }
      
      // 清理过期作业
      await this.cleanupExpiredJobs();
      
    } catch (error) {
      logger.error('清理过期数据失败:', error);
    }
  }
  
  /**
   * 发送每日统计报告
   */
  async sendDailyReport(settings) {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      // 统计今日任务执行情况
      const stats = {
        totalTasks: 0,
        successfulTasks: 0,
        failedTasks: 0,
        pendingTasks: 0
      };
      
      // 这里添加统计逻辑
      
      // 构建报告消息
      const reportMessage = `
【每日任务执行报告】
日期：${today.toLocaleDateString('zh-CN')}

📊 执行统计：
• 总任务数：${stats.totalTasks}
• 成功执行：${stats.successfulTasks}
• 执行失败：${stats.failedTasks}
• 待执行：${stats.pendingTasks}

✅ 执行成功率：${stats.totalTasks > 0 ? ((stats.successfulTasks / stats.totalTasks) * 100).toFixed(2) : 0}%
      `.trim();
      
      // 发送报告
      const webhook = settings.notification_webhook || process.env.DINGTALK_WEBHOOK;
      if (webhook) {
        await dingTalkBot.sendMessage(reportMessage, webhook);
        logger.info('每日统计报告已发送');
      }
      
    } catch (error) {
      logger.error('发送每日统计报告失败:', error);
    }
  }
  
  /**
   * 手动执行任务（用于测试）
   */
  async executeTaskManually(taskId) {
    try {
      const task = await this.taskModel.findById(taskId).populate('groupId').populate('fileConfig.fileId');
      
      if (!task) {
        throw new Error('Task not found');
      }
      
      if (task.type === 'worksheet') {
        // 执行工作表任务的第一个时间点
        const file = await this.fileModel.findById(task.fileConfig.fileId);
        const filePath = path.resolve(file.filePath);
        const worksheetData = await excelParser.parseWorksheet(filePath, task.fileConfig.worksheet);
        
        if (worksheetData && worksheetData.length > 0) {
          const { time, message } = worksheetData[0];
          await this.executeWorksheetTask(task, message, time);
        }
      } else {
        await this.executeSimpleTask(task);
      }
      
      return { success: true, message: 'Task executed successfully' };
    } catch (error) {
      logger.error(`Failed to execute task manually: ${taskId}`, error);
      throw error;
    }
  }
}

// 创建单例实例
const cronicleScheduler = new CronicleScheduler();

module.exports = cronicleScheduler;