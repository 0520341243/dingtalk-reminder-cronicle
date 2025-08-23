/**
 * 安全中间件
 * 提供各种安全防护措施
 */

const crypto = require('crypto');
const { ErrorFactory } = require('../utils/errors');
const logger = require('../utils/logger');

/**
 * 基础安全头设置
 */
function securityHeaders(options = {}) {
    const {
        contentSecurityPolicy = true,
        hsts = true,
        noSniff = true,
        frameOptions = true,
        xssProtection = true,
        referrerPolicy = true,
        permissionsPolicy = true
    } = options;

    return (req, res, next) => {
        // 内容安全策略
        if (contentSecurityPolicy) {
            const csp = process.env.NODE_ENV === 'production' 
                ? "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self' ws: wss:; frame-ancestors 'none';"
                : "default-src 'self' 'unsafe-inline' 'unsafe-eval'; connect-src 'self' ws: wss: http: https:;";
            
            res.setHeader('Content-Security-Policy', csp);
        }

        // HSTS (仅在HTTPS环境下)
        if (hsts && req.secure) {
            res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
        }

        // 防止MIME类型嗅探
        if (noSniff) {
            res.setHeader('X-Content-Type-Options', 'nosniff');
        }

        // 防止点击劫持
        if (frameOptions) {
            res.setHeader('X-Frame-Options', 'DENY');
            // frame-ancestors 已在上面的 CSP 中设置，不需要重复设置
        }

        // XSS保护
        if (xssProtection) {
            res.setHeader('X-XSS-Protection', '1; mode=block');
        }

        // Referrer策略
        if (referrerPolicy) {
            res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
        }

        // 权限策略
        if (permissionsPolicy) {
            res.setHeader('Permissions-Policy', 'camera=(), microphone=(), location=(), payment=()');
        }

        // 移除服务器信息
        res.removeHeader('X-Powered-By');
        res.removeHeader('Server');

        next();
    };
}

/**
 * 请求验证中间件
 */
function requestValidation(options = {}) {
    const {
        maxBodySize = '10mb',
        allowedMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
        validateContentType = true,
        requireContentType = ['POST', 'PUT', 'PATCH']
    } = options;

    return (req, res, next) => {
        // 验证HTTP方法
        if (!allowedMethods.includes(req.method)) {
            logger.warn('不允许的HTTP方法', {
                method: req.method,
                path: req.path,
                ip: req.ip
            });
            throw ErrorFactory.validation('不允许的HTTP方法', 'METHOD_NOT_ALLOWED');
        }

        // 验证Content-Type (排除特定测试路径)
        if (validateContentType && requireContentType.includes(req.method)) {
            // 跳过特定测试和清理接口的Content-Type验证
            const skipPaths = [
                '/test', 
                '/clear',
                '/start-immediate',
                '/maintenance',
                '/reload',
                '/restart'
            ];
            const shouldSkip = skipPaths.some(path => req.path.includes(path));
            
            if (shouldSkip && req.method === 'POST') {
                logger.debug('跳过特定接口的Content-Type验证', { path: req.path });
                return next();
            }
            
            const contentType = req.get('Content-Type');
            if (!contentType) {
                throw ErrorFactory.validation('缺少Content-Type头', 'MISSING_CONTENT_TYPE');
            }

            const allowedTypes = [
                'application/json',
                'application/x-www-form-urlencoded',
                'multipart/form-data'
            ];

            if (!allowedTypes.some(type => contentType.includes(type))) {
                logger.warn('不支持的Content-Type', {
                    contentType,
                    path: req.path,
                    ip: req.ip
                });
                throw ErrorFactory.validation('不支持的Content-Type', 'INVALID_CONTENT_TYPE');
            }
        }

        // 验证请求头
        const suspiciousHeaders = [
            'x-forwarded-for',
            'x-real-ip',
            'x-cluster-client-ip'
        ];

        for (const header of suspiciousHeaders) {
            const value = req.get(header);
            if (value && containsSuspiciousContent(value)) {
                logger.warn('检测到可疑请求头', {
                    header,
                    value,
                    path: req.path,
                    ip: req.ip
                });
            }
        }

        next();
    };
}

/**
 * SQL注入防护
 */
function sqlInjectionProtection() {
    const sqlPatterns = [
        /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION)\b)/gi,
        /(\b(OR|AND)\s+\d+\s*=\s*\d+)/gi,
        /(--|#|\/\*|\*\/)/gi,
        /('|(\\x27)|(\\x2D\\x2D))/gi
    ];

    return (req, res, next) => {
        const checkValue = (value, path = '') => {
            if (typeof value === 'string') {
                for (const pattern of sqlPatterns) {
                    if (pattern.test(value)) {
                        logger.error('检测到SQL注入尝试', {
                            value: value.substring(0, 100),
                            pattern: pattern.source,
                            path: req.path,
                            queryPath: path,
                            ip: req.ip,
                            userAgent: req.get('User-Agent')
                        });
                        throw ErrorFactory.validation('检测到恶意输入', 'SQL_INJECTION_DETECTED');
                    }
                }
            } else if (typeof value === 'object' && value !== null) {
                for (const [key, val] of Object.entries(value)) {
                    checkValue(val, `${path}.${key}`);
                }
            }
        };

        // 检查查询参数
        checkValue(req.query, 'query');

        // 检查请求体
        if (req.body) {
            checkValue(req.body, 'body');
        }

        next();
    };
}

/**
 * XSS防护 - 增强版
 */
function xssProtection() {
    const xss = require('xss');
    
    // 更全面的XSS模式检测
    const xssPatterns = [
        /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
        /javascript:/gi,
        /vbscript:/gi,
        /onload=/gi,
        /onerror=/gi,
        /onclick=/gi,
        /onmouseover=/gi,
        /onmouseout=/gi,
        /onkeydown=/gi,
        /onkeyup=/gi,
        /onfocus=/gi,
        /onblur=/gi,
        /onchange=/gi,
        /onsubmit=/gi,
        /<iframe\b/gi,
        /<object\b/gi,
        /<embed\b/gi,
        /<link\b/gi,
        /<meta\b/gi,
        /<style\b/gi,
        /expression\s*\(/gi,
        /import\s+/gi,
        /document\./gi,
        /window\./gi,
        /eval\s*\(/gi,
        /setTimeout\s*\(/gi,
        /setInterval\s*\(/gi
    ];

    // XSS配置选项
    const xssOptions = {
        whiteList: {
            // 允许的安全HTML标签
            a: ['href', 'title', 'target'],
            b: [],
            strong: [],
            i: [],
            em: [],
            u: [],
            br: [],
            p: ['class'],
            div: ['class'],
            span: ['class'],
            h1: [],
            h2: [],
            h3: [],
            h4: [],
            h5: [],
            h6: [],
            ul: [],
            ol: [],
            li: [],
            blockquote: [],
            code: ['class'],
            pre: ['class']
        },
        stripIgnoreTag: true,
        stripIgnoreTagBody: ['script', 'style'],
        // 对URL进行安全检查
        onTagAttr: function(tag, name, value, isWhiteAttr) {
            if (name === 'href' || name === 'src') {
                if (value.indexOf('javascript:') === 0 || 
                    value.indexOf('vbscript:') === 0 ||
                    value.indexOf('data:text/html') === 0) {
                    return '';
                }
            }
        }
    };

    return (req, res, next) => {
        const sanitizeValue = (value) => {
            if (typeof value === 'string') {
                // 首先使用xss库进行清理
                let cleaned = xss(value, xssOptions);
                
                // 然后检查剩余的危险模式
                for (const pattern of xssPatterns) {
                    if (pattern.test(cleaned)) {
                        logger.warn('检测到XSS尝试', {
                            originalValue: value.substring(0, 100),
                            pattern: pattern.source,
                            path: req.path,
                            method: req.method,
                            ip: req.ip,
                            userAgent: req.get('User-Agent')
                        });
                        
                        // 移除匹配的危险内容
                        cleaned = cleaned.replace(pattern, '');
                    }
                }
                
                // HTML实体编码特殊字符
                cleaned = cleaned
                    .replace(/&(?!amp;|lt;|gt;|quot;|#39;|#x2F;)/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;')
                    .replace(/'/g, '&#39;')
                    .replace(/\//g, '&#x2F;');
                
                return cleaned;
            } else if (Array.isArray(value)) {
                return value.map(item => sanitizeValue(item));
            } else if (typeof value === 'object' && value !== null) {
                const cleaned = {};
                for (const [key, val] of Object.entries(value)) {
                    // 同时清理键名
                    const cleanKey = typeof key === 'string' ? sanitizeValue(key) : key;
                    cleaned[cleanKey] = sanitizeValue(val);
                }
                return cleaned;
            }
            return value;
        };

        // 清理查询参数
        if (req.query) {
            req.query = sanitizeValue(req.query);
        }

        // 清理请求体
        if (req.body) {
            req.body = sanitizeValue(req.body);
        }

        // 清理路径参数
        if (req.params) {
            req.params = sanitizeValue(req.params);
        }

        // 清理请求头中的可能包含用户输入的字段
        const userInputHeaders = ['referer', 'user-agent', 'x-forwarded-for'];
        userInputHeaders.forEach(header => {
            const value = req.get(header);
            if (value && typeof value === 'string') {
                req.headers[header] = sanitizeValue(value);
            }
        });

        next();
    };
}

/**
 * CSRF防护
 */
function csrfProtection(options = {}) {
    const {
        tokenName = 'csrfToken',
        headerName = 'X-CSRF-Token',
        cookieName = 'csrf-token',
        secret = process.env.CSRF_SECRET || 'your-csrf-secret',
        safeMethods = ['GET', 'HEAD', 'OPTIONS', 'TRACE']
    } = options;

    return (req, res, next) => {
        // 跳过安全方法
        if (safeMethods.includes(req.method)) {
            return next();
        }

        // 生成或获取CSRF令牌
        if (!req.session || !req.session.csrfToken) {
            const token = crypto.randomBytes(32).toString('hex');
            if (req.session) {
                req.session.csrfToken = token;
            }
            res.cookie(cookieName, token, {
                httpOnly: false,
                secure: req.secure,
                sameSite: 'strict'
            });
        }

        // 验证CSRF令牌
        const tokenFromHeader = req.get(headerName);
        const tokenFromBody = req.body && req.body[tokenName];
        const tokenFromCookie = req.cookies && req.cookies[cookieName];
        const sessionToken = req.session && req.session.csrfToken;

        const providedToken = tokenFromHeader || tokenFromBody || tokenFromCookie;

        if (!providedToken || !sessionToken || providedToken !== sessionToken) {
            logger.warn('CSRF令牌验证失败', {
                hasHeader: !!tokenFromHeader,
                hasBody: !!tokenFromBody,
                hasCookie: !!tokenFromCookie,
                hasSession: !!sessionToken,
                path: req.path,
                ip: req.ip
            });
            throw ErrorFactory.authorization('无效的CSRF令牌', 'INVALID_CSRF_TOKEN');
        }

        next();
    };
}

/**
 * 敏感信息检测
 */
function sensitiveDataProtection() {
    const sensitivePatterns = [
        /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, // 信用卡号
        /\b\d{3}-?\d{2}-?\d{4}\b/g, // SSN
        /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, // Email
        /\b\d{11}\b/g, // 手机号
        /\b\d{15,20}\b/g, // 身份证号
        /password|passwd|pwd|secret|token|key/gi
    ];

    return (req, res, next) => {
        // 检查并记录敏感信息泄露
        const checkForSensitiveData = (data, path = '') => {
            if (typeof data === 'string') {
                for (const pattern of sensitivePatterns) {
                    if (pattern.test(data)) {
                        logger.warn('检测到敏感信息', {
                            pattern: pattern.source,
                            path: req.path,
                            dataPath: path,
                            ip: req.ip
                        });
                    }
                }
            } else if (typeof data === 'object' && data !== null) {
                for (const [key, value] of Object.entries(data)) {
                    checkForSensitiveData(value, `${path}.${key}`);
                }
            }
        };

        // 拦截响应并检查
        const originalJson = res.json;
        res.json = function(data) {
            checkForSensitiveData(data, 'response');
            return originalJson.call(this, data);
        };

        next();
    };
}

/**
 * IP白名单/黑名单
 */
function ipFilter(options = {}) {
    const {
        whitelist = [],
        blacklist = [],
        mode = 'blacklist' // 'whitelist' 或 'blacklist'
    } = options;

    return (req, res, next) => {
        const clientIp = req.ip || req.connection.remoteAddress;
        const forwarded = req.get('X-Forwarded-For');
        const realIp = req.get('X-Real-IP');
        
        const ips = [clientIp, forwarded, realIp].filter(Boolean);

        if (mode === 'whitelist' && whitelist.length > 0) {
            const allowed = ips.some(ip => whitelist.some(allowed => ip.includes(allowed)));
            if (!allowed) {
                logger.warn('IP不在白名单中', { ips, whitelist });
                throw ErrorFactory.authorization('访问被拒绝', 'IP_NOT_WHITELISTED');
            }
        }

        if (mode === 'blacklist' && blacklist.length > 0) {
            const blocked = ips.some(ip => blacklist.some(blocked => ip.includes(blocked)));
            if (blocked) {
                logger.warn('IP在黑名单中', { ips, blacklist });
                throw ErrorFactory.authorization('访问被拒绝', 'IP_BLACKLISTED');
            }
        }

        next();
    };
}

/**
 * User-Agent验证
 */
function userAgentValidation(options = {}) {
    const {
        allowedPatterns = [],
        blockedPatterns = [
            /bot/i,
            /crawler/i,
            /spider/i,
            /scraper/i
        ],
        requireUserAgent = false
    } = options;

    return (req, res, next) => {
        const userAgent = req.get('User-Agent');

        if (requireUserAgent && !userAgent) {
            logger.warn('缺少User-Agent', { ip: req.ip, path: req.path });
            throw ErrorFactory.validation('缺少User-Agent头', 'MISSING_USER_AGENT');
        }

        if (userAgent) {
            // 检查黑名单
            for (const pattern of blockedPatterns) {
                if (pattern.test(userAgent)) {
                    logger.warn('被阻止的User-Agent', {
                        userAgent,
                        pattern: pattern.source,
                        ip: req.ip
                    });
                    throw ErrorFactory.authorization('访问被拒绝', 'BLOCKED_USER_AGENT');
                }
            }

            // 检查白名单（如果配置）
            if (allowedPatterns.length > 0) {
                const allowed = allowedPatterns.some(pattern => pattern.test(userAgent));
                if (!allowed) {
                    logger.warn('User-Agent不在白名单中', {
                        userAgent,
                        ip: req.ip
                    });
                    throw ErrorFactory.authorization('访问被拒绝', 'USER_AGENT_NOT_ALLOWED');
                }
            }
        }

        next();
    };
}

/**
 * 输入长度限制
 */
function inputLengthValidation(options = {}) {
    const {
        maxStringLength = 1000,
        maxArrayLength = 100,
        maxObjectDepth = 5
    } = options;

    return (req, res, next) => {
        const validateValue = (value, depth = 0) => {
            if (depth > maxObjectDepth) {
                throw ErrorFactory.validation('对象嵌套层级过深', 'OBJECT_TOO_DEEP');
            }

            if (typeof value === 'string' && value.length > maxStringLength) {
                throw ErrorFactory.validation('字符串长度超出限制', 'STRING_TOO_LONG');
            }

            if (Array.isArray(value)) {
                if (value.length > maxArrayLength) {
                    throw ErrorFactory.validation('数组长度超出限制', 'ARRAY_TOO_LONG');
                }
                value.forEach(item => validateValue(item, depth + 1));
            } else if (typeof value === 'object' && value !== null) {
                Object.values(value).forEach(val => validateValue(val, depth + 1));
            }
        };

        if (req.body) {
            validateValue(req.body);
        }

        Object.values(req.query).forEach(value => validateValue(value));

        next();
    };
}

/**
 * 检测可疑内容
 */
function containsSuspiciousContent(content) {
    const suspiciousPatterns = [
        /\.\./g,  // 路径遍历
        /[<>]/g,  // HTML标签
        /[';]/g,  // SQL注入字符
        /javascript:/gi,
        /vbscript:/gi,
        /data:/gi
    ];

    return suspiciousPatterns.some(pattern => pattern.test(content));
}

module.exports = {
    securityHeaders,
    requestValidation,
    sqlInjectionProtection,
    xssProtection,
    csrfProtection,
    sensitiveDataProtection,
    ipFilter,
    userAgentValidation,
    inputLengthValidation,
    containsSuspiciousContent
};