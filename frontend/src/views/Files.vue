<template>
  <div class="files-container">
    <div class="header">
      <h2>文件管理</h2>
      <p>管理Excel提醒文件，支持上传、预览和删除操作</p>
    </div>

    <!-- 文件操作区域 -->
    <el-card class="upload-card">
      <template #header>
        <div class="card-header">
          <span><el-icon><FolderOpened /></el-icon> Excel文件管理</span>
          <div class="upload-actions">
            <el-button type="primary" @click="showUploadDialog = true">
              <el-icon><Upload /></el-icon>
              上传Excel文件
            </el-button>
          </div>
        </div>
      </template>
      
      <div class="upload-tips">
        <el-alert
          title="支持的文件格式"
          type="info"
          :closable="false"
          show-icon
        >
          <p>支持 .xlsx 和 .xls 格式的Excel文件，文件大小不超过10MB</p>
          <p>Excel文件应包含"时间"和"消息内容"两列，用于创建定时提醒任务</p>
        </el-alert>
      </div>
    </el-card>

    <!-- 文件列表 -->
    <el-card class="files-list-card">
      <template #header>
        <div class="card-header">
          <span>文件列表</span>
          <div class="filter-controls">
            <el-select 
              v-model="filterGroupId" 
              placeholder="筛选群组" 
              clearable 
              @change="loadFiles"
              style="width: 200px; margin-right: 10px;"
            >
              <el-option label="全部群组" value="" />
              <el-option
                v-for="group in availableGroups"
                :key="group.id"
                :label="group.name"
                :value="group.id"
              />
            </el-select>
            <el-button @click="loadFiles">
              <el-icon><Refresh /></el-icon>
              刷新
            </el-button>
          </div>
        </div>
      </template>

      <el-table 
        :data="paginatedFiles" 
        v-loading="filesLoading" 
        style="width: 100%"
        :default-sort="{prop: 'createdAt', order: 'descending'}"
      >
        <el-table-column prop="originalName" label="文件名" min-width="200">
          <template #default="{ row }">
            <div class="file-name">
              <el-icon><Document /></el-icon>
              <span>{{ row.originalName || row.original_name }}</span>
            </div>
          </template>
        </el-table-column>
        
        <el-table-column prop="groupName" label="关联群组" width="150">
          <template #default="{ row }">
            {{ row.groupName || row.group_name || '-' }}
          </template>
        </el-table-column>
        
        <el-table-column prop="size" label="文件大小" width="120">
          <template #default="{ row }">
            {{ formatFileSize(row.size || row.fileSize || row.file_size || 0) }}
          </template>
        </el-table-column>
        
        <el-table-column prop="uploadedAt" label="上传时间" width="180" sortable>
          <template #default="{ row }">
            {{ formatDate(row.uploadedAt || row.uploaded_at || row.createdAt || row.created_at) }}
          </template>
        </el-table-column>
        
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button 
              size="small" 
              type="primary" 
              @click="previewFile(row)"
            >
              <el-icon><View /></el-icon>
              预览
            </el-button>
            <el-button 
              size="small" 
              type="danger" 
              @click="deleteFile(row)"
            >
              <el-icon><Delete /></el-icon>
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
      
      <!-- 分页 -->
      <div class="pagination">
        <el-pagination
          v-model:current-page="currentPage"
          :page-size="pageSize"
          :total="filteredFiles.length"
          layout="total, prev, pager, next"
          @current-change="handlePageChange"
        />
      </div>
    </el-card>

    <!-- 上传对话框 -->
    <el-dialog
      v-model="showUploadDialog"
      title="上传Excel文件"
      width="600px"
      :close-on-click-modal="false"
    >
      <el-form
        ref="uploadFormRef"
        :model="uploadForm"
        :rules="uploadRules"
        label-width="100px"
        class="upload-form"
      >
        <el-form-item label="选择群组" prop="groupId">
          <el-select v-model="uploadForm.groupId" placeholder="请选择群组" style="width: 100%">
            <el-option
              v-for="group in availableGroups"
              :key="group.id"
              :label="group.name"
              :value="group.id"
            />
          </el-select>
        </el-form-item>
        
        <el-form-item label="选择文件">
          <el-upload
            ref="uploadRef"
            class="file-upload"
            drag
            action="#"
            :auto-upload="false"
            multiple
            :before-upload="beforeUpload"
            :on-change="handleFileChange"
            :file-list="fileList"
            :on-exceed="handleExceed"
            :limit="5"
            accept=".xlsx,.xls"
          >
            <el-icon class="el-icon--upload"><UploadFilled /></el-icon>
            <div class="el-upload__text">
              将文件拖到此处，或<em>点击上传</em>
            </div>
            <div class="el-upload__tip">
              最多可选择5个 xlsx/xls 文件，单个文件不超过 10MB
            </div>
          </el-upload>
        </el-form-item>

        <el-form-item>
          <div class="form-tip">
            <el-icon><InfoFilled /></el-icon>
            <span>Excel文件应包含"时间"和"消息内容"列，时间格式为HH:MM或HH:MM:SS，支持批量上传多个文件</span>
          </div>
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="showUploadDialog = false">取消</el-button>
        <el-button 
          type="primary" 
          @click="submitUpload" 
          :loading="uploading"
        >
          上传文件
        </el-button>
      </template>
    </el-dialog>

    <!-- 文件预览对话框 -->
    <el-dialog
      v-model="showPreviewDialog"
      title="文件预览"
      width="80%"
      :close-on-click-modal="false"
    >
      <div v-if="previewData">
        <!-- 工作表列表 -->
        <div v-if="previewData.worksheets" class="worksheets-info">
          <el-alert
            :title="`文件包含 ${previewData.worksheets.length} 个工作表，共 ${previewData.totalReminders || 0} 条提醒`"
            type="success"
            :closable="false"
            show-icon
          />
          
          <!-- 工作表标签页 -->
          <el-tabs v-model="activeWorksheet" class="worksheet-tabs">
            <el-tab-pane
              v-for="sheet in previewData.worksheets"
              :key="sheet"
              :label="sheet"
              :name="sheet"
            >
              <div v-if="previewData.data && previewData.data[sheet]" class="worksheet-content">
                <el-table :data="previewData.data[sheet]" size="small" max-height="400">
                  <el-table-column prop="time" label="时间" width="100" />
                  <el-table-column prop="message" label="消息内容" />
                </el-table>
              </div>
            </el-tab-pane>
          </el-tabs>
        </div>
        
        <!-- 错误信息 -->
        <div v-if="previewData.errors?.length" class="preview-errors">
          <el-alert title="解析错误" type="error" :closable="false">
            <ul>
              <li v-for="error in previewData.errors" :key="error">{{ error }}</li>
            </ul>
          </el-alert>
        </div>
        
        <!-- 旧格式兼容 -->
        <div v-if="previewData.preview?.length && !previewData.worksheets" class="preview-content">
          <el-table :data="previewData.preview" size="small">
            <el-table-column prop="time" label="时间" width="100" />
            <el-table-column prop="content" label="消息内容" />
          </el-table>
        </div>
      </div>
      <div v-loading="previewLoading" style="min-height: 200px;"></div>
      
      <template #footer>
        <el-button @click="showPreviewDialog = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  FolderOpened, Upload, Refresh, Document, View, Delete,
  UploadFilled, InfoFilled
} from '@element-plus/icons-vue'
import { filesApi } from '@/api/modules/files'
import { groupsApi } from '@/api/modules/groups'

// 响应式数据
const filesLoading = ref(false)
const uploading = ref(false)
const previewLoading = ref(false)
const files = ref([])
const availableGroups = ref([])
const filterGroupId = ref('')
const activeWorksheet = ref('') // 添加当前激活的工作表

// 分页
const currentPage = ref(1)
const pageSize = ref(10)

// 对话框状态
const showUploadDialog = ref(false)
const showPreviewDialog = ref(false)
const previewData = ref(null)

// 上传表单
const uploadFormRef = ref()
const uploadRef = ref()
const uploadForm = reactive({
  groupId: null
})
const fileList = ref([])

const uploadRules = {
  groupId: [
    { required: true, message: '请选择群组', trigger: 'change' }
  ]
}

// 计算属性
const filteredFiles = computed(() => {
  if (!filterGroupId.value) {
    return files.value
  }
  return files.value.filter(file => {
    // 兼容多种字段名格式
    const fileGroupId = file.groupId || file.group_id
    // 比较时转换为字符串，避免类型不匹配
    return String(fileGroupId) === String(filterGroupId.value)
  })
})

const paginatedFiles = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  const end = start + pageSize.value
  return filteredFiles.value.slice(start, end)
})

// 方法
const loadFiles = async () => {
  filesLoading.value = true
  try {
    const response = await filesApi.getFiles()
    // 兼容多种响应格式
    let fileList = []
    if (response.files) {
      // 直接返回 files 数组的格式
      fileList = response.files
    } else if (response.success && response.data) {
      // 包含 success 标志的格式
      fileList = response.data
    } else if (response.data && response.data.files) {
      // 嵌套在 data 中的格式
      fileList = response.data.files
    } else if (Array.isArray(response)) {
      // 直接返回数组的格式
      fileList = response
    }
    
    // 过滤Excel文件（检查多个可能的文件名字段）
    files.value = fileList.filter(file => {
      const fileName = file.originalName || file.fileName || file.file_name || file.original_name || file.filename || ''
      return fileName.toLowerCase().includes('.xlsx') || 
             fileName.toLowerCase().includes('.xls')
    })
    
    console.log('API响应原始数据:', response)
    console.log('解析后的文件列表:', fileList)
    console.log('过滤后的文件列表:', files.value)
  } catch (error) {
    console.error('加载文件列表失败:', error)
    ElMessage.error('加载文件列表失败')
  } finally {
    filesLoading.value = false
  }
}

const loadGroups = async () => {
  try {
    const response = await groupsApi.getGroups()
    // 兼容多种响应格式
    if (response.groups) {
      availableGroups.value = response.groups
    } else if (response.data && response.data.groups) {
      availableGroups.value = response.data.groups
    } else if (response.data && Array.isArray(response.data)) {
      availableGroups.value = response.data
    } else if (Array.isArray(response)) {
      availableGroups.value = response
    } else {
      // 如果都不匹配，尝试从整个响应中提取
      availableGroups.value = []
      console.warn('未能识别的群组数据格式:', response)
    }
    console.log('加载的群组列表:', availableGroups.value)
  } catch (error) {
    console.error('加载群组失败:', error)
    ElMessage.error('加载群组失败')
    // 确保有默认值
    availableGroups.value = []
  }
}

const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const formatDate = (dateString) => {
  if (!dateString) return '-'
  try {
    const date = new Date(dateString)
    if (isNaN(date.getTime())) return '-'
    return date.toLocaleString('zh-CN')
  } catch (error) {
    return '-'
  }
}

const handlePageChange = (page) => {
  currentPage.value = page
}

const beforeUpload = (file) => {
  const isExcel = file.name.toLowerCase().endsWith('.xlsx') || file.name.toLowerCase().endsWith('.xls')
  const isLt10M = file.size / 1024 / 1024 < 10

  if (!isExcel) {
    ElMessage.error('只能上传Excel文件 (.xlsx, .xls)')
    return false
  }
  if (!isLt10M) {
    ElMessage.error('文件大小不能超过10MB')
    return false
  }
  return false // 阻止自动上传
}

const handleFileChange = (file, uploadFileList) => {
  fileList.value = [...uploadFileList]
}

const handleExceed = (files, fileList) => {
  ElMessage.warning('最多只能选择5个文件')
  // 如果超出限制，移除多余的文件
  const allowedFiles = files.slice(0, 5)
  fileList.value = allowedFiles.map(file => ({
    name: file.name,
    raw: file
  }))
}

const submitUpload = async () => {
  if (!uploadFormRef.value) return
  
  try {
    await uploadFormRef.value.validate()
    
    if (!fileList.value || !fileList.value.length) {
      ElMessage.warning('请先选择文件')
      return
    }

    const formData = new FormData()
    
    // 添加所有选中的文件
    fileList.value.forEach(fileItem => {
      formData.append('files', fileItem.raw)
    })
    
    formData.append('groupId', uploadForm.groupId)

    uploading.value = true
    
    const response = await filesApi.uploadFile(formData)
    
    // axios响应格式，实际数据在response.data中
    const result = response.data || response
    
    // 检查响应格式
    if (result.success) {
      // 检查是批量上传还是单文件上传
      if (result.data && result.data.summary) {
        // 批量上传响应
        const { summary, results, errors } = result.data
        
        if (summary.success > 0) {
          if (summary.failed === 0) {
            ElMessage.success(`所有文件上传成功！成功: ${summary.success} 个`)
          } else {
            ElMessage.warning(`部分文件上传成功！成功: ${summary.success} 个，失败: ${summary.failed} 个`)
            
            // 显示失败文件的详细信息
            if (errors && errors.length > 0) {
              const failedFiles = errors.map(e => `${e.fileName}: ${e.details || e.error}`).join('\n')
              setTimeout(() => {
                ElMessage({
                  message: `失败文件详情:\n${failedFiles}`,
                  type: 'warning',
                  duration: 8000,
                  showClose: true
                })
              }, 1000)
            }
          }
        } else {
          // 所有文件都失败了
          const failedFiles = errors.map(e => `${e.fileName}: ${e.details || e.error}`).join('\n')
          throw new Error(`所有文件上传失败:\n${failedFiles}`)
        }
      } else {
        // 单文件上传响应
        ElMessage.success('文件上传成功')
      }
      
      showUploadDialog.value = false
      resetUploadForm()
      console.log('文件上传成功，开始重新加载文件列表...')
      await loadFiles()
      console.log('文件列表重新加载完成，当前文件数量:', files.value.length)
    } else {
      throw new Error(result.error || result.message || '上传失败')
    }
  } catch (error) {
    console.error('文件上传失败:', error)
    ElMessage.error('文件上传失败: ' + (error.message || '未知错误'))
  } finally {
    uploading.value = false
  }
}

const resetUploadForm = () => {
  Object.assign(uploadForm, {
    groupId: null
  })
  fileList.value = []
  if (uploadRef.value && typeof uploadRef.value.clearFiles === 'function') {
    uploadRef.value.clearFiles()
  }
}

const previewFile = async (file) => {
  try {
    previewLoading.value = true
    showPreviewDialog.value = true
    
    const response = await filesApi.previewFile(file.id)
    // axios响应格式，实际数据在response.data中
    const result = response.data || response
    
    // 兼容多种响应格式
    if (result.success && result.data) {
      // 标准格式 {success: true, data: {...}}
      previewData.value = result.data
    } else if (result.worksheets || result.reminders) {
      // 直接返回数据的格式
      previewData.value = result
    } else if (result.error) {
      throw new Error(result.error || result.message)
    } else {
      // 其他格式，尝试直接使用
      previewData.value = result
    }
    
    console.log('预览数据:', previewData.value)
  } catch (error) {
    console.error('文件预览失败:', error)
    ElMessage.error('文件预览失败: ' + (error.message || '未知错误'))
    showPreviewDialog.value = false
  } finally {
    previewLoading.value = false
  }
}

const deleteFile = async (file) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除文件 "${file.originalName || file.original_name}" 吗？`,
      '确认删除',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    const response = await filesApi.deleteFile(file.id)
    // axios响应格式，实际数据在response.data中
    const result = response.data || response
    
    if (result.success) {
      ElMessage.success('文件删除成功')
      await loadFiles()
    } else {
      throw new Error(result.error || result.message || '删除失败')
    }
  } catch (error) {
    if (error !== 'cancel') {
      console.error('文件删除失败:', error)
      ElMessage.error('文件删除失败: ' + (error.message || '未知错误'))
    }
  }
}

// 初始化函数
const initializeFiles = async () => {
  await Promise.all([
    loadFiles(),
    loadGroups()
  ])
}

// 生命周期 - 不使用async
onMounted(() => {
  initializeFiles()
})
</script>

<style scoped>
.files-container {
  padding: 20px;
}

.header {
  margin-bottom: 20px;
}

.header h2 {
  margin: 0 0 5px 0;
  color: #303133;
}

.header p {
  margin: 0;
  color: #909399;
  font-size: 14px;
}

.upload-card, .files-list-card {
  margin-bottom: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-header span {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
}

.upload-tips {
  margin-top: 16px;
}

.upload-tips .el-alert p {
  margin: 4px 0;
}

.filter-controls {
  display: flex;
  align-items: center;
}

.file-name {
  display: flex;
  align-items: center;
  gap: 8px;
}

.pagination {
  margin-top: 20px;
  display: flex;
  justify-content: center;
}

.upload-form {
  margin-top: 16px;
}

.form-tip {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #909399;
  font-size: 14px;
}

.file-upload {
  width: 100%;
}

.preview-errors {
  margin: 16px 0;
}

.preview-content {
  margin-top: 16px;
  max-height: 400px;
  overflow-y: auto;
}

.worksheets-info {
  margin-top: 10px;
}

.worksheet-tabs {
  margin-top: 16px;
}

.worksheet-content {
  margin-top: 10px;
  overflow-x: auto;
}

/* 移动端表格优化 */
@media (max-width: 768px) {
  /* 确保文件列表在移动端显示 */
  .files-list-card .el-table {
    display: block !important;
    overflow-x: auto;
  }
  
  .files-list-card .el-table__body-wrapper {
    overflow-x: auto;
  }
  
  /* 移动端表格列调整 - 不完全隐藏，而是调整显示 */
  .el-table .el-table__cell:nth-child(3) {
    min-width: 80px;
    font-size: 12px;
  }
  
  .el-table .el-table__cell:nth-child(4) {
    min-width: 120px;
    font-size: 12px;
  }
  
  /* 确保表格数据完整显示 */
  .el-table {
    min-width: 100%;
  }
  
  .worksheet-tabs .el-tabs__content {
    padding: 10px 0;
  }
  
  .worksheet-content .el-table {
    font-size: 12px;
  }
  
  .preview-content .el-table {
    font-size: 12px;
  }
  
  .el-dialog {
    width: 95% !important;
  }
  
  .el-dialog__body {
    padding: 10px !important;
  }
}

@media (max-width: 768px) {
  .files-container {
    padding: 10px;
  }

  .card-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
  }

  .filter-controls {
    width: 100%;
    flex-direction: column;
    gap: 10px;
  }

  .filter-controls .el-select {
    width: 100% !important;
  }
}
</style>