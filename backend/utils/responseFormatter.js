/**
 * API响应格式化工具
 * 确保所有API返回统一的响应格式
 */

/**
 * 成功响应格式化
 * @param {Object} data - 响应数据
 * @param {String} message - 成功消息
 * @param {Object} meta - 元数据（分页等）
 */
function success(data = null, message = '操作成功', meta = null) {
    const response = {
        success: true,
        message,
        data
    };
    
    if (meta) {
        response.meta = meta;
    }
    
    return response;
}

/**
 * 错误响应格式化
 * @param {String} message - 错误消息
 * @param {String} code - 错误代码
 * @param {Object} details - 错误详情
 */
function error(message = '操作失败', code = 'ERROR', details = null) {
    const response = {
        success: false,
        message,
        code
    };
    
    if (details) {
        response.details = details;
    }
    
    if (process.env.NODE_ENV === 'development' && details?.stack) {
        response.stack = details.stack;
    }
    
    return response;
}

/**
 * 分页响应格式化
 * @param {Array} items - 数据列表
 * @param {Number} total - 总数
 * @param {Number} page - 当前页
 * @param {Number} pageSize - 每页大小
 */
function paginated(items, total, page, pageSize) {
    return {
        success: true,
        message: '获取成功',
        data: items,
        meta: {
            total,
            page,
            pageSize,
            totalPages: Math.ceil(total / pageSize),
            hasNext: page < Math.ceil(total / pageSize),
            hasPrev: page > 1
        }
    };
}

/**
 * 验证错误响应格式化
 * @param {Array|Object} errors - 验证错误
 */
function validationError(errors) {
    return {
        success: false,
        message: '验证失败',
        code: 'VALIDATION_ERROR',
        errors: Array.isArray(errors) ? errors : [errors]
    };
}

/**
 * 未授权响应
 */
function unauthorized(message = '未授权访问') {
    return {
        success: false,
        message,
        code: 'UNAUTHORIZED'
    };
}

/**
 * 禁止访问响应
 */
function forbidden(message = '无权限访问') {
    return {
        success: false,
        message,
        code: 'FORBIDDEN'
    };
}

/**
 * 资源未找到响应
 */
function notFound(resource = '资源') {
    return {
        success: false,
        message: `${resource}不存在`,
        code: 'NOT_FOUND'
    };
}

/**
 * 服务器错误响应
 */
function serverError(message = '服务器错误', error = null) {
    const response = {
        success: false,
        message,
        code: 'SERVER_ERROR'
    };
    
    if (process.env.NODE_ENV === 'development' && error) {
        response.error = {
            message: error.message,
            stack: error.stack
        };
    }
    
    return response;
}

/**
 * Express中间件 - 添加格式化方法到res对象
 */
function responseMiddleware(req, res, next) {
    // 成功响应
    res.success = function(data, message, meta) {
        return this.json(success(data, message, meta));
    };
    
    // 错误响应
    res.error = function(message, code, details) {
        return this.status(400).json(error(message, code, details));
    };
    
    // 分页响应
    res.paginated = function(items, total, page, pageSize) {
        return this.json(paginated(items, total, page, pageSize));
    };
    
    // 验证错误
    res.validationError = function(errors) {
        return this.status(422).json(validationError(errors));
    };
    
    // 未授权
    res.unauthorized = function(message) {
        return this.status(401).json(unauthorized(message));
    };
    
    // 禁止访问
    res.forbidden = function(message) {
        return this.status(403).json(forbidden(message));
    };
    
    // 未找到
    res.notFound = function(resource) {
        return this.status(404).json(notFound(resource));
    };
    
    // 服务器错误
    res.serverError = function(message, error) {
        return this.status(500).json(serverError(message, error));
    };
    
    next();
}

module.exports = {
    success,
    error,
    paginated,
    validationError,
    unauthorized,
    forbidden,
    notFound,
    serverError,
    responseMiddleware
};