/**
 * 系统日志路由
 * 提供日志查询、清理等功能
 */

const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');

/**
 * 获取系统日志
 * GET /api/logs
 */
router.get('/', async (req, res) => {
    try {
        const { level = 'info', limit = 50 } = req.query;
        const logFile = level === 'error' ? 'error.log' : 'combined.log';
        const logPath = path.join(process.cwd(), 'logs', logFile);
        
        try {
            // 读取日志文件
            const content = await fs.readFile(logPath, 'utf-8');
            const lines = content.split('\n').filter(line => line.trim());
            
            // 解析日志并获取最近的记录
            const logs = lines
                .slice(-limit)
                .reverse()
                .map(line => {
                    try {
                        return JSON.parse(line);
                    } catch (e) {
                        // 如果解析失败，返回原始日志
                        return {
                            level: level,
                            timestamp: new Date().toISOString(),
                            message: line
                        };
                    }
                })
                .filter(log => log);
            
            res.json({
                success: true,
                data: {
                    logs: logs,
                    total: logs.length
                }
            });
        } catch (error) {
            // 如果日志文件不存在，返回空数组
            if (error.code === 'ENOENT') {
                res.json({
                    success: true,
                    data: {
                        logs: [],
                        total: 0
                    }
                });
            } else {
                throw error;
            }
        }
    } catch (error) {
        logger.error('获取日志失败:', error);
        res.status(500).json({
            success: false,
            message: '获取日志失败',
            error: error.message
        });
    }
});

/**
 * 清理系统日志
 * POST /api/logs/clear
 */
router.post('/clear', async (req, res) => {
    try {
        const logsDir = path.join(process.cwd(), 'logs');
        const files = ['error.log', 'combined.log'];
        
        for (const file of files) {
            const filePath = path.join(logsDir, file);
            try {
                await fs.unlink(filePath);
                logger.info(`日志文件已清理: ${file}`);
            } catch (error) {
                if (error.code !== 'ENOENT') {
                    logger.error(`清理日志文件失败: ${file}`, error);
                }
            }
        }
        
        res.json({
            success: true,
            message: '日志已清理'
        });
    } catch (error) {
        logger.error('清理日志失败:', error);
        res.status(500).json({
            success: false,
            message: '清理日志失败',
            error: error.message
        });
    }
});

/**
 * 获取日志统计
 * GET /api/logs/stats
 */
router.get('/stats', async (req, res) => {
    try {
        const logsDir = path.join(process.cwd(), 'logs');
        const stats = {
            error: { count: 0, size: 0 },
            info: { count: 0, size: 0 }
        };
        
        try {
            // 错误日志统计
            const errorLog = path.join(logsDir, 'error.log');
            const errorStat = await fs.stat(errorLog);
            const errorContent = await fs.readFile(errorLog, 'utf-8');
            stats.error.size = errorStat.size;
            stats.error.count = errorContent.split('\n').filter(line => line.trim()).length;
        } catch (e) {
            // 忽略文件不存在的错误
        }
        
        try {
            // 综合日志统计
            const combinedLog = path.join(logsDir, 'combined.log');
            const combinedStat = await fs.stat(combinedLog);
            const combinedContent = await fs.readFile(combinedLog, 'utf-8');
            stats.info.size = combinedStat.size;
            stats.info.count = combinedContent.split('\n').filter(line => line.trim()).length;
        } catch (e) {
            // 忽略文件不存在的错误
        }
        
        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        logger.error('获取日志统计失败:', error);
        res.status(500).json({
            success: false,
            message: '获取日志统计失败',
            error: error.message
        });
    }
});

module.exports = router;