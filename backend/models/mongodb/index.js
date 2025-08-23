/**
 * MongoDB 数据模型定义
 * 使用Mongoose ODM简化MongoDB操作
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const logger = require('../../utils/logger');

// MongoDB连接配置
const mongoUrl = process.env.MONGODB_URL || 'mongodb://admin:admin123456@localhost:27018/dingtalk-scheduler?authSource=admin';

// 连接选项 (MongoDB 4.0+不需要useNewUrlParser和useUnifiedTopology)
const mongoOptions = {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
};

// 建立连接
mongoose.connect(mongoUrl, mongoOptions)
    .then(() => logger.info('MongoDB连接成功'))
    .catch(err => logger.error('MongoDB连接失败:', err));

// 监听连接事件
mongoose.connection.on('error', err => {
    logger.error('MongoDB连接错误:', err);
});

mongoose.connection.on('disconnected', () => {
    logger.warn('MongoDB连接断开');
});

// 1. 用户模型
const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    password: {
        type: String,
        required: true
    },
    role: {
        type: String,
        enum: ['admin', 'user'],
        default: 'user'
    },
    email: {
        type: String,
        trim: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// 密码加密中间件
userSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    
    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

// 更新时间中间件
userSchema.pre('save', function(next) {
    this.updatedAt = new Date();
    next();
});

// 密码验证方法
userSchema.methods.comparePassword = async function(candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

// 2. 群组模型
const groupSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    description: String,
    webhookUrl: {
        type: String,
        required: true
    },
    secret: String,
    status: {
        type: String,
        enum: ['active', 'inactive'],
        default: 'active'
    },
    groupType: {
        type: String,
        enum: ['regular', 'custom'],
        default: 'regular'
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    lastSendTime: Date,
    sendCount: {
        type: Number,
        default: 0
    },
    failCount: {
        type: Number,
        default: 0
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

groupSchema.pre('save', function(next) {
    this.updatedAt = new Date();
    next();
});

// 3. 任务模型
const taskSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    type: {
        type: String,
        enum: ['simple', 'worksheet', 'quarterly', 'custom'],
        default: 'simple'
    },
    description: String,
    groupId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Group',
        required: true
    },
    messageContent: String,
    priority: {
        type: String,
        enum: ['low', 'normal', 'high', 'critical'],
        default: 'normal'
    },
    status: {
        type: String,
        enum: ['active', 'paused', 'completed', 'failed'],
        default: 'active'
    },
    
    // 任务关联字段
    relatedTaskId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Task',
        default: null
    },
    relationshipType: {
        type: String,
        enum: ['replaces', 'supplements', 'depends_on'],
        default: 'replaces'
    },
    
    // 消息时间和内容配置
    reminderTime: String,  // 简单任务的执行时间 (HH:MM格式)
    contentSource: {
        type: String,
        enum: ['manual', 'worksheet'],
        default: 'manual'
    },
    
    // 调度规则
    scheduleRule: {
        ruleType: String,
        ruleConfig: mongoose.Schema.Types.Mixed,
        dayMode: mongoose.Schema.Types.Mixed,
        weekMode: mongoose.Schema.Types.Mixed,
        intervalMode: mongoose.Schema.Types.Mixed,
        months: [Number],
        quarters: [Number], // 支持季度选择
        excludeSettings: {
            excludeHolidays: {
                type: Boolean,
                default: false
            },
            excludeWeekends: {
                type: Boolean,
                default: false
            },
            specificDates: [String] // 指定排除的日期列表
        },
        executionTimes: [String],
        cron: String
    },
    
    // 文件配置（工作表任务）
    fileConfig: {
        fileId: mongoose.Schema.Types.ObjectId,
        worksheet: String,  // 改为worksheet以匹配前端
        worksheetName: String,  // 保留以兼容旧数据
        data: mongoose.Schema.Types.Mixed
    },
    
    // 调度任务信息
    nextRunAt: Date,
    lastRunAt: Date,
    
    // 执行统计
    lastExecutedAt: Date,
    lastExecutionStatus: {
        type: String,
        enum: ['sent', 'failed', 'skipped'],
        default: null
    },
    executionCount: {
        type: Number,
        default: 0
    },
    successCount: {
        type: Number,
        default: 0
    },
    failureCount: {
        type: Number,
        default: 0
    },
    lastError: String,
    
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

taskSchema.pre('save', function(next) {
    this.updatedAt = new Date();
    next();
});

// 创建复合索引
taskSchema.index({ groupId: 1, status: 1 });
taskSchema.index({ nextRunAt: 1 });

// 4. 文件模型
const fileSchema = new mongoose.Schema({
    groupId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Group'
        // 移除required，因为文件可能不关联群组
    },
    originalName: {
        type: String,
        required: true
    },
    storedName: {
        type: String,
        required: true
    },
    filePath: {
        type: String,
        required: true
    },
    fileSize: Number,
    fileType: {
        type: String,
        enum: ['regular', 'temp', 'custom_reminder'],
        default: 'regular'
    },
    status: {
        type: String,
        enum: ['active', 'processed', 'archived'],
        default: 'active'
    },
    uploadBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    description: String,
    worksheetCount: {
        type: Number,
        default: 0
    },
    worksheets: [{
        name: String,
        rowCount: Number
    }],
    processedAt: Date,
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// 5. 执行历史模型
const executionHistorySchema = new mongoose.Schema({
    taskId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Task',
        required: true
    },
    executedAt: {
        type: Date,
        required: true
    },
    status: {
        type: String,
        enum: ['completed', 'failed', 'skipped'],
        required: true
    },
    messageContent: String,
    errorMessage: String,
    webhookResponse: mongoose.Schema.Types.Mixed,
    retryCount: {
        type: Number,
        default: 0
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

executionHistorySchema.index({ taskId: 1, executedAt: -1 });

// 6. 节假日模型
const holidaySchema = new mongoose.Schema({
    date: {
        type: Date,
        required: true,
        unique: true
    },
    name: String,
    type: {
        type: String,
        enum: ['legal', 'custom'],
        default: 'custom'
    },
    year: Number,
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// date字段已经有unique: true，会自动创建索引，不需要重复定义
// holidaySchema.index({ date: 1 }); // 移除重复索引
holidaySchema.index({ year: 1 });

// 7. 系统设置模型
const settingSchema = new mongoose.Schema({
    key: {
        type: String,
        required: true,
        unique: true
    },
    value: mongoose.Schema.Types.Mixed,
    description: String,
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

settingSchema.pre('save', function(next) {
    this.updatedAt = new Date();
    next();
});

// 8. 任务关联模型
const taskAssociationSchema = new mongoose.Schema({
    primaryTaskId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Task',
        required: true,
        index: true
    },
    associatedTaskId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Task',
        required: true,
        index: true
    },
    duration: {
        type: Number, // 关联时长（天）
        required: true,
        min: 1,
        max: 365
    },
    startDate: {
        type: Date,
        required: true
    },
    endDate: {
        type: Date,
        required: true
    },
    description: {
        type: String,
        maxlength: 500
    },
    status: {
        type: String,
        enum: ['active', 'expired', 'cancelled'],
        default: 'active',
        index: true
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// 复合索引
taskAssociationSchema.index({ primaryTaskId: 1, associatedTaskId: 1, startDate: 1, endDate: 1 });
taskAssociationSchema.index({ primaryTaskId: 1, status: 1 });
taskAssociationSchema.index({ associatedTaskId: 1, status: 1 });
taskAssociationSchema.index({ status: 1, startDate: 1, endDate: 1 });

// 更新时间中间件
taskAssociationSchema.pre('save', function(next) {
    this.updatedAt = new Date();
    next();
});

/**
 * 检查任务是否被覆盖
 */
taskAssociationSchema.statics.isTaskSuppressed = async function(taskId, date = new Date()) {
    // 将检查日期设置为当天的开始时间
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    // 将检查日期设置为当天的结束时间
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    
    // 查找在当天有效的覆盖关联
    const association = await this.findOne({
        associatedTaskId: taskId,
        status: 'active',
        startDate: { $lte: endOfDay },  // 开始日期在今天结束之前
        endDate: { $gte: startOfDay }    // 结束日期在今天开始之后
    });
    
    return !!association;
};

/**
 * 获取覆盖指定任务的主任务
 */
taskAssociationSchema.statics.getSuppressingTask = async function(taskId, date = new Date()) {
    // 将检查日期设置为当天的开始时间
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    // 将检查日期设置为当天的结束时间
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    
    // 查找在当天有效的覆盖关联
    const association = await this.findOne({
        associatedTaskId: taskId,
        status: 'active',
        startDate: { $lte: endOfDay },  // 开始日期在今天结束之前
        endDate: { $gte: startOfDay }    // 结束日期在今天开始之后
    }).populate('primaryTaskId');
    
    return association ? association.primaryTaskId : null;
};

/**
 * 批量更新过期的关联状态
 */
taskAssociationSchema.statics.updateExpiredAssociations = async function() {
    const now = new Date();
    const result = await this.updateMany(
        {
            status: 'active',
            endDate: { $lt: now }
        },
        {
            $set: { status: 'expired' }
        }
    );
    
    return result.modifiedCount;
};

// 9. 发送日志模型
const sendLogSchema = new mongoose.Schema({
    groupId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Group'
    },
    reminderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Task'
    },
    messageContent: {
        type: String,
        maxlength: 1000
    },
    responseCode: {
        type: Number,
        default: 0
    },
    responseMessage: {
        type: String,
        maxlength: 500
    },
    isSuccess: {
        type: Boolean,
        default: false
    },
    retryCount: {
        type: Number,
        default: 0
    },
    sentAt: {
        type: Date,
        default: Date.now
    }
});

// 添加索引
sendLogSchema.index({ groupId: 1, sentAt: -1 });
sendLogSchema.index({ isSuccess: 1 });
sendLogSchema.index({ sentAt: -1 });

// 导出模型
module.exports = {
    User: mongoose.model('User', userSchema),
    Group: mongoose.model('Group', groupSchema),
    Task: mongoose.model('Task', taskSchema),
    File: mongoose.model('File', fileSchema),
    ExecutionHistory: mongoose.model('ExecutionHistory', executionHistorySchema),
    Holiday: mongoose.model('Holiday', holidaySchema),
    Setting: mongoose.model('Setting', settingSchema),
    TaskAssociation: mongoose.model('TaskAssociation', taskAssociationSchema),
    SendLog: mongoose.model('SendLog', sendLogSchema),
    mongoose,
    
    // 连接管理方法
    connect: async () => {
        if (mongoose.connection.readyState !== 1) {
            await mongoose.connect(mongoUrl, mongoOptions);
        }
    },
    
    disconnect: async () => {
        await mongoose.disconnect();
    },
    
    getConnection: () => mongoose.connection
};