import api from '../index'
import { API_PATHS } from '@/config/api.config'

// 移除API_PATHS中的/api前缀，因为api模块已经有baseURL
const getPath = (path) => {
  return path.replace('/api', '')
}

const basePath = getPath(API_PATHS.groups)

export const groupsApi = {
  // 获取群组列表
  getGroups(params = {}) {
    return api.get(basePath, { params })
  },

  // 获取群组详情
  getGroup(id) {
    return api.get(`${basePath}/${id}`)
  },

  // 创建群组
  createGroup(data) {
    return api.post(basePath, data)
  },

  // 更新群组
  updateGroup(id, data) {
    return api.put(`${basePath}/${id}`, data)
  },

  // 删除群组
  deleteGroup(id) {
    return api.delete(`${basePath}/${id}`)
  },

  // 测试群组连接
  testGroup(id, data = {}) {
    return api.post(`${basePath}/${id}/test`, data)
  },

  // 更新工作表映射
  updateMappings(id, mappings) {
    return api.put(`${basePath}/${id}/mappings`, { mappings })
  },

  // 批量操作群组
  batchOperation(action, groupIds) {
    return api.post(`${basePath}/batch`, { action, groupIds })
  },

  // 兼容性方法 - 支持 CustomReminders.vue 中使用的接口
  getList(params = {}) {
    return api.get(basePath, { params })
  }
}

// 默认导出，兼容现有的导入方式
export default groupsApi