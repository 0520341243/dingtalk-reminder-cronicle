/**
 * CSRF保护中间件
 * 使用双重提交Cookie模式实现CSRF保护
 */

const crypto = require('crypto');
const logger = require('../utils/logger');

// CSRF令牌配置
const CSRF_TOKEN_LENGTH = 32;
const CSRF_COOKIE_NAME = 'csrf-token';
const CSRF_HEADER_NAME = 'x-csrf-token';
const CSRF_FIELD_NAME = '_csrf';

// 不需要CSRF保护的方法
const SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS'];

// 不需要CSRF保护的路径
const EXCLUDED_PATHS = [
    '/api/auth/login',
    '/api/auth/register',
    '/api/health',
    '/api/mongo/auth/login',
    '/api/mongo/auth/register'
];

/**
 * 生成CSRF令牌
 */
function generateToken() {
    return crypto.randomBytes(CSRF_TOKEN_LENGTH).toString('hex');
}

/**
 * 获取请求中的CSRF令牌
 */
function getTokenFromRequest(req) {
    // 从请求头获取
    const headerToken = req.get(CSRF_HEADER_NAME) || req.get('X-XSRF-TOKEN');
    if (headerToken) return headerToken;
    
    // 从请求体获取
    if (req.body && req.body[CSRF_FIELD_NAME]) {
        return req.body[CSRF_FIELD_NAME];
    }
    
    // 从查询参数获取
    if (req.query && req.query[CSRF_FIELD_NAME]) {
        return req.query[CSRF_FIELD_NAME];
    }
    
    return null;
}

/**
 * CSRF保护中间件
 */
function csrfProtection(options = {}) {
    const {
        cookie = true,
        ignoreMethods = SAFE_METHODS,
        excludePaths = EXCLUDED_PATHS,
        cookieOptions = {
            httpOnly: false, // 允许JavaScript访问以便在请求中发送
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 24 * 60 * 60 * 1000 // 24小时
        }
    } = options;
    
    return (req, res, next) => {
        // 检查是否需要跳过CSRF保护
        if (ignoreMethods.includes(req.method)) {
            // 为GET请求生成令牌（如果需要）
            if (req.method === 'GET' && !req.cookies?.[CSRF_COOKIE_NAME]) {
                const token = generateToken();
                res.cookie(CSRF_COOKIE_NAME, token, cookieOptions);
                res.locals.csrfToken = token;
            }
            return next();
        }
        
        // 检查是否在排除路径中
        const isExcluded = excludePaths.some(path => {
            if (typeof path === 'string') {
                return req.path === path || req.path.startsWith(path);
            }
            if (path instanceof RegExp) {
                return path.test(req.path);
            }
            return false;
        });
        
        if (isExcluded) {
            return next();
        }
        
        // 获取存储的令牌
        const storedToken = req.cookies?.[CSRF_COOKIE_NAME];
        
        // 如果没有存储的令牌，生成新的
        if (!storedToken) {
            logger.warn('CSRF保护：缺少存储的令牌', {
                path: req.path,
                method: req.method,
                ip: req.ip
            });
            
            return res.status(403).json({
                success: false,
                message: 'CSRF令牌缺失，请刷新页面重试',
                code: 'CSRF_TOKEN_MISSING'
            });
        }
        
        // 获取请求中的令牌
        const requestToken = getTokenFromRequest(req);
        
        if (!requestToken) {
            logger.warn('CSRF保护：请求中缺少令牌', {
                path: req.path,
                method: req.method,
                ip: req.ip
            });
            
            return res.status(403).json({
                success: false,
                message: 'CSRF验证失败：请求中缺少令牌',
                code: 'CSRF_TOKEN_MISSING_IN_REQUEST'
            });
        }
        
        // 验证令牌
        if (requestToken !== storedToken) {
            logger.error('CSRF保护：令牌不匹配', {
                path: req.path,
                method: req.method,
                ip: req.ip,
                userAgent: req.get('User-Agent')
            });
            
            return res.status(403).json({
                success: false,
                message: 'CSRF验证失败：令牌无效',
                code: 'CSRF_TOKEN_INVALID'
            });
        }
        
        // 令牌验证通过，刷新令牌
        const newToken = generateToken();
        res.cookie(CSRF_COOKIE_NAME, newToken, cookieOptions);
        res.locals.csrfToken = newToken;
        
        next();
    };
}

/**
 * 生成CSRF令牌的路由处理器
 */
function csrfTokenRoute(req, res) {
    const token = generateToken();
    
    res.cookie(CSRF_COOKIE_NAME, token, {
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 24 * 60 * 60 * 1000
    });
    
    res.json({
        success: true,
        data: {
            csrfToken: token
        }
    });
}

/**
 * 添加CSRF令牌到响应的中间件
 */
function addCsrfToken(req, res, next) {
    // 如果还没有令牌，生成一个
    if (!req.cookies?.[CSRF_COOKIE_NAME]) {
        const token = generateToken();
        res.cookie(CSRF_COOKIE_NAME, token, {
            httpOnly: false,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 24 * 60 * 60 * 1000
        });
        res.locals.csrfToken = token;
    } else {
        res.locals.csrfToken = req.cookies[CSRF_COOKIE_NAME];
    }
    
    // 添加到响应头
    res.set('X-CSRF-Token', res.locals.csrfToken);
    
    next();
}

module.exports = {
    csrfProtection,
    csrfTokenRoute,
    addCsrfToken,
    generateToken
};