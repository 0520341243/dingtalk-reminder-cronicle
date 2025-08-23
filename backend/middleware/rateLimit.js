/**
 * API速率限制中间件
 * 提供灵活的速率限制和安全防护
 */

const { rateLimitCache, cacheUtils } = require('./cache');
const { cacheUtils: redisCacheUtils } = require('../config/redis');
const { ErrorFactory } = require('../utils/errors');
const logger = require('../utils/logger');

/**
 * 速率限制中间件工厂
 */
function rateLimit(options = {}) {
    const {
        windowMs = 15 * 60 * 1000, // 15分钟窗口
        maxRequests = 100,         // 最大请求数
        keyGenerator = defaultKeyGenerator,
        skipFailedRequests = false,
        skipSuccessfulRequests = false,
        onLimitReached = null,
        message = '请求过于频繁，请稍后再试',
        standardHeaders = true,
        legacyHeaders = false,
        store = null // 自定义存储
    } = options;

    return async (req, res, next) => {
        try {
            const key = keyGenerator(req);
            const identifier = `${req.ip}:${key}`;
            const endpoint = req.route?.path || req.path;
            
            // 检查速率限制
            const rateResult = await rateLimitCache.checkRate(
                identifier, 
                maxRequests, 
                Math.floor(windowMs / 1000),
                endpoint
            );

            // 设置响应头
            if (standardHeaders) {
                const resetTime = new Date(Date.now() + (rateResult.resetTime * 1000));
                res.set({
                    'RateLimit-Limit': maxRequests.toString(),
                    'RateLimit-Remaining': rateResult.remaining.toString(),
                    'RateLimit-Reset': resetTime.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }),
                    'RateLimit-Policy': `${maxRequests};w=${Math.floor(windowMs / 1000)}`
                });
            }

            if (legacyHeaders) {
                res.set({
                    'X-RateLimit-Limit': maxRequests.toString(),
                    'X-RateLimit-Remaining': rateResult.remaining.toString(),
                    'X-RateLimit-Reset': Math.floor(Date.now() / 1000 + rateResult.resetTime).toString()
                });
            }

            // 检查是否超出限制
            if (!rateResult.allowed) {
                logger.warn('速率限制触发', {
                    ip: req.ip,
                    path: req.path,
                    method: req.method,
                    identifier,
                    current: rateResult.current,
                    limit: maxRequests,
                    userAgent: req.get('User-Agent')
                });

                // 触发回调
                if (onLimitReached) {
                    onLimitReached(req, res, rateResult);
                }

                // 设置重试头
                const retryAfter = Math.ceil(rateResult.resetTime);
                res.set('Retry-After', retryAfter.toString());

                // 直接返回错误响应，避免未捕获的Promise拒绝
                return res.status(429).json({
                    error: message,
                    retryAfter: retryAfter
                });
            }

            // 记录成功的请求
            logger.debug('速率限制检查通过', {
                identifier,
                current: rateResult.current,
                remaining: rateResult.remaining
            });

            next();

        } catch (error) {
            if (error.code === 'RATE_LIMIT_EXCEEDED') {
                throw error;
            }
            
            logger.error('速率限制中间件错误:', error);
            // 出错时允许请求通过，但记录错误
            next();
        }
    };
}

/**
 * 默认键生成器
 */
function defaultKeyGenerator(req) {
    return req.path;
}

/**
 * 基于用户的键生成器
 */
function userKeyGenerator(req) {
    if (req.user?.id) {
        return `user:${req.user.id}`;
    }
    return req.ip;
}

/**
 * 基于IP的键生成器
 */
function ipKeyGenerator(req) {
    return req.ip;
}

/**
 * 严格的速率限制（用于敏感操作）
 */
function strictRateLimit(options = {}) {
    return rateLimit({
        windowMs: 60 * 1000, // 1分钟
        maxRequests: 5,      // 最多5次
        keyGenerator: userKeyGenerator,
        message: '操作过于频繁，请稍后再试',
        onLimitReached: (req, res, result) => {
            logger.error('严格速率限制触发', {
                ip: req.ip,
                userId: req.user?.id,
                path: req.path,
                method: req.method,
                attempts: result.current
            });
        },
        ...options
    });
}

/**
 * 登录速率限制
 */
function loginRateLimit(options = {}) {
    return rateLimit({
        windowMs: 15 * 60 * 1000, // 15分钟
        maxRequests: 5,           // 最多5次登录尝试
        keyGenerator: (req) => `login:${req.ip}:${req.body?.username || 'unknown'}`,
        message: '登录尝试过于频繁，请15分钟后再试',
        skipSuccessfulRequests: true, // 成功的登录不计入限制
        onLimitReached: (req, res, result) => {
            logger.warn('登录速率限制触发', {
                ip: req.ip,
                username: req.body?.username,
                attempts: result.current,
                userAgent: req.get('User-Agent')
            });
        },
        ...options
    });
}

/**
 * API键速率限制
 */
function apiKeyRateLimit(options = {}) {
    return rateLimit({
        windowMs: 60 * 60 * 1000, // 1小时
        maxRequests: 1000,        // 每小时1000次请求
        keyGenerator: (req) => {
            const apiKey = req.get('X-API-Key') || req.query.api_key;
            return apiKey ? `api_key:${apiKey}` : `ip:${req.ip}`;
        },
        message: 'API请求配额已用尽，请稍后再试',
        ...options
    });
}

/**
 * 文件上传速率限制
 */
function uploadRateLimit(options = {}) {
    return rateLimit({
        windowMs: 10 * 60 * 1000, // 10分钟
        maxRequests: 10,          // 最多10次上传
        keyGenerator: userKeyGenerator,
        message: '文件上传过于频繁，请稍后再试',
        onLimitReached: (req, res, result) => {
            logger.warn('文件上传速率限制触发', {
                ip: req.ip,
                userId: req.user?.id,
                attempts: result.current
            });
        },
        ...options
    });
}

/**
 * 渐进式速率限制（越频繁限制越严格）
 */
function progressiveRateLimit(baseOptions = {}) {
    const levels = [
        { windowMs: 60 * 1000, maxRequests: 20 },      // 1分钟20次
        { windowMs: 5 * 60 * 1000, maxRequests: 100 }, // 5分钟100次
        { windowMs: 60 * 60 * 1000, maxRequests: 500 } // 1小时500次
    ];

    return async (req, res, next) => {
        const key = (baseOptions.keyGenerator || defaultKeyGenerator)(req);
        const identifier = `${req.ip}:${key}`;
        
        try {
            for (const level of levels) {
                const rateResult = await rateLimitCache.checkRate(
                    identifier,
                    level.maxRequests,
                    Math.floor(level.windowMs / 1000),
                    `progressive_${Math.floor(level.windowMs / 1000)}`
                );

                if (!rateResult.allowed) {
                    logger.warn('渐进式速率限制触发', {
                        ip: req.ip,
                        path: req.path,
                        level: level.windowMs / 1000,
                        current: rateResult.current,
                        limit: level.maxRequests
                    });

                    res.set('Retry-After', Math.ceil(rateResult.resetTime).toString());
                    throw ErrorFactory.rateLimit('请求过于频繁，请稍后再试');
                }
            }

            next();
        } catch (error) {
            if (error.code === 'RATE_LIMIT_EXCEEDED') {
                throw error;
            }
            next();
        }
    };
}

/**
 * 清理速率限制数据
 */
async function clearRateLimit(identifier, endpoint = '') {
    try {
        await rateLimitCache.reset(identifier, endpoint);
        logger.info('速率限制数据已清理', { identifier, endpoint });
        return true;
    } catch (error) {
        logger.error('清理速率限制数据失败:', error);
        return false;
    }
}

/**
 * 获取速率限制状态
 */
async function getRateLimitStatus(identifier, endpoint = '') {
    try {
        // 这里需要实现获取当前状态的逻辑
        // 暂时返回模拟数据
        return {
            identifier,
            endpoint,
            current: 0,
            limit: 100,
            remaining: 100,
            resetTime: Date.now() + 15 * 60 * 1000
        };
    } catch (error) {
        logger.error('获取速率限制状态失败:', error);
        return null;
    }
}

/**
 * 创建基于滑动窗口的速率限制
 */
function slidingWindowRateLimit(options = {}) {
    const {
        windowMs = 60 * 1000,
        maxRequests = 100,
        keyGenerator = defaultKeyGenerator
    } = options;

    return async (req, res, next) => {
        try {
            const key = keyGenerator(req);
            const identifier = `sliding:${req.ip}:${key}`;
            const now = Date.now();
            const windowStart = now - windowMs;

            // 使用Redis的ZSET实现滑动窗口
            if (redisCacheUtils && redisCacheUtils.redis && redisCacheUtils.redis.isReady()) {
                const client = redisCacheUtils.redis.getClient();
                
                // 清理过期的请求记录
                await client.zremrangebyscore(identifier, 0, windowStart);
                
                // 获取当前窗口内的请求数
                const currentCount = await client.zcard(identifier);
                
                if (currentCount >= maxRequests) {
                    logger.warn('滑动窗口速率限制触发', {
                        ip: req.ip,
                        identifier,
                        currentCount,
                        maxRequests
                    });
                    
                    throw ErrorFactory.rateLimit('请求过于频繁，请稍后再试');
                }
                
                // 记录当前请求
                await client.zadd(identifier, now, `${now}:${Math.random()}`);
                await client.expire(identifier, Math.ceil(windowMs / 1000));
                
                // 设置响应头
                res.set({
                    'X-RateLimit-Limit': maxRequests.toString(),
                    'X-RateLimit-Remaining': (maxRequests - currentCount - 1).toString(),
                    'X-RateLimit-Reset': Math.floor((now + windowMs) / 1000).toString()
                });
            }

            next();
        } catch (error) {
            if (error.code === 'RATE_LIMIT_EXCEEDED') {
                throw error;
            }
            logger.error('滑动窗口速率限制错误:', error);
            next();
        }
    };
}

module.exports = {
    rateLimit,
    strictRateLimit,
    loginRateLimit,
    apiKeyRateLimit,
    uploadRateLimit,
    progressiveRateLimit,
    slidingWindowRateLimit,
    clearRateLimit,
    getRateLimitStatus,
    
    // 键生成器
    defaultKeyGenerator,
    userKeyGenerator,
    ipKeyGenerator
};