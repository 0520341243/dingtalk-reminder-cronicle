/**
 * 管理员权限中间件
 * 仅允许管理员用户访问
 */

const logger = require('../utils/logger');

function adminMiddleware(req, res, next) {
  try {
    // 检查用户是否已认证
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: '未认证用户'
      });
    }
    
    // 检查用户角色是否为管理员
    if (req.user.role !== 'admin') {
      logger.warn(`非管理员用户 ${req.user.username} 尝试访问管理员接口`);
      return res.status(403).json({
        success: false,
        message: '权限不足，需要管理员权限'
      });
    }
    
    // 管理员验证通过
    next();
  } catch (error) {
    logger.error('管理员中间件错误:', error);
    res.status(500).json({
      success: false,
      message: '权限验证失败'
    });
  }
}

module.exports = adminMiddleware;