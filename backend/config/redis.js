/**
 * Redis配置和连接管理
 */

const Redis = require('ioredis');
const logger = require('../utils/logger');

class RedisManager {
    constructor() {
        this.client = null;
        this.isConnected = false;
        this.lastErrorTime = 0;
        this.connectionEnabled = true; // 新增：控制连接尝试
    }

    /**
     * 初始化Redis连接
     */
    async connect() {
        try {
            // 检查Redis是否被启用 - 默认关闭，需要明确设置为true才启用
            const redisEnabled = process.env.REDIS_ENABLED === 'true' && process.env.REDIS_HOST;
            if (!redisEnabled) {
                logger.info('Redis未启用或未配置，跳过连接');
                this.connectionEnabled = false;
                return null;
            }

            const config = {
                host: process.env.REDIS_HOST || 'localhost',
                port: parseInt(process.env.REDIS_PORT) || 6379,
                password: process.env.REDIS_PASSWORD || undefined,
                db: parseInt(process.env.REDIS_DB) || 0,
                
                // 连接选项
                lazyConnect: false,  // 改为false，立即连接
                keepAlive: 30000,
                
                // 标准重试策略 - 指数退避
                retryStrategy: (times) => {
                    const delay = Math.min(times * 1000, 30000); // 最大30秒
                    logger.info(`Redis重连策略: 第${times}次重试，延迟${delay}ms`);
                    return delay;
                },
                
                // 重试配置（去重复）
                maxRetriesPerRequest: 3,
                retryDelayOnFailover: 1000,
                
                // 性能优化
                enableOfflineQueue: false, // 改为false，失败时立即返回
                enableReadyCheck: true,
                
                // 重连策略
                reconnectOnError: (err) => {
                    const reconnectErrors = ['READONLY', 'ECONNRESET', 'ENOTFOUND', 'ETIMEDOUT', 'EHOSTDOWN', 'ENETUNREACH'];
                    const shouldReconnect = reconnectErrors.some(errType => err.message.includes(errType));
                    if (shouldReconnect) {
                        logger.info(`Redis错误触发重连: ${err.message}`);
                    }
                    return shouldReconnect;
                },
                
                // 超时配置
                connectTimeout: 10000,
                commandTimeout: 5000,
                
                // 健康检查
                family: 4
            };

            // 如果已有客户端，先清理
            if (this.client) {
                try {
                    this.client.removeAllListeners();
                    await this.client.disconnect();
                } catch (err) {
                    logger.warn('清理旧Redis连接失败:', err.message);
                }
            }

            // 创建Redis实例
            this.client = new Redis(config);
            
            // 设置事件监听器
            this.setupEventListeners();
            
            logger.info('开始建立Redis连接...', {
                host: config.host,
                port: config.port,
                db: config.db
            });
            
            return this.client;
            
        } catch (error) {
            logger.error('Redis连接初始化失败:', {
                error: error.message,
                stack: error.stack
            });
            
            // 不再禁用，保留客户端让ioredis自动重连
            if (this.client) {
                logger.info('保留Redis客户端，等待ioredis自动重连...');
            }
            
            return this.client;
        }
    }

    /**
     * 设置事件监听器
     */
    setupEventListeners() {
        if (!this.client) return;

        this.client.on('connect', () => {
            logger.info('🔄 Redis正在连接...');
        });

        this.client.on('ready', () => {
            this.isConnected = true;
            this.retryAttempts = 0;
            logger.info('✅ Redis连接就绪');
        });

        this.client.on('error', (error) => {
            this.isConnected = false;
            
            // 减少错误日志频率，避免日志轰炸
            const now = Date.now();
            if (!this.lastErrorTime || (now - this.lastErrorTime) > 30000) { // 30秒间隔
                logger.error('Redis连接错误:', {
                    error: error.message,
                    code: error.code
                });
                this.lastErrorTime = now;
            }
        });

        this.client.on('close', () => {
            this.isConnected = false;
            logger.warn('⚠️ Redis连接关闭');
        });

        this.client.on('reconnecting', (delay) => {
            logger.info(`🔄 Redis重连中，延迟: ${delay}ms`);
        });

        this.client.on('end', () => {
            this.isConnected = false;
            logger.info('Redis连接结束');
        });
    }

    /**
     * 获取客户端实例
     */
    getClient() {
        if (!this.client) {
            throw new Error('Redis客户端未初始化');
        }
        return this.client;
    }

    /**
     * 检查连接状态 - 增强版
     */
    isReady() {
        if (!this.client || !this.connectionEnabled) {
            return false;
        }
        
        // 检查客户端状态
        const status = this.client.status;
        return status === 'ready' && this.isConnected;
    }
    
    /**
     * 健康检查 - 新增
     */
    async healthCheck() {
        if (!this.isReady()) {
            return false;
        }
        
        try {
            await this.client.ping();
            return true;
        } catch (error) {
            logger.warn('Redis健康检查失败:', error.message);
            return false;
        }
    }

    /**
     * 获取连接状态
     */
    getStatus() {
        return {
            connected: this.isConnected,
            status: this.client?.status || 'disconnected',
            retryAttempts: this.retryAttempts,
            maxRetries: this.maxRetries
        };
    }

    /**
     * 启动定期健康检查 - 新增
     */
    startHealthCheck() {
        // 清除旧的定时器
        if (this.healthCheckTimer) {
            clearInterval(this.healthCheckTimer);
        }
        
        // 每30秒检查一次
        this.healthCheckTimer = setInterval(async () => {
            const isHealthy = await this.healthCheck();
            if (!isHealthy && this.isConnected) {
                logger.warn('Redis健康检查失败，尝试重连...');
                await this.reconnect();
            }
        }, 30000);
    }
    
    /**
     * 停止健康检查 - 新增
     */
    stopHealthCheck() {
        if (this.healthCheckTimer) {
            clearInterval(this.healthCheckTimer);
            this.healthCheckTimer = null;
        }
    }
    
    /**
     * 关闭连接
     */
    async disconnect() {
        this.stopHealthCheck();
        
        if (this.client) {
            await this.client.quit();
            this.client = null;
            this.isConnected = false;
            logger.info('Redis连接已关闭');
        }
    }

    /**
     * 重置连接状态并重新尝试连接
     */
    async reconnect() {
        logger.info('手动重置Redis连接...');
        this.lastErrorTime = 0;
        this.isConnected = false;
        
        return await this.connect();
    }

    /**
     * 清空所有缓存
     */
    async flushAll() {
        if (this.isReady()) {
            await this.client.flushdb();
            logger.info('Redis缓存已清空');
        }
    }
}

// 创建单例实例
const redisManager = new RedisManager();

// 缓存工具类
class CacheUtils {
    constructor(redisManager) {
        this.redis = redisManager;
        this.defaultTTL = parseInt(process.env.CACHE_TTL) || 3600; // 默认1小时
    }

    /**
     * 生成缓存键
     */
    generateKey(namespace, identifier, suffix = '') {
        const parts = [namespace, identifier, suffix].filter(Boolean);
        return parts.join(':');
    }

    /**
     * 设置缓存 - 增强版
     */
    async set(key, value, ttl = this.defaultTTL) {
        // 检查Redis状态
        if (!this.redis.isReady()) {
            logger.debug('Redis不可用，跳过缓存设置', { key });
            return false;
        }

        try {
            const serialized = JSON.stringify(value);
            if (ttl > 0) {
                await this.redis.getClient().setex(key, ttl, serialized);
            } else {
                await this.redis.getClient().set(key, serialized);
            }
            
            logger.debug('缓存设置成功', { key, ttl });
            return true;
        } catch (error) {
            logger.error('缓存设置失败', { key, error: error.message });
            return false;
        }
    }
    
    /**
     * 检查Redis健康状态 - 新增
     */
    async checkRedisHealth() {
        if (!this.redis.isReady()) {
            return false;
        }
        
        return await this.redis.healthCheck();
    }

    /**
     * 获取缓存 - 增强版
     */
    async get(key) {
        if (!this.redis.isReady()) {
            logger.debug('Redis不可用，跳过缓存获取', { key });
            return null;
        }

        try {
            const cached = await this.redis.getClient().get(key);
            if (cached === null) {
                return null;
            }
            
            const value = JSON.parse(cached);
            logger.debug('缓存命中', { key });
            return value;
        } catch (error) {
            logger.error('缓存获取失败', { key, error: error.message });
            return null;
        }
    }

    /**
     * 删除缓存
     */
    async del(key) {
        if (!this.redis.isReady()) {
            logger.warn('Redis未连接，跳过缓存删除', { key });
            return false;
        }

        try {
            const result = await this.redis.getClient().del(key);
            logger.debug('缓存删除成功', { key, deleted: result });
            return result > 0;
        } catch (error) {
            logger.error('缓存删除失败', { key, error: error.message });
            return false;
        }
    }

    /**
     * 检查缓存是否存在
     */
    async exists(key) {
        if (!this.redis.isReady()) {
            return false;
        }

        try {
            const result = await this.redis.getClient().exists(key);
            return result > 0;
        } catch (error) {
            logger.error('缓存检查失败', { key, error: error.message });
            return false;
        }
    }

    /**
     * 设置过期时间
     */
    async expire(key, ttl) {
        if (!this.redis.isReady()) {
            return false;
        }

        try {
            const result = await this.redis.getClient().expire(key, ttl);
            return result > 0;
        } catch (error) {
            logger.error('设置过期时间失败', { key, ttl, error: error.message });
            return false;
        }
    }

    /**
     * 获取剩余过期时间
     */
    async ttl(key) {
        if (!this.redis.isReady()) {
            return -1;
        }

        try {
            return await this.redis.getClient().ttl(key);
        } catch (error) {
            logger.error('获取TTL失败', { key, error: error.message });
            return -1;
        }
    }

    /**
     * 批量删除（通过模式匹配）
     */
    async delPattern(pattern) {
        if (!this.redis.isReady()) {
            return 0;
        }

        try {
            const keys = await this.redis.getClient().keys(pattern);
            if (keys.length === 0) {
                return 0;
            }
            
            const result = await this.redis.getClient().del(...keys);
            logger.debug('批量缓存删除成功', { pattern, deleted: result });
            return result;
        } catch (error) {
            logger.error('批量缓存删除失败', { pattern, error: error.message });
            return 0;
        }
    }

    /**
     * 递增计数器
     */
    async incr(key, amount = 1, ttl = this.defaultTTL) {
        if (!this.redis.isReady()) {
            return amount;
        }

        try {
            let result;
            if (amount === 1) {
                result = await this.redis.getClient().incr(key);
            } else {
                result = await this.redis.getClient().incrby(key, amount);
            }
            
            // 设置过期时间（仅在首次创建时）
            if (result === amount && ttl > 0) {
                await this.redis.getClient().expire(key, ttl);
            }
            
            return result;
        } catch (error) {
            logger.error('计数器递增失败', { key, amount, error: error.message });
            return amount;
        }
    }

    /**
     * 获取缓存统计
     */
    async getStats() {
        if (!this.redis.isReady()) {
            return null;
        }

        try {
            const info = await this.redis.getClient().info('memory');
            const keyspace = await this.redis.getClient().info('keyspace');
            
            return {
                memory: info,
                keyspace: keyspace,
                connected: this.redis.isReady(),
                status: this.redis.getStatus()
            };
        } catch (error) {
            logger.error('获取缓存统计失败', { error: error.message });
            return null;
        }
    }

    /**
     * 清空所有缓存
     */
    async flushAll() {
        if (!this.redis.isReady()) {
            logger.warn('Redis未连接，跳过缓存清空');
            return false;
        }

        try {
            await this.redis.getClient().flushdb();
            logger.info('所有Redis缓存已清空');
            return true;
        } catch (error) {
            logger.error('清空缓存失败', { error: error.message });
            return false;
        }
    }
}

// 创建缓存工具实例
const cacheUtils = new CacheUtils(redisManager);

module.exports = {
    redisManager,
    cacheUtils
};