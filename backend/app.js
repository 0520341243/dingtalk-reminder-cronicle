const express = require('express');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
require('dotenv').config();

// const { testConnection } = require('./config/database');
// const { waitForDatabase, initDatabase } = require('./utils/initDatabase');
const { redisManager, cacheUtils } = require('./config/redis');
const { enhancedCache } = require('./utils/enhancedCache');
const logger = require('./utils/logger');

// 初始化MongoDB连接 - 尽早建立连接
require('./models/mongodb');

// 路由模块
// PostgreSQL路由已删除，使用MongoDB路由
// PostgreSQL监控和缓存路由已删除
// const scheduleTestRoutes = require('./routes/schedule-test'); // PostgreSQL版本已删除
// PostgreSQL任务路由已删除

// 中间件
const { errorHandler, notFoundHandler, setupUncaughtExceptionHandlers } = require('./middleware/errorHandler');
const authMiddleware = require('./middleware/auth');
const { responseCache, invalidateUserCache } = require('./middleware/cache');
// const { requestMonitoring, errorMonitoring } = require('./middleware/monitoring'); // PostgreSQL监控已删除
// const { monitoring } = require('./services/monitoring'); // PostgreSQL监控已删除
const { rateLimit, loginRateLimit, strictRateLimit, uploadRateLimit } = require('./middleware/rateLimit');
const { securityHeaders, requestValidation, sqlInjectionProtection, xssProtection } = require('./middleware/security');
const { responseMiddleware } = require('./utils/responseFormatter');
const { csrfProtection, csrfTokenRoute, addCsrfToken } = require('./middleware/csrf');

const app = express();
const PORT = process.env.PORT || 3000;

// Helmet安全头设置 - 增强安全性
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // Vue需要unsafe-eval
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'", "ws:", "wss:", "http:", "https:"],
            fontSrc: ["'self'", "data:"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"]
        }
    },
    hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
    }
}));

// 自定义安全中间件
app.use(securityHeaders());
app.use(requestValidation());
app.use(sqlInjectionProtection());
app.use(xssProtection());

// CORS配置
app.use(cors({
    origin: process.env.NODE_ENV === 'production' ? 
        false : // 生产环境通常不需要CORS，前后端在同一域名
        ['http://localhost:8080', 'http://127.0.0.1:8080', 'http://localhost:5173'],
    credentials: true
}));

// 全局速率限制
app.use(rateLimit({
    windowMs: 15 * 60 * 1000, // 15分钟
    maxRequests: 1000,         // 每个 IP 每 15 分钟最多 1000 次请求
    message: '请求过于频繁，请稍后再试'
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser());

// 添加响应格式化中间件
app.use(responseMiddleware);

// CSRF保护 - 在认证之前，但在CORS之后
app.use(addCsrfToken); // 为所有请求添加CSRF令牌
app.use(csrfProtection()); // 验证需要保护的请求

// 请求监控中间件 - 记录所有请求和错误
app.use((req, res, next) => {
    const startTime = Date.now();
    
    // 监听响应完成
    res.on('finish', () => {
        const responseTime = Date.now() - startTime;
        const isError = res.statusCode >= 400;
        
        // 记录请求到监控服务
        try {
            // const { monitoring } = require('./services/monitoring'); // PostgreSQL监控已删除
            // if (monitoring && typeof monitoring.recordRequest === 'function') {
            //     monitoring.recordRequest(responseTime, isError);
            // }
        } catch (err) {
            // 忽略监控错误，不影响主流程
        }
    });
    
    next();
});

// 请求监控中间件
// app.use(requestMonitoring({ // PostgreSQL监控已删除
//     logSlowRequests: true,
//     slowRequestThreshold: 1000
// }));

// 静态文件服务
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// 提供前端静态文件 - 正确映射子目录
// 注意：在Docker容器中，app.js在/app目录，所以frontend在./frontend
app.use('/js', express.static(path.join(__dirname, './frontend/dist/js'), {
  setHeaders: (res, path) => {
    res.set('Content-Type', 'application/javascript; charset=UTF-8');
  }
}));

app.use('/css', express.static(path.join(__dirname, './frontend/dist/css'), {
  setHeaders: (res, path) => {
    res.set('Content-Type', 'text/css; charset=UTF-8');
  }
}));

// 提供其他静态文件（如index.html）
app.use(express.static(path.join(__dirname, './frontend/dist')));

// API路由 - 带缓存策略和安全限制
// 认证路由 - 严格的速率限制
app.use('/api/auth/login', loginRateLimit());
app.use('/api/auth/register', strictRateLimit({ maxRequests: 3, windowMs: 60 * 60 * 1000 })); // 每小时最多3次注册
// app.use('/api/auth', authRoutes); // PostgreSQL版本已删除


// MongoDB路由 - 完全使用MongoDB
const mongoAuthRoutes = require('./routes/mongo-auth');
const mongoTasksRoutes = require('./routes/mongo-tasks');
const mongoGroupsRoutes = require('./routes/mongo-groups');
const mongoFilesRoutes = require('./routes/mongo-files');
const mongoDashboardRoutes = require('./routes/mongo-dashboard');
const { mongoAuthMiddleware } = require('./middleware/mongo-auth');

// Cronicle调度器路由
const schedulerRoutes = require('./routes/scheduler');
app.use('/api/scheduler', mongoAuthMiddleware, schedulerRoutes);

// MongoDB认证路由（不需要认证中间件）
app.use('/api/mongo/auth', mongoAuthRoutes);
// MongoDB任务路由（需要MongoDB认证中间件）
app.use('/api/mongo/tasks', mongoAuthMiddleware, mongoTasksRoutes);
// MongoDB群组路由（需要MongoDB认证中间件）
app.use('/api/mongo/groups', mongoAuthMiddleware, mongoGroupsRoutes);
// MongoDB文件路由（需要MongoDB认证中间件）
app.use('/api/mongo/files', mongoAuthMiddleware, mongoFilesRoutes);
// MongoDB仪表盘路由（需要MongoDB认证中间件）
app.use('/api/mongo/dashboard', mongoAuthMiddleware, mongoDashboardRoutes);
// MongoDB设置路由（需要MongoDB认证中间件）
const mongoSettingsRoutes = require('./routes/mongo/settings');
app.use('/api/mongo/settings', mongoAuthMiddleware, mongoSettingsRoutes);

// 系统日志路由（需要MongoDB认证中间件）
const logsRoutes = require('./routes/logs');
app.use('/api/logs', mongoAuthMiddleware, logsRoutes);

// V1 API 路由 - 兼容现有系统
// app.use('/api/groups', authMiddleware, invalidateUserCache(), responseCache({ ttl: 600 }), groupRoutes); // PostgreSQL版本已删除
// app.use('/api/files', authMiddleware, invalidateUserCache(), responseCache({ ttl: 300 }), fileRoutes); // PostgreSQL版本已删除
app.use('/api/files/upload', authMiddleware, uploadRateLimit()); // 文件上传速率限制
// app.use('/api/settings', authMiddleware, invalidateUserCache(), responseCache({ ttl: 900 }), settingRoutes); // PostgreSQL版本已删除
// 将MongoDB仪表盘路由映射到通用路径，让前端无需修改
app.use('/api/dashboard', mongoAuthMiddleware, mongoDashboardRoutes);
// app.use('/api/monitoring', strictRateLimit({ maxRequests: 50, windowMs: 60 * 1000 }), monitoringRoutes); // PostgreSQL版本已删除

// 增强调度测试API - 开发测试用
// app.use('/api/schedule-test', scheduleTestRoutes); // PostgreSQL版本已删除
// app.use('/api/worksheet-tasks', authMiddleware, worksheetTasksRoutes); // PostgreSQL版本已删除
// app.use('/api/cache', authMiddleware, cacheRoutes); // PostgreSQL版本已删除
// app.use('/api/redis-control', authMiddleware, redisControlRoutes); // PostgreSQL版本已删除
// app.use('/api/scheduler-status', schedulerStatusRoutes); // PostgreSQL版本已删除

// 任务关联管理接口
// const taskAssociationsRoutes = require('./routes/task-associations'); // PostgreSQL版本已删除
// app.use('/api/task-associations', authMiddleware, taskAssociationsRoutes); // PostgreSQL版本已删除

// 调度器控制路由 - 需要管理员权限
// const schedulerControlRoutes = require('./routes/scheduler-control'); // PostgreSQL版本已删除
// app.use('/api/scheduler', authMiddleware, schedulerControlRoutes); // PostgreSQL版本已删除

// CSRF令牌端点
app.get('/api/csrf-token', csrfTokenRoute);

// 健康检查接口 - 增强版
app.get('/api/health', async (req, res) => {
    try {
        const mongoose = require('mongoose');
        const jwtUtils = require('./utils/jwt');
        
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        const timestamp = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
        
        // MongoDB连接状态
        const mongoStatus = {
            connected: mongoose.connection.readyState === 1,
            state: ['disconnected', 'connected', 'connecting', 'disconnecting'][mongoose.connection.readyState],
            host: mongoose.connection.host,
            port: mongoose.connection.port,
            name: mongoose.connection.name
        };
        
        const tokenStats = await jwtUtils.getTokenStats();
        const cacheStats = await cacheUtils.getStats();
        const redisStatus = redisManager.getStatus();
    
        res.json({
            status: 'healthy',
            timestamp: timestamp,
            timezone: 'Asia/Shanghai (UTC+8)',
            version: '2.0.0',
            environment: process.env.NODE_ENV,
            uptime: Math.floor(process.uptime()),
            memory: {
                used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB',
                total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + 'MB'
            },
            database: {
                type: 'MongoDB',
                status: mongoStatus.connected ? 'connected' : mongoStatus.state,
                host: mongoStatus.host,
                port: mongoStatus.port,
                database: mongoStatus.name
            },
            cache: {
                status: redisStatus.connected ? 'connected' : 'disconnected',
                redis: redisStatus,
                stats: cacheStats ? 'available' : 'unavailable'
            },
            auth: {
                activeSessions: tokenStats.validRefreshTokens,
                tokenExpiry: tokenStats.accessTokenExpiry
            }
        });
    } catch (error) {
        logger.error('健康检查接口错误:', error);
        res.status(500).json({
            status: 'error',
            message: '健康检查失败',
            timestamp: new Date().toISOString(),
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// 404错误处理（放在所有路由之后）
app.use('/api/*', notFoundHandler);

// 前端路由处理 (SPA)
// SPA 路由回退 - 对于非API请求，返回index.html
app.get('*', (req, res, next) => {
  // 跳过API路由和静态文件请求
  if (req.path.startsWith('/api') || 
      req.path.startsWith('/uploads') ||
      req.path.includes('.')) {
    return next();
  }
  
  // 对于其他路由，返回index.html让Vue Router处理
  res.sendFile(path.join(__dirname, './frontend/dist/index.html'));
});

// 错误监控中间件（必须放在全局错误处理之前）
// app.use(errorMonitoring); // PostgreSQL监控已删除

// 全局错误处理中间件（必须放在最后）
app.use(errorHandler);

// 设置未捕获异常处理器
setupUncaughtExceptionHandlers();

// 内存优化：强制垃圾回收（生产环境）
if (global.gc && process.env.NODE_ENV === 'production') {
    console.log('🔧 启用定期垃圾回收...');
    setInterval(() => {
        global.gc();
        const usage = process.memoryUsage();
        if (usage.heapUsed / usage.heapTotal > 0.9) {
            logger.warn('内存使用率过高', {
                heapUsed: Math.round(usage.heapUsed / 1024 / 1024) + 'MB',
                heapTotal: Math.round(usage.heapTotal / 1024 / 1024) + 'MB',
                external: Math.round(usage.external / 1024 / 1024) + 'MB'
            });
        }
    }, 30000); // 每30秒执行一次
}

// 启动服务器
async function startServer() {
    try {
        console.log('🔄 正在启动钉钉提醒系统...');
        
        // MongoDB连接已在顶部通过require('./models/mongodb')自动建立
        // 系统使用MongoDB作为唯一数据库
        
        // 等待MongoDB连接就绪
        const mongoose = require('mongoose');
        if (mongoose.connection.readyState !== 1) {
            console.log('🔄 等待MongoDB连接...');
            await new Promise((resolve) => {
                mongoose.connection.once('open', resolve);
            });
        }
        console.log('✅ MongoDB连接就绪');
        
        // 初始化Redis连接（可选）
        console.log('🔧 初始化Redis缓存层...');
        const redisClient = await redisManager.connect();
        if (redisClient) {
            console.log('✅ Redis缓存层初始化成功');
        } else {
            // 检查Redis是否被配置为启用
            const redisEnabled = process.env.REDIS_ENABLED === 'true';
            if (redisEnabled) {
                console.warn('⚠️ Redis连接初始化失败，将持续尝试重连');
                
                // 启动Redis连接监控定时器（避免"启动早于Redis"的问题）
                const redisReconnectTimer = setInterval(async () => {
                    if (!redisManager.isReady()) {
                        logger.info('尝试重新连接Redis...');
                        const client = await redisManager.reconnect();
                        if (client && redisManager.isReady()) {
                            logger.info('✅ Redis重连成功');
                            clearInterval(redisReconnectTimer);
                        }
                    } else {
                        clearInterval(redisReconnectTimer);
                    }
                }, 30000); // 30秒间隔
                
                // 设置定时器清理（避免无限重试）
                setTimeout(() => {
                    if (redisReconnectTimer) {
                        clearInterval(redisReconnectTimer);
                        logger.info('Redis重连定时器已停止（超时）');
                    }
                }, 10 * 60 * 1000); // 10分钟后停止重试
            } else {
                console.warn('⚠️ Redis已禁用，跳过连接重试');
            }
        }
        
        // 启动Cronicle调度器
        console.log('🔧 准备启动Cronicle调度器...');
        const cronicleScheduler = require('./services/cronicleScheduler');
        const { Task, File } = require('./models/mongodb');
        await cronicleScheduler.initialize({ Task, File });
        console.log('✅ Cronicle调度器启动完成');
        
        // 启动监控服务
        console.log('🔧 启动系统监控服务...');
        // monitoring.start(30000); // 30秒间隔 - PostgreSQL监控已删除
        console.log('✅ 系统监控服务启动完成');
        
        // 启动HTTP服务器 - 监听所有网络接口以支持局域网访问
        const server = app.listen(PORT, '0.0.0.0', () => {
            logger.info(`🚀 服务器启动成功，端口: ${PORT}`);
            logger.info(`📱 管理界面: http://localhost:${PORT}`);
            logger.info(`🔧 健康检查: http://localhost:${PORT}/api/health`);
            console.log('✅ 钉钉提醒系统启动完成！');
        });
        
        // 优雅关闭处理
        const gracefulShutdown = (signal) => {
            logger.info(`收到${signal}信号，开始优雅关闭...`);
            
            server.close(async () => {
                logger.info('HTTP服务器已关闭');
                
                // 停止Cronicle调度器
                try {
                    const cronicleScheduler = require('./services/cronicleScheduler');
                    await cronicleScheduler.stop();
                    logger.info('Cronicle调度器已停止');
                } catch (error) {
                    logger.warn('Cronicle调度器停止异常:', error.message);
                }
                
                // 停止监控服务
                try {
                    // monitoring.stop(); // PostgreSQL监控已删除
                    logger.info('监控服务已停止');
                } catch (error) {
                    logger.warn('监控服务停止异常:', error.message);
                }
                
                // 关闭Redis连接
                try {
                    await redisManager.disconnect();
                    logger.info('Redis连接已关闭');
                } catch (error) {
                    logger.warn('Redis关闭异常:', error.message);
                }
                
                process.exit(0);
            });
            
            // 强制退出超时
            setTimeout(() => {
                logger.error('强制退出：优雅关闭超时');
                process.exit(1);
            }, 10000);
        };
        
        process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
        process.on('SIGINT', () => gracefulShutdown('SIGINT'));
        
    } catch (error) {
        logger.error('服务器启动失败:', {
            message: error.message,
            stack: error.stack
        });
        console.error('❌ 启动失败:', error.message);
        process.exit(1);
    }
}

// 启动应用
startServer();