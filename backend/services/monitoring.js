/**
 * Enhanced Performance Monitoring Service
 * V2 system with 500+ daily reminders capacity monitoring
 * Supports advanced metrics, alert management, and optimization
 */

const os = require('os');
const { EventEmitter } = require('events');
const logger = require('../utils/logger');
// const { getPoolStats } = require('../config/database'); // PostgreSQL已删除
const { redisManager, cacheUtils } = require('../config/redis');
const { enhancedCache } = require('../utils/enhancedCache');

class MonitoringService extends EventEmitter {
    constructor() {
        super();
        this.metrics = {
            system: {},
            database: {},
            cache: {},
            application: {},
            errors: {}
        };
        
        this.thresholds = {
            cpu: parseFloat(process.env.CPU_THRESHOLD) || 80,
            memory: parseFloat(process.env.MEMORY_THRESHOLD) || 85,
            diskSpace: parseFloat(process.env.DISK_THRESHOLD) || 90,
            dbConnections: parseFloat(process.env.DB_CONNECTION_THRESHOLD) || 90,
            responseTime: parseInt(process.env.RESPONSE_TIME_THRESHOLD) || 200,  // Reduced for V2 performance
            errorRate: parseFloat(process.env.ERROR_RATE_THRESHOLD) || 5,  // Stricter for V2
            // V2 specific thresholds
            dailyReminderCapacity: parseInt(process.env.DAILY_REMINDER_CAPACITY) || 500,
            cacheHitRate: parseFloat(process.env.CACHE_HIT_RATE_THRESHOLD) || 90,
            concurrentTasks: parseInt(process.env.CONCURRENT_TASKS_THRESHOLD) || 100,
            ruleComplexity: parseFloat(process.env.RULE_COMPLEXITY_THRESHOLD) || 80
        };
        
        this.alertHistory = [];
        this.isRunning = false;
        this.collectInterval = null;
        this.alertCooldowns = new Map();
        
        // 启动时间
        this.startTime = Date.now();
        
        // 请求和错误统计
        this.requestStats = {
            total: 0,
            errors: 0,
            responseTimes: [],
            lastReset: Date.now()
        };
        
        // 每小时重置一次统计数据，避免累积误差
        setInterval(() => {
            const oldTotal = this.requestStats.total;
            const oldErrors = this.requestStats.errors;
            this.requestStats = {
                total: 0,
                errors: 0,
                responseTimes: [],
                lastReset: Date.now()
            };
            logger.info('重置请求统计', {
                oldTotal,
                oldErrors,
                oldErrorRate: oldTotal > 0 ? Math.round((oldErrors / oldTotal) * 100) : 0
            });
        }, 3600000); // 1小时
        
        // V2 system performance tracking
        this.v2Stats = {
            dailyReminderCount: 0,
            processingLatency: [],
            cachePerformance: { hits: 0, misses: 0 },
            conflictResolutions: 0,
            ruleComplexityScores: [],
            lastOptimizationRun: null,
            systemLoad: { current: 0, peak: 0 },
            concurrentOperations: 0
        };
        
        // Performance optimization features
        this.optimization = {
            enabled: process.env.PERFORMANCE_OPTIMIZATION !== 'false',
            autoGc: process.env.AUTO_GC !== 'false',
            cachePrewarming: process.env.CACHE_PREWARMING !== 'false',
            memoryThreshold: parseInt(process.env.MEMORY_OPTIMIZATION_THRESHOLD) || 75
        };
    }

    /**
     * 启动监控服务
     */
    start(intervalMs = 30000) {
        if (this.isRunning) {
            logger.warn('监控服务已在运行');
            return;
        }

        this.isRunning = true;
        logger.info('启动系统监控服务', { interval: intervalMs });

        // 定期收集指标
        this.collectInterval = setInterval(async () => {
            try {
                await this.collectMetrics();
                await this.checkThresholds();
            } catch (error) {
                logger.error('收集监控指标失败:', error);
            }
        }, intervalMs);

        // 初始收集
        this.collectMetrics();
    }

    /**
     * 停止监控服务
     */
    stop() {
        if (!this.isRunning) {
            return;
        }

        this.isRunning = false;
        if (this.collectInterval) {
            clearInterval(this.collectInterval);
            this.collectInterval = null;
        }
        
        logger.info('系统监控服务已停止');
    }

    /**
     * 收集系统指标
     */
    async collectMetrics() {
        const now = Date.now();
        
        try {
            // 收集系统指标
            await this.collectSystemMetrics();
            
            // 收集数据库指标
            await this.collectDatabaseMetrics();
            
            // 收集缓存指标
            await this.collectCacheMetrics();
            
            // 收集应用指标
            await this.collectApplicationMetrics();
            
            // 收集V2系统指标
            await this.collectV2Metrics();
            
            // 记录收集时间
            this.metrics.lastCollection = now;
            
            logger.debug('指标收集完成', { 
                timestamp: new Date(now).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }),
                metricsCount: Object.keys(this.metrics).length
            });
            
        } catch (error) {
            logger.error('收集监控指标时出错:', error);
        }
    }

    /**
     * 收集系统指标
     */
    async collectSystemMetrics() {
        const memUsage = process.memoryUsage();
        const cpuUsage = process.cpuUsage();
        const loadAvg = os.loadavg();

        this.metrics.system = {
            timestamp: Date.now(),
            uptime: Math.floor(process.uptime()),
            
            // 内存指标
            memory: {
                heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
                heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
                external: Math.round(memUsage.external / 1024 / 1024), // MB
                rss: Math.round(memUsage.rss / 1024 / 1024), // MB
                usage: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100) // %
            },
            
            // CPU指标
            cpu: {
                user: Math.round(cpuUsage.user / 1000), // ms
                system: Math.round(cpuUsage.system / 1000), // ms
                loadAverage: {
                    '1m': Math.round(loadAvg[0] * 100) / 100,
                    '5m': Math.round(loadAvg[1] * 100) / 100,
                    '15m': Math.round(loadAvg[2] * 100) / 100
                }
            },
            
            // 系统信息
            os: {
                platform: os.platform(),
                arch: os.arch(),
                version: os.release(),
                hostname: os.hostname(),
                totalMemory: Math.round(os.totalmem() / 1024 / 1024), // MB
                freeMemory: Math.round(os.freemem() / 1024 / 1024), // MB
                cpus: os.cpus().length
            }
        };
    }

    /**
     * 收集数据库指标
     */
    async collectDatabaseMetrics() {
        try {
            // PostgreSQL已删除，使用MongoDB
            const mongoose = require('mongoose');
            
            this.metrics.database = {
                timestamp: Date.now(),
                connections: {
                    total: 0,
                    idle: 0,
                    waiting: 0,
                    usage: 0
                },
                queries: {
                    total: 0,
                    slow: 0,
                    errors: 0,
                    averageTime: 0,
                    errorRate: 0,
                    slowQueryRate: 0
                },
                mongodb: {
                    connected: mongoose.connection.readyState === 1,
                    state: ['disconnected', 'connected', 'connecting', 'disconnecting'][mongoose.connection.readyState]
                }
            };
        } catch (error) {
            logger.warn('收集数据库指标失败:', error.message);
            this.metrics.database = {
                timestamp: Date.now(),
                error: error.message
            };
        }
    }

    /**
     * 收集缓存指标
     */
    async collectCacheMetrics() {
        try {
            const redisStatus = redisManager.getStatus();
            const cacheStats = await cacheUtils.getStats();
            
            this.metrics.cache = {
                timestamp: Date.now(),
                redis: {
                    connected: redisStatus.connected,
                    status: redisStatus.status,
                    retryAttempts: redisStatus.retryAttempts
                },
                stats: cacheStats ? {
                    available: true,
                    memory: this.parseRedisInfo(cacheStats.memory),
                    keyspace: this.parseRedisInfo(cacheStats.keyspace)
                } : {
                    available: false
                }
            };
        } catch (error) {
            logger.warn('收集缓存指标失败:', error.message);
            this.metrics.cache = {
                timestamp: Date.now(),
                error: error.message
            };
        }
    }

    /**
     * 收集应用指标
     */
    async collectApplicationMetrics() {
        const jwtUtils = require('../utils/jwt');
        
        try {
            const tokenStats = await jwtUtils.getTokenStats();
            
            this.metrics.application = {
                timestamp: Date.now(),
                
                // JWT统计
                auth: {
                    activeSessions: tokenStats.validRefreshTokens,
                    tokenExpiry: tokenStats.accessTokenExpiry,
                    storageType: tokenStats.storageType
                },
                
                // 请求统计
                requests: {
                    total: this.requestStats.total,
                    errors: this.requestStats.errors,
                    errorRate: this.requestStats.total > 0 ? 
                        Math.round((this.requestStats.errors / this.requestStats.total) * 100) : 0,
                    averageResponseTime: this.calculateAverageResponseTime()
                },
                
                // 运行时指标
                runtime: {
                    nodeVersion: process.version,
                    pid: process.pid,
                    startTime: this.startTime,
                    uptime: Date.now() - this.startTime
                }
            };
        } catch (error) {
            logger.warn('收集应用指标失败:', error.message);
            this.metrics.application = {
                timestamp: Date.now(),
                error: error.message
            };
        }
    }

    /**
     * 收集V2系统性能指标
     */
    async collectV2Metrics() {
        try {
            // Get enhanced cache performance metrics
            const cacheMetrics = enhancedCache.getPerformanceMetrics();
            
            // Calculate cache hit rate
            const totalCacheRequests = this.v2Stats.cachePerformance.hits + this.v2Stats.cachePerformance.misses;
            const cacheHitRate = totalCacheRequests > 0 ? 
                (this.v2Stats.cachePerformance.hits / totalCacheRequests * 100).toFixed(2) : 0;
            
            // Calculate average processing latency
            const avgLatency = this.v2Stats.processingLatency.length > 0 ?
                this.v2Stats.processingLatency.reduce((a, b) => a + b, 0) / this.v2Stats.processingLatency.length : 0;
            
            // Calculate average rule complexity
            const avgComplexity = this.v2Stats.ruleComplexityScores.length > 0 ?
                this.v2Stats.ruleComplexityScores.reduce((a, b) => a + b, 0) / this.v2Stats.ruleComplexityScores.length : 0;
            
            this.metrics.v2System = {
                timestamp: Date.now(),
                
                // Reminder capacity metrics
                reminders: {
                    dailyCount: this.v2Stats.dailyReminderCount,
                    capacity: this.thresholds.dailyReminderCapacity,
                    utilization: Math.round((this.v2Stats.dailyReminderCount / this.thresholds.dailyReminderCapacity) * 100),
                    status: this.v2Stats.dailyReminderCount < this.thresholds.dailyReminderCapacity ? 'healthy' : 'at_capacity'
                },
                
                // Performance metrics
                performance: {
                    averageLatency: Math.round(avgLatency),
                    concurrentOperations: this.v2Stats.concurrentOperations,
                    conflictResolutions: this.v2Stats.conflictResolutions,
                    systemLoad: {
                        current: this.v2Stats.systemLoad.current,
                        peak: this.v2Stats.systemLoad.peak
                    }
                },
                
                // Cache performance
                cache: {
                    hitRate: parseFloat(cacheHitRate),
                    totalRequests: totalCacheRequests,
                    status: cacheHitRate >= this.thresholds.cacheHitRate ? 'optimal' : 'degraded',
                    enhancedCache: cacheMetrics
                },
                
                // Rule complexity metrics
                rules: {
                    averageComplexity: Math.round(avgComplexity),
                    maxComplexity: Math.max(...this.v2Stats.ruleComplexityScores, 0),
                    status: avgComplexity <= this.thresholds.ruleComplexity ? 'optimal' : 'complex'
                },
                
                // Optimization status
                optimization: {
                    enabled: this.optimization.enabled,
                    lastRun: this.v2Stats.lastOptimizationRun,
                    autoGc: this.optimization.autoGc,
                    cachePrewarming: this.optimization.cachePrewarming
                }
            };
            
            // Apply automatic optimizations if enabled
            if (this.optimization.enabled) {
                await this.applyV2Optimizations();
            }
            
        } catch (error) {
            logger.error('收集V2系统指标失败:', error.message);
            this.metrics.v2System = {
                timestamp: Date.now(),
                error: error.message
            };
        }
    }

    /**
     * 应用V2系统性能优化
     */
    async applyV2Optimizations() {
        try {
            const memUsage = process.memoryUsage();
            const heapUsagePercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
            
            // Automatic garbage collection when memory usage is high
            if (this.optimization.autoGc && heapUsagePercent > this.optimization.memoryThreshold) {
                if (global.gc) {
                    global.gc();
                    logger.debug('V2 system triggered garbage collection', {
                        memoryUsage: `${Math.round(heapUsagePercent)}%`,
                        threshold: `${this.optimization.memoryThreshold}%`
                    });
                }
            }
            
            // Cache prewarming if cache hit rate is low
            if (this.optimization.cachePrewarming) {
                const cacheHitRate = this.metrics.v2System?.cache?.hitRate || 0;
                if (cacheHitRate < this.thresholds.cacheHitRate) {
                    logger.debug('Low cache hit rate detected, consider cache prewarming', {
                        currentHitRate: `${cacheHitRate}%`,
                        threshold: `${this.thresholds.cacheHitRate}%`
                    });
                }
            }
            
            this.v2Stats.lastOptimizationRun = Date.now();
            
        } catch (error) {
            logger.error('V2系统优化失败:', error.message);
        }
    }

    /**
     * 记录V2系统性能数据
     */
    recordV2Performance(data) {
        try {
            // Record daily reminder processing
            if (data.reminderProcessed) {
                this.v2Stats.dailyReminderCount++;
            }
            
            // Record processing latency
            if (data.latency) {
                this.v2Stats.processingLatency.push(data.latency);
                // Keep only recent latency data
                if (this.v2Stats.processingLatency.length > 1000) {
                    this.v2Stats.processingLatency = this.v2Stats.processingLatency.slice(-500);
                }
            }
            
            // Record cache performance
            if (data.cacheHit !== undefined) {
                if (data.cacheHit) {
                    this.v2Stats.cachePerformance.hits++;
                } else {
                    this.v2Stats.cachePerformance.misses++;
                }
            }
            
            // Record conflict resolutions
            if (data.conflictResolved) {
                this.v2Stats.conflictResolutions++;
            }
            
            // Record rule complexity
            if (data.ruleComplexity) {
                this.v2Stats.ruleComplexityScores.push(data.ruleComplexity);
                // Keep only recent complexity scores
                if (this.v2Stats.ruleComplexityScores.length > 100) {
                    this.v2Stats.ruleComplexityScores = this.v2Stats.ruleComplexityScores.slice(-50);
                }
            }
            
            // Update concurrent operations
            if (data.concurrentOps !== undefined) {
                this.v2Stats.concurrentOperations = data.concurrentOps;
            }
            
            // Update system load
            if (data.systemLoad !== undefined) {
                this.v2Stats.systemLoad.current = data.systemLoad;
                this.v2Stats.systemLoad.peak = Math.max(this.v2Stats.systemLoad.peak, data.systemLoad);
            }
            
        } catch (error) {
            logger.error('记录V2性能数据失败:', error.message);
        }
    }

    /**
     * 获取V2系统性能摘要
     */
    getV2PerformanceSummary() {
        try {
            const cacheHitRate = this.metrics.v2System?.cache?.hitRate || 0;
            const utilization = this.metrics.v2System?.reminders?.utilization || 0;
            const avgLatency = this.metrics.v2System?.performance?.averageLatency || 0;
            
            return {
                status: this.getV2SystemStatus(),
                capacity: {
                    daily: this.v2Stats.dailyReminderCount,
                    target: this.thresholds.dailyReminderCapacity,
                    utilization: `${utilization}%`
                },
                performance: {
                    avgLatency: `${avgLatency}ms`,
                    cacheHitRate: `${cacheHitRate}%`,
                    concurrentOps: this.v2Stats.concurrentOperations
                },
                optimization: {
                    enabled: this.optimization.enabled,
                    lastRun: this.v2Stats.lastOptimizationRun ? 
                        new Date(this.v2Stats.lastOptimizationRun).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }) : 'Never'
                }
            };
            
        } catch (error) {
            logger.error('获取V2性能摘要失败:', error.message);
            return { error: error.message };
        }
    }

    /**
     * 获取V2系统状态
     */
    getV2SystemStatus() {
        try {
            const metrics = this.metrics.v2System;
            if (!metrics) return 'unknown';
            
            // Check critical metrics
            const cacheHitRate = metrics.cache?.hitRate || 0;
            const utilization = metrics.reminders?.utilization || 0;
            const avgLatency = metrics.performance?.averageLatency || 0;
            const avgComplexity = metrics.rules?.averageComplexity || 0;
            
            // Determine status based on thresholds
            if (utilization > 95 || avgLatency > this.thresholds.responseTime * 2) {
                return 'critical';
            } else if (utilization > 80 || cacheHitRate < this.thresholds.cacheHitRate || 
                      avgComplexity > this.thresholds.ruleComplexity) {
                return 'warning';
            } else {
                return 'healthy';
            }
            
        } catch (error) {
            logger.error('获取V2系统状态失败:', error.message);
            return 'error';
        }
    }

    /**
     * 检查阈值并触发告警
     */
    async checkThresholds() {
        const alerts = [];

        try {
            // 检查内存使用率
            if (this.metrics.system?.memory?.usage > this.thresholds.memory) {
                alerts.push({
                    type: 'memory',
                    level: 'warning',
                    message: `内存使用率过高: ${this.metrics.system.memory.usage}%`,
                    value: this.metrics.system.memory.usage,
                    threshold: this.thresholds.memory
                });
            }

            // 检查数据库连接使用率
            if (this.metrics.database?.connections?.usage > this.thresholds.dbConnections) {
                alerts.push({
                    type: 'database',
                    level: 'warning',
                    message: `数据库连接使用率过高: ${this.metrics.database.connections.usage}%`,
                    value: this.metrics.database.connections.usage,
                    threshold: this.thresholds.dbConnections
                });
            }

            // 检查错误率（忽略初始化阶段的错误）
            const uptime = Date.now() - this.startTime;
            const isWarmup = uptime < 60000; // 启动后1分钟内为预热期
            
            if (!isWarmup && this.metrics.application?.requests?.errorRate > this.thresholds.errorRate) {
                // 只有在有足够请求样本时才报警
                if (this.requestStats.total >= 100) {
                    alerts.push({
                        type: 'error_rate',
                        level: 'error',
                        message: `请求错误率过高: ${this.metrics.application.requests.errorRate}%`,
                        value: this.metrics.application.requests.errorRate,
                        threshold: this.thresholds.errorRate
                    });
                }
            }

            // 检查平均响应时间
            if (this.metrics.application?.requests?.averageResponseTime > this.thresholds.responseTime) {
                alerts.push({
                    type: 'response_time',
                    level: 'warning',
                    message: `平均响应时间过长: ${this.metrics.application.requests.averageResponseTime}ms`,
                    value: this.metrics.application.requests.averageResponseTime,
                    threshold: this.thresholds.responseTime
                });
            }

            // V2 System specific alerts
            await this.checkV2SystemAlerts(alerts);

            // 处理告警
            alerts.forEach(alert => this.handleAlert(alert));

        } catch (error) {
            logger.error('检查阈值时出错:', error);
        }
    }

    /**
     * 检查V2系统特定告警
     */
    async checkV2SystemAlerts(alerts) {
        try {
            const v2Metrics = this.metrics.v2System;
            if (!v2Metrics) return;

            // 检查日提醒容量使用率
            if (v2Metrics.reminders?.utilization > 90) {
                alerts.push({
                    type: 'v2_capacity',
                    level: v2Metrics.reminders.utilization > 95 ? 'error' : 'warning',
                    message: `V2系统日提醒使用率过高: ${v2Metrics.reminders.utilization}%`,
                    value: v2Metrics.reminders.utilization,
                    threshold: 90
                });
            }

            // 检查缓存命中率
            if (v2Metrics.cache?.hitRate < this.thresholds.cacheHitRate) {
                alerts.push({
                    type: 'v2_cache_hit_rate',
                    level: 'warning',
                    message: `V2系统缓存命中率过低: ${v2Metrics.cache.hitRate}%`,
                    value: v2Metrics.cache.hitRate,
                    threshold: this.thresholds.cacheHitRate
                });
            }

            // 检查V2系统平均延迟
            if (v2Metrics.performance?.averageLatency > this.thresholds.responseTime) {
                alerts.push({
                    type: 'v2_latency',
                    level: v2Metrics.performance.averageLatency > this.thresholds.responseTime * 2 ? 'error' : 'warning',
                    message: `V2系统处理延迟过高: ${v2Metrics.performance.averageLatency}ms`,
                    value: v2Metrics.performance.averageLatency,
                    threshold: this.thresholds.responseTime
                });
            }

            // 检查规则复杂度
            if (v2Metrics.rules?.averageComplexity > this.thresholds.ruleComplexity) {
                alerts.push({
                    type: 'v2_rule_complexity',
                    level: 'warning',
                    message: `V2系统规则复杂度过高: ${v2Metrics.rules.averageComplexity}`,
                    value: v2Metrics.rules.averageComplexity,
                    threshold: this.thresholds.ruleComplexity
                });
            }

            // 检查并发任务数量
            if (v2Metrics.performance?.concurrentOperations > this.thresholds.concurrentTasks) {
                alerts.push({
                    type: 'v2_concurrent_tasks',
                    level: 'warning',
                    message: `V2系统并发任务数量过高: ${v2Metrics.performance.concurrentOperations}`,
                    value: v2Metrics.performance.concurrentOperations,
                    threshold: this.thresholds.concurrentTasks
                });
            }

        } catch (error) {
            logger.error('检查V2系统告警失败:', error.message);
        }
    }

    /**
     * 处理告警
     */
    handleAlert(alert) {
        const alertKey = `${alert.type}:${alert.level}`;
        const now = Date.now();
        const cooldownPeriod = 5 * 60 * 1000; // 5分钟冷却期

        // 检查冷却期
        if (this.alertCooldowns.has(alertKey)) {
            const lastAlert = this.alertCooldowns.get(alertKey);
            if (now - lastAlert < cooldownPeriod) {
                return; // 在冷却期内，跳过
            }
        }

        // 记录告警
        const alertRecord = {
            ...alert,
            timestamp: now,
            timestampFormatted: new Date(now).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }),
            id: `${alertKey}-${now}`
        };

        this.alertHistory.push(alertRecord);
        this.alertCooldowns.set(alertKey, now);

        // 限制历史记录数量
        if (this.alertHistory.length > 100) {
            this.alertHistory = this.alertHistory.slice(-50);
        }

        // 记录日志
        if (alert.level === 'error') {
            logger.error('系统告警 (严重):', alertRecord);
        } else {
            logger.warn('系统告警 (警告):', alertRecord);
        }

        // 发出事件
        this.emit('alert', alertRecord);

        // TODO: 集成外部告警系统（钉钉、邮件等）
        this.sendExternalAlert(alertRecord);
    }

    /**
     * 发送外部告警
     */
    async sendExternalAlert(alert) {
        try {
            // 这里可以集成钉钉机器人、邮件系统等
            // 当前仅记录日志
            logger.info('外部告警发送:', {
                type: alert.type,
                level: alert.level,
                message: alert.message
            });

            // TODO: 实际的外部告警实现
            // await dingTalkBot.sendAlert(alert);
            // await emailService.sendAlert(alert);
            
        } catch (error) {
            logger.error('发送外部告警失败:', error);
        }
    }

    /**
     * 记录请求指标
     */
    recordRequest(responseTime, isError = false) {
        this.requestStats.total++;
        if (isError) {
            this.requestStats.errors++;
            // 记录错误详情以便分析
            logger.debug('记录请求错误', {
                errorCount: this.requestStats.errors,
                totalCount: this.requestStats.total,
                errorRate: Math.round((this.requestStats.errors / this.requestStats.total) * 100)
            });
        }

        // 记录响应时间
        this.requestStats.responseTimes.push(responseTime);
        
        // 限制响应时间记录数量
        if (this.requestStats.responseTimes.length > 1000) {
            this.requestStats.responseTimes = this.requestStats.responseTimes.slice(-500);
        }
    }

    /**
     * 计算平均响应时间
     */
    calculateAverageResponseTime() {
        if (this.requestStats.responseTimes.length === 0) {
            return 0;
        }

        const sum = this.requestStats.responseTimes.reduce((a, b) => a + b, 0);
        return Math.round(sum / this.requestStats.responseTimes.length);
    }

    /**
     * 解析Redis信息
     */
    parseRedisInfo(infoString) {
        if (!infoString || typeof infoString !== 'string') {
            return {};
        }

        const result = {};
        const lines = infoString.split('\r\n');
        
        for (const line of lines) {
            if (line.includes(':') && !line.startsWith('#')) {
                const [key, value] = line.split(':');
                result[key] = value;
            }
        }
        
        return result;
    }

    /**
     * 获取当前指标
     */
    getMetrics() {
        return {
            ...this.metrics,
            thresholds: this.thresholds,
            alerts: {
                recent: this.alertHistory.slice(-10),
                total: this.alertHistory.length
            }
        };
    }

    /**
     * 获取健康状态
     */
    getHealthStatus() {
        const recentAlerts = this.alertHistory.filter(
            alert => Date.now() - alert.timestamp < 10 * 60 * 1000 // 10分钟内
        );

        const criticalAlerts = recentAlerts.filter(alert => alert.level === 'error');
        const warningAlerts = recentAlerts.filter(alert => alert.level === 'warning');

        let status = 'healthy';
        if (criticalAlerts.length > 0) {
            status = 'critical';
        } else if (warningAlerts.length > 2) {
            status = 'warning';
        }

        return {
            status,
            uptime: Math.floor(process.uptime()),
            alerts: {
                critical: criticalAlerts.length,
                warning: warningAlerts.length,
                total: recentAlerts.length
            },
            lastCheck: this.metrics.lastCollection || null
        };
    }

    /**
     * 重置统计数据
     */
    resetStats() {
        this.requestStats = {
            total: 0,
            errors: 0,
            responseTimes: []
        };
        
        this.alertHistory = [];
        this.alertCooldowns.clear();
        
        logger.info('监控统计数据已重置');
    }
}

// 创建全局监控实例
const monitoring = new MonitoringService();

module.exports = {
    MonitoringService,
    monitoring
};