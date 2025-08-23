<template>
  <el-dialog
    :model-value="visible"
    title="任务覆盖设置"
    width="700px"
    :close-on-click-modal="false"
    @close="handleClose"
  >
    <div class="association-manager">
      <div class="current-task-info">
        <h4>当前任务：{{ task.name }}</h4>
        <p v-if="!isReadOnly">设置当前任务在关联期内覆盖其他低优先级任务</p>
        <el-alert
          v-if="isReadOnly"
          :title="readOnlyMessage"
          type="info"
          :closable="false"
          show-icon
        />
      </div>

      <div class="associations-list">
        <div class="list-header">
          <h5>任务覆盖规则</h5>
          <el-button v-if="!isReadOnly" size="small" type="primary" @click="addAssociation">
            <el-icon><Plus /></el-icon>
            添加覆盖规则
          </el-button>
        </div>

        <div v-if="associations.length === 0" class="empty-associations">
          <el-empty description="暂无覆盖规则" :image-size="80" />
        </div>

        <div v-else class="associations-content">
          <div
            v-for="(association, index) in associations"
            :key="index"
            class="association-item"
          >
            <div class="association-card">
              <div class="card-header">
                <el-tag type="warning">任务覆盖</el-tag>
                <el-button
                  v-if="!isReadOnly"
                  size="small"
                  type="danger"
                  link
                  @click="removeAssociation(index)"
                >
                  <el-icon><Delete /></el-icon>
                  删除
                </el-button>
              </div>

              <div class="card-content">
                <el-form :model="association" label-width="100px">
                  <el-form-item label="覆盖任务" required>
                    <el-select
                      v-model="association.associatedTaskId"
                      placeholder="选择要覆盖的低优先级任务"
                      style="width: 100%"
                      :disabled="isReadOnly"
                      filterable
                    >
                      <el-option
                        v-for="t in availableTasks"
                        :key="t.id"
                        :label="`${t.name} (优先级: ${getPriorityLabel(t.priority)})`"
                        :value="t.id"
                        :disabled="t.id === task.id"
                      />
                    </el-select>
                  </el-form-item>
                  
                  <el-form-item label="生效日期" required>
                    <el-date-picker
                      v-model="association.startDate"
                      type="date"
                      placeholder="选择开始日期"
                      style="width: 100%"
                      :disabled="isReadOnly"
                      :disabled-date="(time) => time.getTime() < Date.now() - 8.64e7"
                      @change="updateEndDate(association)"
                      value-format="YYYY-MM-DD"
                    />
                  </el-form-item>
                  
                  <el-form-item label="关联期限" required>
                    <el-row :gutter="20">
                      <el-col :span="12">
                        <el-input-number
                          v-model="association.duration"
                          :min="1"
                          :max="365"
                          :disabled="isReadOnly"
                          @change="updateEndDate(association)"
                        />
                        <span style="margin-left: 10px;">天</span>
                      </el-col>
                      <el-col :span="12">
                        <div class="end-date-display">
                          结束日期：{{ association.endDate || '请选择开始日期' }}
                        </div>
                      </el-col>
                    </el-row>
                  </el-form-item>

                  <el-form-item label="备注说明">
                    <el-input
                      v-model="association.description"
                      type="textarea"
                      :rows="2"
                      placeholder="可选：添加覆盖原因说明..."
                      maxlength="200"
                      show-word-limit
                    />
                  </el-form-item>
                </el-form>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 覆盖预览 -->
      <div v-if="validAssociations.length > 0" class="preview-section">
        <h5>覆盖效果预览</h5>
        <div class="preview-content">
          <el-alert
            v-for="(association, index) in validAssociations"
            :key="index"
            type="info"
            :closable="false"
            style="margin-bottom: 10px"
          >
            <template #default>
              从 <strong>{{ association.startDate }}</strong> 
              到 <strong>{{ association.endDate }}</strong>
              （共{{ association.duration }}天），
              任务"<strong>{{ getTaskName(association.associatedTaskId) }}</strong>"
              将被当前任务覆盖，暂停执行。
            </template>
          </el-alert>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <el-button @click="handleClose">{{ isReadOnly ? '关闭' : '取消' }}</el-button>
        <el-button v-if="!isReadOnly" type="primary" @click="handleSave" :loading="saving">
          保存设置
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import { Plus, Delete } from '@element-plus/icons-vue'
import { taskAssociationAPI } from '@/api/modules/tasks-unified'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  task: {
    type: Object,
    required: true
  },
  allTasks: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['close', 'save'])

// 响应式数据
const associations = ref([])
const saving = ref(false)
const isReadOnly = ref(false)
const readOnlyMessage = ref('')

// 计算属性：可选择的任务（排除当前任务）
const availableTasks = computed(() => {
  return props.allTasks.filter(t => t.id !== props.task.id)
})

// 有效的关联（用于预览）
const validAssociations = computed(() => {
  return associations.value.filter(a => 
    a && a.associatedTaskId && a.startDate
  )
})

// 方法
const addAssociation = () => {
  const today = new Date()
  const startDate = formatDate(today)
  
  associations.value.push({
    associatedTaskId: '',
    startDate: startDate,
    duration: 1,
    endDate: formatDate(new Date(today.getTime() + 86400000)), // 默认1天后
    description: ''
  })
}

const removeAssociation = (index) => {
  associations.value.splice(index, 1)
}

// 更新结束日期
const updateEndDate = (association) => {
  if (association.startDate && association.duration) {
    const start = new Date(association.startDate)
    const end = new Date(start.getTime() + (association.duration - 1) * 86400000)
    association.endDate = formatDate(end)
  }
}

// 格式化日期
const formatDate = (date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// 获取任务名称
const getTaskName = (taskId) => {
  if (!taskId) return '未知任务'
  const task = props.allTasks?.find(t => t.id === taskId || t._id === taskId)
  return task ? task.name : '未知任务'
}

// 获取优先级标签
const getPriorityLabel = (priority) => {
  const labels = {
    high: '高',
    normal: '普通',
    low: '低'
  }
  return labels[priority] || '普通'
}

// 验证关联设置
const validateAssociations = () => {
  for (let i = 0; i < associations.value.length; i++) {
    const association = associations.value[i]
    
    if (!association.associatedTaskId) {
      ElMessage.error(`第${i + 1}条规则：请选择要覆盖的任务`)
      return false
    }
    
    if (!association.startDate) {
      ElMessage.error(`第${i + 1}条规则：请选择生效日期`)
      return false
    }
    
    if (!association.duration || association.duration < 1) {
      ElMessage.error(`第${i + 1}条规则：关联期限必须至少为1天`)
      return false
    }
    
    // 检查是否有重复的任务
    const duplicates = associations.value.filter(a => 
      a.associatedTaskId === association.associatedTaskId
    )
    if (duplicates.length > 1) {
      ElMessage.error('不能重复设置同一个任务的覆盖规则')
      return false
    }
  }
  return true
}

// 保存关联设置
const handleSave = async () => {
  if (associations.value.length === 0) {
    // 如果没有关联，直接关闭
    emit('close')
    return
  }

  if (!validateAssociations()) {
    return
  }

  saving.value = true
  
  try {
    // 准备保存数据
    const saveData = associations.value.map(a => ({
      taskId: a.associatedTaskId,
      startDate: a.startDate,
      endDate: a.endDate,
      duration: a.duration,
      description: a.description || ''
    }))
    
    emit('save', saveData)
  } catch (error) {
    ElMessage.error('保存失败: ' + error.message)
  } finally {
    saving.value = false
  }
}

// 关闭对话框
const handleClose = () => {
  associations.value = []
  emit('close')
}

// 加载现有关联
const loadExistingAssociations = async () => {
  try {
    const response = await taskAssociationAPI.getTaskAssociations(props.task.id)
    console.log('API响应:', response) // 调试日志
    
    // 处理Axios响应格式
    const apiData = response.data || response
    console.log('API数据:', apiData) // 调试日志
    
    if (apiData && apiData.success && apiData.data && Array.isArray(apiData.data)) {
      console.log('关联数据:', apiData.data) // 调试日志
      
      // 根据任务优先级决定显示方式
      console.log('当前任务优先级:', props.task.priority)
      console.log('当前任务信息:', props.task)
      
      // 检查是否是高优先级任务（可能的值：high, normal, low）
      // 只有当任务有suppressing类型的关联时，才认为它是主任务
      const suppressingAssociations = apiData.data.filter(a => a.type === 'suppressing')
      const suppressedAssociations = apiData.data.filter(a => a.type === 'suppressed')
      
      if (suppressingAssociations.length > 0) {
        // 该任务有覆盖其他任务的关联，可以编辑
        const editableAssociations = apiData.data.filter(a => a.type === 'suppressing')
        console.log('找到的可编辑关联:', editableAssociations)
        
        associations.value = editableAssociations.map(a => ({
          associatedTaskId: a.associatedTaskId || a.taskId || '',
          associatedTaskName: a.associatedTaskName || '',  // 添加任务名称
          startDate: a.startDate ? formatDate(new Date(a.startDate)) : '',
          endDate: a.endDate ? formatDate(new Date(a.endDate)) : '',
          duration: a.duration || 1,
          description: a.description || ''
        }))
        console.log('该任务可编辑关联，处理后的关联:', associations.value)
      } else if (suppressedAssociations.length > 0) {
        // 该任务被其他任务覆盖，只读模式
        const suppressedInfo = suppressedAssociations
        if (suppressedInfo.length > 0) {
          // 设置只读模式和提示信息
          isReadOnly.value = true
          readOnlyMessage.value = `此任务被高优先级任务 "${suppressedInfo[0].primaryTaskName}" 覆盖。请到该任务中修改关联设置。`
          
          // 显示被覆盖的信息（只读）
          associations.value = suppressedInfo.map(a => ({
            associatedTaskId: a.primaryTaskId || '',
            associatedTaskName: a.primaryTaskName || '',
            startDate: a.startDate ? formatDate(new Date(a.startDate)) : '',
            endDate: a.endDate ? formatDate(new Date(a.endDate)) : '',
            duration: a.duration || 1,
            description: a.description || ''
          }))
          console.log('低优先级任务，只读关联:', associations.value)
        } else {
          associations.value = []
        }
      }
    } else {
      console.log('没有关联数据或格式不正确，apiData:', apiData) // 调试日志
      associations.value = []
    }
  } catch (error) {
    // 如果没有关联数据，不显示错误
    console.error('加载关联数据出错:', error)
    // 确保associations.value是一个空数组
    associations.value = []
  }
}

// 监听对话框打开
watch(() => props.visible, (visible) => {
  console.log('TaskAssociationDialog visible changed:', visible)
  console.log('Current task:', props.task)
  
  if (visible && props.task) {
    console.log('对话框打开，当前任务:', props.task.name, props.task.id)
    // 重置状态
    associations.value = []
    isReadOnly.value = false
    readOnlyMessage.value = ''
    // 加载现有关联
    loadExistingAssociations()
  } else {
    // 关闭时清空数据
    associations.value = []
    isReadOnly.value = false
    readOnlyMessage.value = ''
  }
})

// 也监听task的变化
watch(() => props.task, (newTask) => {
  console.log('Task prop changed:', newTask)
  if (newTask && props.visible) {
    loadExistingAssociations()
  }
}, { deep: true })

// 组件挂载时的处理
onMounted(() => {
  console.log('TaskAssociationDialog mounted')
  console.log('Initial props:', { visible: props.visible, task: props.task })
  
  // 如果初始就是可见的，加载数据
  if (props.visible && props.task) {
    nextTick(() => {
      loadExistingAssociations()
    })
  }
})
</script>

<style scoped>
.association-manager {
  max-height: 70vh;
  overflow-y: auto;
}

.current-task-info {
  background: #f8f9fa;
  padding: 15px;
  border-radius: 6px;
  margin-bottom: 20px;
}

.current-task-info h4 {
  margin: 0 0 5px 0;
  color: #303133;
}

.current-task-info p {
  margin: 0;
  color: #909399;
  font-size: 14px;
}

.list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.list-header h5 {
  margin: 0;
  color: #303133;
}

.empty-associations {
  text-align: center;
  padding: 40px;
}

.associations-content {
  margin-bottom: 20px;
}

.association-item {
  margin-bottom: 20px;
}

.association-card {
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  background: white;
  overflow: hidden;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 15px;
  background: #fafafa;
  border-bottom: 1px solid #e4e7ed;
}

.card-content {
  padding: 20px;
}

.end-date-display {
  padding: 8px 12px;
  background: #f5f7fa;
  border-radius: 4px;
  font-size: 14px;
  color: #606266;
}

.preview-section {
  border-top: 1px solid #e4e7ed;
  padding-top: 20px;
  margin-top: 20px;
}

.preview-section h5 {
  margin: 0 0 15px 0;
  color: #303133;
}

.preview-content {
  max-height: 200px;
  overflow-y: auto;
}

.dialog-footer {
  text-align: right;
}

/* 自定义滚动条 */
.association-manager::-webkit-scrollbar,
.preview-content::-webkit-scrollbar {
  width: 6px;
}

.association-manager::-webkit-scrollbar-track,
.preview-content::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 3px;
}

.association-manager::-webkit-scrollbar-thumb,
.preview-content::-webkit-scrollbar-thumb {
  background: #c0c4cc;
  border-radius: 3px;
}

.association-manager::-webkit-scrollbar-thumb:hover,
.preview-content::-webkit-scrollbar-thumb:hover {
  background: #a8abb2;
}

@media (max-width: 768px) {
  .el-dialog {
    width: 95% !important;
    margin: 5vh auto;
  }
  
  .card-content {
    padding: 15px;
  }
}
</style>