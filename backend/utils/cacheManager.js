/**
 * 缓存管理器
 * 提供缓存监控、清理和管理功能
 */

const { cacheUtils } = require('../config/redis');
const logger = require('./logger');

class CacheManager {
    constructor() {
        this.namespaces = new Set(['api', 'session', 'ratelimit', 'query']);
        this.stats = {
            hits: 0,
            misses: 0,
            errors: 0,
            invalidations: 0
        };
    }

    /**
     * 注册新的命名空间
     */
    registerNamespace(namespace) {
        this.namespaces.add(namespace);
    }

    /**
     * 获取缓存统计信息
     */
    getStats() {
        return {
            ...this.stats,
            hitRate: this.stats.hits > 0 
                ? (this.stats.hits / (this.stats.hits + this.stats.misses) * 100).toFixed(2) + '%'
                : '0%'
        };
    }

    /**
     * 记录缓存命中
     */
    recordHit() {
        this.stats.hits++;
    }

    /**
     * 记录缓存未命中
     */
    recordMiss() {
        this.stats.misses++;
    }

    /**
     * 记录缓存错误
     */
    recordError() {
        this.stats.errors++;
    }

    /**
     * 清理指定路由的缓存
     */
    async clearRouteCache(route, userId = null) {
        try {
            let pattern = `api:${route.replace(/\//g, '_')}*`;
            
            if (userId) {
                pattern += `:user:${userId}`;
            }

            const deleted = await cacheUtils.delPattern(pattern);
            this.stats.invalidations += deleted;
            
            logger.info('路由缓存已清理', {
                route,
                pattern,
                deleted,
                userId
            });

            return deleted;
        } catch (error) {
            logger.error('清理路由缓存失败', {
                route,
                error: error.message
            });
            this.recordError();
            throw error;
        }
    }

    /**
     * 清理指定命名空间的所有缓存
     */
    async clearNamespace(namespace) {
        try {
            const pattern = `${namespace}:*`;
            const deleted = await cacheUtils.delPattern(pattern);
            this.stats.invalidations += deleted;
            
            logger.info('命名空间缓存已清理', {
                namespace,
                deleted
            });

            return deleted;
        } catch (error) {
            logger.error('清理命名空间缓存失败', {
                namespace,
                error: error.message
            });
            this.recordError();
            throw error;
        }
    }

    /**
     * 清理所有缓存
     */
    async clearAll() {
        try {
            let totalDeleted = 0;
            
            for (const namespace of this.namespaces) {
                const deleted = await this.clearNamespace(namespace);
                totalDeleted += deleted;
            }

            logger.info('所有缓存已清理', {
                totalDeleted,
                namespaces: Array.from(this.namespaces)
            });

            return totalDeleted;
        } catch (error) {
            logger.error('清理所有缓存失败', {
                error: error.message
            });
            this.recordError();
            throw error;
        }
    }

    /**
     * 清理过期缓存（主动清理）
     */
    async cleanupExpired() {
        try {
            // Redis会自动清理过期键，这里可以添加额外的清理逻辑
            logger.debug('执行过期缓存清理检查');
            
            // 可以添加自定义的清理逻辑
            // 例如：清理超过特定时间的缓存
            
            return 0;
        } catch (error) {
            logger.error('清理过期缓存失败', {
                error: error.message
            });
            this.recordError();
            throw error;
        }
    }

    /**
     * 预热缓存
     */
    async warmup(routes = []) {
        try {
            logger.info('开始缓存预热', {
                routes: routes.length
            });

            // 这里可以添加预热逻辑
            // 例如：预先加载常用数据到缓存

            return true;
        } catch (error) {
            logger.error('缓存预热失败', {
                error: error.message
            });
            this.recordError();
            throw error;
        }
    }

    /**
     * 获取缓存信息
     */
    async getCacheInfo() {
        try {
            const info = await cacheUtils.info();
            const stats = this.getStats();
            
            return {
                redis: info,
                stats,
                namespaces: Array.from(this.namespaces)
            };
        } catch (error) {
            logger.error('获取缓存信息失败', {
                error: error.message
            });
            this.recordError();
            throw error;
        }
    }

    /**
     * 设置自动清理任务
     */
    setupAutoCleanup(intervalHours = 24) {
        setInterval(async () => {
            try {
                logger.info('执行定期缓存清理');
                await this.cleanupExpired();
                
                // 重置统计信息
                if (this.stats.hits + this.stats.misses > 100000) {
                    logger.info('重置缓存统计信息', this.stats);
                    this.stats = {
                        hits: 0,
                        misses: 0,
                        errors: 0,
                        invalidations: 0
                    };
                }
            } catch (error) {
                logger.error('定期缓存清理失败', {
                    error: error.message
                });
            }
        }, intervalHours * 60 * 60 * 1000);
    }
}

// 创建单例实例
const cacheManager = new CacheManager();

// 设置自动清理（每24小时）
cacheManager.setupAutoCleanup(24);

module.exports = cacheManager;