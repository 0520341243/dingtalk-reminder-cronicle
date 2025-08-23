const logger = require('../utils/logger');
const { CustomError, ErrorHandler, ErrorFactory, BusinessError, SystemError } = require('../utils/errors');

/**
 * 全局错误处理中间件
 */
function errorHandler(err, req, res, next) {
    const context = {
        url: req.url,
        method: req.method,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        userId: req.user?.id,
        username: req.user?.username
    };

    // 记录错误日志
    ErrorHandler.logError(err, context);

    // 处理不同类型的错误
    let processedError = err;

    // 如果不是自定义错误，转换为自定义错误
    if (!(err instanceof CustomError)) {
        processedError = convertToCustomError(err);
    }

    // 生成错误响应
    const response = ErrorHandler.generateResponse(
        processedError, 
        process.env.NODE_ENV === 'development'
    );

    // 返回错误响应
    res.status(processedError.statusCode || 500).json(response);
}

/**
 * 将原生错误转换为自定义错误
 */
function convertToCustomError(err) {
    // JWT相关错误
    if (err.name === 'JsonWebTokenError') {
        return ErrorFactory.invalidToken('无效的访问令牌');
    } else if (err.name === 'TokenExpiredError') {
        return ErrorFactory.tokenExpired('访问令牌已过期');
    }
    
    // 数据库错误 (PostgreSQL)
    else if (err.code) {
        switch(err.code) {
            case '23505': // 唯一约束违反
                return ErrorFactory.database('数据重复，违反唯一性约束', err);
            case '23503': // 外键约束违反
                return ErrorFactory.database('外键约束错误，相关数据不存在', err);
            case '42P01': // 表不存在
                return ErrorFactory.database('数据表不存在', err);
            case '42703': // 字段不存在
                return ErrorFactory.database('字段错误，数据表结构异常', err);
            case '40P01': // 死锁
                return ErrorFactory.database('数据库死锁，请重试', err);
            case 'ECONNREFUSED':
            case 'ENOTFOUND':
                return ErrorFactory.connectionFailed('数据库连接失败');
            default:
                return ErrorFactory.queryFailed('数据库查询失败', err);
        }
    }
    
    // 文件上传错误
    else if (err.code === 'LIMIT_FILE_SIZE') {
        return ErrorFactory.fileTooLarge('文件大小超出限制');
    } else if (err.code === 'LIMIT_FILE_COUNT') {
        return ErrorFactory.validation('文件数量超出限制');
    } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        return ErrorFactory.validation('意外的文件字段');
    }
    
    // 验证错误
    else if (err.name === 'ValidationError') {
        return ErrorFactory.validation(err.message);
    }
    
    // 网络相关错误
    else if (err.code === 'ECONNRESET') {
        return ErrorFactory.externalService('网络连接重置', 'network');
    } else if (err.code === 'ETIMEDOUT') {
        return ErrorFactory.externalService('网络请求超时', 'network');
    }
    
    // 权限相关错误
    else if (err.code === 'EACCES' || err.code === 'EPERM') {
        return ErrorFactory.system('系统权限不足');
    }
    
    // 磁盘空间错误
    else if (err.code === 'ENOSPC') {
        return ErrorFactory.system('磁盘空间不足');
    }
    
    // 其他错误
    else if (err.status || err.statusCode) {
        // 如果有状态码，创建对应的错误
        const statusCode = err.status || err.statusCode;
        if (statusCode >= 400 && statusCode < 500) {
            return new BusinessError(err.message, 'BUSINESS_ERROR', statusCode);
        } else {
            return ErrorFactory.system(err.message);
        }
    }
    
    // 默认系统错误
    return ErrorFactory.system(err.message || '未知系统错误');
}

/**
 * 404错误处理中间件
 */
function notFoundHandler(req, res, next) {
    const error = ErrorFactory.authentication(
        `接口路径不存在: ${req.method} ${req.originalUrl}`,
        'ENDPOINT_NOT_FOUND'
    );
    error.statusCode = 404;
    next(error);
}

/**
 * 异步路由错误包装器
 */
function asyncWrapper(fn) {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}

/**
 * 未捕获异常处理器
 */
function setupUncaughtExceptionHandlers() {
    // 未捕获的异常
    process.on('uncaughtException', (error) => {
        logger.error('未捕获的异常:', {
            message: error.message,
            stack: error.stack,
            type: 'uncaughtException'
        });
        
        // 优雅关闭
        process.exit(1);
    });
    
    // 未处理的Promise拒绝
    process.on('unhandledRejection', (reason, promise) => {
        logger.error('未处理的Promise拒绝:', {
            reason: reason?.message || reason,
            stack: reason?.stack,
            promise: promise.toString(),
            type: 'unhandledRejection'
        });
        
        // 不立即退出，给当前请求处理完成的机会
        setTimeout(() => {
            process.exit(1);
        }, 1000);
    });
}

module.exports = {
    errorHandler,
    notFoundHandler,
    asyncWrapper,
    setupUncaughtExceptionHandlers
};