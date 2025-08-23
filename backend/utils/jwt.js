/**
 * JWT工具类 - 增强版本
 * 支持访问令牌和刷新令牌机制
 */

const jwt = require('jsonwebtoken');
const logger = require('./logger');
const { cacheUtils } = require('../config/redis');

class JWTUtils {
    constructor() {
        this.accessTokenSecret = process.env.JWT_SECRET;
        this.refreshTokenSecret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET + '_refresh';
        this.accessTokenExpiry = process.env.JWT_EXPIRY || '30m';  // 访问令牌30分钟
        this.refreshTokenExpiry = process.env.JWT_REFRESH_EXPIRY || '7d'; // 刷新令牌7天
        
        // 存储有效的刷新令牌（优先使用Redis，备用内存）
        this.validRefreshTokens = new Set();
        this.useRedis = process.env.NODE_ENV === 'production'; // 生产环境优先使用Redis
        
        if (!this.accessTokenSecret) {
            throw new Error('JWT_SECRET环境变量未设置');
        }
    }

    /**
     * 生成访问令牌
     * @param {Object} payload 载荷数据
     * @returns {string} 访问令牌
     */
    generateAccessToken(payload) {
        try {
            const token = jwt.sign(
                {
                    ...payload,
                    type: 'access',
                    iat: Math.floor(Date.now() / 1000)
                },
                this.accessTokenSecret,
                { 
                    expiresIn: this.accessTokenExpiry,
                    issuer: 'dingtalk-reminder-system',
                    audience: 'dingtalk-reminder-users'
                }
            );
            
            logger.debug('生成访问令牌', { userId: payload.userId });
            return token;
        } catch (error) {
            logger.error('生成访问令牌失败:', error);
            throw new Error('生成访问令牌失败');
        }
    }

    /**
     * 生成刷新令牌
     * @param {Object} payload 载荷数据
     * @returns {string} 刷新令牌
     */
    async generateRefreshToken(payload) {
        try {
            const token = jwt.sign(
                {
                    userId: payload.userId,
                    username: payload.username,
                    type: 'refresh',
                    iat: Math.floor(Date.now() / 1000)
                },
                this.refreshTokenSecret,
                { 
                    expiresIn: this.refreshTokenExpiry,
                    issuer: 'dingtalk-reminder-system',
                    audience: 'dingtalk-reminder-users'
                }
            );
            
            // 将刷新令牌添加到存储
            await this.addRefreshToken(token, payload.userId);
            
            logger.debug('生成刷新令牌', { userId: payload.userId });
            return token;
        } catch (error) {
            logger.error('生成刷新令牌失败:', error);
            throw new Error('生成刷新令牌失败');
        }
    }

    /**
     * 生成令牌对（访问令牌 + 刷新令牌）
     * @param {Object} payload 载荷数据
     * @returns {Object} 令牌对
     */
    async generateTokenPair(payload) {
        const accessToken = this.generateAccessToken(payload);
        const refreshToken = await this.generateRefreshToken(payload);
        
        return {
            accessToken,
            refreshToken,
            accessTokenExpiresIn: this.accessTokenExpiry,
            refreshTokenExpiresIn: this.refreshTokenExpiry,
            tokenType: 'Bearer'
        };
    }

    /**
     * 验证访问令牌
     * @param {string} token 访问令牌
     * @returns {Object} 解码后的载荷
     */
    verifyAccessToken(token) {
        try {
            const decoded = jwt.verify(token, this.accessTokenSecret, {
                issuer: 'dingtalk-reminder-system',
                audience: 'dingtalk-reminder-users'
            });
            
            if (decoded.type !== 'access') {
                throw new Error('无效的令牌类型');
            }
            
            return decoded;
        } catch (error) {
            if (error.name === 'TokenExpiredError') {
                throw new Error('访问令牌已过期');
            } else if (error.name === 'JsonWebTokenError') {
                throw new Error('无效的访问令牌');
            } else {
                throw error;
            }
        }
    }

    /**
     * 验证刷新令牌
     * @param {string} token 刷新令牌
     * @returns {Object} 解码后的载荷
     */
    async verifyRefreshToken(token) {
        try {
            // 检查令牌是否在有效存储中
            const isValid = await this.isRefreshTokenValid(token);
            if (!isValid) {
                throw new Error('刷新令牌已失效');
            }
            
            const decoded = jwt.verify(token, this.refreshTokenSecret, {
                issuer: 'dingtalk-reminder-system',
                audience: 'dingtalk-reminder-users'
            });
            
            if (decoded.type !== 'refresh') {
                throw new Error('无效的令牌类型');
            }
            
            return decoded;
        } catch (error) {
            // 从存储中移除无效令牌
            await this.removeRefreshToken(token);
            
            if (error.name === 'TokenExpiredError') {
                throw new Error('刷新令牌已过期');
            } else if (error.name === 'JsonWebTokenError') {
                throw new Error('无效的刷新令牌');
            } else {
                throw error;
            }
        }
    }

    /**
     * 使用刷新令牌刷新访问令牌
     * @param {string} refreshToken 刷新令牌
     * @returns {Object} 新的令牌对
     */
    async refreshAccessToken(refreshToken) {
        try {
            const decoded = await this.verifyRefreshToken(refreshToken);
            
            // 生成新的令牌对
            const payload = {
                userId: decoded.userId,
                username: decoded.username,
                role: decoded.role
            };
            
            // 生成新的令牌对
            const newTokens = await this.generateTokenPair(payload);
            
            // 设置旧令牌的宽限期（60秒内仍可使用，防止并发刷新冲突）
            try {
                if (cacheUtils && cacheUtils.redis && cacheUtils.redis.isReady()) {
                    const graceKey = `refresh_token:grace:${decoded.userId}:${Date.now()}`;
                    await cacheUtils.set(graceKey, refreshToken, 60); // 60秒宽限期
                    logger.debug('设置刷新令牌宽限期', { userId: decoded.userId });
                }
            } catch (graceError) {
                logger.warn('设置令牌宽限期失败:', graceError.message);
            }
            
            // 延迟移除旧的刷新令牌（给并发请求留出时间）
            setTimeout(async () => {
                await this.revokeRefreshToken(refreshToken);
            }, 5000); // 5秒后移除旧令牌
            
            logger.info('令牌刷新成功', { userId: decoded.userId });
            return newTokens;
        } catch (error) {
            logger.warn('令牌刷新失败:', error.message);
            throw error;
        }
    }

    /**
     * 撤销刷新令牌
     * @param {string} refreshToken 要撤销的刷新令牌
     */
    async revokeRefreshToken(refreshToken) {
        const removed = await this.removeRefreshToken(refreshToken);
        if (removed) {
            logger.debug('刷新令牌已撤销');
        }
        return removed;
    }

    /**
     * 撤销用户的所有刷新令牌（用于登出所有设备）
     * @param {number} userId 用户ID
     */
    async revokeAllUserRefreshTokens(userId) {
        let revokedCount = 0;
        
        try {
            if (cacheUtils && cacheUtils.redis && cacheUtils.redis.isReady()) {
                // 使用Redis批量删除
                const pattern = `refresh_token:user:${userId}:*`;
                revokedCount = await cacheUtils.delPattern(pattern);
            } else {
                // 使用内存集合
                for (const token of this.validRefreshTokens) {
                    try {
                        const decoded = jwt.decode(token);
                        if (decoded && decoded.userId === userId) {
                            this.validRefreshTokens.delete(token);
                            revokedCount++;
                        }
                    } catch (error) {
                        // 忽略解码错误，直接删除
                        this.validRefreshTokens.delete(token);
                    }
                }
            }
        } catch (error) {
            logger.error('撤销用户刷新令牌失败:', error.message);
        }
        
        logger.info(`撤销用户所有刷新令牌`, { userId, revokedCount });
        return revokedCount;
    }

    /**
     * 清理过期的刷新令牌
     */
    async cleanupExpiredTokens() {
        let cleanedCount = 0;
        
        try {
            if (cacheUtils && cacheUtils.redis && cacheUtils.redis.isReady()) {
                // Redis会自动清理过期的键，暂时不需要手动清理
                logger.debug('Redis自动清理过期令牌');
                return 0;
            } else {
                // 清理内存集合中的过期令牌
                for (const token of this.validRefreshTokens) {
                    try {
                        jwt.verify(token, this.refreshTokenSecret);
                    } catch (error) {
                        this.validRefreshTokens.delete(token);
                        cleanedCount++;
                    }
                }
            }
        } catch (error) {
            logger.error('清理过期令牌失败:', error.message);
        }
        
        if (cleanedCount > 0) {
            logger.info(`清理过期刷新令牌: ${cleanedCount}个`);
        }
        
        return cleanedCount;
    }

    /**
     * 获取令牌统计信息
     */
    async getTokenStats() {
        let validRefreshTokens = this.validRefreshTokens.size;
        
        try {
            if (cacheUtils && cacheUtils.redis && cacheUtils.redis.isReady()) {
                // 从 Redis 获取统计
                const keys = await cacheUtils.redis.getClient().keys('refresh_token:user:*');
                validRefreshTokens = keys.length;
            }
        } catch (error) {
            logger.warn('获取Redis令牌统计失败:', error.message);
        }
        
        return {
            validRefreshTokens,
            accessTokenExpiry: this.accessTokenExpiry,
            refreshTokenExpiry: this.refreshTokenExpiry,
            storageType: cacheUtils && cacheUtils.redis && cacheUtils.redis.isReady() ? 'redis' : 'memory'
        };
    }
    
    /**
     * 添加刷新令牌到存储
     */
    async addRefreshToken(token, userId) {
        try {
            if (cacheUtils && cacheUtils.redis && cacheUtils.redis.isReady()) {
                const key = `refresh_token:user:${userId}:${Date.now()}`;
                const expiry = this.parseExpiry(this.refreshTokenExpiry);
                await cacheUtils.set(key, token, expiry);
            } else {
                this.validRefreshTokens.add(token);
            }
        } catch (error) {
            logger.warn('添加刷新令牌失败，使用内存存储:', error.message);
            this.validRefreshTokens.add(token);
        }
    }
    
    /**
     * 检查刷新令牌是否有效
     */
    async isRefreshTokenValid(token) {
        try {
            if (cacheUtils && cacheUtils.redis && cacheUtils.redis.isReady()) {
                // 在Redis中搜索令牌
                const keys = await cacheUtils.redis.getClient().keys('refresh_token:user:*');
                for (const key of keys) {
                    const storedToken = await cacheUtils.get(key);
                    if (storedToken === token) {
                        return true;
                    }
                }
                
                // Redis中未找到时，检查宽限期令牌
                try {
                    const decoded = jwt.decode(token);
                    if (decoded && decoded.userId) {
                        const graceKeys = await cacheUtils.redis.getClient().keys(`refresh_token:grace:${decoded.userId}:*`);
                        for (const graceKey of graceKeys) {
                            const graceToken = await cacheUtils.get(graceKey);
                            if (graceToken === token) {
                                logger.debug('令牌在宽限期内有效', { userId: decoded.userId });
                                return true;
                            }
                        }
                    }
                } catch (graceError) {
                    logger.warn('检查宽限期令牌失败:', graceError.message);
                }
                
                // 检查内存集合（用于Redis切换期迁移）
                if (this.validRefreshTokens.has(token)) {
                    logger.info('Redis切换期令牌迁移: 从内存迁移到Redis', { hasToken: true });
                    try {
                        // 尝试解码获取用户ID
                        const decoded = jwt.decode(token);
                        if (decoded && decoded.userId) {
                            // 迁移到Redis
                            const key = `refresh_token:user:${decoded.userId}:${Date.now()}`;
                            const expiry = this.parseExpiry(this.refreshTokenExpiry);
                            await cacheUtils.set(key, token, expiry);
                            logger.info('令牌迁移成功', { userId: decoded.userId });
                            return true;
                        }
                    } catch (migrateError) {
                        logger.warn('令牌迁移失败，但允许通过:', migrateError.message);
                        return true;
                    }
                }
                
                // 都没找到，返回false
                return false;
            } else {
                // Redis不可用时的降级策略：检查内存集合或直接验证JWT
                if (this.validRefreshTokens.has(token)) {
                    return true;
                }
                logger.warn('Redis不可用，使用JWT验证降级策略');
                return true; // 让JWT本身的过期验证来处理
            }
        } catch (error) {
            logger.warn('检查刷新令牌失败，使用降级策略:', error.message);
            // 降级：检查内存集合或允许JWT验证
            return this.validRefreshTokens.has(token) || true;
        }
    }
    
    /**
     * 从存储中移除刷新令牌
     */
    async removeRefreshToken(token) {
        let removed = false;
        
        try {
            if (cacheUtils && cacheUtils.redis && cacheUtils.redis.isReady()) {
                // 在Redis中搜索并删除令牌
                const keys = await cacheUtils.redis.getClient().keys('refresh_token:user:*');
                for (const key of keys) {
                    const storedToken = await cacheUtils.get(key);
                    if (storedToken === token) {
                        await cacheUtils.del(key);
                        removed = true;
                        break;
                    }
                }
            } else {
                removed = this.validRefreshTokens.delete(token);
            }
        } catch (error) {
            logger.warn('移除刷新令牌失败，使用内存操作:', error.message);
            removed = this.validRefreshTokens.delete(token);
        }
        
        return removed;
    }
    
    /**
     * 解析过期时间为秒数
     */
    parseExpiry(expiry) {
        if (typeof expiry === 'number') {
            return expiry;
        }
        
        if (typeof expiry === 'string') {
            const match = expiry.match(/^(\d+)([smhd])$/);
            if (match) {
                const value = parseInt(match[1]);
                const unit = match[2];
                
                switch (unit) {
                    case 's': return value;
                    case 'm': return value * 60;
                    case 'h': return value * 60 * 60;
                    case 'd': return value * 24 * 60 * 60;
                    default: return 7 * 24 * 60 * 60; // 默认7天
                }
            }
        }
        
        return 7 * 24 * 60 * 60; // 默认7天
    }
}

// 创建全局实例
const jwtUtils = new JWTUtils();

// 定期清理过期令牌（每小时）
setInterval(async () => {
    await jwtUtils.cleanupExpiredTokens();
}, 60 * 60 * 1000);

module.exports = jwtUtils;