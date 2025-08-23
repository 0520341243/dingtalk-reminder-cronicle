<template>
  <el-dialog
    :model-value="visible"
    title="任务执行历史"
    width="80%"
    :before-close="handleClose"
    @update:model-value="handleClose"
  >
    <div v-loading="loading" class="history-container">
      <!-- 统计信息 -->
      <el-row :gutter="20" class="stats-row">
        <el-col :span="6">
          <el-statistic title="总执行次数" :value="statistics.total" />
        </el-col>
        <el-col :span="6">
          <el-statistic title="成功次数" :value="statistics.success" />
        </el-col>
        <el-col :span="6">
          <el-statistic title="失败次数" :value="statistics.failed" />
        </el-col>
        <el-col :span="6">
          <el-statistic title="成功率" :value="statistics.successRate" suffix="%" />
        </el-col>
      </el-row>

      <!-- 历史记录表格 -->
      <el-table
        :data="historyList"
        style="width: 100%; margin-top: 20px"
        max-height="400"
      >
        <el-table-column type="index" label="序号" width="60" />
        
        <el-table-column prop="executedAt" label="执行时间" width="180">
          <template #default="{ row }">
            {{ formatDateTime(row.executedAt) }}
          </template>
        </el-table-column>
        
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)" size="small">
              {{ getStatusLabel(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        
        <el-table-column prop="triggerType" label="触发方式" width="120">
          <template #default="{ row }">
            <el-tag type="info" size="small">
              {{ getTriggerLabel(row.triggerType) }}
            </el-tag>
          </template>
        </el-table-column>
        
        <el-table-column prop="messageContent" label="消息内容" min-width="200">
          <template #default="{ row }">
            <el-tooltip :content="row.messageContent" placement="top" :disabled="!row.messageContent || row.messageContent.length < 50">
              <span class="message-content">{{ truncate(row.messageContent, 50) }}</span>
            </el-tooltip>
          </template>
        </el-table-column>
        
        <el-table-column prop="errorMessage" label="错误信息" min-width="150">
          <template #default="{ row }">
            <span v-if="row.errorMessage" class="error-message">
              {{ row.errorMessage }}
            </span>
            <span v-else class="text-muted">-</span>
          </template>
        </el-table-column>
        
        <el-table-column prop="retryCount" label="重试次数" width="100">
          <template #default="{ row }">
            {{ row.retryCount || 0 }}
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页 -->
      <el-pagination
        v-model:current-page="currentPage"
        v-model:page-size="pageSize"
        :page-sizes="[10, 20, 50]"
        :total="total"
        layout="total, sizes, prev, pager, next"
        @size-change="handleSizeChange"
        @current-change="handleCurrentChange"
        style="margin-top: 20px; text-align: center"
      />
    </div>

    <template #footer>
      <el-button @click="handleClose">关闭</el-button>
      <el-button type="primary" @click="exportHistory">
        <el-icon><Download /></el-icon>
        导出历史
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, reactive, watch, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { Download } from '@element-plus/icons-vue'
import tasksV2API from '@/api/modules/tasks-unified'
import { formatDateTime } from '@/utils/date'

const props = defineProps({
  visible: {
    type: Boolean,
    required: true
  },
  task: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['close'])

const loading = ref(false)
const historyList = ref([])
const currentPage = ref(1)
const pageSize = ref(20)
const total = ref(0)

const statistics = reactive({
  total: 0,
  success: 0,
  failed: 0,
  successRate: 0
})

const loadHistory = async () => {
  if (!props.task) return
  
  loading.value = true
  try {
    const response = await tasksV2API.getTaskHistory(props.task.id, {
      page: currentPage.value,
      limit: pageSize.value
    })
    
    const result = response.data || response
    
    if (result.success) {
      historyList.value = result.data || []
      total.value = result.pagination?.total || result.total || 0
      
      // 计算统计数据
      updateStatistics()
    } else {
      ElMessage.error('加载历史记录失败')
    }
  } catch (error) {
    console.error('加载执行历史失败:', error)
    ElMessage.error('加载历史记录失败: ' + error.message)
  } finally {
    loading.value = false
  }
}

const updateStatistics = () => {
  // 从当前页面数据计算统计信息
  const allHistory = historyList.value
  statistics.total = total.value
  statistics.success = allHistory.filter(h => h.status === 'success' || h.status === 'completed').length
  statistics.failed = allHistory.filter(h => h.status === 'failed').length
  statistics.successRate = statistics.total > 0 
    ? Math.round((statistics.success / statistics.total) * 100) 
    : 0
}

const handleClose = () => {
  emit('close')
}

const handleSizeChange = (size) => {
  pageSize.value = size
  loadHistory()
}

const handleCurrentChange = (page) => {
  currentPage.value = page
  loadHistory()
}

const exportHistory = () => {
  // TODO: 实现导出功能
  ElMessage.info('导出功能开发中...')
}

const getStatusType = (status) => {
  const types = {
    success: 'success',
    completed: 'success',
    failed: 'danger',
    skipped: 'warning'
  }
  return types[status] || 'info'
}

const getStatusLabel = (status) => {
  const labels = {
    success: '成功',
    completed: '成功',
    failed: '失败',
    skipped: '跳过'
  }
  return labels[status] || status
}

const getTriggerLabel = (type) => {
  const labels = {
    manual: '手动执行',
    scheduled: '定时执行',
    api: 'API调用',
    system: '系统触发'
  }
  return labels[type] || type || '定时执行'
}

const truncate = (text, length) => {
  if (!text) return '-'
  if (text.length <= length) return text
  return text.substring(0, length) + '...'
}

// 监听对话框打开
watch(() => props.visible, (newVal) => {
  if (newVal && props.task) {
    currentPage.value = 1
    loadHistory()
  }
})
</script>

<style scoped>
.history-container {
  padding: 10px;
}

.stats-row {
  margin-bottom: 20px;
  padding: 20px;
  background: #f5f7fa;
  border-radius: 8px;
}

.message-content {
  display: inline-block;
  max-width: 300px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.error-message {
  color: #f56c6c;
  font-size: 12px;
}

.text-muted {
  color: #909399;
}

:deep(.el-statistic__content) {
  font-size: 24px;
}

:deep(.el-statistic__head) {
  font-size: 14px;
  color: #606266;
}
</style>