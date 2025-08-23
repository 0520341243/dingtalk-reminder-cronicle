/**
 * 请求监控中间件
 * 收集API请求的性能指标和错误信息
 */

const { monitoring } = require('../services/monitoring');
const logger = require('../utils/logger');

/**
 * 请求性能监控中间件
 */
function requestMonitoring(options = {}) {
    const {
        excludePaths = ['/api/health', '/favicon.ico'],
        includeBody = false,
        logSlowRequests = true,
        slowRequestThreshold = 1000 // 1秒
    } = options;

    return (req, res, next) => {
        // 跳过排除的路径
        if (excludePaths.some(path => req.path.includes(path))) {
            return next();
        }

        const startTime = Date.now();
        const requestId = generateRequestId();
        
        // 添加请求ID到请求对象
        req.requestId = requestId;

        // 记录请求开始
        const requestInfo = {
            requestId,
            method: req.method,
            path: req.path,
            url: req.url,
            userAgent: req.get('User-Agent'),
            ip: req.ip || req.connection.remoteAddress,
            userId: null, // 将在认证后填充
            startTime,
            timestamp: new Date().toISOString()
        };

        // 如果需要记录请求体
        if (includeBody && ['POST', 'PUT', 'PATCH'].includes(req.method)) {
            // 注意：不记录敏感信息
            const body = { ...req.body };
            if (body.password) delete body.password;
            if (body.token) delete body.token;
            requestInfo.body = body;
        }

        logger.debug('请求开始', requestInfo);

        // 重写res.json方法来捕获响应
        const originalJson = res.json;
        const originalSend = res.send;
        const originalEnd = res.end;

        let responseBody = null;
        let responseSent = false;

        // 捕获JSON响应
        res.json = function(data) {
            if (!responseSent) {
                responseBody = data;
                responseSent = true;
                handleResponse();
            }
            return originalJson.call(this, data);
        };

        // 捕获send响应
        res.send = function(data) {
            if (!responseSent) {
                responseBody = data;
                responseSent = true;
                handleResponse();
            }
            return originalSend.call(this, data);
        };

        // 捕获end响应
        res.end = function(data) {
            if (!responseSent) {
                responseBody = data;
                responseSent = true;
                handleResponse();
            }
            return originalEnd.call(this, data);
        };

        // 处理响应完成
        function handleResponse() {
            const endTime = Date.now();
            const responseTime = endTime - startTime;
            const isError = res.statusCode >= 400;

            // 获取用户ID（如果已认证）
            if (req.user) {
                requestInfo.userId = req.user.id;
            }

            // 构建响应信息
            const responseInfo = {
                ...requestInfo,
                endTime,
                responseTime,
                statusCode: res.statusCode,
                statusMessage: res.statusMessage,
                isError,
                contentLength: res.get('Content-Length') || 0
            };

            // 记录到监控服务 - 只统计5xx为错误，避免401/403噪声
            const isServerError = res.statusCode >= 500;
            monitoring.recordRequest(responseTime, isServerError);

            // 记录日志
            if (isError) {
                logger.warn('请求完成 (错误)', responseInfo);
            } else if (logSlowRequests && responseTime > slowRequestThreshold) {
                logger.warn('请求完成 (慢请求)', {
                    ...responseInfo,
                    threshold: slowRequestThreshold
                });
            } else {
                // 将普通请求完成日志改为debug级别，减少日志量
                logger.debug('请求完成', {
                    requestId,
                    method: req.method,
                    path: req.path,
                    statusCode: res.statusCode,
                    responseTime: `${responseTime}ms`,
                    userId: req.user?.id
                });
            }

            // 发出监控事件
            monitoring.emit('request', responseInfo);
        }

        // 处理请求中断
        req.on('close', () => {
            if (!responseSent) {
                const endTime = Date.now();
                const responseTime = endTime - startTime;
                
                logger.warn('请求中断', {
                    ...requestInfo,
                    responseTime,
                    reason: 'client_disconnect'
                });

                monitoring.recordRequest(responseTime, true);
            }
        });

        next();
    };
}

/**
 * 错误监控中间件
 * 必须放在错误处理中间件之前
 */
function errorMonitoring(err, req, res, next) {
    const errorInfo = {
        requestId: req.requestId,
        error: {
            name: err.name,
            message: err.message,
            stack: err.stack,
            code: err.code,
            statusCode: err.statusCode || 500
        },
        request: {
            method: req.method,
            path: req.path,
            url: req.url,
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            userId: req.user?.id
        },
        timestamp: new Date().toISOString()
    };

    // 记录错误到监控服务
    logger.error('请求错误', errorInfo);
    
    // 发出错误事件
    monitoring.emit('error', errorInfo);

    // 继续错误处理链
    next(err);
}

/**
 * API端点统计中间件
 */
function endpointStats() {
    const stats = new Map();

    return (req, res, next) => {
        const endpoint = `${req.method} ${req.route?.path || req.path}`;
        const startTime = Date.now();

        // 重写response结束方法
        const originalEnd = res.end;
        res.end = function(...args) {
            const responseTime = Date.now() - startTime;
            const isError = res.statusCode >= 400;

            // 更新统计
            if (!stats.has(endpoint)) {
                stats.set(endpoint, {
                    count: 0,
                    errors: 0,
                    totalTime: 0,
                    minTime: Infinity,
                    maxTime: 0
                });
            }

            const stat = stats.get(endpoint);
            stat.count++;
            stat.totalTime += responseTime;
            stat.minTime = Math.min(stat.minTime, responseTime);
            stat.maxTime = Math.max(stat.maxTime, responseTime);
            
            if (isError) {
                stat.errors++;
            }

            return originalEnd.apply(this, args);
        };

        next();
    };
}

/**
 * 生成请求ID
 */
function generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * 获取请求统计信息
 */
function getRequestStats() {
    return {
        monitoring: monitoring.getMetrics().application?.requests || {},
        health: monitoring.getHealthStatus()
    };
}

/**
 * 实时监控中间件（WebSocket支持）
 */
function realtimeMonitoring() {
    const clients = new Set();

    // 监听监控事件
    monitoring.on('request', (data) => {
        broadcastToClients('request', data);
    });

    monitoring.on('error', (data) => {
        broadcastToClients('error', data);
    });

    monitoring.on('alert', (data) => {
        broadcastToClients('alert', data);
    });

    function broadcastToClients(type, data) {
        const message = JSON.stringify({ type, data, timestamp: Date.now() });
        
        clients.forEach(client => {
            try {
                if (client.readyState === 1) { // WebSocket.OPEN
                    client.send(message);
                }
            } catch (error) {
                clients.delete(client);
            }
        });
    }

    return {
        addClient: (ws) => {
            clients.add(ws);
            
            ws.on('close', () => {
                clients.delete(ws);
            });

            // 发送当前状态
            const currentMetrics = monitoring.getMetrics();
            ws.send(JSON.stringify({
                type: 'init',
                data: currentMetrics,
                timestamp: Date.now()
            }));
        },
        
        getClientsCount: () => clients.size,
        
        broadcast: broadcastToClients
    };
}

module.exports = {
    requestMonitoring,
    errorMonitoring,
    endpointStats,
    generateRequestId,
    getRequestStats,
    realtimeMonitoring
};