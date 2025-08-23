<template>
  <el-dialog
    :model-value="visible"
    title="调度作业列表"
    width="80%"
    @close="handleClose"
  >
    <div v-loading="loading" class="jobs-container">
      <div v-if="jobs.length === 0" class="empty-state">
        <el-empty description="暂无调度作业" />
      </div>
      
      <el-table v-else :data="jobs" style="width: 100%" max-height="500">
        <el-table-column prop="id" label="作业ID" width="120">
          <template #default="scope">
            <el-tag type="info" size="small">{{ scope.row.id.substring(0, 8) }}...</el-tag>
          </template>
        </el-table-column>
        
        <el-table-column label="任务名称" min-width="150">
          <template #default="scope">
            <div>
              {{ scope.row.taskDetails?.name || scope.row.message || '未知任务' }}
              <el-tag 
                v-if="scope.row.isSuppressed" 
                type="warning" 
                size="small"
                style="margin-left: 5px"
              >
                被覆盖
              </el-tag>
            </div>
          </template>
        </el-table-column>
        
        <el-table-column label="分组" width="120">
          <template #default="scope">
            {{ scope.row.taskDetails?.groupName || '默认' }}
          </template>
        </el-table-column>
        
        <el-table-column label="状态" width="100">
          <template #default="scope">
            <el-tag 
              :type="getStatusType(scope.row.status)" 
              size="small"
            >
              {{ getStatusLabel(scope.row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        
        <el-table-column label="优先级" width="80">
          <template #default="scope">
            <el-tag 
              :type="getPriorityType(scope.row.taskDetails?.priority)" 
              size="small"
            >
              {{ getPriorityLabel(scope.row.taskDetails?.priority) }}
            </el-tag>
          </template>
        </el-table-column>
        
        <el-table-column label="调度时间" width="150">
          <template #default="scope">
            <el-tag type="warning" size="small">
              {{ formatSchedule(scope.row.schedule) || scope.row.time }}
            </el-tag>
          </template>
        </el-table-column>
        
        <el-table-column label="下次执行" width="180">
          <template #default="scope">
            {{ formatDateTime(scope.row.nextRun) || '待定' }}
          </template>
        </el-table-column>
        
        <el-table-column label="操作" fixed="right" width="150">
          <template #default="scope">
            <el-button 
              type="primary" 
              size="small" 
              @click="viewDetails(scope.row)"
            >
              查看详情
            </el-button>
            <el-button 
              v-if="scope.row.enabled === 1"
              type="warning" 
              size="small" 
              @click="executeNow(scope.row)"
            >
              立即执行
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>
    
    <template #footer>
      <el-button @click="handleClose">关闭</el-button>
      <el-button type="primary" @click="refreshJobs">刷新</el-button>
    </template>
  </el-dialog>
  
  <!-- 作业详情对话框 -->
  <JobDetailsDialog 
    :visible="showJobDetails" 
    :job="selectedJob"
    @close="showJobDetails = false"
    @refresh="refreshJobs" 
  />
</template>

<script setup>
import { ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import api from '@/api'
import JobDetailsDialog from './JobDetailsDialog.vue'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['close'])

const loading = ref(false)
const jobs = ref([])
const showJobDetails = ref(false)
const selectedJob = ref(null)

// 格式化调度规则
const formatSchedule = (schedule) => {
  if (!schedule) return null
  
  // 如果是字符串格式的时间
  if (typeof schedule === 'string') {
    return schedule
  }
  
  // 如果是对象格式
  if (typeof schedule === 'object') {
    if (schedule.ruleType) {
      const types = {
        'by_day': '每日',
        'by_week': '每周',
        'by_interval': '间隔',
        'monthly': '每月',
        'yearly': '每年'
      }
      return types[schedule.ruleType] || schedule.ruleType
    }
  }
  
  return JSON.stringify(schedule)
}

// 获取状态类型
const getStatusType = (status) => {
  const types = {
    'active': 'success',
    'inactive': 'info',
    'error': 'danger',
    'pending': 'warning'
  }
  return types[status] || 'info'
}

// 获取状态标签
const getStatusLabel = (status) => {
  const labels = {
    'active': '活动',
    'inactive': '停用',
    'error': '错误',
    'pending': '待定'
  }
  return labels[status] || status
}

// 获取优先级类型
const getPriorityType = (priority) => {
  const types = {
    'high': 'danger',
    'normal': 'primary',
    'low': 'info'
  }
  return types[priority] || 'info'
}

// 获取优先级标签
const getPriorityLabel = (priority) => {
  const labels = {
    'high': '高',
    'normal': '普通',
    'low': '低'
  }
  return labels[priority] || '普通'
}

// 格式化日期时间
const formatDateTime = (timestamp) => {
  if (!timestamp) return null
  const date = new Date(timestamp * 1000)
  return date.toLocaleString('zh-CN')
}

// 加载作业列表
const loadJobs = async () => {
  loading.value = true
  try {
    const response = await api.get('/scheduler/jobs/detailed')
    if (response.data && response.data.success && response.data.data) {
      jobs.value = response.data.data.jobs || []
    } else {
      jobs.value = []
    }
  } catch (error) {
    console.error('加载作业列表失败:', error)
    ElMessage.error('加载作业列表失败')
    jobs.value = []
  } finally {
    loading.value = false
  }
}

// 查看详情
const viewDetails = (job) => {
  selectedJob.value = {
    jobId: job.id,
    jobType: job.type === 'worksheet' ? 'worksheet' : 'simple',
    taskName: job.taskDetails?.name || job.message || '未知任务',
    groupName: job.taskDetails?.groupName || '默认',
    priority: job.taskDetails?.priority || 'normal',
    scheduledTime: job.time || formatSchedule(job.schedule),
    status: job.status || 'pending',
    messageContent: job.message || job.taskDetails?.messageContent || '定时提醒',
    schedule: formatSchedule(job.schedule),
    taskId: job.taskId,
    isSuppressed: job.isSuppressed,
    suppressedBy: job.suppressedBy
  }
  showJobDetails.value = true
}

// 立即执行
const executeNow = async (job) => {
  try {
    await ElMessageBox.confirm(
      `确认立即执行作业"${job.name}"吗？`,
      '执行确认',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'info'
      }
    )
    
    const response = await api.post('/scheduler/run_event', { 
      id: job.id 
    })
    
    if (response.data.code === 0) {
      ElMessage.success('作业执行已触发')
      await loadJobs()
    } else {
      ElMessage.error(response.data.description || '触发执行失败')
    }
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('触发执行失败: ' + error.message)
    }
  }
}

// 刷新作业列表
const refreshJobs = () => {
  loadJobs()
}

// 关闭对话框
const handleClose = () => {
  emit('close')
}

// 监听对话框显示状态
watch(() => props.visible, (newVal) => {
  if (newVal) {
    loadJobs()
  }
})
</script>

<style scoped>
.jobs-container {
  min-height: 300px;
}

.empty-state {
  padding: 50px 0;
}

.item {
  margin-left: 10px;
}
</style>