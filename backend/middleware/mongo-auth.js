/**
 * MongoDB认证中间件
 * JWT token验证，使用MongoDB用户系统
 */

const jwt = require('jsonwebtoken');
const { User } = require('../models/mongodb');
const logger = require('../utils/logger');

const JWT_SECRET = process.env.JWT_SECRET || 'dingtalk-reminder-secret-key-2024';

/**
 * MongoDB认证中间件
 */
const mongoAuthMiddleware = async (req, res, next) => {
    try {
        // 从请求头获取token
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                message: '未提供认证令牌',
                code: 'NO_AUTH_TOKEN'
            });
        }
        
        const token = authHeader.substring(7);
        
        // 验证token
        let decoded;
        try {
            decoded = jwt.verify(token, JWT_SECRET);
        } catch (error) {
            if (error.name === 'TokenExpiredError') {
                return res.status(401).json({
                    success: false,
                    message: '认证令牌已过期',
                    code: 'TOKEN_EXPIRED'
                });
            }
            
            return res.status(401).json({
                success: false,
                message: '无效的认证令牌',
                code: 'INVALID_TOKEN'
            });
        }
        
        // 检查token类型
        if (decoded.type !== 'access') {
            return res.status(401).json({
                success: false,
                message: '无效的令牌类型',
                code: 'INVALID_TOKEN_TYPE'
            });
        }
        
        // 查找用户
        const user = await User.findById(decoded.userId).select('-password');
        
        if (!user) {
            return res.status(401).json({
                success: false,
                message: '用户不存在',
                code: 'USER_NOT_FOUND'
            });
        }
        
        // 将用户信息附加到请求对象
        req.user = {
            id: user._id.toString(),
            mongoId: user._id, // MongoDB ObjectId
            username: user.username,
            role: user.role,
            email: user.email
        };
        
        next();
        
    } catch (error) {
        logger.error('认证中间件错误:', error);
        res.status(500).json({
            success: false,
            message: '认证处理失败',
            error: error.message
        });
    }
};

/**
 * 角色验证中间件生成器
 */
const requireRole = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: '未认证',
                code: 'NOT_AUTHENTICATED'
            });
        }
        
        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: '权限不足',
                code: 'INSUFFICIENT_PERMISSION'
            });
        }
        
        next();
    };
};

/**
 * 管理员权限中间件
 */
const requireAdmin = requireRole('admin');

/**
 * 可选认证中间件 - 如果提供了token则验证，否则继续
 */
const optionalAuth = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        // 没有提供token，继续处理
        return next();
    }
    
    // 有token，进行验证
    return mongoAuthMiddleware(req, res, next);
};

module.exports = {
    mongoAuthMiddleware,
    requireRole,
    requireAdmin,
    optionalAuth
};