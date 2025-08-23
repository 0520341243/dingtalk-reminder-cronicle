<template>
  <el-dialog
    :model-value="visible"
    title="全局执行计划"
    width="95%"
    :close-on-click-modal="false"
    @close="handleClose"
    class="global-execution-dialog"
  >
    <div class="execution-plans">
      <el-tabs v-model="activeTab" class="plan-tabs">
        <!-- 即将执行 -->
        <el-tab-pane label="即将执行" name="upcoming">
          <div class="tab-content">
            <div class="filter-bar">
              <el-row :gutter="15">
                <el-col :span="6">
                  <el-date-picker
                    v-model="upcomingDate"
                    type="date"
                    placeholder="选择日期"
                    format="YYYY-MM-DD"
                    value-format="YYYY-MM-DD"
                    @change="loadUpcomingPlans"
                  />
                </el-col>
                <el-col :span="4">
                  <el-button type="primary" @click="loadUpcomingPlans">
                    <el-icon><Refresh /></el-icon>
                    刷新
                  </el-button>
                </el-col>
              </el-row>
            </div>

            <div v-loading="loadingUpcoming" class="plans-list">
              <div v-if="upcomingPlans.length === 0" class="empty-plans">
                <el-empty description="今日无待执行计划" :image-size="80" />
              </div>
              
              <el-table v-else :data="upcomingPlans" style="width: 100%" stripe>
                <el-table-column prop="jobId" label="作业ID" width="180" show-overflow-tooltip />
                <el-table-column prop="taskName" label="任务/作业名称" min-width="250">
                  <template #default="{ row }">
                    <div>
                      <span :class="{ 'suppressed-task': row.isSuppressed }">{{ row.taskName }}</span>
                      <el-tag v-if="row.isSuppressed" type="danger" size="small" style="margin-left: 5px">
                        被覆盖
                      </el-tag>
                      <el-tag v-if="row.jobType === 'worksheet'" type="info" size="small" style="margin-left: 5px">
                        工作表
                      </el-tag>
                      <el-tag v-if="row.jobType === 'system'" type="warning" size="small" style="margin-left: 5px">
                        系统
                      </el-tag>
                      <div v-if="row.isSuppressed && row.suppressedBy" class="suppressed-info">
                        <el-icon><InfoFilled /></el-icon>
                        <span>将被 "{{ row.suppressedBy.name }}" 覆盖，不会执行</span>
                      </div>
                    </div>
                  </template>
                </el-table-column>
                <el-table-column prop="groupName" label="群组" width="120" />
                <el-table-column prop="scheduledTime" label="执行时间" width="100" sortable />
                <el-table-column prop="messageContent" label="消息内容" min-width="200" show-overflow-tooltip />
                <el-table-column prop="priority" label="优先级" width="80">
                  <template #default="{ row }">
                    <el-tag :type="getPriorityType(row.priority)" size="small">
                      {{ getPriorityLabel(row.priority) }}
                    </el-tag>
                  </template>
                </el-table-column>
                <el-table-column prop="status" label="状态" width="80">
                  <template #default="{ row }">
                    <el-tag :type="getStatusType(row.status)" size="small">
                      {{ getStatusLabel(row.status) }}
                    </el-tag>
                  </template>
                </el-table-column>
                <el-table-column label="操作" width="150" fixed="right">
                  <template #default="{ row }">
                    <el-button
                      v-if="row.status === 'pending'"
                      type="primary"
                      size="small"
                      link
                      @click="executeNow(row)"
                    >
                      立即执行
                    </el-button>
                    <el-button
                      v-if="row.status === 'pending'"
                      type="warning"
                      size="small"
                      link
                      @click="skipExecution(row)"
                    >
                      跳过
                    </el-button>
                  </template>
                </el-table-column>
              </el-table>
            </div>
          </div>
        </el-tab-pane>

        <!-- 执行历史 -->
        <el-tab-pane label="执行历史" name="history">
          <div class="tab-content">
            <div class="filter-bar">
              <el-row :gutter="15">
                <el-col :span="6">
                  <el-date-picker
                    v-model="historyDate"
                    type="date"
                    placeholder="选择日期"
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
                    <el-icon><Refresh /></el-icon>
                    刷新
                  </el-button>
                </el-col>
              </el-row>
            </div>

            <div v-loading="loadingHistory" class="history-table">
              <el-table :data="executionHistory" style="width: 100%" stripe>
                <el-table-column prop="jobId" label="作业ID" width="180" show-overflow-tooltip />
                <el-table-column prop="taskName" label="任务/作业名称" min-width="250">
                  <template #default="{ row }">
                    <div>
                      <span :class="{ 'suppressed-task': row.isSuppressed }">{{ row.taskName }}</span>
                      <el-tag v-if="row.isSuppressed" type="danger" size="small" style="margin-left: 5px">
                        被覆盖
                      </el-tag>
                      <el-tag v-if="row.jobType === 'worksheet'" type="info" size="small" style="margin-left: 5px">
                        工作表
                      </el-tag>
                      <el-tag v-if="row.jobType === 'system'" type="warning" size="small" style="margin-left: 5px">
                        系统
                      </el-tag>
                      <div v-if="row.isSuppressed && row.suppressedBy" class="suppressed-info">
                        <el-icon><InfoFilled /></el-icon>
                        <span>将被 "{{ row.suppressedBy.name }}" 覆盖，不会执行</span>
                      </div>
                    </div>
                  </template>
                </el-table-column>
                <el-table-column prop="groupName" label="群组" width="120" />
                <el-table-column prop="scheduledTime" label="计划时间" width="100" />
                <el-table-column prop="actualExecutionTime" label="实际执行时间" width="160">
                  <template #default="{ row }">
                    {{ row.actualExecutionTime ? formatDateTime(row.actualExecutionTime) : '-' }}
                  </template>
                </el-table-column>
                <el-table-column prop="messageContent" label="消息内容" min-width="200" show-overflow-tooltip />
                <el-table-column prop="status" label="执行状态" width="80">
                  <template #default="{ row }">
                    <el-tag :type="getStatusType(row.status)" size="small">
                      {{ getStatusLabel(row.status) }}
                    </el-tag>
                  </template>
                </el-table-column>
                <el-table-column prop="errorMessage" label="错误信息" width="150" show-overflow-tooltip>
                  <template #default="{ row }">
                    {{ row.errorMessage || '-' }}
                  </template>
                </el-table-column>
                <el-table-column label="操作" width="100" fixed="right">
                  <template #default="{ row }">
                    <el-button
                      v-if="row.status === 'failed'"
                      type="primary"
                      size="small"
                      link
                      @click="retryExecution(row)"
                    >
                      重试
                    </el-button>
                  </template>
                </el-table-column>
              </el-table>
              
              <div class="pagination-container">
                <el-pagination
                  v-model:current-page="historyCurrentPage"
                  v-model:page-size="historyPageSize"
                  :page-sizes="[20, 50, 100]"
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
            <div class="filter-bar">
              <el-row :gutter="15">
                <el-col :span="6">
                  <el-date-picker
                    v-model="statsDate"
                    type="date"
                    placeholder="选择日期"
                    format="YYYY-MM-DD"
                    value-format="YYYY-MM-DD"
                    @change="loadStatistics"
                  />
                </el-col>
                <el-col :span="4">
                  <el-button type="primary" @click="loadStatistics">
                    <el-icon><Refresh /></el-icon>
                    刷新
                  </el-button>
                </el-col>
              </el-row>
            </div>

            <div v-loading="loadingStats" class="stats-content">
              <!-- 统计卡片 -->
              <el-row :gutter="20" class="stats-cards">
                <el-col :span="6">
                  <div class="stat-card gradient-blue">
                    <div class="stat-icon">
                      <el-icon><Calendar /></el-icon>
                    </div>
                    <div class="stat-info">
                      <div class="stat-number">{{ statistics.totalPlans }}</div>
                      <div class="stat-label">总计划数</div>
                    </div>
                  </div>
                </el-col>
                
                <el-col :span="6">
                  <div class="stat-card gradient-green">
                    <div class="stat-icon">
                      <el-icon><CircleCheck /></el-icon>
                    </div>
                    <div class="stat-info">
                      <div class="stat-number">{{ statistics.successfulExecutions }}</div>
                      <div class="stat-label">成功执行</div>
                    </div>
                  </div>
                </el-col>
                
                <el-col :span="6">
                  <div class="stat-card gradient-red">
                    <div class="stat-icon">
                      <el-icon><CircleClose /></el-icon>
                    </div>
                    <div class="stat-info">
                      <div class="stat-number">{{ statistics.failedExecutions }}</div>
                      <div class="stat-label">失败次数</div>
                    </div>
                  </div>
                </el-col>
                
                <el-col :span="6">
                  <div class="stat-card gradient-purple">
                    <div class="stat-icon">
                      <el-icon><TrendCharts /></el-icon>
                    </div>
                    <div class="stat-info">
                      <div class="stat-number">{{ statistics.successRate }}%</div>
                      <div class="stat-label">成功率</div>
                    </div>
                  </div>
                </el-col>
              </el-row>

              <!-- 图表区域 -->
              <el-row :gutter="20" class="charts-row">
                <el-col :span="12">
                  <div class="chart-card">
                    <h3>执行状态分布</h3>
                    <div ref="pieChart" class="chart-container"></div>
                  </div>
                </el-col>
                <el-col :span="12">
                  <div class="chart-card">
                    <h3>时间段执行统计</h3>
                    <div ref="barChart" class="chart-container"></div>
                  </div>
                </el-col>
              </el-row>

              <!-- 任务排行 -->
              <div class="chart-card task-ranking">
                <h3>任务执行排行 TOP 10</h3>
                <el-table :data="taskRanking" style="width: 100%">
                  <el-table-column type="index" label="排名" width="60" />
                  <el-table-column prop="taskName" label="任务名称" />
                  <el-table-column prop="executionCount" label="执行次数" width="120">
                    <template #default="{ row }">
                      <el-tag type="info">{{ row.executionCount }}</el-tag>
                    </template>
                  </el-table-column>
                  <el-table-column prop="successRate" label="成功率" width="150">
                    <template #default="{ row }">
                      <el-progress :percentage="row.successRate" :color="getProgressColor(row.successRate)" />
                    </template>
                  </el-table-column>
                </el-table>
              </div>
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
import { ref, reactive, watch, onMounted, nextTick } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { 
  Refresh, Calendar, CircleCheck, CircleClose, TrendCharts, InfoFilled 
} from '@element-plus/icons-vue'
import { formatDateTime } from '@/utils/date'
import * as echarts from 'echarts'
import api from '@/api'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['close'])

// 响应式数据
const activeTab = ref('upcoming')

// 即将执行数据
const upcomingPlans = ref([])
const loadingUpcoming = ref(false)
const upcomingDate = ref(new Date().toISOString().split('T')[0])

// 执行历史数据
const executionHistory = ref([])
const loadingHistory = ref(false)
const historyDate = ref(new Date().toISOString().split('T')[0])
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
const loadingStats = ref(false)
const statsDate = ref(new Date().toISOString().split('T')[0])
const taskRanking = ref([])

// 图表引用
const pieChart = ref(null)
const barChart = ref(null)
let pieChartInstance = null
let barChartInstance = null

// 加载即将执行的计划（从调度器获取实际作业）
const loadUpcomingPlans = async () => {
  loadingUpcoming.value = true
  
  try {
    const response = await api.get('/scheduler/jobs/today', {
      params: { date: upcomingDate.value }
    })
    
    const result = response.data || response
    
    if (result.success) {
      // 过滤出未执行的作业
      const allJobs = result.data || []
      upcomingPlans.value = allJobs.filter(job => job.status === 'pending')
      
      // 添加消息内容字段名映射和覆盖状态
      upcomingPlans.value = upcomingPlans.value.map(job => ({
        ...job,
        messageContent: job.message || job.messageContent || '定时提醒',
        // 保留覆盖状态信息
        isSuppressed: job.isSuppressed || false,
        suppressedBy: job.suppressedBy || null,
        // 从taskDetails中提取信息（如果存在）
        taskName: job.taskDetails?.name || job.taskName || '未知任务',
        priority: job.taskDetails?.priority || job.priority || 'normal'
      }))
    } else {
      ElMessage.error('加载执行计划失败')
    }
  } catch (error) {
    ElMessage.error('加载执行计划失败: ' + error.message)
  } finally {
    loadingUpcoming.value = false
  }
}

// 加载执行历史（从调度器获取已完成的作业）
const loadExecutionHistory = async () => {
  loadingHistory.value = true
  
  try {
    const response = await api.get('/scheduler/jobs/history', {
      params: {
        date: historyDate.value,
        status: historyStatusFilter.value,
        page: historyCurrentPage.value,
        limit: historyPageSize.value
      }
    })
    
    const result = response.data || response
    
    if (result.success) {
      // 映射字段名
      executionHistory.value = (result.data || []).map(job => ({
        ...job,
        messageContent: job.message || job.messageContent || '定时提醒'
      }))
      historyTotal.value = result.total || 0
    } else {
      ElMessage.error('加载执行历史失败')
    }
  } catch (error) {
    ElMessage.error('加载执行历史失败: ' + error.message)
  } finally {
    loadingHistory.value = false
  }
}

// 加载统计数据（从调度器获取作业统计）
const loadStatistics = async () => {
  loadingStats.value = true
  
  try {
    const response = await api.get('/scheduler/jobs/statistics', {
      params: { date: statsDate.value }
    })
    
    const result = response.data || response
    
    if (result.success) {
      Object.assign(statistics, result.data.summary || {})
      taskRanking.value = result.data.ranking || []
      
      // 更新图表
      nextTick(() => {
        initCharts()
        updateCharts(result.data)
      })
    } else {
      ElMessage.error('加载统计数据失败')
    }
  } catch (error) {
    ElMessage.error('加载统计数据失败: ' + error.message)
  } finally {
    loadingStats.value = false
  }
}

// 初始化图表
const initCharts = () => {
  // 饼图
  if (pieChart.value && !pieChartInstance) {
    pieChartInstance = echarts.init(pieChart.value)
  }
  
  // 柱状图
  if (barChart.value && !barChartInstance) {
    barChartInstance = echarts.init(barChart.value)
  }
}

// 更新图表
const updateCharts = (data) => {
  // 更新饼图
  if (pieChartInstance) {
    const pieOption = {
      tooltip: {
        trigger: 'item',
        formatter: '{a} <br/>{b}: {c} ({d}%)'
      },
      legend: {
        orient: 'vertical',
        left: 'left'
      },
      series: [
        {
          name: '执行状态',
          type: 'pie',
          radius: ['40%', '70%'],
          avoidLabelOverlap: false,
          itemStyle: {
            borderRadius: 10,
            borderColor: '#fff',
            borderWidth: 2
          },
          label: {
            show: false,
            position: 'center'
          },
          emphasis: {
            label: {
              show: true,
              fontSize: 20,
              fontWeight: 'bold'
            }
          },
          labelLine: {
            show: false
          },
          data: [
            { value: data.summary?.successfulExecutions || 0, name: '成功', itemStyle: { color: '#67C23A' } },
            { value: data.summary?.failedExecutions || 0, name: '失败', itemStyle: { color: '#F56C6C' } },
            { value: data.summary?.skippedExecutions || 0, name: '跳过', itemStyle: { color: '#E6A23C' } }
          ]
        }
      ]
    }
    pieChartInstance.setOption(pieOption)
  }
  
  // 更新柱状图
  if (barChartInstance) {
    const hours = []
    const counts = []
    
    // 生成24小时数据
    for (let i = 0; i < 24; i++) {
      hours.push(`${i}:00`)
      counts.push(data.hourlyStats?.[i] || 0)
    }
    
    const barOption = {
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'shadow'
        }
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: hours,
        axisTick: {
          alignWithLabel: true
        }
      },
      yAxis: {
        type: 'value'
      },
      series: [
        {
          name: '执行次数',
          type: 'bar',
          barWidth: '60%',
          data: counts,
          itemStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: '#83bff6' },
              { offset: 0.5, color: '#188df0' },
              { offset: 1, color: '#188df0' }
            ])
          }
        }
      ]
    }
    barChartInstance.setOption(barOption)
  }
}

// 立即执行
const executeNow = async (plan) => {
  try {
    await ElMessageBox.confirm(
      `确认立即执行任务"${plan.taskName}"吗？`,
      '执行确认',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'info'
      }
    )
    
    const response = await api.post(`/mongo/tasks/${plan.taskId}/trigger`, { planId: plan.id })
    
    if (response.data.success) {
      ElMessage.success('任务执行已触发')
      await loadUpcomingPlans()
    } else {
      ElMessage.error('触发执行失败')
    }
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('触发执行失败: ' + error.message)
    }
  }
}

// 跳过执行
const skipExecution = async (plan) => {
  try {
    await ElMessageBox.confirm(
      `确认跳过任务"${plan.taskName}"的执行吗？`,
      '跳过确认',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    
    ElMessage.success('已跳过执行')
    await loadUpcomingPlans()
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('跳过失败: ' + error.message)
    }
  }
}

// 重试执行
const retryExecution = async (execution) => {
  try {
    const response = await api.post(`/mongo/tasks/${execution.taskId}/trigger`, { 
      planId: execution.id,
      isRetry: true 
    })
    
    if (response.data.success) {
      ElMessage.success('重试执行已触发')
      await loadExecutionHistory()
    } else {
      ElMessage.error('重试失败')
    }
  } catch (error) {
    ElMessage.error('重试失败: ' + error.message)
  }
}

// 获取优先级标签类型
const getPriorityType = (priority) => {
  const types = {
    critical: 'danger',
    high: 'warning',
    normal: 'primary',
    low: 'info'
  }
  return types[priority] || 'info'
}

// 获取优先级标签文本
const getPriorityLabel = (priority) => {
  const labels = {
    critical: '紧急',
    high: '高',
    normal: '普通',
    low: '低'
  }
  return labels[priority] || '普通'
}

// 获取状态标签类型
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

// 获取状态标签文本
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

// 获取进度条颜色
const getProgressColor = (percentage) => {
  if (percentage >= 90) return '#67C23A'
  if (percentage >= 70) return '#409EFF'
  if (percentage >= 50) return '#E6A23C'
  return '#F56C6C'
}

// 处理对话框关闭
const handleClose = () => {
  emit('close')
}

// 监听器
watch(() => props.visible, (visible) => {
  if (visible) {
    loadUpcomingPlans()
    loadExecutionHistory()
    loadStatistics()
  }
})

watch(activeTab, (tab) => {
  if (tab === 'upcoming') {
    loadUpcomingPlans()
  } else if (tab === 'history') {
    loadExecutionHistory()
  } else if (tab === 'statistics') {
    loadStatistics()
  }
})

// 组件卸载时销毁图表
onMounted(() => {
  return () => {
    if (pieChartInstance) {
      pieChartInstance.dispose()
      pieChartInstance = null
    }
    if (barChartInstance) {
      barChartInstance.dispose()
      barChartInstance = null
    }
  }
})
</script>

<style scoped>
.global-execution-dialog {
  /* 对话框样式 */
}

.execution-plans {
  max-height: 80vh;
  overflow: hidden;
}

.plan-tabs {
  height: calc(80vh - 50px);
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

.plans-list, .history-table {
  flex: 1;
  overflow-y: auto;
}

.empty-plans {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 300px;
}

.pagination-container {
  display: flex;
  justify-content: center;
  margin-top: 20px;
}

/* 被覆盖任务的样式 */
.suppressed-task {
  text-decoration: line-through;
  color: #909399;
  opacity: 0.7;
}

.suppressed-info {
  margin-top: 5px;
  font-size: 12px;
  color: #F56C6C;
  display: flex;
  align-items: center;
  gap: 5px;
}

.suppressed-info .el-icon {
  font-size: 14px;
}

/* 统计卡片样式 - 后现代风格 */
.stats-cards {
  margin-bottom: 30px;
}

.stat-card {
  padding: 25px;
  border-radius: 16px;
  color: white;
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.stat-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 15px 40px rgba(0, 0, 0, 0.15);
}

.gradient-blue {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.gradient-green {
  background: linear-gradient(135deg, #84fab0 0%, #8fd3f4 100%);
}

.gradient-red {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
}

.gradient-purple {
  background: linear-gradient(135deg, #fa709a 0%, #fee140 100%);
}

.stat-icon {
  font-size: 48px;
  opacity: 0.8;
}

.stat-info {
  text-align: right;
}

.stat-number {
  font-size: 36px;
  font-weight: bold;
  margin-bottom: 5px;
}

.stat-label {
  font-size: 14px;
  opacity: 0.9;
}

/* 图表卡片样式 */
.charts-row {
  margin-bottom: 30px;
}

.chart-card {
  background: white;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 5px 20px rgba(0, 0, 0, 0.08);
}

.chart-card h3 {
  margin: 0 0 20px 0;
  color: #303133;
  font-size: 18px;
  font-weight: 500;
}

.chart-container {
  height: 300px;
}

.task-ranking {
  margin-top: 30px;
}

.dialog-footer {
  text-align: right;
}

/* 深色主题支持 */
@media (prefers-color-scheme: dark) {
  .filter-bar {
    background: #1f2937;
  }
  
  .chart-card {
    background: #1f2937;
    color: #f3f4f6;
  }
  
  .chart-card h3 {
    color: #f3f4f6;
  }
}
</style>