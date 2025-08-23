/**
 * 缓存中间件
 * 提供API响应缓存和通用缓存策略
 */

const { cacheUtils } = require('../config/redis');
const logger = require('../utils/logger');
const crypto = require('crypto');
const cacheManager = require('../utils/cacheManager');

/**
 * API响应缓存中间件
 */
function responseCache(options = {}) {
    const {
        ttl = 300, // 默认5分钟
        keyGenerator = null,
        skipCache = null,
        namespace = 'api',
        validateResponse = null // 新增：响应验证函数
    } = options;

    return async (req, res, next) => {
        // 检查Redis是否启用
        const redisControlRouter = require('../routes/redis-control');
        if (!redisControlRouter.isRedisEnabled()) {
            return next();
        }

        // 检查是否需要跳过缓存
        if (skipCache && skipCache(req)) {
            return next();
        }

        // 只缓存GET请求
        if (req.method !== 'GET') {
            return next();
        }

        // 生成缓存键
        const cacheKey = keyGenerator ? 
            keyGenerator(req) : 
            generateDefaultCacheKey(req, namespace);

        try {
            // 尝试从缓存获取数据
            const cachedResponse = await cacheUtils.get(cacheKey);
            if (cachedResponse) {
                logger.debug('响应缓存命中', { 
                    path: req.path, 
                    key: cacheKey,
                    userId: req.user?.id 
                });

                // 记录缓存命中
                cacheManager.recordHit();

                // 设置缓存头
                res.set('X-Cache', 'HIT');
                res.set('X-Cache-Key', cacheKey);
                
                return res.json(cachedResponse);
            }

            // 缓存未命中，继续处理请求
            logger.debug('响应缓存未命中', { 
                path: req.path, 
                key: cacheKey 
            });
            
            // 记录缓存未命中
            cacheManager.recordMiss();

            // 重写res.json方法来缓存响应
            const originalJson = res.json;
            res.json = function(data) {
                // 只缓存成功的响应
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    // 验证响应数据是否应该被缓存
                    const shouldCache = validateResponse ? validateResponse(data, req) : true;
                    
                    if (shouldCache) {
                        cacheUtils.set(cacheKey, data, ttl).catch(error => {
                            logger.warn('响应缓存设置失败', { 
                                key: cacheKey, 
                                error: error.message 
                            });
                        });
                    } else {
                        logger.debug('响应不满足缓存条件，跳过缓存', { 
                            path: req.path,
                            key: cacheKey 
                        });
                    }
                }

                // 设置缓存头
                res.set('X-Cache', 'MISS');
                res.set('X-Cache-Key', cacheKey);

                return originalJson.call(this, data);
            };

            next();

        } catch (error) {
            logger.error('缓存中间件错误', { 
                error: error.message, 
                path: req.path 
            });
            
            // 记录错误
            cacheManager.recordError();
            
            next();
        }
    };
}

/**
 * 生成默认缓存键
 */
function generateDefaultCacheKey(req, namespace) {
    const { path, query, user, baseUrl, originalUrl } = req;
    
    // 使用完整的路径信息，确保不同路由生成不同的缓存键
    const fullPath = originalUrl || path;
    
    // 创建基础键组件 - 包含完整路径
    const components = [namespace, fullPath.replace(/\//g, '_')];
    
    // 添加查询参数
    if (Object.keys(query).length > 0) {
        const sortedQuery = Object.keys(query)
            .sort()
            .reduce((result, key) => {
                result[key] = query[key];
                return result;
            }, {});
        components.push(crypto.createHash('md5').update(JSON.stringify(sortedQuery)).digest('hex').substring(0, 8));
    }
    
    // 添加用户ID（如果存在）
    if (user?.id) {
        components.push(`user:${user.id}`);
    }
    
    // 添加用户角色（影响数据权限）
    if (user?.role) {
        components.push(`role:${user.role}`);
    }
    
    return components.join(':');
}

/**
 * 用户相关缓存无效化中间件
 */
function invalidateUserCache(options = {}) {
    const { patterns = ['api:*:user:*'], methods = ['POST', 'PUT', 'DELETE', 'PATCH'] } = options;
    
    return async (req, res, next) => {
        // 检查Redis是否启用
        const redisControlRouter = require('../routes/redis-control');
        if (!redisControlRouter.isRedisEnabled()) {
            return next();
        }

        // 只在修改操作后清理缓存
        if (!methods.includes(req.method)) {
            return next();
        }

        // 重写res.json方法来在响应后清理缓存
        const originalJson = res.json;
        res.json = async function(data) {
            const result = originalJson.call(this, data);

            // 只在成功响应后清理缓存
            if (res.statusCode >= 200 && res.statusCode < 300) {
                try {
                    for (const pattern of patterns) {
                        // 替换用户ID占位符
                        const resolvedPattern = pattern.replace('*:user:*', 
                            req.user?.id ? `*:user:${req.user.id}` : '*:user:*');
                        
                        const deleted = await cacheUtils.delPattern(resolvedPattern);
                        if (deleted > 0) {
                            logger.debug('用户缓存清理成功', { 
                                pattern: resolvedPattern, 
                                deleted,
                                userId: req.user?.id,
                                path: req.path,
                                method: req.method
                            });
                        }
                    }
                } catch (error) {
                    logger.warn('用户缓存清理失败', { 
                        error: error.message,
                        userId: req.user?.id,
                        path: req.path 
                    });
                }
            }

            return result;
        };

        next();
    };
}

/**
 * 通用缓存清理中间件
 */
function invalidateCache(patterns) {
    if (typeof patterns === 'string') {
        patterns = [patterns];
    }
    
    return async (req, res, next) => {
        const originalJson = res.json;
        res.json = async function(data) {
            const result = originalJson.call(this, data);

            // 只在成功响应后清理缓存
            if (res.statusCode >= 200 && res.statusCode < 300) {
                try {
                    for (const pattern of patterns) {
                        const deleted = await cacheUtils.delPattern(pattern);
                        if (deleted > 0) {
                            logger.debug('缓存清理成功', { 
                                pattern, 
                                deleted,
                                path: req.path,
                                method: req.method
                            });
                        }
                    }
                } catch (error) {
                    logger.warn('缓存清理失败', { 
                        error: error.message,
                        patterns,
                        path: req.path 
                    });
                }
            }

            return result;
        };

        next();
    };
}

/**
 * 数据库查询结果缓存装饰器
 */
function withCache(cacheKey, ttl = 300) {
    return function(target, propertyKey, descriptor) {
        const originalMethod = descriptor.value;

        descriptor.value = async function(...args) {
            const key = typeof cacheKey === 'function' ? cacheKey(...args) : cacheKey;
            
            try {
                // 尝试从缓存获取
                const cached = await cacheUtils.get(key);
                if (cached !== null) {
                    logger.debug('查询缓存命中', { key });
                    return cached;
                }

                // 执行原始方法
                const result = await originalMethod.apply(this, args);
                
                // 缓存结果
                if (result !== null && result !== undefined) {
                    await cacheUtils.set(key, result, ttl);
                    logger.debug('查询结果已缓存', { key, ttl });
                }

                return result;
            } catch (error) {
                logger.error('缓存装饰器错误', { 
                    key, 
                    error: error.message,
                    method: propertyKey 
                });
                
                // 出错时直接执行原始方法
                return await originalMethod.apply(this, args);
            }
        };

        return descriptor;
    };
}

/**
 * 会话存储工具
 */
class SessionCache {
    constructor(prefix = 'session') {
        this.prefix = prefix;
        this.defaultTTL = 7 * 24 * 60 * 60; // 7天
    }

    /**
     * 生成会话键
     */
    getKey(sessionId) {
        return `${this.prefix}:${sessionId}`;
    }

    /**
     * 设置会话数据
     */
    async set(sessionId, data, ttl = this.defaultTTL) {
        const key = this.getKey(sessionId);
        return await cacheUtils.set(key, data, ttl);
    }

    /**
     * 获取会话数据
     */
    async get(sessionId) {
        const key = this.getKey(sessionId);
        return await cacheUtils.get(key);
    }

    /**
     * 删除会话
     */
    async del(sessionId) {
        const key = this.getKey(sessionId);
        return await cacheUtils.del(key);
    }

    /**
     * 更新会话过期时间
     */
    async touch(sessionId, ttl = this.defaultTTL) {
        const key = this.getKey(sessionId);
        return await cacheUtils.expire(key, ttl);
    }

    /**
     * 删除用户的所有会话
     */
    async delUserSessions(userId) {
        const pattern = `${this.prefix}:*:user:${userId}`;
        return await cacheUtils.delPattern(pattern);
    }
}

/**
 * 频率限制工具
 */
class RateLimitCache {
    constructor(prefix = 'ratelimit') {
        this.prefix = prefix;
    }

    /**
     * 生成限制键
     */
    getKey(identifier, endpoint = '') {
        return `${this.prefix}:${endpoint}:${identifier}`;
    }

    /**
     * 检查和更新频率限制
     */
    async checkRate(identifier, limit, window, endpoint = '') {
        const key = this.getKey(identifier, endpoint);
        
        try {
            const current = await cacheUtils.incr(key, 1, window);
            
            return {
                allowed: current <= limit,
                current: current,
                limit: limit,
                resetTime: await cacheUtils.ttl(key),
                remaining: Math.max(0, limit - current)
            };
        } catch (error) {
            logger.error('频率限制检查失败', { 
                key, 
                error: error.message 
            });
            
            // 出错时允许通过
            return {
                allowed: true,
                current: 1,
                limit: limit,
                resetTime: window,
                remaining: limit - 1
            };
        }
    }

    /**
     * 重置频率限制
     */
    async reset(identifier, endpoint = '') {
        const key = this.getKey(identifier, endpoint);
        return await cacheUtils.del(key);
    }
}

// 创建实例
const sessionCache = new SessionCache();
const rateLimitCache = new RateLimitCache();

module.exports = {
    responseCache,
    invalidateUserCache,
    invalidateCache,
    generateDefaultCacheKey,
    withCache,
    SessionCache,
    RateLimitCache,
    sessionCache,
    rateLimitCache
};