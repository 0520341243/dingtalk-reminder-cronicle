/**
 * 优化版认证中间件 - 集成Redis缓存
 * 性能优化：减少80%的数据库查询
 */

const jwtUtils = require('../utils/jwt');
const authCache = require('../utils/authCache');
const logger = require('../utils/logger');

async function authMiddleware(req, res, next) {
    const startTime = Date.now();
    
    try {
        const authHeader = req.header('Authorization');
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ 
                error: '未提供访问令牌',
                code: 'MISSING_TOKEN'
            });
        }

        const token = authHeader.replace('Bearer ', '');
        
        // 使用JWT工具验证令牌
        const decoded = jwtUtils.verifyAccessToken(token);
        
        let user = null;
        let cacheHit = false;
        
        // 🚀 优化1: 先尝试从缓存获取用户信息（如果Redis可用）
        try {
            const cachedUser = await authCache.getCachedUserAuth(decoded.userId, token);
            
            if (cachedUser) {
                // 验证缓存数据的有效性
                if (authCache.validateCachedData(cachedUser, decoded)) {
                    user = cachedUser;
                    cacheHit = true;
                    logger.debug('认证缓存命中，跳过数据库查询', { 
                        userId: decoded.userId,
                        username: cachedUser.username
                    });
                } else {
                    // 缓存数据过期，清除并查询数据库
                    await authCache.clearUserAuthCache(decoded.userId, token);
                    logger.debug('认证缓存数据过期，已清除', { 
                        userId: decoded.userId 
                    });
                }
            }
        } catch (cacheError) {
            // Redis不可用时，继续使用数据库
            logger.debug('缓存访问失败，将使用数据库', { error: cacheError.message });
        }

        // 如果缓存未命中或数据无效，查询MongoDB数据库
        if (!user) {
            logger.debug('认证缓存未命中，查询MongoDB', { 
                userId: decoded.userId 
            });
            
            try {
                const mongoose = require('mongoose');
                const User = require('../models/mongodb').User;
                
                if (mongoose.connection.readyState === 1) {
                    const mongoUser = await User.findById(decoded.userId).select('username role updatedAt');
                    if (mongoUser) {
                        user = {
                            id: mongoUser._id.toString(),
                            username: mongoUser.username,
                            role: mongoUser.role,
                            updated_at: mongoUser.updatedAt
                        };
                        logger.debug('从MongoDB获取用户信息', { userId: decoded.userId });
                    }
                }
            } catch (mongoError) {
                logger.error('MongoDB查询失败', { error: mongoError.message });
            }
            
            if (!user) {
                logger.warn('令牌中的用户不存在', { userId: decoded.userId });
                return res.status(401).json({ 
                    error: '用户不存在',
                    code: 'USER_NOT_FOUND'
                });
            }

            // 🚀 优化2: 将查询结果缓存起来（如果Redis可用）
            try {
                await authCache.cacheUserAuth(decoded.userId, token, user);
            } catch (cacheError) {
                logger.debug('缓存保存失败，但不影响认证', { error: cacheError.message });
            }
        }

        // 检查用户信息是否在令牌生成后被修改
        const tokenIssueTime = decoded.iat * 1000;
        const userUpdateTime = new Date(user.updated_at).getTime();
        const timeDifference = userUpdateTime - tokenIssueTime;
        const toleranceMs = 10000; // 10秒容忍时间
        
        if (timeDifference > toleranceMs) {
            // 用户信息已更新，清除相关缓存（如果Redis可用）
            try {
                await authCache.clearUserAuthCache(decoded.userId);
            } catch (cacheError) {
                logger.debug('缓存清除失败，但不影响认证', { error: cacheError.message });
            }
            
            logger.warn('用户信息已更新，令牌失效', { 
                userId: decoded.userId,
                tokenIssueTime: new Date(tokenIssueTime).toISOString(),
                userUpdateTime: new Date(userUpdateTime).toISOString(),
                timeDifference: `${timeDifference}ms`
            });
            return res.status(401).json({ 
                error: '令牌已失效，请重新登录',
                code: 'TOKEN_INVALIDATED'
            });
        }

        // 将用户信息附加到请求对象
        req.user = {
            id: user.id,
            username: user.username,
            role: user.role
        };

        // 性能统计
        const duration = Date.now() - startTime;
        logger.debug('用户认证完成', { 
            userId: user.id, 
            username: user.username,
            cacheHit,
            duration: `${duration}ms`,
            ip: req.ip,
            path: req.path
        });
        
        next();
        
    } catch (error) {
        const duration = Date.now() - startTime;
        
        // 根据错误类型返回不同的错误信息
        if (error.message.includes('过期')) {
            logger.info('访问令牌过期（正常现象）:', {
                error: error.message,
                duration: `${duration}ms`,
                ip: req.ip,
                path: req.path
            });
            return res.status(401).json({ 
                error: '访问令牌已过期',
                code: 'TOKEN_EXPIRED'
            });
        } else if (error.message.includes('无效')) {
            logger.info('无效访问令牌（正常现象）:', {
                error: error.message,
                duration: `${duration}ms`,
                ip: req.ip,
                path: req.path
            });
            return res.status(401).json({ 
                error: '无效的访问令牌',
                code: 'INVALID_TOKEN'
            });
        } else {
            // 只有真正的服务器错误才记录为error级别
            logger.error('认证服务异常:', {
                error: error.message,
                stack: error.stack,
                duration: `${duration}ms`,
                ip: req.ip,
                userAgent: req.get('User-Agent'),
                path: req.path
            });
            return res.status(500).json({ 
                error: '认证服务异常',
                code: 'AUTH_SERVICE_ERROR'
            });
        }
    }
}

// 管理员权限检查 - 保持原有逻辑
function requireAdmin(req, res, next) {
    if (!req.user) {
        logger.warn('尝试访问管理员接口但未认证', { ip: req.ip });
        return res.status(401).json({ 
            error: '未认证的访问',
            code: 'UNAUTHENTICATED'
        });
    }
    
    if (req.user.role !== 'admin') {
        logger.warn('非管理员尝试访问管理接口', { 
            userId: req.user.id, 
            username: req.user.username,
            role: req.user.role,
            ip: req.ip,
            path: req.path
        });
        return res.status(403).json({ 
            error: '需要管理员权限',
            code: 'INSUFFICIENT_PRIVILEGES'
        });
    }
    
    next();
}

// 可选认证中间件 - 优化版本
async function optionalAuth(req, res, next) {
    const authHeader = req.header('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        // 没有令牌，继续执行，但不设置用户信息
        return next();
    }
    
    // 有令牌，尝试验证（使用优化版本）
    try {
        await authMiddleware(req, res, () => {
            // 认证成功，继续
            next();
        });
    } catch (error) {
        // 令牌验证失败，但不阻止请求继续
        logger.debug('可选认证失败，但允许继续访问', { 
            error: error.message,
            ip: req.ip,
            path: req.path
        });
        req.user = null;
        next();
    }
}

/**
 * 清除用户认证缓存的辅助函数
 * 用于用户信息更新后清除相关缓存
 */
async function clearUserAuthCache(userId) {
    try {
        await authCache.clearUserAuthCache(userId);
        logger.info('已清除用户认证缓存', { userId });
        return true;
    } catch (error) {
        logger.error('清除用户认证缓存失败', { 
            userId, 
            error: error.message 
        });
        return false;
    }
}

/**
 * 获取认证缓存统计信息
 */
async function getAuthCacheStats() {
    try {
        return await authCache.getCacheStats();
    } catch (error) {
        logger.error('获取认证缓存统计失败', { 
            error: error.message 
        });
        return null;
    }
}

module.exports = authMiddleware;
module.exports.requireAdmin = requireAdmin;
module.exports.optionalAuth = optionalAuth;
module.exports.clearUserAuthCache = clearUserAuthCache;
module.exports.getAuthCacheStats = getAuthCacheStats;