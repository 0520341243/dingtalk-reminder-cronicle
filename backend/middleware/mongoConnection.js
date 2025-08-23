/**
 * MongoDB连接检查中间件
 */

const mongoose = require('mongoose');
const logger = require('../utils/logger');

/**
 * 检查MongoDB连接状态
 */
const checkMongoConnection = async (req, res, next) => {
    try {
        // 检查mongoose连接状态
        if (mongoose.connection.readyState !== 1) {
            logger.error('MongoDB未连接，当前状态:', mongoose.connection.readyState);
            
            return res.status(503).json({
                success: false,
                message: 'MongoDB服务暂时不可用，请稍后重试',
                error: 'Database connection not ready'
            });
        }
        
        // 连接正常，继续处理请求
        next();
    } catch (error) {
        logger.error('MongoDB连接检查失败:', error);
        res.status(500).json({
            success: false,
            message: 'MongoDB连接检查失败',
            error: error.message
        });
    }
};

/**
 * 确保MongoDB已连接（用于启动时）
 */
const ensureMongoConnection = async () => {
    const maxRetries = 5;
    let retries = 0;
    
    while (retries < maxRetries) {
        if (mongoose.connection.readyState === 1) {
            logger.info('MongoDB连接已就绪');
            return true;
        }
        
        retries++;
        logger.info(`等待MongoDB连接... (尝试 ${retries}/${maxRetries})`);
        
        // 等待1秒后重试
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    logger.error('MongoDB连接超时');
    return false;
};

module.exports = {
    checkMongoConnection,
    ensureMongoConnection
};