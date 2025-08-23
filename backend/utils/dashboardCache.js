/**
 * 仪表板数据缓存工具
 * 优化仪表板复杂查询性能，减少数据库负载
 */

const { cacheUtils } = require('../config/redis');
const logger = require('./logger');

class DashboardCache {
    constructor() {
        this.namespace = 'dashboard';
        this.overviewTTL = 120;    // 概览数据缓存2分钟
        this.statsTTL = 300;       // 统计数据缓存5分钟
        this.trendTTL = 600;       // 趋势数据缓存10分钟
    }

    /**
     * 生成仪表板缓存键
     * @param {string} type - 缓存类型 (overview, stats, trend等)
     * @param {number} userId - 用户ID
     * @param {string} suffix - 附加标识符(日期等)
     * @returns {string} 缓存键
     */
    generateCacheKey(type, userId, suffix = '') {
        const parts = [this.namespace, type, userId];
        if (suffix) parts.push(suffix);
        return parts.join(':');
    }

    /**
     * 缓存仪表板概览数据
     * @param {number} userId - 用户ID
     * @param {Object} overviewData - 概览数据
     * @param {number} ttl - 缓存时间，默认2分钟
     */
    async cacheOverview(userId, overviewData, ttl = this.overviewTTL) {
        try {
            const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
            const cacheKey = this.generateCacheKey('overview', userId, today);
            
            const cacheData = {
                ...overviewData,
                cached_at: new Date().toISOString(),
                expires_at: new Date(Date.now() + ttl * 1000).toISOString(),
                cache_type: 'overview'
            };

            await cacheUtils.set(cacheKey, cacheData, ttl);
            
            logger.debug('仪表板概览数据已缓存', { 
                userId, 
                dataPoints: Object.keys(overviewData).length,
                ttl: ttl + 's',
                cacheKey: cacheKey.substring(0, 30) + '...'
            });

            return true;
        } catch (error) {
            logger.error('缓存仪表板概览数据失败', { 
                userId, 
                error: error.message 
            });
            return false;
        }
    }

    /**
     * 获取缓存的仪表板概览数据
     * @param {number} userId - 用户ID
     * @returns {Object|null} 缓存的概览数据或null
     */
    async getCachedOverview(userId) {
        try {
            const today = new Date().toISOString().split('T')[0];
            const cacheKey = this.generateCacheKey('overview', userId, today);
            const cachedData = await cacheUtils.get(cacheKey);

            if (cachedData) {
                logger.debug('仪表板概览缓存命中', { 
                    userId, 
                    cached_at: cachedData.cached_at,
                    dataPoints: Object.keys(cachedData).length - 3 // 除去meta字段
                });

                // 移除缓存元数据，返回纯业务数据
                const { cached_at, expires_at, cache_type, ...businessData } = cachedData;
                return businessData;
            }

            logger.debug('仪表板概览缓存未命中', { userId });
            return null;

        } catch (error) {
            logger.error('获取仪表板概览缓存失败', { 
                userId, 
                error: error.message 
            });
            return null;
        }
    }

    /**
     * 缓存周趋势数据
     * @param {number} userId - 用户ID
     * @param {Array} trendData - 趋势数据
     * @param {number} ttl - 缓存时间，默认10分钟
     */
    async cacheTrend(userId, trendData, ttl = this.trendTTL) {
        try {
            const weekKey = this.getWeekKey(); // 获取当前周标识
            const cacheKey = this.generateCacheKey('trend', userId, weekKey);
            
            const cacheData = {
                trend_data: trendData,
                cached_at: new Date().toISOString(),
                expires_at: new Date(Date.now() + ttl * 1000).toISOString(),
                cache_type: 'trend',
                data_points: trendData.length
            };

            await cacheUtils.set(cacheKey, cacheData, ttl);
            
            logger.debug('趋势数据已缓存', { 
                userId, 
                dataPoints: trendData.length,
                weekKey,
                ttl: ttl + 's'
            });

            return true;
        } catch (error) {
            logger.error('缓存趋势数据失败', { 
                userId, 
                error: error.message 
            });
            return false;
        }
    }

    /**
     * 获取缓存的趋势数据
     * @param {number} userId - 用户ID
     * @returns {Array|null} 缓存的趋势数据或null
     */
    async getCachedTrend(userId) {
        try {
            const weekKey = this.getWeekKey();
            const cacheKey = this.generateCacheKey('trend', userId, weekKey);
            const cachedData = await cacheUtils.get(cacheKey);

            if (cachedData && cachedData.trend_data) {
                logger.debug('趋势数据缓存命中', { 
                    userId, 
                    dataPoints: cachedData.data_points,
                    cached_at: cachedData.cached_at
                });

                return cachedData.trend_data;
            }

            logger.debug('趋势数据缓存未命中', { userId });
            return null;

        } catch (error) {
            logger.error('获取趋势数据缓存失败', { 
                userId, 
                error: error.message 
            });
            return null;
        }
    }

    /**
     * 缓存统计数据
     * @param {number} userId - 用户ID
     * @param {string} statsType - 统计类型
     * @param {Object} statsData - 统计数据
     * @param {number} ttl - 缓存时间，默认5分钟
     */
    async cacheStats(userId, statsType, statsData, ttl = this.statsTTL) {
        try {
            const today = new Date().toISOString().split('T')[0];
            const cacheKey = this.generateCacheKey('stats', userId, `${statsType}_${today}`);
            
            const cacheData = {
                stats_type: statsType,
                stats_data: statsData,
                cached_at: new Date().toISOString(),
                expires_at: new Date(Date.now() + ttl * 1000).toISOString()
            };

            await cacheUtils.set(cacheKey, cacheData, ttl);
            
            logger.debug('统计数据已缓存', { 
                userId, 
                statsType,
                ttl: ttl + 's'
            });

            return true;
        } catch (error) {
            logger.error('缓存统计数据失败', { 
                userId, 
                statsType,
                error: error.message 
            });
            return false;
        }
    }

    /**
     * 获取缓存的统计数据
     * @param {number} userId - 用户ID  
     * @param {string} statsType - 统计类型
     * @returns {Object|null} 缓存的统计数据或null
     */
    async getCachedStats(userId, statsType) {
        try {
            const today = new Date().toISOString().split('T')[0];
            const cacheKey = this.generateCacheKey('stats', userId, `${statsType}_${today}`);
            const cachedData = await cacheUtils.get(cacheKey);

            if (cachedData && cachedData.stats_data) {
                logger.debug('统计数据缓存命中', { 
                    userId, 
                    statsType,
                    cached_at: cachedData.cached_at
                });

                return cachedData.stats_data;
            }

            logger.debug('统计数据缓存未命中', { userId, statsType });
            return null;

        } catch (error) {
            logger.error('获取统计数据缓存失败', { 
                userId, 
                statsType,
                error: error.message 
            });
            return null;
        }
    }

    /**
     * 清除用户仪表板缓存
     * @param {number} userId - 用户ID
     * @param {string} type - 缓存类型，可选
     */
    async clearUserDashboardCache(userId, type = null) {
        try {
            let pattern;
            if (type) {
                pattern = this.generateCacheKey(type, userId, '*');
            } else {
                pattern = this.generateCacheKey('*', userId, '*');
            }
            
            const deletedCount = await cacheUtils.delPattern(pattern);
            logger.debug('已清除用户仪表板缓存', { 
                userId, 
                type, 
                deletedCount 
            });
            
            return deletedCount;
        } catch (error) {
            logger.error('清除仪表板缓存失败', { 
                userId, 
                type,
                error: error.message 
            });
            return 0;
        }
    }

    /**
     * 获取当前周的标识符
     * @returns {string} 周标识符 (格式: YYYY-W##)
     */
    getWeekKey() {
        const now = new Date();
        const year = now.getFullYear();
        
        // 获取一年中的第几周
        const onejan = new Date(year, 0, 1);
        const week = Math.ceil((((now - onejan) / 86400000) + onejan.getDay() + 1) / 7);
        
        return `${year}-W${String(week).padStart(2, '0')}`;
    }

    /**
     * 获取仪表板缓存统计
     */
    async getDashboardCacheStats() {
        try {
            return {
                namespace: this.namespace,
                ttl_settings: {
                    overview: this.overviewTTL + 's',
                    stats: this.statsTTL + 's', 
                    trend: this.trendTTL + 's'
                },
                redis_connected: await cacheUtils.checkRedisHealth()
            };
        } catch (error) {
            logger.error('获取仪表板缓存统计失败', { 
                error: error.message 
            });
            return null;
        }
    }

    /**
     * 预热缓存 - 为活跃用户预先生成缓存
     * @param {Array} activeUserIds - 活跃用户ID列表
     */
    async warmupCache(activeUserIds) {
        try {
            logger.info('开始预热仪表板缓存', { userCount: activeUserIds.length });
            
            // 这里可以实现缓存预热逻辑
            // 例如在低峰期预先生成常用数据的缓存
            
            return true;
        } catch (error) {
            logger.error('缓存预热失败', { error: error.message });
            return false;
        }
    }
}

// 创建单例实例
const dashboardCache = new DashboardCache();

module.exports = dashboardCache;