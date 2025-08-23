/**
 * MongoDB用户认证API
 * 使用MongoDB替代PostgreSQL进行用户管理
 */

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { User, mongoose } = require('../models/mongodb');
const logger = require('../utils/logger');

// JWT配置
const JWT_SECRET = process.env.JWT_SECRET || 'dingtalk-reminder-secret-key-2024';
const JWT_EXPIRES = process.env.JWT_EXPIRES || '24h';
const JWT_REFRESH_EXPIRES = process.env.JWT_REFRESH_EXPIRES || '7d';

/**
 * 用户登录
 */
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        // 验证输入
        if (!username || !password) {
            return res.status(400).json({
                success: false,
                message: '用户名和密码不能为空'
            });
        }
        
        // 查找用户
        const user = await User.findOne({ username });
        if (!user) {
            return res.status(401).json({
                success: false,
                message: '用户名或密码错误'
            });
        }
        
        // 验证密码
        const isPasswordValid = await user.comparePassword(password);
        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: '用户名或密码错误'
            });
        }
        
        // 更新最后登录时间
        user.lastLoginAt = new Date();
        await user.save();
        
        // 生成JWT token
        const tokenPayload = {
            userId: user._id.toString(),
            username: user.username,
            role: user.role
        };
        
        const accessToken = jwt.sign(
            { ...tokenPayload, type: 'access' },
            JWT_SECRET,
            { 
                expiresIn: JWT_EXPIRES,
                issuer: 'dingtalk-reminder-system',
                audience: 'dingtalk-reminder-users'
            }
        );
        
        const refreshToken = jwt.sign(
            { ...tokenPayload, type: 'refresh' },
            JWT_SECRET,
            { 
                expiresIn: JWT_REFRESH_EXPIRES,
                issuer: 'dingtalk-reminder-system',
                audience: 'dingtalk-reminder-users'
            }
        );
        
        // 返回成功响应
        res.json({
            success: true,
            message: '登录成功',
            accessToken,
            refreshToken,
            user: {
                id: user._id,
                username: user.username,
                role: user.role,
                email: user.email,
                lastLoginAt: user.lastLoginAt
            }
        });
        
    } catch (error) {
        logger.error('登录失败:', error);
        res.status(500).json({
            success: false,
            message: '登录失败',
            error: error.message
        });
    }
});

/**
 * 用户注册 (管理员创建用户时使用)
 * 需要管理员权限
 */
router.post('/register', async (req, res) => {
    try {
        // 检查是否有管理员权限
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            try {
                const token = authHeader.substring(7);
                const decoded = jwt.verify(token, JWT_SECRET);
                
                // 只有管理员可以指定角色
                if (decoded.role !== 'admin' && req.body.role && req.body.role !== 'user') {
                    return res.status(403).json({
                        success: false,
                        message: '只有管理员可以创建其他管理员账户'
                    });
                }
            } catch (error) {
                // Token验证失败，但允许创建普通用户
                if (req.body.role && req.body.role !== 'user') {
                    return res.status(403).json({
                        success: false,
                        message: '只有管理员可以创建管理员账户'
                    });
                }
            }
        } else {
            // 没有token，只能创建普通用户
            if (req.body.role && req.body.role !== 'user') {
                return res.status(403).json({
                    success: false,
                    message: '只有管理员可以创建管理员账户'
                });
            }
        }
        
        const { username, password, email, role = 'user' } = req.body;
        
        // 验证输入
        if (!username || !password) {
            return res.status(400).json({
                success: false,
                message: '用户名和密码不能为空'
            });
        }
        
        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                message: '密码长度至少为6位'
            });
        }
        
        // 检查用户名是否已存在
        const existingUser = await User.findOne({ username });
        if (existingUser) {
            return res.status(409).json({
                success: false,
                message: '用户名已存在'
            });
        }
        
        // 创建新用户
        const newUser = new User({
            username,
            password, // mongoose中间件会自动加密
            email,
            role
        });
        
        await newUser.save();
        
        // 生成JWT token
        const tokenPayload = {
            userId: newUser._id.toString(),
            username: newUser.username,
            role: newUser.role
        };
        
        const accessToken = jwt.sign(
            { ...tokenPayload, type: 'access' },
            JWT_SECRET,
            { 
                expiresIn: JWT_EXPIRES,
                issuer: 'dingtalk-reminder-system',
                audience: 'dingtalk-reminder-users'
            }
        );
        
        const refreshToken = jwt.sign(
            { ...tokenPayload, type: 'refresh' },
            JWT_SECRET,
            { 
                expiresIn: JWT_REFRESH_EXPIRES,
                issuer: 'dingtalk-reminder-system',
                audience: 'dingtalk-reminder-users'
            }
        );
        
        res.status(201).json({
            success: true,
            message: '注册成功',
            accessToken,
            refreshToken,
            user: {
                id: newUser._id,
                username: newUser.username,
                role: newUser.role,
                email: newUser.email
            }
        });
        
    } catch (error) {
        logger.error('注册失败:', error);
        res.status(500).json({
            success: false,
            message: '注册失败',
            error: error.message
        });
    }
});

/**
 * 刷新Token
 */
router.post('/refresh', async (req, res) => {
    try {
        const { refreshToken } = req.body;
        
        if (!refreshToken) {
            return res.status(400).json({
                success: false,
                message: '缺少刷新令牌'
            });
        }
        
        // 验证refresh token
        const decoded = jwt.verify(refreshToken, JWT_SECRET);
        
        if (decoded.type !== 'refresh') {
            return res.status(401).json({
                success: false,
                message: '无效的刷新令牌'
            });
        }
        
        // 查找用户
        const user = await User.findById(decoded.userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: '用户不存在'
            });
        }
        
        // 生成新的access token
        const tokenPayload = {
            userId: user._id.toString(),
            username: user.username,
            role: user.role
        };
        
        const newAccessToken = jwt.sign(
            { ...tokenPayload, type: 'access' },
            JWT_SECRET,
            { 
                expiresIn: JWT_EXPIRES,
                issuer: 'dingtalk-reminder-system',
                audience: 'dingtalk-reminder-users'
            }
        );
        
        res.json({
            success: true,
            message: 'Token刷新成功',
            accessToken: newAccessToken
        });
        
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                message: '刷新令牌已过期，请重新登录'
            });
        }
        
        logger.error('Token刷新失败:', error);
        res.status(500).json({
            success: false,
            message: 'Token刷新失败',
            error: error.message
        });
    }
});

/**
 * 获取当前用户信息
 */
router.get('/me', async (req, res) => {
    try {
        // 从请求头获取token
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                message: '未提供认证令牌'
            });
        }
        
        const token = authHeader.substring(7);
        
        // 验证token
        const decoded = jwt.verify(token, JWT_SECRET);
        
        if (decoded.type !== 'access') {
            return res.status(401).json({
                success: false,
                message: '无效的访问令牌'
            });
        }
        
        // 查找用户
        const user = await User.findById(decoded.userId).select('-password');
        if (!user) {
            return res.status(404).json({
                success: false,
                message: '用户不存在'
            });
        }
        
        res.json({
            success: true,
            user: {
                id: user._id,
                username: user.username,
                role: user.role,
                email: user.email,
                createdAt: user.createdAt,
                lastLoginAt: user.lastLoginAt
            }
        });
        
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                message: '访问令牌已过期'
            });
        }
        
        logger.error('获取用户信息失败:', error);
        res.status(500).json({
            success: false,
            message: '获取用户信息失败',
            error: error.message
        });
    }
});

/**
 * 修改密码
 */
router.post('/change-password', async (req, res) => {
    try {
        const { oldPassword, newPassword } = req.body;
        
        // 从请求头获取token
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                message: '未提供认证令牌'
            });
        }
        
        const token = authHeader.substring(7);
        const decoded = jwt.verify(token, JWT_SECRET);
        
        // 验证输入
        if (!oldPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                message: '请提供旧密码和新密码'
            });
        }
        
        if (newPassword.length < 6) {
            return res.status(400).json({
                success: false,
                message: '新密码长度至少为6位'
            });
        }
        
        // 查找用户
        const user = await User.findById(decoded.userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: '用户不存在'
            });
        }
        
        // 验证旧密码
        const isOldPasswordValid = await user.comparePassword(oldPassword);
        if (!isOldPasswordValid) {
            return res.status(401).json({
                success: false,
                message: '旧密码错误'
            });
        }
        
        // 更新密码
        user.password = newPassword; // mongoose中间件会自动加密
        await user.save();
        
        res.json({
            success: true,
            message: '密码修改成功'
        });
        
    } catch (error) {
        logger.error('修改密码失败:', error);
        res.status(500).json({
            success: false,
            message: '修改密码失败',
            error: error.message
        });
    }
});

/**
 * 获取用户资料 (当前登录用户)
 */
router.get('/profile', async (req, res) => {
    try {
        // 从请求头获取token
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                message: '未提供认证令牌'
            });
        }
        
        const token = authHeader.substring(7);
        
        // 验证token
        const decoded = jwt.verify(token, JWT_SECRET);
        
        if (decoded.type !== 'access') {
            return res.status(401).json({
                success: false,
                message: '无效的访问令牌'
            });
        }
        
        // 查找用户
        const user = await User.findById(decoded.userId).select('-password');
        if (!user) {
            return res.status(404).json({
                success: false,
                message: '用户不存在'
            });
        }
        
        res.json({
            success: true,
            user: {
                id: user._id,
                username: user.username,
                role: user.role,
                email: user.email,
                created_at: user.createdAt,
                updated_at: user.updatedAt
            }
        });
        
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                message: '访问令牌已过期'
            });
        }
        
        logger.error('获取用户资料失败:', error);
        res.status(500).json({
            success: false,
            message: '获取用户资料失败',
            error: error.message
        });
    }
});

/**
 * 获取所有用户列表 (仅管理员)
 */
router.get('/users', async (req, res) => {
    try {
        // 从请求头获取token
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                message: '未提供认证令牌'
            });
        }
        
        const token = authHeader.substring(7);
        const decoded = jwt.verify(token, JWT_SECRET);
        
        // 检查是否是管理员
        const currentUser = await User.findById(decoded.userId);
        if (!currentUser || currentUser.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: '权限不足，需要管理员权限'
            });
        }
        
        // 获取所有用户
        const users = await User.find().select('-password').sort({ createdAt: -1 });
        
        res.json({
            success: true,
            users: users.map(user => ({
                id: user._id,
                username: user.username,
                email: user.email,
                role: user.role,
                created_at: user.createdAt,
                updated_at: user.updatedAt
            }))
        });
        
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                message: '访问令牌已过期'
            });
        }
        
        logger.error('获取用户列表失败:', error);
        res.status(500).json({
            success: false,
            message: '获取用户列表失败',
            error: error.message
        });
    }
});

/**
 * 删除用户 (仅管理员)
 */
router.delete('/users/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        // 从请求头获取token
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                message: '未提供认证令牌'
            });
        }
        
        const token = authHeader.substring(7);
        const decoded = jwt.verify(token, JWT_SECRET);
        
        // 检查是否是管理员
        const currentUser = await User.findById(decoded.userId);
        if (!currentUser || currentUser.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: '权限不足，需要管理员权限'
            });
        }
        
        // 防止删除自己
        if (decoded.userId === id) {
            return res.status(400).json({
                success: false,
                message: '不能删除当前登录的用户'
            });
        }
        
        // 查找并删除用户
        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: '用户不存在'
            });
        }
        
        await User.findByIdAndDelete(id);
        
        res.json({
            success: true,
            message: '用户删除成功'
        });
        
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                message: '访问令牌已过期'
            });
        }
        
        logger.error('删除用户失败:', error);
        res.status(500).json({
            success: false,
            message: '删除用户失败',
            error: error.message
        });
    }
});

module.exports = router;