/**
 * 统一错误处理工具类
 * 提供标准化的错误定义和处理机制
 */

const logger = require('./logger');

/**
 * 自定义错误基类
 */
class CustomError extends Error {
    constructor(message, code, statusCode = 500, isOperational = true) {
        super(message);
        this.name = this.constructor.name;
        this.code = code;
        this.statusCode = statusCode;
        this.isOperational = isOperational;
        
        // 捕获堆栈跟踪
        Error.captureStackTrace(this, this.constructor);
    }

    /**
     * 转换为API响应格式
     */
    toResponse() {
        return {
            error: this.message,
            code: this.code,
            timestamp: new Date().toISOString()
        };
    }
}

/**
 * 业务逻辑错误 (400-499)
 */
class BusinessError extends CustomError {
    constructor(message, code = 'BUSINESS_ERROR', statusCode = 400) {
        super(message, code, statusCode, true);
    }
}

/**
 * 认证相关错误 (401)
 */
class AuthenticationError extends CustomError {
    constructor(message, code = 'AUTHENTICATION_ERROR', statusCode = 401) {
        super(message, code, statusCode, true);
    }
}

/**
 * 权限相关错误 (403)
 */
class AuthorizationError extends CustomError {
    constructor(message, code = 'AUTHORIZATION_ERROR', statusCode = 403) {
        super(message, code, statusCode, true);
    }
}

/**
 * 资源未找到错误 (404)
 */
class NotFoundError extends CustomError {
    constructor(message, code = 'NOT_FOUND', statusCode = 404) {
        super(message, code, statusCode, true);
    }
}

/**
 * 数据冲突错误 (409)
 */
class ConflictError extends CustomError {
    constructor(message, code = 'CONFLICT_ERROR', statusCode = 409) {
        super(message, code, statusCode, true);
    }
}

/**
 * 请求频率限制错误 (429)
 */
class RateLimitError extends CustomError {
    constructor(message, code = 'RATE_LIMIT_EXCEEDED', statusCode = 429) {
        super(message, code, statusCode, true);
    }
}

/**
 * 系统内部错误 (500)
 */
class SystemError extends CustomError {
    constructor(message, code = 'SYSTEM_ERROR', statusCode = 500) {
        super(message, code, statusCode, false);
    }
}

/**
 * 数据库操作错误
 */
class DatabaseError extends SystemError {
    constructor(message, originalError = null, code = 'DATABASE_ERROR') {
        super(message, code, 500);
        this.originalError = originalError;
    }
}

/**
 * 第三方服务错误
 */
class ExternalServiceError extends SystemError {
    constructor(message, service, code = 'EXTERNAL_SERVICE_ERROR') {
        super(message, code, 502);
        this.service = service;
    }
}

/**
 * 错误工厂类 - 快速创建常见错误
 */
class ErrorFactory {
    // 认证错误
    static authentication(message = '认证失败', code = 'AUTHENTICATION_FAILED') {
        return new AuthenticationError(message, code);
    }

    static tokenExpired(message = '访问令牌已过期') {
        return new AuthenticationError(message, 'TOKEN_EXPIRED');
    }

    static invalidToken(message = '无效的访问令牌') {
        return new AuthenticationError(message, 'INVALID_TOKEN');
    }

    static refreshTokenExpired(message = '刷新令牌已过期，请重新登录') {
        return new AuthenticationError(message, 'REFRESH_TOKEN_EXPIRED');
    }

    // 权限错误
    static authorization(message = '权限不足', code = 'INSUFFICIENT_PRIVILEGES') {
        return new AuthorizationError(message, code);
    }

    static adminRequired(message = '需要管理员权限') {
        return new AuthorizationError(message, 'ADMIN_REQUIRED');
    }

    // 业务错误
    static validation(message, code = 'VALIDATION_ERROR') {
        return new BusinessError(message, code);
    }

    static userExists(message = '用户名已存在') {
        return new ConflictError(message, 'USER_EXISTS');
    }

    static userNotFound(message = '用户不存在') {
        return new NotFoundError(message, 'USER_NOT_FOUND');
    }

    static invalidPassword(message = '密码错误') {
        return new BusinessError(message, 'INVALID_PASSWORD');
    }

    static passwordTooWeak(message = '密码强度不足') {
        return new BusinessError(message, 'PASSWORD_TOO_WEAK');
    }

    // 文件相关错误
    static fileNotFound(message = '文件不存在') {
        return new NotFoundError(message, 'FILE_NOT_FOUND');
    }

    static fileUploadFailed(message = '文件上传失败') {
        return new SystemError(message, 'FILE_UPLOAD_FAILED');
    }

    static fileTooLarge(message = '文件过大') {
        return new BusinessError(message, 'FILE_TOO_LARGE');
    }

    static invalidFileType(message = '不支持的文件类型') {
        return new BusinessError(message, 'INVALID_FILE_TYPE');
    }

    // 数据库错误
    static database(message, originalError = null) {
        return new DatabaseError(message, originalError);
    }

    static connectionFailed(message = '数据库连接失败') {
        return new DatabaseError(message, null, 'DB_CONNECTION_FAILED');
    }

    static queryFailed(message, originalError = null) {
        return new DatabaseError(message, originalError, 'DB_QUERY_FAILED');
    }

    // 外部服务错误
    static externalService(message, service, code = 'EXTERNAL_SERVICE_ERROR') {
        return new ExternalServiceError(message, service, code);
    }

    static dingTalkError(message = '钉钉服务调用失败') {
        return new ExternalServiceError(message, 'dingtalk', 'DINGTALK_ERROR');
    }

    // 系统错误
    static system(message = '系统内部错误', code = 'SYSTEM_ERROR') {
        return new SystemError(message, code);
    }

    static rateLimit(message = '请求过于频繁，请稍后再试') {
        return new RateLimitError(message);
    }
}

/**
 * 错误处理工具函数
 */
class ErrorHandler {
    /**
     * 判断是否为可操作错误
     */
    static isOperationalError(error) {
        if (error instanceof CustomError) {
            return error.isOperational;
        }
        return false;
    }

    /**
     * 记录错误日志
     */
    static logError(error, context = {}) {
        const errorInfo = {
            name: error.name,
            message: error.message,
            stack: error.stack,
            code: error.code || 'UNKNOWN',
            statusCode: error.statusCode || 500,
            isOperational: error.isOperational || false,
            ...context
        };

        if (error.statusCode >= 500) {
            logger.error('系统错误:', errorInfo);
        } else if (error.statusCode >= 400) {
            logger.warn('业务错误:', errorInfo);
        } else {
            logger.info('信息错误:', errorInfo);
        }
    }

    /**
     * 生成错误响应
     */
    static generateResponse(error, includeStack = false) {
        const response = {
            success: false,
            error: error.message || '未知错误',
            code: error.code || 'UNKNOWN_ERROR',
            timestamp: new Date().toISOString()
        };

        // 开发环境下包含堆栈跟踪
        if (includeStack && process.env.NODE_ENV === 'development') {
            response.stack = error.stack;
        }

        // 如果有原始错误，在开发环境下包含
        if (error.originalError && process.env.NODE_ENV === 'development') {
            response.originalError = {
                message: error.originalError.message,
                code: error.originalError.code
            };
        }

        return response;
    }

    /**
     * 包装异步函数以处理错误
     */
    static wrapAsync(fn) {
        return (req, res, next) => {
            Promise.resolve(fn(req, res, next)).catch(next);
        };
    }
}

module.exports = {
    CustomError,
    BusinessError,
    AuthenticationError,
    AuthorizationError,
    NotFoundError,
    ConflictError,
    RateLimitError,
    SystemError,
    DatabaseError,
    ExternalServiceError,
    ErrorFactory,
    ErrorHandler
};