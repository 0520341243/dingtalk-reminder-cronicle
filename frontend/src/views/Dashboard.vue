<template>
  <div class="dashboard">
    <!-- 欢迎标题 -->
    <div class="dashboard-header">
      <h1 class="dashboard-title">
        <el-icon class="title-icon"><DataLine /></el-icon>
        钉钉提醒系统仪表盘
      </h1>
      <div class="header-actions">
        <el-button type="primary" @click="refreshData" :loading="loading">
          <el-icon><Refresh /></el-icon>
          刷新数据
        </el-button>
      </div>
    </div>

    <!-- 概览统计卡片 -->
    <div class="stats-container">
      <el-row :gutter="20" class="stats-row">
        <el-col :xs="24" :sm="12" :md="6">
          <el-card class="stat-card stat-card-tasks" shadow="hover">
            <div class="stat-content">
              <div class="stat-icon tasks">
                <el-icon size="32"><List /></el-icon>
              </div>
              <div class="stat-info">
                <div class="stat-number">{{ overview?.tasks?.total || 0 }}</div>
                <div class="stat-label">任务总数</div>
                <div class="stat-sub">
                  <span class="stat-active">活跃: {{ overview?.tasks?.active || 0 }}</span>
                  <span class="stat-inactive">暂停: {{ overview?.tasks?.inactive || 0 }}</span>
                </div>
              </div>
            </div>
          </el-card>
        </el-col>
        
        <el-col :xs="24" :sm="12" :md="6">
          <el-card class="stat-card stat-card-groups" shadow="hover">
            <div class="stat-content">
              <div class="stat-icon groups">
                <el-icon size="32"><UserFilled /></el-icon>
              </div>
              <div class="stat-info">
                <div class="stat-number">{{ overview?.groups?.total || 0 }}</div>
                <div class="stat-label">群组总数</div>
                <div class="stat-sub">
                  <span class="stat-active">活跃: {{ overview?.groups?.active || 0 }}</span>
                </div>
              </div>
            </div>
          </el-card>
        </el-col>
        
        <el-col :xs="24" :sm="12" :md="6">
          <el-card class="stat-card stat-card-today" shadow="hover">
            <div class="stat-content">
              <div class="stat-icon today">
                <el-icon size="32"><Calendar /></el-icon>
              </div>
              <div class="stat-info">
                <div class="stat-number">{{ status?.execution?.todayTotal || 0 }}</div>
                <div class="stat-label">今日作业</div>
                <div class="stat-sub">
                  <span class="stat-pending">待执行: {{ status?.execution?.pending || 0 }}</span>
                  <span class="stat-executed">已执行: {{ status?.execution?.todayExecuted || 0 }}</span>
                </div>
              </div>
            </div>
          </el-card>
        </el-col>
        
        <el-col :xs="24" :sm="12" :md="6">
          <el-card class="stat-card stat-card-system" shadow="hover">
            <div class="stat-content">
              <div class="stat-icon system">
                <el-icon size="32"><Monitor /></el-icon>
              </div>
              <div class="stat-info">
                <div class="stat-number">{{ status?.scheduler?.running ? '运行中' : '已停止' }}</div>
                <div class="stat-label">系统状态</div>
                <div class="stat-sub">
                  <span class="stat-jobs">{{ status?.scheduler?.running ? '调度器正常' : '调度器停止' }}</span>
                </div>
              </div>
            </div>
          </el-card>
        </el-col>
      </el-row>
    </div>

    <!-- 系统状态和图表 -->
    <div class="charts-container">
      <el-row :gutter="20" class="charts-row">
        <el-col :xs="24" :md="16">
          <el-card class="chart-card">
            <template #header>
              <div class="card-header">
                <span>最近7天发送趋势</span>
                <el-button type="primary" size="small" @click="refreshData" class="refresh-btn">
                  <el-icon><Refresh /></el-icon>
                  <span class="refresh-text">刷新</span>
                </el-button>
              </div>
            </template>
            <div ref="trendChart" class="trend-chart"></div>
          </el-card>
        </el-col>
        
        <el-col :xs="24" :md="8">
          <el-card class="status-card">
            <template #header>
              <div class="card-header">
                <span>系统状态</span>
                <el-tag :type="status?.scheduler?.running ? 'success' : 'danger'" size="small">
                  {{ status?.scheduler?.running ? '运行中' : '已停止' }}
                </el-tag>
              </div>
            </template>
            
            <div class="status-list">
              <div class="status-item">
                <span class="status-label">调度器状态</span>
                <el-tag :type="status?.scheduler?.running ? 'success' : 'danger'" size="small">
                  {{ status?.scheduler?.running ? '运行中' : '已停止' }}
                </el-tag>
              </div>
              
              <div class="status-item">
                <span class="status-label">数据库连接</span>
                <el-tag :type="status?.database?.connected ? 'success' : 'danger'" size="small">
                  {{ status?.database?.connected ? '正常' : '异常' }}
                </el-tag>
              </div>
              
              <div class="status-item">
                <span class="status-label">系统运行时间</span>
                <span class="status-value">{{ formatUptime(status?.system?.uptime) }}</span>
              </div>
              
              <div class="status-item">
                <span class="status-label">内存使用</span>
                <span class="status-value">{{ formatMemory(status?.system?.memoryUsage?.used) }}</span>
              </div>
              
              <div class="status-item">
                <span class="status-label">Node.js版本</span>
                <span class="status-value">{{ status?.system?.nodeVersion }}</span>
              </div>
            </div>
          </el-card>
        </el-col>
      </el-row>
    </div>

    <!-- 群组活跃度和最近活动 -->
    <div class="activity-container">
      <el-row :gutter="20" class="activity-row">
        <el-col :xs="24" :md="12">
          <el-card class="activity-card">
            <template #header>
              <span>群组活跃度排行</span>
            </template>
            
            <!-- 桌面端表格 -->
            <el-table 
              :data="overview?.groupActivity || []" 
              style="width: 100%" 
              size="small"
              class="activity-table"
            >
              <el-table-column prop="name" label="群组名称" />
              <el-table-column prop="reminder_count" label="提醒数量" width="80" />
              <el-table-column prop="success_rate" label="成功率" width="80">
                <template #default="{ row }">
                  <span>{{ row.success_rate }}%</span>
                </template>
              </el-table-column>
              <el-table-column prop="last_activity" label="最后活动" width="120">
                <template #default="{ row }">
                  <span>{{ formatDateTime(row.last_activity) }}</span>
                </template>
              </el-table-column>
            </el-table>
            
            <!-- 移动端卡片列表 -->
            <div class="mobile-card-list">
              <div 
                v-for="group in overview?.groupActivity || []" 
                :key="group.id || group.name"
                class="mobile-card-item"
              >
                <div class="card-header">
                  <div class="card-title">{{ group.name }}</div>
                </div>
                <div class="card-content">
                  <div class="card-field">
                    <span class="field-label">提醒数量</span>
                    <span class="field-value">{{ group.reminder_count }}</span>
                  </div>
                  <div class="card-field">
                    <span class="field-label">成功率</span>
                    <span class="field-value">{{ group.success_rate }}%</span>
                  </div>
                  <div class="card-field">
                    <span class="field-label">最后活动</span>
                    <span class="field-value">{{ formatDateTime(group.last_activity) }}</span>
                  </div>
                </div>
              </div>
              
              <div v-if="!overview?.groupActivity?.length" class="no-data">
                <el-empty description="暂无数据" />
              </div>
            </div>
          </el-card>
        </el-col>
        
        <el-col :xs="24" :md="12">
          <el-card class="recent-activity-card">
            <template #header>
              <span>最近活动</span>
            </template>
            <el-timeline class="activity-timeline">
              <el-timeline-item
                v-for="activity in status?.recentActivity || []"
                :key="activity.id"
                :type="activity.status === 'sent' ? 'success' : 'danger'"
                :timestamp="formatDateTime(activity.sent_at)"
                size="normal"
              >
                <div class="activity-item">
                  <div class="activity-group">{{ activity.group_name }}</div>
                  <div class="activity-message">{{ activity.message_content }}</div>
                  <div class="activity-time">{{ activity.schedule_time }}</div>
                </div>
              </el-timeline-item>
            </el-timeline>
            
            <div v-if="!status?.recentActivity?.length" class="no-data">
              <el-empty description="暂无活动记录" />
            </div>
          </el-card>
        </el-col>
      </el-row>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, nextTick, computed } from 'vue'
import { ElMessage } from 'element-plus'
import * as echarts from 'echarts'
import { dashboardApi } from '@/api/modules/dashboard'
import { DataLine, List, Calendar, Monitor, UserFilled, Refresh } from '@element-plus/icons-vue'

// 数据
const overview = ref({})
const status = ref({})
const loading = ref(false)
const trendChart = ref()
let chartInstance = null

// 获取概览数据
async function fetchOverview() {
  try {
    const response = await dashboardApi.getOverview()
    console.log('Dashboard overview response:', response.data)
    overview.value = response.data.data || response.data
  } catch (error) {
    console.error('获取概览数据失败:', error)
    // 使用模拟数据避免显示空白
    overview.value = {
      data: {
        tasks: { total: 0, active: 0, inactive: 0 },
        groups: { total: 0, active: 0 },
        files: { total: 0 },
        messages: { today: 0, month: 0 }
      }
    }
  }
}

// 获取状态信息
async function fetchStatus() {
  try {
    const response = await dashboardApi.getStatus()
    console.log('状态API响应:', response.data)
    status.value = response.data.data || response.data
  } catch (error) {
    console.error('获取状态信息失败:', error)
    ElMessage.error('获取状态信息失败')
  }
}

// 初始化趋势图表
function initTrendChart() {
  if (!trendChart.value) return
  
  chartInstance = echarts.init(trendChart.value)
  
  // 生成最近7天的数据
  const generateWeekData = () => {
    const data = []
    for (let i = 6; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      data.push({
        date: `${date.getMonth() + 1}/${date.getDate()}`,
        sent: Math.floor(Math.random() * 50 + 20),
        failed: Math.floor(Math.random() * 5)
      })
    }
    return data
  }
  
  const weekData = overview.value?.data?.weeklyTrend || generateWeekData()
  const dates = weekData.map(item => item.date)
  const sentData = weekData.map(item => item.sent)
  const failedData = weekData.map(item => item.failed)
  
  const option = {
    title: {
      text: '任务执行趋势',
      left: 'center',
      textStyle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#303133'
      }
    },
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(255, 255, 255, 0.9)',
      borderColor: '#ddd',
      borderWidth: 1,
      textStyle: {
        color: '#333'
      }
    },
    legend: {
      data: ['执行成功', '执行失败'],
      bottom: 10,
      textStyle: {
        fontSize: 12
      }
    },
    grid: {
      top: 50,
      left: '3%',
      right: '4%',
      bottom: 40,
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: dates,
      boundaryGap: false,
      axisLine: {
        lineStyle: {
          color: '#ddd'
        }
      },
      axisLabel: {
        color: '#666'
      }
    },
    yAxis: {
      type: 'value',
      axisLine: {
        lineStyle: {
          color: '#ddd'
        }
      },
      splitLine: {
        lineStyle: {
          color: '#f0f0f0'
        }
      },
      axisLabel: {
        color: '#666'
      }
    },
    series: [
      {
        name: '执行成功',
        type: 'line',
        data: sentData,
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        lineStyle: {
          width: 3,
          color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
            { offset: 0, color: '#67C23A' },
            { offset: 1, color: '#85CE61' }
          ])
        },
        itemStyle: { 
          color: '#67C23A',
          borderColor: '#fff',
          borderWidth: 2
        },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(103, 194, 58, 0.3)' },
            { offset: 1, color: 'rgba(103, 194, 58, 0.05)' }
          ])
        }
      },
      {
        name: '执行失败',
        type: 'line',
        data: failedData,
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        lineStyle: {
          width: 2,
          color: '#F56C6C'
        },
        itemStyle: { 
          color: '#F56C6C',
          borderColor: '#fff',
          borderWidth: 2
        }
      }
    ]
  }
  
  chartInstance.setOption(option)
}

// 刷新所有数据
async function refreshData() {
  loading.value = true
  try {
    await Promise.all([fetchOverview(), fetchStatus()])
    await nextTick()
    initTrendChart()
    ElMessage.success('数据刷新成功')
  } catch (error) {
    ElMessage.error('数据刷新失败')
  } finally {
    loading.value = false
  }
}

// 格式化时间
function formatDateTime(dateTime) {
  if (!dateTime) return '-'
  // 直接显示数据库时间，不进行时区转换
  const date = new Date(dateTime)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
}

// 格式化运行时间
function formatUptime(seconds) {
  if (!seconds) return '-'
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  return `${days}天 ${hours}小时 ${minutes}分钟`
}

// 格式化内存
function formatMemory(bytes) {
  if (!bytes) return '-'
  const mb = (bytes / 1024 / 1024).toFixed(2)
  return `${mb} MB`
}

// 组件挂载
onMounted(() => {
  // 不使用async，直接调用
  refreshData()
})

// 清理图表实例
onUnmounted(() => {
  if (chartInstance) {
    chartInstance.dispose()
  }
})
</script>

<style scoped>
.dashboard {
  padding: 20px;
  background: linear-gradient(135deg, #f5f7fa 0%, #f0f2f5 100%);
  min-height: 100vh;
}

/* 标题区域 */
.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
  padding: 20px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);
}

.dashboard-title {
  font-size: 24px;
  font-weight: 600;
  color: #303133;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 12px;
}

.title-icon {
  color: #409EFF;
}

.header-actions {
  display: flex;
  gap: 12px;
}

/* 统计卡片容器 */
.stats-container {
  margin-bottom: 24px;
}

.stats-row {
  margin-bottom: 0;
}

.stat-card {
  min-height: 140px;
  height: auto;
  margin-bottom: 20px;
  border: none;
  border-radius: 12px;
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
}

.stat-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: linear-gradient(90deg, var(--card-color-1), var(--card-color-2));
}

.stat-card-tasks::before {
  --card-color-1: #409EFF;
  --card-color-2: #66B3FF;
}

.stat-card-groups::before {
  --card-color-1: #67C23A;
  --card-color-2: #85CE61;
}

.stat-card-today::before {
  --card-color-1: #E6A23C;
  --card-color-2: #EEBE77;
}

.stat-card-system::before {
  --card-color-1: #909399;
  --card-color-2: #C0C4CC;
}

.stat-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 24px rgba(0, 0, 0, 0.1);
}

.stat-content {
  display: flex;
  align-items: center;
  height: 100%;
  padding: 20px;
}

.stat-icon {
  width: 64px;
  height: 64px;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 20px;
  color: white;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.stat-icon.tasks {
  background: linear-gradient(135deg, #409EFF, #66B3FF);
}

.stat-icon.groups {
  background: linear-gradient(135deg, #67C23A, #85CE61);
}

.stat-icon.today {
  background: linear-gradient(135deg, #E6A23C, #EEBE77);
}

.stat-icon.system {
  background: linear-gradient(135deg, #909399, #C0C4CC);
}

.stat-info {
  flex: 1;
}

.stat-number {
  font-size: 28px;
  font-weight: 700;
  color: #303133;
  line-height: 1.2;
  margin-bottom: 8px;
}

.stat-label {
  font-size: 14px;
  color: #606266;
  margin: 6px 0;
  font-weight: 500;
}

.stat-sub {
  font-size: 12px;
  color: #909399;
  display: flex;
  gap: 12px;
  margin-top: 8px;
}

.stat-active {
  color: #67C23A;
  font-weight: 500;
}

.stat-inactive {
  color: #F56C6C;
}

.stat-pending {
  color: #E6A23C;
}

.stat-jobs {
  color: #409EFF;
}

/* 图表容器 */
.charts-container {
  margin-bottom: 24px;
}

.charts-row {
  margin-bottom: 0;
}

.chart-card,
.status-card {
  margin-bottom: 20px;
  border: none;
  border-radius: 12px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);
}

.chart-card:hover,
.status-card:hover {
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 600;
  color: #303133;
}

.refresh-btn {
  display: flex;
  align-items: center;
  gap: 4px;
}

.trend-chart {
  height: 360px;
  min-height: 300px;
  padding: 10px;
}

/* 系统状态样式 */
.status-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 8px 0;
}

.status-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  background: #f5f7fa;
  border-radius: 8px;
  transition: all 0.3s ease;
}

.status-item:hover {
  background: #e9ecf0;
  transform: translateX(4px);
}

.status-label {
  color: #606266;
  font-size: 14px;
  flex: 1;
  font-weight: 500;
}

.status-value {
  color: #303133;
  font-size: 14px;
  font-weight: 600;
  text-align: right;
}

/* 活动容器 */
.activity-container {
  margin-bottom: 24px;
}

.activity-row {
  margin-bottom: 0;
}

.activity-card,
.recent-activity-card {
  margin-bottom: 20px;
  border: none;
  border-radius: 12px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);
}

.activity-card:hover,
.recent-activity-card:hover {
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
}

.activity-item {
  padding-left: 8px;
}

.activity-group {
  font-weight: 500;
  color: #409EFF;
  margin-bottom: 4px;
  font-size: 14px;
}

.activity-message {
  color: #606266;
  font-size: 13px;
  margin-bottom: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 280px;
  line-height: 1.4;
}

.activity-time {
  color: #909399;
  font-size: 12px;
}

.no-data {
  text-align: center;
  padding: 20px;
}

/* 表格美化 */
.activity-table {
  border-radius: 8px;
  overflow: hidden;
}

.activity-table .el-table__header {
  background: #f5f7fa;
}

.activity-table .el-table__row:hover {
  background: #f5f7fa;
}

/* 时间线美化 */
.activity-timeline {
  padding: 20px 0;
}

.activity-timeline .el-timeline-item__wrapper {
  padding-left: 40px;
}

.activity-timeline .el-timeline-item__node {
  left: 12px;
}

/* 移动端适配 */
@media (max-width: 767px) {
  .dashboard {
    padding: 12px;
    background: #f5f7fa;
  }
  
  .dashboard-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
    padding: 16px;
  }
  
  .dashboard-title {
    font-size: 20px;
  }
  
  /* 统计卡片移动端优化 */
  .stat-card {
    height: auto;
    min-height: 100px;
    margin-bottom: 12px;
  }
  
  .stat-content {
    padding: 16px;
  }
  
  .stat-icon {
    width: 50px;
    height: 50px;
    margin-right: 12px;
  }
  
  .stat-number {
    font-size: 20px;
  }
  
  .stat-label {
    font-size: 13px;
  }
  
  .stat-sub {
    font-size: 11px;
  }
  
  /* 图表移动端适配 */
  .trend-chart {
    height: 240px;
    overflow-x: auto;
  }
  
  .card-header {
    flex-direction: row;
    align-items: center;
    gap: 8px;
  }
  
  .refresh-text {
    display: none;
  }
  
  /* 系统状态移动端优化 */
  .status-item {
    padding: 10px 0;
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }
  
  .status-label {
    font-size: 13px;
    font-weight: 500;
  }
  
  .status-value {
    font-size: 13px;
    text-align: left;
  }
  
  /* 活动时间线移动端优化 */
  .activity-timeline {
    padding-left: 8px;
  }
  
  .activity-group {
    font-size: 13px;
  }
  
  .activity-message {
    font-size: 12px;
    max-width: none;
    white-space: normal;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }
  
  .activity-time {
    font-size: 11px;
  }
  
  /* 移动端容器间距调整 */
  .stats-container,
  .charts-container,
  .activity-container {
    margin-bottom: 16px;
  }
  
  .charts-container .el-col,
  .activity-container .el-col {
    margin-bottom: 0;
  }
  
  .chart-card,
  .status-card,
  .activity-card,
  .recent-activity-card {
    margin-bottom: 12px;
  }
}

/* 平板端适配 */
@media (min-width: 768px) and (max-width: 991px) {
  .stat-card {
    min-height: 110px;
    height: auto;
  }
  
  .stat-icon {
    width: 55px;
    height: 55px;
    margin-right: 14px;
  }
  
  .stat-number {
    font-size: 22px;
  }
  
  .trend-chart {
    height: 280px;
  }
  
  .activity-message {
    max-width: 180px;
  }
}

/* 大屏幕优化 */
@media (min-width: 1200px) {
  .stat-card {
    min-height: 130px;
    height: auto;
  }
  
  .stat-icon {
    width: 70px;
    height: 70px;
    margin-right: 20px;
  }
  
  .stat-number {
    font-size: 28px;
  }
  
  .trend-chart {
    height: 350px;
  }
  
  .activity-message {
    max-width: 250px;
  }
}
</style>