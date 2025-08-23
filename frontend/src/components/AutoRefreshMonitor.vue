<!--
  自动刷新系统监控组件
  
  功能:
  - 实时显示刷新系统状态
  - 性能指标监控
  - 错误统计和报告
  - 手动控制开关
-->
<template>
  <div class="auto-refresh-monitor" v-if="showMonitor">
    <el-card class="monitor-card" size="small">
      <template #header>
        <div class="monitor-header">
          <span>🔄 自动刷新监控</span>
          <el-button size="small" text @click="toggleMonitor">
            <el-icon><Hide v-if="expanded" /><View v-else /></el-icon>
          </el-button>
        </div>
      </template>
      
      <div class="monitor-content" v-show="expanded">
        <!-- 系统状态 -->
        <div class="status-section">
          <h4>系统状态</h4>
          <el-row :gutter="12">
            <el-col :span="8">
              <el-statistic title="活跃刷新器" :value="stats.activeRefreshers">
                <template #suffix>个</template>
              </el-statistic>
            </el-col>
            <el-col :span="8">
              <el-statistic title="队列大小" :value="stats.queueSize">
                <template #suffix>项</template>
              </el-statistic>
            </el-col>
            <el-col :span="8">
              <el-statistic title="缓存命中率" :value="stats.cacheHitRate" :precision="1">
                <template #suffix>%</template>
              </el-statistic>
            </el-col>
          </el-row>
        </div>

        <!-- 性能指标 -->
        <div class="performance-section">
          <h4>性能指标</h4>
          <el-row :gutter="12">
            <el-col :span="6">
              <div class="metric-item">
                <span class="metric-label">平均响应时间</span>
                <span class="metric-value">{{ stats.avgResponseTime }}ms</span>
              </div>
            </el-col>
            <el-col :span="6">
              <div class="metric-item">
                <span class="metric-label">成功率</span>
                <span class="metric-value success">{{ stats.successRate }}%</span>
              </div>
            </el-col>
            <el-col :span="6">
              <div class="metric-item">
                <span class="metric-label">错误率</span>
                <span class="metric-value" :class="{ error: stats.errorRate > 5 }">{{ stats.errorRate }}%</span>
              </div>
            </el-col>
            <el-col :span="6">
              <div class="metric-item">
                <span class="metric-label">Token刷新</span>
                <span class="metric-value">{{ stats.tokenRefreshCount }}</span>
              </div>
            </el-col>
          </el-row>
        </div>

        <!-- 活跃组件 -->
        <div class="components-section" v-if="activeComponents.length > 0">
          <h4>活跃组件</h4>
          <el-tag
            v-for="component in activeComponents"
            :key="component.key"
            :type="getComponentStatus(component)"
            size="small"
            class="component-tag"
          >
            {{ component.key }} ({{ component.lastRefresh ? formatTime(component.lastRefresh) : '未刷新' }})
          </el-tag>
        </div>

        <!-- 控制面板 -->
        <div class="control-section">
          <h4>控制面板</h4>
          <el-space>
            <el-button 
              size="small" 
              :type="globalEnabled ? 'danger' : 'success'"
              @click="toggleGlobalRefresh"
            >
              {{ globalEnabled ? '停用自动刷新' : '启用自动刷新' }}
            </el-button>
            <el-button size="small" @click="clearStats">清除统计</el-button>
            <el-button size="small" @click="exportStats">导出数据</el-button>
          </el-space>
        </div>

        <!-- 错误日志 -->
        <div class="error-section" v-if="errorLog.length > 0">
          <h4>最近错误</h4>
          <div class="error-list">
            <div
              v-for="(error, index) in errorLog.slice(0, 5)"
              :key="index"
              class="error-item"
            >
              <span class="error-time">{{ formatTime(error.timestamp) }}</span>
              <span class="error-message">{{ error.message }}</span>
              <span class="error-component">{{ error.component }}</span>
            </div>
          </div>
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import { ElMessage } from 'element-plus'

// 是否显示监控器（开发环境默认显示）
const showMonitor = ref(process.env.NODE_ENV === 'development')
const expanded = ref(false)
const globalEnabled = ref(true)

// 监控统计数据
const stats = reactive({
  activeRefreshers: 0,
  queueSize: 0,
  cacheHitRate: 0,
  avgResponseTime: 0,
  successRate: 100,
  errorRate: 0,
  tokenRefreshCount: 0,
  totalRequests: 0,
  successfulRequests: 0,
  failedRequests: 0,
  cacheHits: 0,
  cacheMisses: 0
})

// 活跃组件列表
const activeComponents = ref([])

// 错误日志
const errorLog = reactive([])

// 性能数据记录
const performanceData = reactive({
  responseTimes: [],
  refreshCounts: [],
  errorCounts: []
})

// 监控定时器
let monitorTimer = null

// 计算属性
const componentCount = computed(() => activeComponents.value.length)

// 获取组件状态类型
function getComponentStatus(component) {
  if (!component.lastRefresh) return 'info'
  const timeSinceRefresh = Date.now() - component.lastRefresh
  if (timeSinceRefresh < 10000) return 'success' // 10秒内
  if (timeSinceRefresh < 30000) return 'warning' // 30秒内
  return 'danger' // 超过30秒
}

// 格式化时间
function formatTime(timestamp) {
  return new Date(timestamp).toLocaleTimeString()
}

// 切换监控器显示状态
function toggleMonitor() {
  expanded.value = !expanded.value
}

// 切换全局刷新开关
function toggleGlobalRefresh() {
  globalEnabled.value = !globalEnabled.value
  
  // 这里可以添加实际的全局开关逻辑
  const message = globalEnabled.value ? '自动刷新已启用' : '自动刷新已停用'
  ElMessage.success(message)
  
  // 记录日志
  recordEvent('system', message)
}

// 清除统计数据
function clearStats() {
  Object.assign(stats, {
    activeRefreshers: 0,
    queueSize: 0,
    cacheHitRate: 0,
    avgResponseTime: 0,
    successRate: 100,
    errorRate: 0,
    tokenRefreshCount: 0,
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    cacheHits: 0,
    cacheMisses: 0
  })
  
  activeComponents.value = []
  errorLog.splice(0)
  performanceData.responseTimes.splice(0)
  performanceData.refreshCounts.splice(0)
  performanceData.errorCounts.splice(0)
  
  ElMessage.success('统计数据已清除')
}

// 导出统计数据
function exportStats() {
  const data = {
    timestamp: new Date().toISOString(),
    stats: { ...stats },
    activeComponents: [...activeComponents.value],
    errorLog: [...errorLog],
    performanceData: {
      responseTimes: [...performanceData.responseTimes],
      refreshCounts: [...performanceData.refreshCounts],
      errorCounts: [...performanceData.errorCounts]
    }
  }
  
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `auto-refresh-stats-${Date.now()}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
  
  ElMessage.success('统计数据已导出')
}

// 记录事件
function recordEvent(component, message, isError = false) {
  if (isError) {
    errorLog.unshift({
      timestamp: Date.now(),
      component,
      message
    })
    
    // 保持错误日志在合理范围内
    if (errorLog.length > 50) {
      errorLog.splice(50)
    }
    
    stats.failedRequests++
    stats.errorRate = Math.round((stats.failedRequests / stats.totalRequests) * 100)
  } else {
    stats.successfulRequests++
  }
  
  stats.totalRequests++
  stats.successRate = Math.round((stats.successfulRequests / stats.totalRequests) * 100)
}

// 更新组件信息
function updateComponentInfo(key, lastRefresh) {
  const existingIndex = activeComponents.value.findIndex(c => c.key === key)
  
  if (existingIndex >= 0) {
    activeComponents.value[existingIndex].lastRefresh = lastRefresh
  } else {
    activeComponents.value.push({ key, lastRefresh })
  }
  
  stats.activeRefreshers = activeComponents.value.length
}

// 更新性能指标
function updatePerformanceMetrics(responseTime, cacheHit = false) {
  performanceData.responseTimes.push(responseTime)
  
  // 保持性能数据在合理范围内
  if (performanceData.responseTimes.length > 100) {
    performanceData.responseTimes.shift()
  }
  
  // 计算平均响应时间
  stats.avgResponseTime = Math.round(
    performanceData.responseTimes.reduce((sum, time) => sum + time, 0) / 
    performanceData.responseTimes.length
  )
  
  // 更新缓存命中率
  if (cacheHit) {
    stats.cacheHits++
  } else {
    stats.cacheMisses++
  }
  
  const totalCacheRequests = stats.cacheHits + stats.cacheMisses
  if (totalCacheRequests > 0) {
    stats.cacheHitRate = Math.round((stats.cacheHits / totalCacheRequests) * 100)
  }
}

// 监听全局刷新事件
function setupGlobalEventListeners() {
  // 监听刷新事件
  if (window.addEventListener) {
    window.addEventListener('refresh:start', (event) => {
      const { key } = event.detail || {}
      updateComponentInfo(key, Date.now())
      recordEvent(key, '开始刷新')
    })
    
    window.addEventListener('refresh:complete', (event) => {
      const { key, responseTime, cacheHit } = event.detail || {}
      updateComponentInfo(key, Date.now())
      updatePerformanceMetrics(responseTime || 0, cacheHit)
      recordEvent(key, '刷新完成')
    })
    
    window.addEventListener('refresh:error', (event) => {
      const { key, error } = event.detail || {}
      recordEvent(key, error?.message || '刷新失败', true)
    })
    
    window.addEventListener('token:refresh', () => {
      stats.tokenRefreshCount++
      recordEvent('auth', 'Token刷新')
    })
  }
}

// 开始监控
function startMonitoring() {
  monitorTimer = setInterval(() => {
    // 更新队列大小（这里需要与实际刷新系统集成）
    // stats.queueSize = globalRefreshQueue.size
    
    // 清理过期组件
    const now = Date.now()
    activeComponents.value = activeComponents.value.filter(component => {
      return !component.lastRefresh || (now - component.lastRefresh) < 300000 // 5分钟
    })
    
    stats.activeRefreshers = activeComponents.value.length
  }, 1000)
}

// 停止监控
function stopMonitoring() {
  if (monitorTimer) {
    clearInterval(monitorTimer)
    monitorTimer = null
  }
}

// 组件生命周期
onMounted(() => {
  setupGlobalEventListeners()
  startMonitoring()
  
  console.log('[AutoRefreshMonitor] 监控器已启动')
})

onUnmounted(() => {
  stopMonitoring()
  console.log('[AutoRefreshMonitor] 监控器已停止')
})

// 暴露方法给外部使用
defineExpose({
  recordEvent,
  updateComponentInfo,
  updatePerformanceMetrics,
  clearStats,
  exportStats
})
</script>

<style scoped>
.auto-refresh-monitor {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 2000;
  max-width: 400px;
}

.monitor-card {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  border-radius: 8px;
}

.monitor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 600;
}

.monitor-content {
  max-height: 60vh;
  overflow-y: auto;
}

.monitor-content h4 {
  margin: 16px 0 8px 0;
  font-size: 14px;
  color: #666;
  border-bottom: 1px solid #eee;
  padding-bottom: 4px;
}

.status-section,
.performance-section,
.components-section,
.control-section,
.error-section {
  margin-bottom: 16px;
}

.metric-item {
  display: flex;
  justify-content: space-between;
  padding: 4px 0;
  border-bottom: 1px solid #f0f0f0;
}

.metric-label {
  font-size: 12px;
  color: #666;
}

.metric-value {
  font-weight: 600;
  font-size: 12px;
}

.metric-value.success {
  color: #67c23a;
}

.metric-value.error {
  color: #f56c6c;
}

.component-tag {
  margin: 2px 4px 2px 0;
}

.error-list {
  max-height: 150px;
  overflow-y: auto;
}

.error-item {
  display: flex;
  justify-content: space-between;
  padding: 4px 0;
  border-bottom: 1px solid #fef0f0;
  font-size: 12px;
}

.error-time {
  color: #999;
  white-space: nowrap;
}

.error-message {
  flex: 1;
  color: #f56c6c;
  margin: 0 8px;
}

.error-component {
  color: #666;
  white-space: nowrap;
}

@media (max-width: 768px) {
  .auto-refresh-monitor {
    position: relative;
    top: auto;
    right: auto;
    max-width: none;
    margin: 10px;
  }
}
</style>