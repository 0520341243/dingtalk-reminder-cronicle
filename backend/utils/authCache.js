/**
 * 认证结果缓存工具
 * 优化用户认证性能，减少数据库查询频次
 */

const crypto = require('crypto');
const { cacheUtils } = require('../config/redis');
const logger = require('./logger');

class AuthCache {
    constructor() {
        this.defaultTTL = 300; // 5分钟缓存时间
        this.namespace = 'auth';
    }

    /**
     * 生成认证缓存键
     * @param {number} userId - 用户ID
     * @param {string} token - JWT token
     * @returns {string} 缓存键
     */
    generateCacheKey(userId, token) {
        // 使用token的hash值避免缓存键过长
        const tokenHash = crypto.createHash('md5').update(token).digest('hex').substring(0, 8);
        return cacheUtils.generateKey(this.namespace, userId, tokenHash);
    }

    /**
     * 缓存用户认证结果
     * @param {number} userId - 用户ID
     * @param {string} token - JWT token
     * @param {Object} userInfo - 用户信息
     * @param {number} ttl - 缓存时间(秒)，默认5分钟
     */
    async cacheUserAuth(userId, token, userInfo, ttl = this.defaultTTL) {
        try {
            const cacheKey = this.generateCacheKey(userId, token);
            
            // 缓存的用户信息包含基本字段和时间戳
            const cacheData = {
                id: userInfo.id,
                username: userInfo.username,
                role: userInfo.role,
                updated_at: userInfo.updated_at,
                cached_at: new Date().toISOString(),
                expires_at: new Date(Date.now() + ttl * 1000).toISOString()
            };

            await cacheUtils.set(cacheKey, cacheData, ttl);
            
            logger.debug('用户认证结果已缓存', { 
                userId, 
                username: userInfo.username,
                ttl: ttl + 's',
                cacheKey: cacheKey.substring(0, 20) + '...'
            });

            return true;
        } catch (error) {
            logger.error('缓存认证结果失败', { 
                userId, 
                error: error.message 
            });
            return false;
        }
    }

    /**
     * 获取缓存的用户认证结果
     * @param {number} userId - 用户ID
     * @param {string} token - JWT token
     * @returns {Object|null} 缓存的用户信息或null
     */
    async getCachedUserAuth(userId, token) {
        try {
            const cacheKey = this.generateCacheKey(userId, token);
            const cachedData = await cacheUtils.get(cacheKey);

            if (cachedData) {
                logger.debug('认证缓存命中', { 
                    userId, 
                    username: cachedData.username,
                    cached_at: cachedData.cached_at 
                });

                // 返回与数据库查询相同格式的数据
                return {
                    id: cachedData.id,
                    username: cachedData.username,
                    role: cachedData.role,
                    updated_at: cachedData.updated_at
                };
            }

            logger.debug('认证缓存未命中', { userId });
            return null;

        } catch (error) {
            logger.error('获取认证缓存失败', { 
                userId, 
                error: error.message 
            });
            return null;
        }
    }

    /**
     * 清除用户认证缓存
     * @param {number} userId - 用户ID
     * @param {string} token - 特定token的缓存，可选
     */
    async clearUserAuthCache(userId, token = null) {
        try {
            if (token) {
                // 清除特定token的缓存
                const cacheKey = this.generateCacheKey(userId, token);
                await cacheUtils.del(cacheKey);
                logger.debug('已清除特定认证缓存', { userId });
            } else {
                // 清除用户所有认证缓存
                const pattern = cacheUtils.generateKey(this.namespace, userId, '*');
                const deletedCount = await cacheUtils.delPattern(pattern);
                logger.debug('已清除用户所有认证缓存', { userId, deletedCount });
            }
            
            return true;
        } catch (error) {
            logger.error('清除认证缓存失败', { 
                userId, 
                error: error.message 
            });
            return false;
        }
    }

    /**
     * 批量清除认证缓存
     * @param {Array} userIds - 用户ID数组
     */
    async batchClearAuthCache(userIds) {
        try {
            const promises = userIds.map(userId => this.clearUserAuthCache(userId));
            await Promise.all(promises);
            
            logger.info('批量清除认证缓存完成', { 
                userCount: userIds.length 
            });
            
            return true;
        } catch (error) {
            logger.error('批量清除认证缓存失败', { 
                error: error.message 
            });
            return false;
        }
    }

    /**
     * 获取认证缓存统计
     */
    async getCacheStats() {
        try {
            // 这里可以实现缓存统计逻辑
            // 例如命中率、缓存数量等
            return {
                namespace: this.namespace,
                defaultTTL: this.defaultTTL,
                redisConnected: await cacheUtils.checkRedisHealth()
            };
        } catch (error) {
            logger.error('获取认证缓存统计失败', { 
                error: error.message 
            });
            return null;
        }
    }

    /**
     * 验证缓存数据的有效性
     * @param {Object} cachedUser - 缓存的用户数据
     * @param {Object} tokenPayload - JWT payload
     * @returns {boolean} 数据是否有效
     */
    validateCachedData(cachedUser, tokenPayload) {
        try {
            // 检查用户信息是否在token生成后被修改
            const tokenIssueTime = tokenPayload.iat * 1000;
            const userUpdateTime = new Date(cachedUser.updated_at).getTime();
            const toleranceMs = 10000; // 10秒容忍时间
            
            const timeDifference = userUpdateTime - tokenIssueTime;
            
            if (timeDifference > toleranceMs) {
                logger.debug('缓存数据已过期，用户信息有更新', {
                    userId: cachedUser.id,
                    tokenIssueTime: new Date(tokenIssueTime).toISOString(),
                    userUpdateTime: new Date(userUpdateTime).toISOString(),
                    timeDifference: `${timeDifference}ms`
                });
                return false;
            }

            return true;
        } catch (error) {
            logger.error('验证缓存数据失败', { 
                error: error.message 
            });
            return false;
        }
    }
}

// 创建单例实例
const authCache = new AuthCache();

module.exports = authCache;