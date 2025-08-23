import api from '../index'
import { API_PATHS } from '@/config/api.config'

// 移除API_PATHS中的/api前缀，因为api模块已经有baseURL
const getPath = (path) => {
  return path.replace('/api', '')
}

const basePath = getPath(API_PATHS.files)

export const filesApi = {
  // 获取文件列表
  getFiles(params = {}) {
    return api.get(basePath, { params })
  },

  // 上传Excel文件
  uploadFile(formData) {
    return api.post(`${basePath}/upload`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    })
  },

  // 下载文件
  downloadFile(id) {
    return api.get(`${basePath}/${id}/download`, {
      responseType: 'blob'
    })
  },

  // 预览Excel文件内容
  previewFile(id, worksheet = null) {
    const params = worksheet ? { worksheet } : {}
    return api.get(`${basePath}/${id}/preview`, { params })
  },

  // 获取工作表列表
  getWorksheets(id) {
    return api.get(`${basePath}/${id}/worksheets`)
  },

  // 获取文件的所有工作表信息
  getFileWorksheets(id) {
    return api.get(`${basePath}/${id}/worksheets`)
  },

  // 获取工作表数据预览
  getWorksheetPreview(id, worksheet, params = {}) {
    return api.get(`${basePath}/${id}/worksheets/${worksheet}/preview`, { params })
  },

  // 删除文件
  deleteFile(id) {
    return api.delete(`${basePath}/${id}`)
  },

  // 立即启动临时计划
  startImmediate(id) {
    return api.post(`${basePath}/${id}/start-immediate`, {}, {
      headers: {
        'Content-Type': 'application/json'
      }
    })
  },

  // 清理临时文件
  cleanupTemp(beforeDate) {
    return api.post('/files/cleanup-temp', { beforeDate })
  },

  // 上传自定义提醒文件
  uploadCustomReminders(formData) {
    return api.post('/files/upload-custom-reminders', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    })
  },

  // 下载自定义提醒模板
  getCustomReminderTemplate(format) {
    return api.get('/files/custom-reminder-template', {
      params: { format },
      responseType: 'blob'
    })
  },

  // 预览自定义提醒文件
  previewCustomReminders(formData) {
    return api.post('/files/preview-custom-reminders', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    })
  },

  // 下载文件内容
  downloadFile(id) {
    return api.get(`/files/${id}/download`, {
      responseType: 'text'
    })
  },

  // 预览自定义提醒文件（简化方法名）
  previewCustomReminder(formData) {
    return this.previewCustomReminders(formData)
  },

  // 预览已上传的自定义提醒文件（通过文件ID）
  previewCustomReminderFile(fileId) {
    return api.get(`/files/${fileId}/preview-custom-reminder`)
  },

  // 批量删除文件
  batchDelete(fileIds) {
    const deletePromises = fileIds.map(fileId => api.delete(`/files/${fileId}`))
    return Promise.all(deletePromises)
  }
}