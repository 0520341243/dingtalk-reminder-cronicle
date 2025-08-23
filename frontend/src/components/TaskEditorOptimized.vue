<template>
  <el-dialog
    :model-value="visible"
    :title="dialogTitle"
    :width="dialogWidth"
    :close-on-click-modal="false"
    :fullscreen="isMobileFullscreen"
    class="task-editor-dialog"
    @close="handleClose"
  >
    <el-form
      ref="formRef"
      :model="formData"
      :rules="formRules"
      :label-width="isMobile ? '100px' : '120px'"
      :label-position="isMobile ? 'top' : 'right'"
      class="task-form"
    >
      <!-- 任务类型提示 -->
      <el-alert
        :title="formData.contentSource === 'worksheet' ? '工作表任务' : '简单任务'"
        :type="formData.contentSource === 'worksheet' ? 'success' : 'primary'"
        :description="formData.contentSource === 'worksheet' 
          ? '从Excel工作表中读取多个时间点和消息内容' 
          : '设置单个固定时间和消息内容'"
        :closable="false"
        show-icon
        style="margin-bottom: 20px"
      />
      
      <!-- 基本信息 -->
      <div class="form-section">
        <div class="section-title">
          <el-icon><Document /></el-icon>
          基本信息
        </div>
        
        <el-row :gutter="20">
          <el-col :xs="24" :sm="12">
            <el-form-item label="任务名称" prop="name">
              <el-input
                v-model="formData.name"
                placeholder="请输入任务名称"
                maxlength="100"
                show-word-limit
              />
            </el-form-item>
          </el-col>
          <el-col :xs="24" :sm="12">
            <el-form-item label="优先级" prop="priority">
              <el-select
                v-model="formData.priority"
                placeholder="选择优先级"
                style="width: 100%"
              >
                <el-option label="高" value="high" />
                <el-option label="普通" value="normal" />
                <el-option label="低" value="low" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="20">
          <el-col :xs="24" :sm="12">
            <el-form-item label="目标群组" prop="groupId">
              <el-select
                v-model="formData.groupId"
                placeholder="选择目标群组"
                style="width: 100%"
                @change="handleGroupChange"
              >
                <el-option
                  v-for="group in props.availableGroups"
                  :key="group.id"
                  :label="group.name"
                  :value="group.id"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :xs="24" :sm="12">
            <el-form-item label="任务状态" prop="status">
              <el-select
                v-model="formData.status"
                placeholder="选择状态"
                style="width: 100%"
              >
                <el-option label="活跃" value="active" />
                <el-option label="暂停" value="paused" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item label="任务描述" prop="description">
          <el-input
            v-model="formData.description"
            type="textarea"
            :rows="3"
            placeholder="请输入任务描述（可选）"
            maxlength="500"
            show-word-limit
          />
        </el-form-item>
      </div>

      <!-- 消息时间和内容配置 -->
      <div class="form-section">
        <div class="section-title">
          <el-icon><ChatLineRound /></el-icon>
          消息时间和内容配置
        </div>

        <el-form-item label="内容来源" prop="contentSource">
          <el-radio-group v-model="formData.contentSource" @change="handleContentSourceChange">
            <el-radio value="manual">手动输入</el-radio>
            <el-radio value="worksheet">工作表数据</el-radio>
          </el-radio-group>
        </el-form-item>

        <!-- 手动输入模式 -->
        <div v-if="formData.contentSource === 'manual'" class="content-manual">
          <el-row :gutter="20">
            <el-col :xs="24" :sm="12">
              <el-form-item label="提醒时间" prop="reminderTime">
                <el-time-picker
                  v-model="formData.reminderTime"
                  format="HH:mm"
                  value-format="HH:mm"
                  placeholder="选择提醒时间"
                  style="width: 100%"
                />
              </el-form-item>
            </el-col>
            <el-col :xs="24" :sm="12">
              <div class="time-preview">
                <span class="time-label">当前时间：</span>
                <span class="time-value">{{ formData.reminderTime || '未设置' }}</span>
              </div>
            </el-col>
          </el-row>
          
          <el-form-item label="消息内容" prop="messageContent">
            <el-input
              v-model="formData.messageContent"
              type="textarea"
              :rows="4"
              placeholder="请输入要发送的消息内容"
              maxlength="1000"
              show-word-limit
            />
          </el-form-item>
        </div>

        <!-- 工作表数据模式 -->
        <div v-if="formData.contentSource === 'worksheet'" class="content-worksheet">
          <el-form-item label="选择文件" prop="selectedFileId">
            <el-select
              v-model="formData.selectedFileId"
              placeholder="选择已上传的Excel文件"
              style="width: 100%"
              @change="handleFileChange"
              :loading="filesLoading"
            >
              <el-option
                v-for="file in availableFiles"
                :key="file.id || file._id"
                :label="`${file.originalName || file.original_name || file.fileName || file.filename} (${formatFileTime(file.uploadedAt || file.upload_time)})`"
                :value="file.id || file._id"
              />
            </el-select>
          </el-form-item>

          <el-form-item label="选择工作表" prop="selectedWorksheet" v-if="availableWorksheets.length > 0">
            <el-select
              v-model="formData.selectedWorksheet"
              placeholder="选择工作表"
              style="width: 100%"
              @change="handleWorksheetChange"
            >
              <el-option
                v-for="worksheet in availableWorksheets"
                :key="worksheet.name"
                :label="worksheet.label"
                :value="worksheet.name"
              />
            </el-select>
          </el-form-item>

          <div v-if="formData.selectedWorksheet" class="worksheet-preview">
            <div class="preview-title">工作表数据预览</div>
            <div class="preview-content">
              <div class="preview-info">
                <span>工作表: {{ getWorksheetLabel(formData.selectedWorksheet) }}</span>
                <span>数据行数: {{ worksheetTotalCount || worksheetPreview.length }}</span>
              </div>
              <el-table
                :data="worksheetPreview"
                size="small"
                stripe
                max-height="200px"
                v-loading="previewLoading"
              >
                <el-table-column prop="time" label="时间" width="100" />
                <el-table-column prop="content" label="消息内容" show-overflow-tooltip />
              </el-table>
              
              <!-- 分页控制 -->
              <el-pagination
                v-if="worksheetTotalCount > previewPageSize"
                small
                layout="prev, pager, next, sizes"
                :page-sizes="[5, 10, 20, 50]"
                :current-page="previewCurrentPage"
                :page-size="previewPageSize"
                :total="worksheetTotalCount"
                @current-change="handlePreviewPageChange"
                @size-change="handlePreviewSizeChange"
                style="margin-top: 10px; justify-content: center;"
              />
              
              <div v-if="worksheetTotalCount > previewPageSize" class="preview-more">
                共 {{ worksheetTotalCount }} 条数据，当前显示第 {{ (previewCurrentPage - 1) * previewPageSize + 1 }} - {{ Math.min(previewCurrentPage * previewPageSize, worksheetTotalCount) }} 条
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 调度规则配置 -->
      <div class="form-section">
        <div class="section-title">
          <el-icon><AlarmClock /></el-icon>
          调度规则配置
        </div>

        <!-- 桌面端调度规则构建器 -->
        <DateRuleBuilderEnhanced 
          v-if="!isMobile"
          v-model="formData.scheduleRule"
          :execution-time="formData.reminderTime"
          :content-source="formData.contentSource"
          :worksheet-times="worksheetPreview"
          @change="handleScheduleRuleChange"
        />
        
        <!-- 移动端调度规则构建器 -->
        <DateRuleBuilderMobile
          v-else
          v-model="formData.scheduleRule"
          :execution-time="formData.reminderTime"
          :content-source="formData.contentSource"
          :worksheet-times="worksheetPreview"
          @change="handleScheduleRuleChange"
        />
      </div>

      <!-- 高级选项 -->
      <div class="form-section">
        <div class="section-title">
          <el-icon><Setting /></el-icon>
          高级选项
        </div>

        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="生效日期">
              <el-date-picker
                v-model="formData.effectiveDate"
                type="date"
                placeholder="选择生效日期"
                format="YYYY-MM-DD"
                value-format="YYYY-MM-DD"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="失效日期">
              <el-date-picker
                v-model="formData.expiryDate"
                type="date"
                placeholder="选择失效日期"
                format="YYYY-MM-DD"
                value-format="YYYY-MM-DD"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item>
          <el-checkbox v-model="formData.enableRetry">启用重试机制</el-checkbox>
          <el-checkbox v-model="formData.enableLogging">启用详细日志</el-checkbox>
        </el-form-item>
      </div>
    </el-form>

    <template #footer>
      <div class="dialog-footer">
        <el-button @click="handleClose">取消</el-button>
        <el-button @click="handleReset">重置</el-button>
        <el-button type="primary" @click="handleSave" :loading="saving">
          {{ isEdit ? '保存修改' : '创建任务' }}
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import {
  Document, ChatLineRound, AlarmClock, Setting
} from '@element-plus/icons-vue'
import DateRuleBuilderMobile from './DateRuleBuilderMobile.vue'
import DateRuleBuilderEnhanced from './DateRuleBuilderEnhanced.vue'
import { filesApi } from '@/api/modules/files'
import { extractArrayData } from '@/utils/apiHelper'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  task: {
    type: Object,
    default: null
  },
  availableGroups: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['close', 'save'])

// 响应式数据
const formRef = ref()
const saving = ref(false)
const filesLoading = ref(false)
const availableFiles = ref([])
const availableWorksheets = ref([])
const worksheetPreview = ref([])
const worksheetTotalCount = ref(0)
const previewCurrentPage = ref(1)
const previewPageSize = ref(10)
const previewLoading = ref(false)
const worksheetAllData = ref([]) // 存储所有数据

const isEdit = computed(() => !!props.task?.id)

const dialogTitle = computed(() => {
  const action = isEdit.value ? '编辑' : '创建'
  const taskType = formData.contentSource === 'worksheet' ? '工作表任务' : '简单任务'
  return `${action}${taskType}`
})

// 响应式对话框宽度
const dialogWidth = computed(() => {
  // 检测是否移动端
  const isMobile = window.innerWidth <= 768
  return isMobile ? '95%' : '800px'
})

// 移动端检测
const isMobile = computed(() => {
  return window.innerWidth <= 768
})

// 移动端全屏模式（仅在长表单时启用）
const isMobileFullscreen = computed(() => {
  return isMobile.value && formData.contentSource === 'worksheet'
})

// 表单数据
const formData = reactive({
  name: '',
  description: '',
  priority: 'normal',
  status: 'active',
  groupId: null,
  contentSource: 'manual', // manual | worksheet
  reminderTime: '09:00', // 提醒时间
  messageContent: '',
  selectedFileId: null,
  selectedWorksheet: null,
  scheduleRule: {
    ruleType: 'by_day',
    months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    dayMode: { type: 'specific_days', days: [], nthDay: 1 },
    weekMode: { weekdays: [], occurrence: 'every' },
    intervalMode: { value: 1, unit: 'days', referenceDate: '' },
    excludeSettings: {
      excludeHolidays: false,
      excludeWeekends: false,
      specificDates: []
    },
    executionTime: '09:00'
  },
  effectiveDate: null,
  expiryDate: null,
  enableRetry: true,
  enableLogging: false
})

// 表单验证规则
const formRules = {
  name: [
    { required: true, message: '请输入任务名称', trigger: 'blur' },
    { min: 1, max: 100, message: '长度在 1 到 100 个字符', trigger: 'blur' }
  ],
  groupId: [
    { required: true, message: '请选择目标群组', trigger: 'change' }
  ],
  priority: [
    { required: true, message: '请选择优先级', trigger: 'change' }
  ],
  status: [
    { required: true, message: '请选择状态', trigger: 'change' }
  ],
  contentSource: [
    { required: true, message: '请选择内容来源', trigger: 'change' }
  ],
  reminderTime: [
    {
      validator: (rule, value, callback) => {
        if (formData.contentSource === 'manual' && !value) {
          callback(new Error('请选择提醒时间'))
        } else {
          callback()
        }
      },
      trigger: 'change'
    }
  ],
  messageContent: [
    {
      validator: (rule, value, callback) => {
        if (formData.contentSource === 'manual' && !value) {
          callback(new Error('请输入消息内容'))
        } else {
          callback()
        }
      },
      trigger: 'blur'
    }
  ],
  selectedFileId: [
    {
      validator: (rule, value, callback) => {
        if (formData.contentSource === 'worksheet' && !value) {
          callback(new Error('请选择Excel文件'))
        } else {
          callback()
        }
      },
      trigger: 'change'
    }
  ],
  selectedWorksheet: [
    {
      validator: (rule, value, callback) => {
        if (formData.contentSource === 'worksheet' && !value) {
          callback(new Error('请选择工作表'))
        } else {
          callback()
        }
      },
      trigger: 'change'
    }
  ]
}

// 工作表标签映射
const worksheetLabels = {
  '子表1': '周一至周四 (子表1)',
  '子表2': '周五 (子表2)', 
  '子表3': '周六 (子表3)',
  '子表4': '周日 (子表4)',
  '子表5': '临时计划 (子表5)'
}

// 方法
const loadAvailableFiles = async () => {
  try {
    filesLoading.value = true
    const response = await filesApi.getFiles()
    
    console.log('文件API响应:', response)
    
    // 使用统一的数据提取函数
    const fileList = extractArrayData(response, 'files')
    
    // 过滤Excel文件
    availableFiles.value = fileList.filter(file => {
      const fileName = file.fileName || file.originalName || file.file_name || file.original_name || file.filename || ''
      return fileName.toLowerCase().includes('.xlsx') || fileName.toLowerCase().includes('.xls')
    })
    
    console.log('加载的Excel文件:', availableFiles.value)
  } catch (error) {
    console.error('加载文件列表失败:', error)
    ElMessage.error('加载文件列表失败')
    availableFiles.value = []
  } finally {
    filesLoading.value = false
  }
}

const handleGroupChange = () => {
  // 群组变更时可以做一些额外处理
  console.log('群组已变更:', formData.groupId)
}

const handleContentSourceChange = () => {
  // 清空相关字段
  formData.reminderTime = '09:00'
  formData.messageContent = ''
  formData.selectedFileId = null
  formData.selectedWorksheet = null
  availableWorksheets.value = []
  worksheetPreview.value = []
}

const handleFileChange = async () => {
  if (!formData.selectedFileId) {
    availableWorksheets.value = []
    worksheetPreview.value = []
    return
  }

  try {
    // 获取文件的工作表信息
    const response = await filesApi.getFileWorksheets(formData.selectedFileId)
    
    console.log('工作表API响应:', response)
    
    // 处理axios响应格式 - response.data包含实际数据
    const responseData = response.data || response
    const worksheetList = responseData?.worksheets || []
    
    console.log('提取的工作表列表:', worksheetList)
    
    // 转换为前端需要的格式
    availableWorksheets.value = worksheetList.map(sheet => {
      const sheetName = typeof sheet === 'string' ? sheet : (sheet.name || sheet)
      return {
        name: sheetName,
        label: worksheetLabels[sheetName] || sheetName,
        rowCount: 0
      }
    })
    
    console.log('可用工作表:', availableWorksheets.value)
  } catch (error) {
    console.error('获取工作表信息失败:', error)
    ElMessage.error('获取工作表信息失败')
    availableWorksheets.value = []
  }
  
  formData.selectedWorksheet = null
  worksheetPreview.value = []
}

const handleWorksheetChange = async () => {
  if (!formData.selectedFileId || !formData.selectedWorksheet) {
    worksheetPreview.value = []
    worksheetAllData.value = []
    worksheetTotalCount.value = 0
    return
  }

  previewLoading.value = true
  try {
    // 获取工作表数据预览 - 使用文件预览API
    const response = await filesApi.previewFile(formData.selectedFileId, formData.selectedWorksheet)
    
    console.log('=== 工作表数据加载调试信息 ===')
    console.log('文件ID:', formData.selectedFileId)
    console.log('工作表名称:', formData.selectedWorksheet)
    console.log('API响应:', response)
    
    // 处理axios响应格式 - response.data包含实际数据
    const responseData = response.data || response
    console.log('响应数据:', responseData)
    console.log('响应结构:', {
      hasReminders: !!responseData.reminders,
      hasData: !!responseData.data,
      isArray: Array.isArray(responseData),
      keys: Object.keys(responseData || {})
    })
    
    // 处理响应格式 - 优先使用 reminders 字段
    let previewData = []
    if (responseData && responseData.reminders && Array.isArray(responseData.reminders)) {
      previewData = responseData.reminders
      console.log('✅ 找到 reminders 字段，包含', previewData.length, '条数据')
    } else if (responseData && responseData.data) {
      if (responseData.data[formData.selectedWorksheet]) {
        previewData = responseData.data[formData.selectedWorksheet]
        console.log('✅ 从 data[worksheet] 获取数据，包含', previewData.length, '条数据')
      } else if (Array.isArray(responseData.data)) {
        previewData = responseData.data
        console.log('✅ 从 data 数组获取数据，包含', previewData.length, '条数据')
      }
    } else if (Array.isArray(responseData)) {
      previewData = responseData
      console.log('✅ 响应本身是数组，包含', previewData.length, '条数据')
    } else {
      console.error('❌ 无法识别的响应格式')
    }
    
    if (previewData.length > 0) {
      console.log('预览数据示例 (前3条):')
      previewData.slice(0, 3).forEach((item, index) => {
        console.log(`  ${index + 1}. 时间: ${item.time}, 消息: ${item.message || item.content}`)
      })
    }
    
    // 存储所有数据并格式化
    worksheetAllData.value = previewData.map((item, index) => {
      const formatted = {
        time: item.time || '未知时间',
        content: item.message || item.content || '无内容'
      }
      if (index < 3) {
        console.log(`格式化数据 ${index + 1}:`, formatted)
      }
      return formatted
    })
    
    worksheetTotalCount.value = worksheetAllData.value.length
    previewCurrentPage.value = 1
    
    // 更新当前页显示的数据
    updatePreviewDisplay()
    
    console.log(`工作表预览数据: 共${worksheetTotalCount.value}条`)
  } catch (error) {
    console.error('获取工作表预览失败:', error)
    ElMessage.error('获取工作表预览失败')
    worksheetPreview.value = []
    worksheetAllData.value = []
    worksheetTotalCount.value = 0
  } finally {
    previewLoading.value = false
  }
}

// 更新预览显示的数据
const updatePreviewDisplay = () => {
  const start = (previewCurrentPage.value - 1) * previewPageSize.value
  const end = start + previewPageSize.value
  worksheetPreview.value = worksheetAllData.value.slice(start, end)
}

// 处理页码变化
const handlePreviewPageChange = (page) => {
  previewCurrentPage.value = page
  updatePreviewDisplay()
}

// 处理每页显示数量变化
const handlePreviewSizeChange = (size) => {
  previewPageSize.value = size
  previewCurrentPage.value = 1
  updatePreviewDisplay()
}

const handleScheduleRuleChange = (rule) => {
  console.log('调度规则已变更:', rule)
}

const getWorksheetLabel = (worksheetName) => {
  return worksheetLabels[worksheetName] || worksheetName
}

const formatFileTime = (time) => {
  if (!time) return '未知时间'
  const date = new Date(time)
  if (isNaN(date.getTime())) return '未知时间'
  return date.toLocaleDateString('zh-CN')
}

const handleClose = () => {
  emit('close')
}

const handleReset = () => {
  formRef.value?.resetFields()
  availableWorksheets.value = []
  worksheetPreview.value = []
}

const handleSave = async () => {
  try {
    const valid = await formRef.value.validate()
    if (!valid) return

    saving.value = true

    // 构建保存数据
    const saveData = {
      name: formData.name,
      description: formData.description,
      priority: formData.priority,
      status: formData.status,
      groupId: formData.groupId,
      contentSource: formData.contentSource,
      scheduleRule: formData.scheduleRule,
      effectiveDate: formData.effectiveDate,
      expiryDate: formData.expiryDate,
      enableRetry: formData.enableRetry,
      enableLogging: formData.enableLogging
    }

    if (formData.contentSource === 'manual') {
      saveData.reminderTime = formData.reminderTime
      saveData.messageContent = formData.messageContent
    } else {
      saveData.fileConfig = {
        fileId: formData.selectedFileId,
        worksheet: formData.selectedWorksheet
      }
    }

    emit('save', saveData)
  } catch (error) {
    console.error('表单验证失败:', error)
  } finally {
    saving.value = false
  }
}

// 监听群组变化
watch(() => props.availableGroups, (newGroups) => {
  if (newGroups && newGroups.length > 0) {
    console.log('群组列表已更新:', newGroups)
  }
}, { immediate: true, deep: true })

// 监听器
// 监听visible变化
watch(() => props.visible, async (visible) => {
  if (visible) {
    // 异步加载文件列表
    await loadAvailableFiles()
    
    // 编辑模式下填充数据
    if (props.task) {
      console.log('TaskEditor - 接收到的任务数据:', props.task)
      console.log('TaskEditor - scheduleRule:', props.task.scheduleRule || props.task.schedule_rule)
      console.log('TaskEditor - fileConfig:', props.task.fileConfig || props.task.file_config)
      
      const formValues = {
        name: props.task.name || '',
        description: props.task.description || '',
        priority: props.task.priority || 'normal',
        status: props.task.status || 'active',
        groupId: props.task.groupId || props.task.group_id || null,
        contentSource: props.task.contentSource || props.task.content_source || (props.task.fileConfig || props.task.file_config ? 'worksheet' : 'manual'),
        reminderTime: props.task.reminderTime || props.task.reminder_time || props.task.scheduleRule?.executionTime || props.task.schedule_rule?.executionTime || '09:00',
        messageContent: props.task.messageContent || props.task.message_content || '',
        selectedFileId: props.task.fileConfig?.fileId || props.task.file_config?.fileId || null,
        selectedWorksheet: props.task.fileConfig?.worksheet || props.task.file_config?.worksheet || null,
        scheduleRule: props.task.scheduleRule || props.task.schedule_rule || {
          ruleType: 'by_day',
          months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
          dayMode: { type: 'specific_days', days: [], nthDay: 1 },
          weekMode: { weekdays: [], occurrence: 'every' },
          intervalMode: { value: 1, unit: 'days', referenceDate: '' },
          excludeSettings: {
            excludeHolidays: false,
            excludeWeekends: false,
            specificDates: []
          },
          executionTime: '09:00'
        },
        effectiveDate: props.task.effectiveDate || props.task.effective_date || null,
        expiryDate: props.task.expiryDate || props.task.expiry_date || null,
        enableRetry: props.task.enableRetry !== undefined ? props.task.enableRetry : (props.task.enable_retry !== undefined ? props.task.enable_retry : true),
        enableLogging: props.task.enableLogging || props.task.enable_logging || false
      }
      
      console.log('TaskEditor - 填充到表单的数据:', formValues)
      Object.assign(formData, formValues)
      
      // 如果有文件ID，重新加载工作表
      if (formData.selectedFileId) {
        await handleFileChange()
        // 如果有工作表，也加载预览数据
        if (formData.selectedWorksheet) {
          await handleWorksheetChange()
        }
      }
    } else {
      // 新建模式下重置表单
      Object.assign(formData, {
        name: '',
        description: '',
        priority: 'normal',
        status: 'active',
        groupId: null,
        contentSource: 'manual',
        reminderTime: '09:00',
        messageContent: '',
        selectedFileId: null,
        selectedWorksheet: null,
        scheduleRule: {
          ruleType: 'by_day',
          months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
          dayMode: { type: 'specific_days', days: [], nthDay: 1 },
          weekMode: { weekdays: [], occurrence: 'every' },
          intervalMode: { value: 1, unit: 'days', referenceDate: '' },
          excludeSettings: {
            excludeHolidays: false,
            excludeWeekends: false,
            specificDates: []
          },
          executionTime: '09:00'
        },
        effectiveDate: null,
        expiryDate: null,
        enableRetry: true,
        enableLogging: false
      })
    }
  }
}, { immediate: true, deep: true })

// 额外监听task prop的变化
watch(() => props.task, async (newTask) => {
  if (newTask && props.visible) {
    // 重新填充数据
    Object.assign(formData, {
      name: newTask.name || '',
      description: newTask.description || '',
      priority: newTask.priority || 'normal',
      status: newTask.status || 'active',
      groupId: newTask.groupId || newTask.group_id || null,
      contentSource: newTask.contentSource || newTask.content_source || (newTask.fileConfig || newTask.file_config ? 'worksheet' : 'manual'),
      reminderTime: newTask.reminderTime || newTask.reminder_time || newTask.scheduleRule?.executionTime || '09:00',
      messageContent: newTask.messageContent || newTask.message_content || '',
      selectedFileId: newTask.fileConfig?.fileId || newTask.file_config?.fileId || null,
      selectedWorksheet: newTask.fileConfig?.worksheet || newTask.file_config?.worksheet || null,
      scheduleRule: newTask.scheduleRule || newTask.schedule_rule || {
        ruleType: 'by_day',
        months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
        dayMode: { type: 'specific_days', days: [], nthDay: 1 },
        weekMode: { weekdays: [], occurrence: 'every' },
        intervalMode: { value: 1, unit: 'days', referenceDate: '' },
        excludeSettings: {
          excludeHolidays: false,
          excludeWeekends: false,
          specificDates: []
        },
        executionTime: '09:00'
      },
      effectiveDate: newTask.effectiveDate || newTask.effective_date || null,
      expiryDate: newTask.expiryDate || newTask.expiry_date || null,
      enableRetry: newTask.enableRetry !== undefined ? newTask.enableRetry : (newTask.enable_retry !== undefined ? newTask.enable_retry : true),
      enableLogging: newTask.enableLogging || newTask.enable_logging || false
    })
    
    // 如果有文件ID，重新加载工作表
    if (formData.selectedFileId) {
      await handleFileChange()
      // 如果有工作表，也加载预览数据
      if (formData.selectedWorksheet) {
        await handleWorksheetChange()
      }
    }
  }
}, { deep: true })

onMounted(() => {
  if (props.visible) {
    loadAvailableFiles()
  }
})
</script>

<style scoped>
.task-editor-dialog {
  :deep(.el-dialog__body) {
    padding: 20px;
    max-height: calc(90vh - 140px);
    overflow-y: auto;
  }
}

.task-form {
  height: 100%;
  overflow: visible;
  padding-right: 10px;
}

.form-section {
  margin-bottom: 32px;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  padding: 20px;
  background: #fafafa;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 20px;
  padding-bottom: 10px;
  border-bottom: 2px solid #e4e7ed;
}

.section-title .el-icon {
  color: #409eff;
}

.content-worksheet {
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 6px;
  padding: 16px;
  margin-top: 10px;
}

.worksheet-preview {
  margin-top: 16px;
  border: 1px solid #e4e7ed;
  border-radius: 6px;
  overflow: hidden;
}

.preview-title {
  background: #f5f7fa;
  padding: 10px 16px;
  font-weight: 500;
  color: #606266;
  border-bottom: 1px solid #e4e7ed;
}

.preview-content {
  padding: 16px;
}

.preview-info {
  display: flex;
  justify-content: space-between;
  margin-bottom: 12px;
  color: #606266;
  font-size: 14px;
}

.preview-more {
  text-align: center;
  color: #909399;
  font-size: 12px;
  margin-top: 8px;
}

.time-preview {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  background: #f5f7fa;
  border: 1px solid #e4e7ed;
  border-radius: 6px;
  margin-top: 8px;
}

.time-label {
  font-size: 14px;
  color: #606266;
  margin-right: 8px;
}

.time-value {
  font-size: 14px;
  color: #409eff;
  font-weight: 500;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

/* 滚动条样式 */
.task-form::-webkit-scrollbar {
  width: 6px;
}

.task-form::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 3px;
}

.task-form::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 3px;
}

.task-form::-webkit-scrollbar-thumb:hover {
  background: #a1a1a1;
}

/* 移动端适配 */
@media (max-width: 768px) {
  /* 修复移动端对话框显示问题 */
  .task-editor-dialog :deep(.el-dialog) {
    width: 95% !important;
    margin: 2.5vh auto !important;
    border-radius: 12px;
  }
  
  /* 全屏模式 */
  .task-editor-dialog :deep(.el-dialog.is-fullscreen) {
    width: 100% !important;
    height: 100% !important;
    margin: 0 !important;
    border-radius: 0;
  }
  
  .task-editor-dialog :deep(.el-dialog__body) {
    padding: 10px !important;
    max-height: calc(90vh - 120px) !important;
    overflow-y: auto !important;
    -webkit-overflow-scrolling: touch; /* 改善iOS滚动体验 */
  }
  
  .task-editor-dialog :deep(.el-dialog.is-fullscreen .el-dialog__body) {
    max-height: calc(100vh - 100px) !important;
  }
  
  .task-editor-dialog :deep(.el-dialog__header) {
    padding: 16px !important;
    border-bottom: 1px solid #e4e7ed;
    position: sticky;
    top: 0;
    background: white;
    z-index: 10;
  }
  
  .task-editor-dialog :deep(.el-dialog__footer) {
    padding: 12px 16px !important;
    border-top: 1px solid #e4e7ed;
    position: sticky;
    bottom: 0;
    background: white;
    z-index: 10;
  }
  
  .task-form {
    max-height: none !important;  /* 移除高度限制，避免内容被截断 */
    overflow: visible !important;
  }
  
  .task-form .el-form-item__label {
    width: 100px !important;
    font-size: 13px;
  }
  
  .form-section {
    margin-bottom: 16px;
    padding: 12px;
  }
  
  .section-title {
    font-size: 14px;
    margin-bottom: 12px;
  }
  
  /* 响应式列布局 */
  .el-row .el-col {
    margin-bottom: 8px;
  }
  
  .el-col-12 {
    width: 100% !important;
    max-width: 100% !important;
    flex: 0 0 100% !important;
  }
  
  /* 移动端输入框优化 */
  .task-form :deep(.el-input__inner),
  .task-form :deep(.el-textarea__inner),
  .task-form :deep(.el-select .el-input__inner) {
    font-size: 16px !important; /* 防止iOS缩放 */
    min-height: 44px !important; /* 触摸友好 */
    padding: 10px 12px !important;
  }
  
  .task-form :deep(.el-time-picker) {
    width: 100% !important;
  }
  
  /* 按钮优化 */
  .dialog-footer .el-button {
    min-height: 44px !important;
    padding: 12px 20px !important;
    font-size: 16px !important;
    width: calc(50% - 5px);
  }
  
  /* 时间预览优化 */
  .time-preview {
    margin-top: 12px;
    padding: 12px;
  }
  
  /* 工作表预览优化 */
  .worksheet-preview {
    margin-top: 12px;
  }
  
  .preview-content {
    padding: 12px;
  }
  
  /* 滚动优化 */
  .content-worksheet {
    padding: 12px;
    margin-top: 8px;
  }
  
  /* 表格在移动端的优化 */
  .worksheet-preview :deep(.el-table) {
    font-size: 12px;
  }
  
  .worksheet-preview :deep(.el-table__cell) {
    padding: 8px 6px;
  }
  
  /* 弹窗按钮固定在底部 */
  .dialog-footer {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    padding: 0;
  }
}
</style>