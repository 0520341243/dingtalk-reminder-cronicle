import api from '../index'
import { API_PATHS } from '@/config/api.config'

// 移除API_PATHS中的/api前缀，因为api模块已经有baseURL
const getPath = (path) => {
  return path.replace('/api', '')
}

export const authApi = {
  // 用户登录
  login(credentials) {
    return api.post(`${getPath(API_PATHS.auth)}/login`, credentials)
  },

  // 用户注册
  register(userData) {
    return api.post(`${getPath(API_PATHS.auth)}/register`, userData)
  },

  // 获取用户资料
  getProfile() {
    return api.get(`${getPath(API_PATHS.auth)}/profile`)
  },

  // 修改密码
  changePassword(passwords) {
    return api.post(`${getPath(API_PATHS.auth)}/change-password`, passwords)
  },

  // 刷新Token (MongoDB API新增)
  refreshToken(refreshToken) {
    return api.post(`${getPath(API_PATHS.auth)}/refresh`, { refreshToken })
  },

  // 获取用户列表 (管理员)
  getUsers() {
    return api.get(`${getPath(API_PATHS.auth)}/users`)
  },

  // 删除用户 (管理员)
  deleteUser(userId) {
    return api.delete(`${getPath(API_PATHS.auth)}/users/${userId}`)
  },

  // 用户登出
  logout() {
    return api.post(`${getPath(API_PATHS.auth)}/logout`)
  }
}