/**
 * Redis Stub - 轻量级Redis接口保留方案
 * 当不使用Redis时，提供空实现避免代码报错
 * 当需要Redis时，只需修改配置即可启用
 */

const logger = require('../utils/logger');

/**
 * Redis存根实现
 * 提供所有Redis接口但不执行实际操作
 */
class RedisStub {
    constructor() {
        this.enabled = false;
        logger.info('Redis Stub 模式 - Redis功能已禁用');
    }

    async connect() {
        return null;
    }

    async disconnect() {
        return true;
    }

    async get() {
        return null;
    }

    async set() {
        return true;
    }

    async del() {
        return true;
    }

    async exists() {
        return false;
    }

    async expire() {
        return true;
    }

    async ttl() {
        return -1;
    }

    async incr() {
        return 1;
    }

    async hget() {
        return null;
    }

    async hset() {
        return true;
    }

    async hdel() {
        return true;
    }

    async hgetall() {
        return {};
    }

    async keys() {
        return [];
    }

    async flushPattern() {
        return true;
    }

    async flushAll() {
        return true;
    }

    getStatus() {
        return {
            connected: false,
            host: 'none',
            port: 0,
            database: 0,
            uptime: 0,
            clients: 0,
            memory: { used: 0, peak: 0 },
            hits: 0,
            misses: 0,
            keys: 0
        };
    }

    isConnected() {
        return false;
    }
}

/**
 * 缓存工具存根实现
 */
class CacheUtilsStub {
    constructor() {
        this.enabled = false;
    }

    async get() {
        return null;
    }

    async set() {
        return true;
    }

    async del() {
        return true;
    }

    async remember(key, ttl, callback) {
        // 直接执行回调，不缓存
        return await callback();
    }

    async invalidate() {
        return true;
    }

    async flush() {
        return true;
    }

    generateKey(...parts) {
        return parts.filter(Boolean).join(':');
    }
}

// 根据环境变量决定是否加载真实Redis还是Stub
const useRealRedis = process.env.REDIS_ENABLED === 'true' && process.env.REDIS_HOST;

if (useRealRedis) {
    // 加载真实的Redis实现
    module.exports = require('./redis');
} else {
    // 使用Stub实现
    const redisManager = new RedisStub();
    const cacheUtils = new CacheUtilsStub();
    
    module.exports = {
        redisManager,
        cacheUtils
    };
}