<template>
  <el-dialog
    :model-value="visible"
    title="作业详情"
    width="600px"
    @close="handleClose"
  >
    <div v-if="job" class="job-details">
      <el-descriptions :column="2" border>
        <el-descriptions-item label="作业ID">
          <el-tag type="info">{{ job.jobId }}</el-tag>
        </el-descriptions-item>
        
        <el-descriptions-item label="作业类型">
          <el-tag :type="job.jobType === 'worksheet' ? 'primary' : 'success'" size="small">
            {{ job.jobType === 'worksheet' ? '工作表' : '简单任务' }}
          </el-tag>
        </el-descriptions-item>
        
        <el-descriptions-item label="任务名称" :span="2">
          {{ job.taskName || '未知任务' }}
        </el-descriptions-item>
        
        <el-descriptions-item label="群组">
          {{ job.groupName || '默认群组' }}
        </el-descriptions-item>
        
        <el-descriptions-item label="优先级">
          <el-tag :type="getPriorityType(job.priority)" size="small">
            {{ getPriorityLabel(job.priority) }}
          </el-tag>
        </el-descriptions-item>
        
        <el-descriptions-item label="计划时间">
          {{ job.scheduledTime || '-' }}
        </el-descriptions-item>
        
        <el-descriptions-item label="状态">
          <el-tag :type="getStatusType(job.status)" size="small">
            {{ getStatusLabel(job.status) }}
          </el-tag>
        </el-descriptions-item>
        
        <el-descriptions-item label="消息内容" :span="2">
          <div class="message-content">
            {{ job.messageContent || job.message || '定时提醒' }}
          </div>
        </el-descriptions-item>
        
        <el-descriptions-item v-if="job.worksheetRow" label="工作表行" :span="2">
          {{ job.worksheetRow }}
        </el-descriptions-item>
        
        <el-descriptions-item v-if="job.schedule" label="调度规则" :span="2">
          <el-tag type="warning" size="small">{{ job.schedule }}</el-tag>
        </el-descriptions-item>
      </el-descriptions>
      
      <!-- 操作按钮 -->
      <div class="action-buttons" v-if="job.status === 'pending'">
        <el-button type="primary" @click="executeNow">立即执行</el-button>
        <el-button type="warning" @click="skipExecution">跳过执行</el-button>
      </div>
    </div>
    
    <template #footer>
      <el-button @click="handleClose">关闭</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ElMessage, ElMessageBox } from 'element-plus'
import api from '@/api'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  job: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['close', 'refresh'])

// 获取优先级类型
const getPriorityType = (priority) => {
  const types = {
    critical: 'danger',
    high: 'warning',
    normal: 'primary',
    low: 'info'
  }
  return types[priority] || 'info'
}

// 获取优先级标签
const getPriorityLabel = (priority) => {
  const labels = {
    critical: '紧急',
    high: '高',
    normal: '普通',
    low: '低'
  }
  return labels[priority] || '普通'
}

// 获取状态类型
const getStatusType = (status) => {
  const types = {
    pending: 'info',
    executing: 'warning',
    completed: 'success',
    failed: 'danger',
    skipped: 'warning'
  }
  return types[status] || 'info'
}

// 获取状态标签
const getStatusLabel = (status) => {
  const labels = {
    pending: '待执行',
    executing: '执行中',
    completed: '已完成',
    failed: '失败',
    skipped: '已跳过'
  }
  return labels[status] || status
}

// 立即执行
const executeNow = async () => {
  try {
    await ElMessageBox.confirm(
      `确认立即执行作业"${props.job.taskName}"吗？`,
      '执行确认',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'info'
      }
    )
    
    if (props.job.taskId) {
      const response = await api.post(`/mongo/tasks/${props.job.taskId}/trigger`, { 
        jobId: props.job.jobId 
      })
      
      if (response.data.success) {
        ElMessage.success('作业执行已触发')
        emit('refresh')
        emit('close')
      } else {
        ElMessage.error('触发执行失败')
      }
    }
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('触发执行失败: ' + error.message)
    }
  }
}

// 跳过执行
const skipExecution = async () => {
  try {
    await ElMessageBox.confirm(
      `确认跳过作业"${props.job.taskName}"的执行吗？`,
      '跳过确认',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    
    ElMessage.success('已跳过执行')
    emit('refresh')
    emit('close')
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('跳过失败: ' + error.message)
    }
  }
}

// 关闭对话框
const handleClose = () => {
  emit('close')
}
</script>

<style scoped>
.job-details {
  padding: 10px;
}

.message-content {
  max-height: 100px;
  overflow-y: auto;
  white-space: pre-wrap;
  word-break: break-all;
}

.action-buttons {
  margin-top: 20px;
  text-align: center;
}

.action-buttons .el-button {
  margin: 0 10px;
}
</style>