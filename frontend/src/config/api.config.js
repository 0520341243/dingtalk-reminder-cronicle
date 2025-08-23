/**
 * API配置文件
 * 控制前端使用PostgreSQL还是MongoDB后端API
 */

// API后端类型：'postgres' 或 'mongodb'
// 可以通过环境变量 VITE_API_BACKEND 控制，默认使用 mongodb
export const API_BACKEND = import.meta.env.VITE_API_BACKEND || 'mongodb';

// API基础路径配置
export const API_BASE_PATHS = {
  postgres: {
    auth: '/api/auth',
    groups: '/api/groups',
    files: '/api/files',
    tasks: '/api/v2/tasks',
    dashboard: '/api/dashboard',
    settings: '/api/settings',
    monitoring: '/api/monitoring'
  },
  mongodb: {
    auth: '/api/mongo/auth',
    groups: '/api/mongo/groups', 
    files: '/api/mongo/files',
    tasks: '/api/mongo/tasks',
    dashboard: '/api/dashboard', // 暂时使用原有的
    settings: '/api/settings',     // 暂时使用原有的
    monitoring: '/api/monitoring'  // 暂时使用原有的
  }
};

// 获取当前使用的API路径
export const getApiPath = (service) => {
  return API_BASE_PATHS[API_BACKEND][service];
};

// 导出当前配置的API路径
export const API_PATHS = {
  auth: getApiPath('auth'),
  groups: getApiPath('groups'),
  files: getApiPath('files'),
  tasks: getApiPath('tasks'),
  dashboard: getApiPath('dashboard'),
  settings: getApiPath('settings'),
  monitoring: getApiPath('monitoring')
};

// 控制台输出当前使用的API后端
if (import.meta.env.DEV) {
  console.log(`🔧 API Backend: ${API_BACKEND}`);
  console.log('📍 API Paths:', API_PATHS);
}

export default {
  API_BACKEND,
  API_PATHS,
  getApiPath
};