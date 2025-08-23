const xss = require('xss');

// XSS防护中间件
const xssProtection = (req, res, next) => {
  // 清理请求体
  if (req.body) {
    req.body = sanitizeObject(req.body);
  }
  
  // 清理查询参数
  if (req.query) {
    req.query = sanitizeObject(req.query);
  }
  
  // 清理路径参数
  if (req.params) {
    req.params = sanitizeObject(req.params);
  }
  
  next();
};

// 递归清理对象中的所有字符串值
function sanitizeObject(obj) {
  if (typeof obj === 'string') {
    // 保留一些安全的HTML标签，如链接
    return xss(obj, {
      whiteList: {
        a: ['href', 'title', 'target'],
        b: [],
        strong: [],
        i: [],
        em: [],
        u: [],
        br: [],
        p: [],
        div: ['class'],
        span: ['class']
      },
      stripIgnoreTag: true,
      stripIgnoreTagBody: ['script']
    });
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }
  
  if (obj !== null && typeof obj === 'object') {
    const sanitized = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        sanitized[key] = sanitizeObject(obj[key]);
      }
    }
    return sanitized;
  }
  
  return obj;
}

// 输入验证中间件
const validateInput = (validationRules) => {
  return async (req, res, next) => {
    for (const field in validationRules) {
      const rules = validationRules[field];
      const value = req.body[field] || req.query[field] || req.params[field];
      
      if (rules.required && !value) {
        return res.status(400).json({
          success: false,
          message: `字段 ${field} 是必需的`
        });
      }
      
      if (value && rules.type) {
        if (rules.type === 'string' && typeof value !== 'string') {
          return res.status(400).json({
            success: false,
            message: `字段 ${field} 必须是字符串`
          });
        }
        
        if (rules.type === 'number' && isNaN(value)) {
          return res.status(400).json({
            success: false,
            message: `字段 ${field} 必须是数字`
          });
        }
        
        if (rules.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          return res.status(400).json({
            success: false,
            message: `字段 ${field} 必须是有效的邮箱地址`
          });
        }
      }
      
      if (value && rules.maxLength && value.length > rules.maxLength) {
        return res.status(400).json({
          success: false,
          message: `字段 ${field} 长度不能超过 ${rules.maxLength}`
        });
      }
      
      if (value && rules.minLength && value.length < rules.minLength) {
        return res.status(400).json({
          success: false,
          message: `字段 ${field} 长度不能少于 ${rules.minLength}`
        });
      }
      
      if (value && rules.pattern && !rules.pattern.test(value)) {
        return res.status(400).json({
          success: false,
          message: `字段 ${field} 格式不正确`
        });
      }
    }
    
    next();
  };
};

module.exports = {
  xssProtection,
  validateInput
};