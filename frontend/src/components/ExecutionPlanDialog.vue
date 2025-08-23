<template>
  <el-dialog
    :model-value="visible"
    title="执行计划查看"
    width="900px"
    :close-on-click-modal="false"
    @close="handleClose"
  >
    <div class="execution-plans">
      <div class="plan-header">
        <div class="task-info">
          <h4>{{ task.name }}</h4>
          <p>查看任务的执行计划和历史记录</p>
        </div>
        
        <div class="header-actions">
          <el-button size="small" @click="generatePlans" :loading="generating">
            <el-icon><Refresh /></el-icon>
            重新生成计划
          </el-button>
        </div>
      </div>

      <el-tabs v-model="activeTab" class="plan-tabs">
        <!-- 即将执行 -->
        <el-tab-pane label="即将执行" name="upcoming">
          <div class="tab-content">
            <div class="filter-bar">
              <el-row :gutter="15">
                <el-col :span="8">
                  <el-date-picker
                    v-model="upcomingDateRange"
                    type="daterange"
                    range-separator="至"
                    start-placeholder="开始日期"
                    end-placeholder="结束日期"
                    format="YYYY-MM-DD"
                    value-format="YYYY-MM-DD"
                    @change="loadUpcomingPlans"
                  />
                </el-col>
                <el-col :span="4">
                  <el-select v-model="upcomingStatusFilter" placeholder="执行状态" clearable @change="loadUpcomingPlans">
                    <el-option label="待执行" value="pending" />
                    <el-option label="执行中" value="executing" />
                    <el-option label="已跳过" value="skipped" />
                  </el-select>
                </el-col>
                <el-col :span="4">
                  <el-button type="primary" @click="loadUpcomingPlans">
                    <el-icon><Search /></el-icon>
                    查询
                  </el-button>
                </el-col>
              </el-row>
            </div>

            <div v-loading="loadingUpcoming" class="plans-list">
              <div v-if="upcomingPlans.length === 0" class="empty-plans">
                <el-empty description="暂无即将执行的计划" :image-size="80" />
              </div>
              
              <div v-else class="plans-timeline">
                <div
                  v-for="plan in upcomingPlans"
                  :key="plan.id"
                  class="plan-item"
                  :class="{ 'is-today': isToday(plan.scheduledDate) }"
                >
                  <div class="plan-time">
                    <div class="date">{{ formatDate(plan.scheduledDate) }}</div>
                    <div class="time">{{ plan.scheduledTime }}</div>
                    <div class="weekday">{{ getWeekday(plan.scheduledDate) }}</div>
                  </div>
                  
                  <div class="plan-content">
                    <div class="plan-header-row">
                      <div class="plan-status">
                        <el-tag :type="getStatusTagType(plan.status)" size="small">
                          {{ getStatusLabel(plan.status) }}
                        </el-tag>
                        <el-tag
                          v-if="plan.priorityOverride"
                          :type="getPriorityTagType(plan.priorityOverride)"
                          size="small"
                        >
                          {{ getPriorityLabel(plan.priorityOverride) }}
                        </el-tag>
                      </div>
                      
                      <div class="plan-actions">
                        <el-button
                          v-if="plan.status === 'pending'"
                          size="small"
                          type="warning"
                          link
                          @click="skipExecution(plan)"
                        >
                          跳过
                        </el-button>
                        
                        <el-button
                          v-if="plan.status === 'pending'"
                          size="small"
                          type="primary"
                          link
                          @click="triggerExecution(plan)"
                        >
                          立即执行
                        </el-button>
                        
                        <el-dropdown @command="handlePlanAction">
                          <el-button size="small" type="info" link>
                            <el-icon><MoreFilled /></el-icon>
                          </el-button>
                          <template #dropdown>
                            <el-dropdown-menu>
                              <el-dropdown-item :command="{ action: 'edit', plan }">
                                编辑计划
                              </el-dropdown-item>
                              <el-dropdown-item :command="{ action: 'duplicate', plan }">
                                复制计划
                              </el-dropdown-item>
                              <el-dropdown-item
                                :command="{ action: 'delete', plan }"
                                divided
                                class="danger-item"
                              >
                                删除计划
                              </el-dropdown-item>
                            </el-dropdown-menu>
                          </template>
                        </el-dropdown>
                      </div>
                    </div>
                    
                    <div class="plan-message">
                      {{ plan.messageContent }}
                    </div>
                    
                    <div v-if="plan.generatedAt" class="plan-meta">
                      <span class="meta-item">
                        <el-icon><Clock /></el-icon>
                        生成时间：{{ formatDateTime(plan.generatedAt) }}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </el-tab-pane>

        <!-- 执行历史 -->
        <el-tab-pane label="执行历史" name="history">
          <div class="tab-content">
            <div class="filter-bar">
              <el-row :gutter="15">
                <el-col :span="8">
                  <el-date-picker
                    v-model="historyDateRange"
                    type="daterange"
                    range-separator="至"
                    start-placeholder="开始日期"
                    end-placeholder="结束日期"
                    format="YYYY-MM-DD"
                    value-format="YYYY-MM-DD"
                    @change="loadExecutionHistory"
                  />
                </el-col>
                <el-col :span="4">
                  <el-select v-model="historyStatusFilter" placeholder="执行状态" clearable @change="loadExecutionHistory">
                    <el-option label="成功" value="completed" />
                    <el-option label="失败" value="failed" />
                    <el-option label="已跳过" value="skipped" />
                  </el-select>
                </el-col>
                <el-col :span="4">
                  <el-button type="primary" @click="loadExecutionHistory">
                    <el-icon><Search /></el-icon>
                    查询
                  </el-button>
                </el-col>
              </el-row>
            </div>

            <div v-loading="loadingHistory" class="history-table">
              <el-table :data="executionHistory" style="width: 100%">
                <el-table-column prop="scheduledDate" label="计划日期" width="120">
                  <template #default="{ row }">
                    {{ formatDate(row.scheduledDate) }}
                  </template>
                </el-table-column>
                
                <el-table-column prop="scheduledTime" label="计划时间" width="100" />
                
                <el-table-column prop="status" label="执行状态" width="100">
                  <template #default="{ row }">
                    <el-tag :type="getStatusTagType(row.status)" size="small">
                      {{ getStatusLabel(row.status) }}
                    </el-tag>
                  </template>
                </el-table-column>
                
                <el-table-column prop="actualExecutionTime" label="实际执行时间" width="180">
                  <template #default="{ row }">
                    {{ row.actualExecutionTime ? formatDateTime(row.actualExecutionTime) : '-' }}
                  </template>
                </el-table-column>
                
                <el-table-column prop="messageContent" label="消息内容" min-width="200" show-overflow-tooltip />
                
                <el-table-column prop="errorMessage" label="错误信息" width="200" show-overflow-tooltip>
                  <template #default="{ row }">
                    {{ row.errorMessage || '-' }}
                  </template>
                </el-table-column>
                
                <el-table-column prop="retryCount" label="重试次数" width="100">
                  <template #default="{ row }">
                    {{ row.retryCount || 0 }}
                  </template>
                </el-table-column>
                
                <el-table-column label="操作" width="100" fixed="right">
                  <template #default="{ row }">
                    <el-button
                      v-if="row.status === 'failed'"
                      size="small"
                      type="primary"
                      link
                      @click="retryExecution(row)"
                    >
                      重试
                    </el-button>
                    
                    <el-button
                      size="small"
                      type="info"
                      link
                      @click="viewExecutionDetail(row)"
                    >
                      详情
                    </el-button>
                  </template>
                </el-table-column>
              </el-table>
              
              <div class="pagination-container">
                <el-pagination
                  v-model:current-page="historyCurrentPage"
                  v-model:page-size="historyPageSize"
                  :page-sizes="[10, 20, 50]"
                  :total="historyTotal"
                  layout="total, sizes, prev, pager, next, jumper"
                  @size-change="loadExecutionHistory"
                  @current-change="loadExecutionHistory"
                />
              </div>
            </div>
          </div>
        </el-tab-pane>

        <!-- 统计分析 -->
        <el-tab-pane label="统计分析" name="statistics">
          <div class="tab-content">
            <div class="stats-grid">
              <el-row :gutter="20">
                <el-col :span="6">
                  <div class="stat-card">
                    <div class="stat-number">{{ statistics.totalPlans }}</div>
                    <div class="stat-label">总计划数</div>
                  </div>
                </el-col>
                
                <el-col :span="6">
                  <div class="stat-card">
                    <div class="stat-number success">{{ statistics.successfulExecutions }}</div>
                    <div class="stat-label">成功执行</div>
                  </div>
                </el-col>
                
                <el-col :span="6">
                  <div class="stat-card">
                    <div class="stat-number danger">{{ statistics.failedExecutions }}</div>
                    <div class="stat-label">失败次数</div>
                  </div>
                </el-col>
                
                <el-col :span="6">
                  <div class="stat-card">
                    <div class="stat-number warning">{{ statistics.successRate }}%</div>
                    <div class="stat-label">成功率</div>
                  </div>
                </el-col>
              </el-row>
            </div>
            
            <div class="charts-section">
              <!-- 这里可以添加图表组件 -->
              <el-empty description="统计图表开发中..." :image-size="100" />
            </div>
          </div>
        </el-tab-pane>
      </el-tabs>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <el-button @click="handleClose">关闭</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Refresh, Search, Clock, MoreFilled
} from '@element-plus/icons-vue'
import { executionPlanAPI, scheduleStatisticsAPI } from '@/api/modules/tasks-unified'
import { formatDate, formatDateTime } from '@/utils/date'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  task: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['close'])

// 响应式数据
const activeTab = ref('upcoming')
const generating = ref(false)

// 即将执行数据
const upcomingPlans = ref([])
const loadingUpcoming = ref(false)
// 默认设置为今天
const today = new Date()
const todayStr = today.toISOString().split('T')[0]

const upcomingDateRange = ref([todayStr, todayStr])
const upcomingStatusFilter = ref('')

// 执行历史数据
const executionHistory = ref([])
const loadingHistory = ref(false)
const historyDateRange = ref([todayStr, todayStr])
const historyStatusFilter = ref('')
const historyCurrentPage = ref(1)
const historyPageSize = ref(20)
const historyTotal = ref(0)

// 统计数据
const statistics = reactive({
  totalPlans: 0,
  successfulExecutions: 0,
  failedExecutions: 0,
  successRate: 0
})

// 方法
const loadUpcomingPlans = async () => {
  loadingUpcoming.value = true
  
  try {
    const params = {
      startDate: upcomingDateRange.value[0],
      endDate: upcomingDateRange.value[1],
      status: upcomingStatusFilter.value
    }
    
    const response = await executionPlanAPI.getTaskExecutionPlans(props.task.id, params)
    
    // 处理Axios包装的响应
    const result = response.data || response
    
    if (result.success) {
      upcomingPlans.value = result.data.plans || []
    } else {
      ElMessage.error('加载执行计划失败: ' + (result.error || '未知错误'))
    }
  } catch (error) {
    ElMessage.error('加载执行计划失败: ' + error.message)
  } finally {
    loadingUpcoming.value = false
  }
}

const loadExecutionHistory = async () => {
  loadingHistory.value = true
  
  try {
    const params = {
      startDate: historyDateRange.value[0],
      endDate: historyDateRange.value[1],
      status: historyStatusFilter.value,
      page: historyCurrentPage.value,
      limit: historyPageSize.value
    }
    
    const response = await executionPlanAPI.getTaskExecutionHistory(props.task.id, params)
    
    // 处理Axios包装的响应
    const result = response.data || response
    
    if (result.success) {
      executionHistory.value = result.data.history || []
      historyTotal.value = result.data.total || 0
    } else {
      ElMessage.error('加载执行历史失败: ' + (result.error || '未知错误'))
    }
  } catch (error) {
    ElMessage.error('加载执行历史失败: ' + error.message)
  } finally {
    loadingHistory.value = false
  }
}

const loadStatistics = async () => {
  try {
    const response = await scheduleStatisticsAPI.getScheduleStatistics(props.task.id)
    
    const result = response.data || response
    
    if (result.success) {
      Object.assign(statistics, result.data.taskStatistics?.[props.task.id] || {})
    }
  } catch (error) {
    console.error('加载统计数据失败:', error)
  }
}

const generatePlans = async () => {
  generating.value = true
  
  try {
    const response = await executionPlanAPI.regenerateExecutionPlans(props.task.id, { days: 30 })
    
    // 处理Axios包装的响应
    const result = response.data || response
    
    if (result.success) {
      ElMessage.success('执行计划重新生成成功')
      await loadUpcomingPlans()
    } else {
      ElMessage.error('生成计划失败: ' + (result.error || '未知错误'))
    }
  } catch (error) {
    ElMessage.error('生成计划失败: ' + error.message)
  } finally {
    generating.value = false
  }
}

const skipExecution = async (plan) => {
  try {
    await ElMessageBox.confirm(
      `确认跳过 ${formatDate(plan.scheduledDate)} ${plan.scheduledTime} 的执行吗？`,
      '跳过确认',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    
    // 这里调用跳过执行的API
    ElMessage.success('已跳过执行')
    await loadUpcomingPlans()
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('跳过失败: ' + error.message)
    }
  }
}

const triggerExecution = async (plan) => {
  try {
    const response = await executionPlanAPI.triggerTaskExecution(props.task.id, { planId: plan.id })
    
    if (response.success) {
      ElMessage.success('任务执行已触发')
      await loadUpcomingPlans()
    } else {
      ElMessage.error('触发执行失败: ' + response.error)
    }
  } catch (error) {
    ElMessage.error('触发执行失败: ' + error.message)
  }
}

const handlePlanAction = async ({ action, plan }) => {
  switch (action) {
    case 'edit':
      // 编辑计划逻辑
      break
    case 'duplicate':
      // 复制计划逻辑
      break
    case 'delete':
      // 删除计划逻辑
      break
  }
}

const retryExecution = async (execution) => {
  try {
    const response = await executionPlanAPI.triggerTaskExecution(props.task.id, { 
      planId: execution.id,
      isRetry: true 
    })
    
    if (response.success) {
      ElMessage.success('重试执行已触发')
      await loadExecutionHistory()
    } else {
      ElMessage.error('重试失败: ' + response.error)
    }
  } catch (error) {
    ElMessage.error('重试失败: ' + error.message)
  }
}

const viewExecutionDetail = (execution) => {
  // 查看执行详情逻辑
  ElMessage.info('执行详情功能开发中...')
}

// 辅助方法
const isToday = (date) => {
  const today = new Date().toISOString().split('T')[0]
  return date === today
}

const getWeekday = (dateStr) => {
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  const date = new Date(dateStr)
  return weekdays[date.getDay()]
}

const getStatusTagType = (status) => {
  const types = {
    pending: 'info',
    executing: 'warning',
    completed: 'success',
    failed: 'danger',
    skipped: 'info'
  }
  return types[status] || 'info'
}

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

const getPriorityTagType = (priority) => {
  const types = {
    high: 'danger',
    normal: 'primary',
    low: 'info'
  }
  return types[priority] || 'primary'
}

const getPriorityLabel = (priority) => {
  const labels = {
    high: '高',
    normal: '普通',
    low: '低'
  }
  return labels[priority] || '普通'
}

const handleClose = () => {
  emit('close')
}

// 初始化数据范围
const initializeDateRanges = () => {
  const today = new Date()
  const nextWeek = new Date(today)
  nextWeek.setDate(today.getDate() + 7)
  
  upcomingDateRange.value = [
    today.toISOString().split('T')[0],
    nextWeek.toISOString().split('T')[0]
  ]
  
  const lastWeek = new Date(today)
  lastWeek.setDate(today.getDate() - 7)
  
  historyDateRange.value = [
    lastWeek.toISOString().split('T')[0],
    today.toISOString().split('T')[0]
  ]
}

// 监听器
watch(() => props.visible, (visible) => {
  if (visible) {
    initializeDateRanges()
    loadUpcomingPlans()
    loadExecutionHistory()
    loadStatistics()
  }
})

watch(activeTab, (tab) => {
  if (tab === 'upcoming' && upcomingPlans.value.length === 0) {
    loadUpcomingPlans()
  } else if (tab === 'history' && executionHistory.value.length === 0) {
    loadExecutionHistory()
  } else if (tab === 'statistics') {
    loadStatistics()
  }
})
</script>

<style scoped>
.execution-plans {
  max-height: 70vh;
  overflow: hidden;
}

.plan-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding: 15px;
  background: #f8f9fa;
  border-radius: 6px;
}

.task-info h4 {
  margin: 0 0 5px 0;
  color: #303133;
}

.task-info p {
  margin: 0;
  color: #909399;
  font-size: 14px;
}

.plan-tabs {
  height: calc(70vh - 100px);
}

.plan-tabs .el-tab-pane {
  height: 100%;
  overflow-y: auto;
}

.tab-content {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.filter-bar {
  margin-bottom: 20px;
  padding: 15px;
  background: #f8f9fa;
  border-radius: 6px;
}

.plans-list {
  flex: 1;
  overflow-y: auto;
}

.empty-plans {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 200px;
}

.plans-timeline {
  padding: 10px 0;
}

.plan-item {
  display: flex;
  margin-bottom: 20px;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  overflow: hidden;
  transition: all 0.3s;
}

.plan-item:hover {
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
}

.plan-item.is-today {
  border-color: #409eff;
  background: #f0f7ff;
}

.plan-time {
  min-width: 120px;
  padding: 15px;
  background: #fafafa;
  border-right: 1px solid #e4e7ed;
  text-align: center;
}

.plan-time .date {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 5px;
}

.plan-time .time {
  font-size: 14px;
  color: #409eff;
  margin-bottom: 5px;
}

.plan-time .weekday {
  font-size: 12px;
  color: #909399;
}

.plan-content {
  flex: 1;
  padding: 15px;
}

.plan-header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.plan-status {
  display: flex;
  gap: 8px;
}

.plan-actions {
  display: flex;
  gap: 8px;
}

.plan-message {
  color: #303133;
  margin-bottom: 10px;
  line-height: 1.5;
}

.plan-meta {
  display: flex;
  gap: 15px;
  font-size: 12px;
  color: #909399;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

.history-table {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.history-table .el-table {
  flex: 1;
}

.pagination-container {
  display: flex;
  justify-content: center;
  margin-top: 20px;
}

.stats-grid {
  margin-bottom: 30px;
}

.stat-card {
  text-align: center;
  padding: 20px;
  background: white;
  border-radius: 8px;
  border: 1px solid #e4e7ed;
}

.stat-number {
  font-size: 28px;
  font-weight: bold;
  color: #303133;
  margin-bottom: 8px;
}

.stat-number.success {
  color: #67c23a;
}

.stat-number.danger {
  color: #f56c6c;
}

.stat-number.warning {
  color: #e6a23c;
}

.stat-label {
  font-size: 14px;
  color: #909399;
}

.charts-section {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 200px;
}

.danger-item {
  color: #f56c6c;
}

.danger-item:hover {
  background-color: #fef0f0;
  color: #f56c6c;
}

.dialog-footer {
  text-align: right;
}

@media (max-width: 768px) {
  .plan-item {
    flex-direction: column;
  }
  
  .plan-time {
    min-width: auto;
    border-right: none;
    border-bottom: 1px solid #e4e7ed;
  }
  
  .filter-bar .el-row .el-col {
    margin-bottom: 10px;
  }
}
</style>