/**
 * 钉钉提醒系统 - 使用Cronicle调度核心
 * 保留原有架构，仅替换调度引擎
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const mongoose = require('mongoose');
const helmet = require('helmet');
const compression = require('compression');
const logger = require('./utils/logger');
const cronicleScheduler = require('./services/cronicleScheduler');

// 创建Express应用
const app = express();

// 基础中间件
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
}));
app.use(compression());
app.use(cors({
    origin: true,
    credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// 静态文件服务
app.use(express.static(path.join(__dirname, 'frontend/dist')));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// MongoDB连接 - 使用独立的cronicle数据库（端口27018）
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://cronicle:cronicle123456@localhost:27018/cronicle?authSource=admin';

mongoose.connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    logger.info('✅ Connected to MongoDB');
    
    // 初始化Cronicle调度器适配器
    initializeScheduler();
}).catch(err => {
    logger.error('❌ MongoDB connection error:', err);
    process.exit(1);
});

// API路由 - 保持原有的所有路由不变
app.use('/api/mongo/auth', require('./routes/mongo-auth'));
app.use('/api/mongo/tasks', require('./routes/mongo-tasks'));
app.use('/api/mongo/groups', require('./routes/mongo-groups'));
app.use('/api/mongo/files', require('./routes/mongo-files'));
app.use('/api/mongo/dashboard', require('./routes/mongo-dashboard'));
app.use('/api/scheduler', require('./routes/scheduler'));

// 健康检查端点
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        scheduler: cronicleScheduler.initialized ? 'running' : 'stopped',
        database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        timestamp: new Date()
    });
});

// 错误处理中间件
app.use((err, req, res, next) => {
    logger.error('Unhandled error:', err);
    res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? err : {}
    });
});

// 所有其他路由返回前端应用
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend/dist/index.html'));
});

/**
 * 初始化Cronicle调度器
 */
async function initializeScheduler() {
    try {
        logger.info('🚀 Initializing Cronicle Scheduler...');
        
        const { Task, File } = require('./models/mongodb');
        await cronicleScheduler.initialize({ Task, File });
        
        logger.info('✅ Cronicle Scheduler initialized successfully');
        
        // 导出调度器供路由使用
        app.locals.scheduler = cronicleScheduler;
        
    } catch (error) {
        logger.error('Failed to initialize scheduler:', error);
        // 调度器初始化失败不影响API服务
    }
}

// 优雅关闭
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

async function gracefulShutdown() {
    logger.info('⚠️ Received shutdown signal, closing gracefully...');
    
    // 停止调度器
    if (cronicleScheduler) {
        await cronicleScheduler.stop();
    }
    
    // 关闭数据库连接
    await mongoose.connection.close();
    
    // 关闭服务器
    server.close(() => {
        logger.info('✅ Server closed gracefully');
        process.exit(0);
    });
    
    // 强制关闭（10秒后）
    setTimeout(() => {
        logger.error('❌ Forced shutdown after timeout');
        process.exit(1);
    }, 10000);
}

// 启动服务器
const PORT = process.env.PORT || 5001;
const server = app.listen(PORT, '0.0.0.0', () => {
    logger.info(`🌟 DingTalk Reminder System with Cronicle Core`);
    logger.info(`📡 Server running on http://0.0.0.0:${PORT}`);
    logger.info(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
    logger.info(`💾 MongoDB: ${MONGODB_URI.replace(/\/\/.*@/, '//***@')}`);
});

module.exports = app;