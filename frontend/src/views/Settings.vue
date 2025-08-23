<template>
  <div class="settings">
    <!-- 桌面端网格布局 -->
    <el-row :gutter="20" class="desktop-layout">
      <!-- 移动端手风琴布局 -->
    </el-row>
    
    <!-- 移动端手风琴布局 -->
    <el-collapse v-model="activeCollapse" class="mobile-accordion">
      <el-collapse-item title="系统设置" name="system-settings">
        <el-card class="collapse-card">
          <div class="card-header">
            <span>系统设置</span>
            <el-button 
              type="primary" 
              size="small" 
              @click="saveSettings" 
              :loading="saving"
              :disabled="!isAdmin"
            >
              <el-icon><Check /></el-icon>
              保存设置
            </el-button>
          </div>
          
          <el-form 
            ref="settingsFormRef"
            :model="settingsForm"
            :rules="settingsRules"
            label-width="140px"
            :disabled="!isAdmin"
            class="mobile-form"
          >
            <el-form-item label="每日加载时间" prop="daily_load_time">
              <el-time-picker
                v-model="dailyLoadTime"
                format="HH:mm"
                value-format="HH:mm"
                placeholder="选择时间"
                @change="handleTimeChange"
              />
              <div class="form-tip">每日自动加载提醒计划的时间</div>
            </el-form-item>
            
            <el-form-item label="最大重试次数" prop="max_retry_count">
              <el-input-number
                v-model="settingsForm.max_retry_count"
                :min="0"
                :max="10"
                placeholder="最大重试次数"
              />
              <div class="form-tip">消息发送失败时的最大重试次数</div>
            </el-form-item>
            
            <el-form-item label="重试间隔(秒)" prop="retry_interval">
              <el-input-number
                v-model="settingsForm.retry_interval"
                :min="10"
                :max="3600"
                placeholder="重试间隔"
              />
              <div class="form-tip">消息发送重试的间隔时间</div>
            </el-form-item>
            
          </el-form>
        </el-card>
      </el-collapse-item>
      
      <el-collapse-item title="调度器控制" name="scheduler-control">
        <el-card class="collapse-card">
          <div class="card-header">
            <span>调度器控制与状态</span>
            <el-tag :type="schedulerStatus?.running ? 'success' : 'danger'" size="small">
              {{ schedulerStatus?.running ? '运行中' : '已停止' }}
            </el-tag>
          </div>
          
          <div class="scheduler-info">
            <el-descriptions :column="1" border>
              <el-descriptions-item label="状态">
                <el-tag :type="schedulerStatus?.running ? 'success' : 'danger'">
                  {{ schedulerStatus?.running ? '运行中' : '已停止' }}
                </el-tag>
              </el-descriptions-item>
              <el-descriptions-item label="下次执行时间">
                {{ schedulerStatus?.nextExecutionTime || '未设置' }}
              </el-descriptions-item>
              <el-descriptions-item label="已加载任务数">
                {{ schedulerStatus?.tasksCount || 0 }}
              </el-descriptions-item>
              <el-descriptions-item label="最后执行时间">
                {{ schedulerStatus?.lastExecutionTime || '从未执行' }}
              </el-descriptions-item>
            </el-descriptions>
            
            <div class="scheduler-controls mobile-controls">
              <el-button 
                type="success" 
                @click="startScheduler" 
                :loading="schedulerLoading"
                :disabled="!isAdmin || schedulerStatus?.running"
                class="control-btn"
              >
                <el-icon><VideoPlay /></el-icon>
                启动调度器
              </el-button>
              <el-button 
                type="danger" 
                @click="stopScheduler" 
                :loading="schedulerLoading"
                :disabled="!isAdmin || !schedulerStatus?.running"
                class="control-btn"
              >
                <el-icon><VideoPause /></el-icon>
                停止调度器
              </el-button>
              <el-button 
                type="warning" 
                @click="reloadPlans" 
                :loading="reloadLoading"
                :disabled="!isAdmin"
                class="control-btn"
              >
                <el-icon><Refresh /></el-icon>
                重新加载计划
              </el-button>
              <!-- 根据用户要求删除清除临时文件按钮 -->
            </div>
          </div>
        </el-card>
      </el-collapse-item>
      
      <el-collapse-item title="Redis缓存控制" name="redis-control">
        <el-card class="collapse-card">
          <div class="card-header">
            <span>Redis缓存控制</span>
            <el-tag :type="redisStatus?.enabled ? 'success' : 'danger'" size="small">
              {{ redisStatus?.enabled ? '已启用' : '已停用' }}
            </el-tag>
          </div>
          
          <div class="redis-info">
            <el-descriptions :column="1" border>
              <el-descriptions-item label="状态">
                <el-tag :type="redisStatus?.connected ? 'success' : 'danger'">
                  {{ redisStatus?.status || '未知' }}
                </el-tag>
              </el-descriptions-item>
              <el-descriptions-item label="消息">
                {{ redisStatus?.message || '加载中...' }}
              </el-descriptions-item>
            </el-descriptions>
            
            <div class="redis-controls mobile-controls">
              <el-button 
                type="success" 
                @click="enableRedis" 
                :loading="redisLoading"
                :disabled="!isAdmin || redisStatus?.enabled"
                class="control-btn"
              >
                <el-icon><VideoPlay /></el-icon>
                启用Redis
              </el-button>
              <el-button 
                type="danger" 
                @click="disableRedis" 
                :loading="redisLoading"
                :disabled="!isAdmin || !redisStatus?.enabled"
                class="control-btn"
              >
                <el-icon><VideoPause /></el-icon>
                停用Redis
              </el-button>
              <el-button 
                type="warning" 
                @click="flushRedis" 
                :loading="redisLoading"
                :disabled="!isAdmin || !redisStatus?.enabled"
                class="control-btn"
              >
                <el-icon><Delete /></el-icon>
                清除所有缓存
              </el-button>
              <el-button 
                type="primary" 
                @click="testRedis" 
                :loading="redisLoading"
                :disabled="!isAdmin || !redisStatus?.enabled"
                class="control-btn"
              >
                <el-icon><Connection /></el-icon>
                测试连接
              </el-button>
            </div>
          </div>
        </el-card>
      </el-collapse-item>
      
      <el-collapse-item title="系统信息" name="system-info">
        <el-card class="collapse-card">
          <div class="card-header">
            <span>系统信息</span>
            <el-button type="primary" size="small" @click="loadSystemInfo">
              <el-icon><Refresh /></el-icon>
              刷新
            </el-button>
          </div>
          
          <el-descriptions :column="1" border v-if="systemInfo">
            <el-descriptions-item label="Node.js版本">
              {{ systemInfo.system?.nodeVersion }}
            </el-descriptions-item>
            <el-descriptions-item label="系统平台">
              {{ systemInfo.system?.platform }}
            </el-descriptions-item>
            <el-descriptions-item label="系统版本">
              {{ systemInfo.system?.version }}
            </el-descriptions-item>
            <el-descriptions-item label="进程ID">
              {{ systemInfo.system?.pid }}
            </el-descriptions-item>
            <el-descriptions-item label="运行时间">
              {{ formatUptime(systemInfo.system?.uptime) }}
            </el-descriptions-item>
            <el-descriptions-item label="内存使用">
              {{ formatMemory(systemInfo.system?.memoryUsage?.used) }}
            </el-descriptions-item>
            <el-descriptions-item label="活跃群组">
              {{ systemInfo.database?.active_groups || 0 }}
            </el-descriptions-item>
            <el-descriptions-item label="今日提醒">
              {{ systemInfo.database?.today_reminders || 0 }}
            </el-descriptions-item>
            <el-descriptions-item label="活跃文件">
              {{ systemInfo.database?.active_files || 0 }}
            </el-descriptions-item>
            <el-descriptions-item label="总用户数">
              {{ systemInfo.database?.total_users || 0 }}
            </el-descriptions-item>
          </el-descriptions>
        </el-card>
      </el-collapse-item>
    </el-collapse>
    
    <el-row :gutter="20" class="desktop-row">
      <!-- 系统设置 -->
      <el-col :span="12">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>系统设置</span>
              <el-button 
                type="primary" 
                size="small" 
                @click="saveSettings" 
                :loading="saving"
                :disabled="!isAdmin"
              >
                <el-icon><Check /></el-icon>
                保存设置
              </el-button>
            </div>
          </template>
          
          <el-form 
            ref="settingsFormRef"
            :model="settingsForm"
            :rules="settingsRules"
            label-width="140px"
            :disabled="!isAdmin"
          >
            <!-- 调度器状态控制已移至右侧调度器控制面板 -->
            
            <el-form-item label="每日加载时间" prop="daily_load_time">
              <el-time-picker
                v-model="dailyLoadTime"
                format="HH:mm"
                value-format="HH:mm"
                placeholder="选择时间"
                @change="handleTimeChange"
              />
              <div class="form-tip">每日自动加载提醒计划的时间</div>
            </el-form-item>
            
            <el-form-item label="最大重试次数" prop="max_retry_count">
              <el-input-number
                v-model="settingsForm.max_retry_count"
                :min="0"
                :max="10"
                placeholder="最大重试次数"
              />
              <div class="form-tip">消息发送失败时的最大重试次数</div>
            </el-form-item>
            
            <el-form-item label="重试间隔(秒)" prop="retry_interval">
              <el-input-number
                v-model="settingsForm.retry_interval"
                :min="10"
                :max="3600"
                placeholder="重试间隔"
              />
              <div class="form-tip">消息发送重试的间隔时间</div>
            </el-form-item>
            
            <!-- 任务执行配置 -->
            <el-divider content-position="left">任务执行配置</el-divider>
            
            <el-form-item label="任务超时时间(秒)" prop="task_timeout">
              <el-input-number
                v-model="settingsForm.task_timeout"
                :min="5"
                :max="300"
                placeholder="任务超时时间"
              />
              <div class="form-tip">单个任务执行的最大时间限制</div>
            </el-form-item>
            
            <el-form-item label="最大并发任务数" prop="max_concurrent_tasks">
              <el-input-number
                v-model="settingsForm.max_concurrent_tasks"
                :min="1"
                :max="50"
                placeholder="最大并发任务数"
              />
              <div class="form-tip">同时执行的最大任务数量</div>
            </el-form-item>
            
            <el-form-item label="失败通知" prop="failure_notification_enabled">
              <el-switch
                v-model="settingsForm.failure_notification_enabled"
                active-text="启用"
                inactive-text="禁用"
              />
              <div class="form-tip">任务执行失败时是否发送通知</div>
            </el-form-item>
            
            <!-- 数据保留策略 -->
            <el-divider content-position="left">数据保留策略</el-divider>
            
            <el-form-item label="历史记录保留(天)" prop="history_retention_days">
              <el-input-number
                v-model="settingsForm.history_retention_days"
                :min="7"
                :max="365"
                placeholder="历史记录保留天数"
              />
              <div class="form-tip">任务执行历史记录的保留时长</div>
            </el-form-item>
            
            <el-form-item label="日志保留(天)" prop="log_retention_days">
              <el-input-number
                v-model="settingsForm.log_retention_days"
                :min="7"
                :max="90"
                placeholder="日志保留天数"
              />
              <div class="form-tip">系统日志文件的保留时长</div>
            </el-form-item>
            
            <el-form-item label="自动清理" prop="auto_cleanup_enabled">
              <el-switch
                v-model="settingsForm.auto_cleanup_enabled"
                active-text="启用"
                inactive-text="禁用"
              />
              <div class="form-tip">是否自动清理过期数据</div>
            </el-form-item>
            
            <el-form-item label="清理时间" prop="cleanup_time" v-if="settingsForm.auto_cleanup_enabled">
              <el-time-picker
                v-model="cleanupTime"
                format="HH:mm"
                value-format="HH:mm"
                placeholder="选择时间"
                @change="handleCleanupTimeChange"
              />
              <div class="form-tip">每日自动清理数据的时间</div>
            </el-form-item>
            
            <!-- 系统通知设置 -->
            <el-divider content-position="left">系统通知设置</el-divider>
            
            <el-form-item label="系统错误通知" prop="system_error_notification">
              <el-switch
                v-model="settingsForm.system_error_notification"
                active-text="启用"
                inactive-text="禁用"
              />
              <div class="form-tip">系统发生错误时是否发送通知</div>
            </el-form-item>
            
            <el-form-item label="任务失败通知" prop="task_failure_notification">
              <el-switch
                v-model="settingsForm.task_failure_notification"
                active-text="启用"
                inactive-text="禁用"
              />
              <div class="form-tip">任务执行失败时是否发送通知</div>
            </el-form-item>
            
            <el-form-item label="每日统计报告" prop="daily_report_enabled">
              <el-switch
                v-model="settingsForm.daily_report_enabled"
                active-text="启用"
                inactive-text="禁用"
              />
              <div class="form-tip">是否发送每日任务执行统计报告</div>
            </el-form-item>
            
            <el-form-item label="报告发送时间" prop="daily_report_time" v-if="settingsForm.daily_report_enabled">
              <el-time-picker
                v-model="dailyReportTime"
                format="HH:mm"
                value-format="HH:mm"
                placeholder="选择时间"
                @change="handleReportTimeChange"
              />
              <div class="form-tip">每日统计报告的发送时间</div>
            </el-form-item>
            
            <el-form-item label="通知Webhook" prop="notification_webhook">
              <el-input
                v-model="settingsForm.notification_webhook"
                placeholder="可选，留空使用默认Webhook"
                type="textarea"
                :rows="2"
              />
              <el-button 
                type="primary" 
                size="small" 
                @click="testWebhook" 
                :disabled="!settingsForm.notification_webhook"
                style="margin-top: 8px"
              >
                测试连接
              </el-button>
              <div class="form-tip">系统通知专用的钉钉Webhook（可选）</div>
            </el-form-item>
            
          </el-form>
        </el-card>
      </el-col>
      
      <!-- 调度器控制 -->
      <el-col :span="12">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>调度器控制与状态</span>
              <el-tag :type="schedulerStatus?.running ? 'success' : 'danger'" size="small">
                {{ schedulerStatus?.running ? '运行中' : '已停止' }}
              </el-tag>
            </div>
          </template>
          
          <div class="scheduler-info">
            <el-descriptions :column="1" border>
              <el-descriptions-item label="状态">
                <el-tag :type="schedulerStatus?.running ? 'success' : 'danger'">
                  {{ schedulerStatus?.running ? '运行中' : '已停止' }}
                </el-tag>
              </el-descriptions-item>
              <el-descriptions-item label="下次执行时间">
                {{ schedulerStatus?.nextExecutionTime || '未设置' }}
              </el-descriptions-item>
              <el-descriptions-item label="已加载任务数">
                {{ schedulerStatus?.tasksCount || 0 }}
              </el-descriptions-item>
              <el-descriptions-item label="最后执行时间">
                {{ schedulerStatus?.lastExecutionTime || '从未执行' }}
              </el-descriptions-item>
            </el-descriptions>
            
            <div class="scheduler-controls">
              <el-button 
                type="success" 
                @click="startScheduler" 
                :loading="schedulerLoading"
                :disabled="!isAdmin || schedulerStatus?.running"
              >
                <el-icon><VideoPlay /></el-icon>
                启动调度器
              </el-button>
              <el-button 
                type="danger" 
                @click="stopScheduler" 
                :loading="schedulerLoading"
                :disabled="!isAdmin || !schedulerStatus?.running"
              >
                <el-icon><VideoPause /></el-icon>
                停止调度器
              </el-button>
              <el-button 
                type="warning" 
                @click="reloadPlans" 
                :loading="reloadLoading"
                :disabled="!isAdmin"
              >
                <el-icon><Refresh /></el-icon>
                重新加载计划
              </el-button>
              <el-button 
                type="info" 
                @click="showJobDetails = true" 
                :disabled="!isAdmin"
              >
                <el-icon><List /></el-icon>
                作业详情
              </el-button>
              <!-- 根据用户要求删除清除临时文件按钮 -->
            </div>
          </div>
        </el-card>
        
        <!-- 系统信息 -->
        <el-card style="margin-top: 20px;">
          <template #header>
            <div class="card-header">
              <span>系统信息</span>
              <el-button type="primary" size="small" @click="loadSystemInfo">
                <el-icon><Refresh /></el-icon>
                刷新
              </el-button>
            </div>
          </template>
          
          <el-descriptions :column="2" border v-if="systemInfo" class="system-descriptions">
            <el-descriptions-item label="Node.js版本">
              {{ systemInfo.system?.nodeVersion }}
            </el-descriptions-item>
            <el-descriptions-item label="系统平台">
              {{ systemInfo.system?.platform }}
            </el-descriptions-item>
            <el-descriptions-item label="系统版本">
              {{ systemInfo.system?.version }}
            </el-descriptions-item>
            <el-descriptions-item label="进程ID">
              {{ systemInfo.system?.pid }}
            </el-descriptions-item>
            <el-descriptions-item label="运行时间">
              {{ formatUptime(systemInfo.system?.uptime) }}
            </el-descriptions-item>
            <el-descriptions-item label="内存使用">
              {{ formatMemory(systemInfo.system?.memoryUsage?.used) }}
            </el-descriptions-item>
            <el-descriptions-item label="活跃群组">
              {{ systemInfo.database?.active_groups || 0 }}
            </el-descriptions-item>
            <el-descriptions-item label="今日提醒">
              {{ systemInfo.database?.today_reminders || 0 }}
            </el-descriptions-item>
            <el-descriptions-item label="活跃文件">
              {{ systemInfo.database?.active_files || 0 }}
            </el-descriptions-item>
            <el-descriptions-item label="总用户数">
              {{ systemInfo.database?.total_users || 0 }}
            </el-descriptions-item>
          </el-descriptions>
        </el-card>
        
        <!-- Redis缓存控制 -->
        <el-card style="margin-top: 20px;">
          <template #header>
            <div class="card-header">
              <span>Redis缓存控制</span>
              <el-tag :type="redisStatus?.enabled ? 'success' : 'danger'" size="small">
                {{ redisStatus?.enabled ? '已启用' : '已停用' }}
              </el-tag>
            </div>
          </template>
          
          <div class="redis-info">
            <el-descriptions :column="2" border>
              <el-descriptions-item label="状态">
                <el-tag :type="redisStatus?.connected ? 'success' : 'danger'">
                  {{ redisStatus?.status || '未知' }}
                </el-tag>
              </el-descriptions-item>
              <el-descriptions-item label="消息">
                {{ redisStatus?.message || '加载中...' }}
              </el-descriptions-item>
            </el-descriptions>
            
            <div class="redis-controls" style="margin-top: 20px;">
              <el-button 
                type="success" 
                @click="enableRedis" 
                :loading="redisLoading"
                :disabled="!isAdmin || redisStatus?.enabled"
                size="small"
              >
                <el-icon><VideoPlay /></el-icon>
                启用Redis
              </el-button>
              <el-button 
                type="danger" 
                @click="disableRedis" 
                :loading="redisLoading"
                :disabled="!isAdmin || !redisStatus?.enabled"
                size="small"
              >
                <el-icon><VideoPause /></el-icon>
                停用Redis
              </el-button>
              <el-button 
                type="warning" 
                @click="flushRedis" 
                :loading="redisLoading"
                :disabled="!isAdmin || !redisStatus?.enabled"
                size="small"
              >
                <el-icon><Delete /></el-icon>
                清除缓存
              </el-button>
              <el-button 
                type="primary" 
                @click="testRedis" 
                :loading="redisLoading"
                :disabled="!isAdmin || !redisStatus?.enabled"
                size="small"
              >
                <el-icon><Connection /></el-icon>
                测试连接
              </el-button>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>
    
    <!-- 第二行：系统日志（双栏显示） -->
    <el-row :gutter="20" class="logs-row">
      <el-col :span="24">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>系统日志</span>
              <div class="header-controls">
                <el-tooltip content="开启后每30秒自动刷新日志" placement="top">
                  <el-switch 
                    v-model="autoRefresh" 
                    size="small"
                    @change="toggleAutoRefresh"
                    active-text="自动"
                    style="margin-right: 12px;"
                  />
                </el-tooltip>
                <el-button type="primary" size="small" @click="loadAllLogs">
                  <el-icon><Refresh /></el-icon>
                  刷新全部
                </el-button>
                <el-button 
                  type="danger" 
                  size="small" 
                  @click="clearLogs"
                  :disabled="!isAdmin"
                >
                  <el-icon><Delete /></el-icon>
                  清理
                </el-button>
              </div>
            </div>
          </template>
          
          <el-row :gutter="20">
            <!-- 错误日志列 -->
            <el-col :span="12">
              <div class="log-section">
                <div class="log-section-header">
                  <el-icon color="#f56c6c"><CircleClose /></el-icon>
                  <span class="log-section-title">错误日志</span>
                  <el-tag type="danger" size="small">{{ errorLogs.length }}</el-tag>
                </div>
                <div class="logs-container">
                  <div v-if="!errorLogs || !errorLogs.length" class="no-logs">
                    <el-empty description="暂无错误日志" :image-size="60" />
                  </div>
                  <div v-else class="logs-list">
                    <div 
                      v-for="(log, index) in errorLogs" 
                      :key="'error-' + index" 
                      class="log-item log-error"
                    >
                      <div class="log-time">{{ formatDateTime(log.timestamp) }}</div>
                      <div class="log-message">{{ log.message }}</div>
                    </div>
                  </div>
                </div>
              </div>
            </el-col>
            
            <!-- 信息日志列 -->
            <el-col :span="12">
              <div class="log-section">
                <div class="log-section-header">
                  <el-icon color="#67c23a"><CircleCheck /></el-icon>
                  <span class="log-section-title">信息日志</span>
                  <el-tag type="success" size="small">{{ infoLogs.length }}</el-tag>
                </div>
                <div class="logs-container">
                  <div v-if="!infoLogs || !infoLogs.length" class="no-logs">
                    <el-empty description="暂无信息日志" :image-size="60" />
                  </div>
                  <div v-else class="logs-list">
                    <div 
                      v-for="(log, index) in infoLogs" 
                      :key="'info-' + index" 
                      class="log-item log-info"
                    >
                      <div class="log-time">{{ formatDateTime(log.timestamp) }}</div>
                      <div class="log-message">{{ log.message }}</div>
                    </div>
                  </div>
                </div>
              </div>
            </el-col>
          </el-row>
        </el-card>
      </el-col>
    </el-row>
    
    <!-- 数据管理 -->
    <el-row :gutter="20" class="data-row">
      <el-col :span="24">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>数据管理</span>
            </div>
          </template>
          
          <div class="data-controls">
            <el-alert
              title="数据操作提醒"
              type="warning"
              :closable="false"
              description="以下操作仅管理员可执行，请谨慎操作。数据备份操作可能需要较长时间。"
            />
            
            <div class="control-buttons">
              <!-- 备份功能已移除 -->
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

  </div>
  
  <!-- 作业详情弹窗 -->
  <SchedulerJobsDialog 
    :visible="showJobDetails" 
    @close="showJobDetails = false"
  />
</template>

<script setup>
import { ref, reactive, computed, onMounted, onBeforeUnmount } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useAuthStore } from '@/stores/auth'
import { settingsApi } from '@/api/modules/settings'
import SchedulerJobsDialog from '@/components/SchedulerJobsDialog.vue'

const authStore = useAuthStore()

// 数据
const settings = ref({})
const schedulerStatus = ref({})
const systemInfo = ref(null)
const logs = ref([])
const errorLogs = ref([])  // 错误日志
const infoLogs = ref([])   // 信息日志
const saving = ref(false)
const schedulerLoading = ref(false)
const reloadLoading = ref(false)
const cleanupLoading = ref(false)
const logLevel = ref('info')
const activeCollapse = ref(['system-settings'])
const autoRefresh = ref(true)
const refreshTimer = ref(null)
const showJobDetails = ref(false)

// Redis控制相关
const redisStatus = ref(null)
const redisLoading = ref(false)

// 计算属性
const isAdmin = computed(() => authStore.isAdmin)

// 表单数据
const settingsFormRef = ref()
const settingsForm = reactive({
  // 基础设置
  scheduler_enabled: 'true',
  daily_load_time: '02:00',
  max_retry_count: 3,
  retry_interval: 300,
  
  // 任务执行配置
  task_timeout: 30,
  max_concurrent_tasks: 10,
  failure_notification_enabled: true,
  
  // 数据保留策略
  history_retention_days: 90,
  log_retention_days: 30,
  auto_cleanup_enabled: true,
  cleanup_time: '03:00',
  
  // 系统通知设置
  system_error_notification: true,
  task_failure_notification: true,
  daily_report_enabled: false,
  daily_report_time: '09:00',
  notification_webhook: ''
})

// 时间选择器绑定值
const dailyLoadTime = ref('')
const cleanupTime = ref('')
const dailyReportTime = ref('')

// 表单验证规则
const settingsRules = {
  max_retry_count: [
    { required: true, message: '请输入最大重试次数', trigger: 'blur' }
  ],
  retry_interval: [
    { required: true, message: '请输入重试间隔', trigger: 'blur' }
  ]
}

// 加载系统设置
async function loadSettings() {
  try {
    const response = await settingsApi.getSettings()
    const data = response.data?.data || response.data || {}
    settings.value = data
    
    // 更新表单数据
    Object.keys(settingsForm).forEach(key => {
      if (data[key] !== undefined) {
        settingsForm[key] = data[key]
      }
    })
    
    // 更新时间选择器
    dailyLoadTime.value = settingsForm.daily_load_time
    cleanupTime.value = settingsForm.cleanup_time
    dailyReportTime.value = settingsForm.daily_report_time
    
  } catch (error) {
    console.error('加载系统设置失败:', error)
    // 静默处理，使用默认值
  }
}

// 保存系统设置
async function saveSettings() {
  if (!settingsFormRef.value) return
  
  try {
    await settingsFormRef.value.validate()
    saving.value = true
    
    // 准备保存的数据，保持类型正确
    const settingsData = { ...settingsForm }
    
    const response = await settingsApi.updateSettings(settingsData)
    if (response.data?.success) {
      ElMessage.success('系统设置保存成功')
    } else {
      ElMessage.error(response.data?.message || '保存失败')
    }
    
    // 如果调度器正在运行，提示重启以应用新的时间设置
    if (schedulerStatus.value?.running) {
      try {
        await ElMessageBox.confirm(
          '时间设置已保存，需要重启调度器以应用新的定时设置。是否立即重启？',
          '重启调度器',
          {
            confirmButtonText: '立即重启',
            cancelButtonText: '稍后手动重启',
            type: 'warning'
          }
        )
        
        // 使用专门的重启接口
        const result = await settingsApi.restartScheduler()
        if (result.data.success) {
          ElMessage.success('调度器重启成功，新的时间设置已生效')
        } else {
          ElMessage.error(result.data.message || '调度器重启失败')
        }
      } catch (error) {
        if (error !== 'cancel') {
          ElMessage.warning('调度器重启失败，请手动重启以应用新设置')
        }
      }
    }
    
    await loadSettings()
    await loadSchedulerStatus()
  } catch (error) {
    ElMessage.error('保存系统设置失败')
  } finally {
    saving.value = false
  }
}

// 加载调度器状态
async function loadSchedulerStatus() {
  try {
    const response = await settingsApi.getSchedulerStatus()
    // API返回格式为 { success: true, data: {...} }
    schedulerStatus.value = response.data.data || response.data
  } catch (error) {
    ElMessage.error('加载调度器状态失败')
  }
}

// 启动调度器
async function startScheduler() {
  try {
    schedulerLoading.value = true
    const response = await settingsApi.startScheduler()
    ElMessage.success(response.data?.message || '调度器启动成功')
    await loadSchedulerStatus()
  } catch (error) {
    ElMessage.error(error.response?.data?.message || '启动调度器失败')
  } finally {
    schedulerLoading.value = false
  }
}

// 停止调度器
async function stopScheduler() {
  try {
    await ElMessageBox.confirm(
      '确定要停止调度器吗？这将停止所有定时任务。',
      '确认停止',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    
    schedulerLoading.value = true
    const response = await settingsApi.stopScheduler()
    ElMessage.success(response.data?.message || '调度器停止成功')
    await loadSchedulerStatus()
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(error.response?.data?.message || '停止调度器失败')
    }
  } finally {
    schedulerLoading.value = false
  }
}

// Redis控制相关方法
async function loadRedisStatus() {
  try {
    const response = await settingsApi.getRedisStatus()
    console.log('Redis状态响应:', response)
    // 处理Redis状态数据
    const data = response.data.data
    redisStatus.value = {
      enabled: data.connected || false,
      connected: data.connected || false,
      status: data.connected ? 'connected' : 'disconnected',
      message: data.connected ? 'Redis已连接' : 'Redis未连接'
    }
  } catch (error) {
    console.error('加载Redis状态失败:', error)
    redisStatus.value = {
      enabled: false,
      connected: false,
      status: 'disconnected',
      message: 'Redis未配置或未启用'
    }
  }
}

async function enableRedis() {
  try {
    redisLoading.value = true
    await settingsApi.enableRedis()
    ElMessage.success('Redis缓存已启用')
    await loadRedisStatus()
  } catch (error) {
    ElMessage.error('启用Redis失败: ' + (error.response?.data?.error || error.message))
  } finally {
    redisLoading.value = false
  }
}

async function disableRedis() {
  try {
    await ElMessageBox.confirm(
      '确定要停用Redis缓存吗？这将清除所有缓存并可能影响性能。',
      '确认停用',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    
    redisLoading.value = true
    await settingsApi.disableRedis()
    ElMessage.success('Redis缓存已停用，所有缓存已清理')
    await loadRedisStatus()
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('停用Redis失败: ' + (error.response?.data?.error || error.message))
    }
  } finally {
    redisLoading.value = false
  }
}

async function flushRedis() {
  try {
    await ElMessageBox.confirm(
      '确定要清除所有缓存吗？这将删除所有缓存数据。',
      '确认清除',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    
    redisLoading.value = true
    await settingsApi.flushRedis()
    ElMessage.success('所有缓存已清理')
    await loadRedisStatus()
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('清理缓存失败: ' + (error.response?.data?.error || error.message))
    }
  } finally {
    redisLoading.value = false
  }
}

async function testRedis() {
  try {
    redisLoading.value = true
    const response = await settingsApi.testRedis()
    if (response.data.success) {
      ElMessage.success(response.data.message || 'Redis连接正常')
    } else {
      ElMessage.warning(response.data.message || 'Redis连接异常')
    }
    await loadRedisStatus()
  } catch (error) {
    ElMessage.error('测试Redis失败: ' + (error.response?.data?.error || error.message))
  } finally {
    redisLoading.value = false
  }
}

// 重新加载计划
async function reloadPlans() {
  try {
    await ElMessageBox.confirm(
      '确定要重新加载今日任务吗？\n\n此操作将：\n• 清理当前已加载的所有任务\n• 从数据库读取所有活跃的任务\n• 根据任务的执行时间筛选今日需执行的任务\n• 自动排除已过期和已禁用的任务\n• 重新创建调度作业\n\n注意：此操作会重置所有调度器任务，请谨慎操作。',
      '重新加载今日任务',
      {
        confirmButtonText: '确定加载',
        cancelButtonText: '取消',
        type: 'info',
        dangerouslyUseHTMLString: true
      }
    )
    
    reloadLoading.value = true
    const response = await settingsApi.reloadPlans()
    
    // 处理后端返回的数据结构
    const data = response.data?.data || response.data || {}
    const loadedCount = data.loadedCount || 0
    const totalActive = data.totalActive || 0
    const skippedCount = Math.max(0, totalActive - loadedCount)
    
    // 显示详细的加载结果
    const message = `任务加载完成！
活跃任务数: ${totalActive}
成功加载: ${loadedCount} 个
跳过加载: ${skippedCount} 个`
    
    ElMessage({
      message: message,
      type: 'success',
      duration: 5000,
      dangerouslyUseHTMLString: true
    })
    
    await loadSchedulerStatus()
  } catch (error) {
    if (error !== 'cancel') {
      console.error('重新加载任务失败:', error)
      ElMessage.error('重新加载任务失败: ' + (error.message || '未知错误'))
    }
  } finally {
    reloadLoading.value = false
  }
}

// 清理临时文件
async function cleanupTempFiles() {
  try {
    await ElMessageBox.confirm(
      '确定要清理临时文件吗？\n\n此操作将：\n• 清理超过1天的所有临时文件\n• 将文件移动到备份目录\n• 清理相关的过期提醒记录\n\n清理后的文件可在备份目录中找到。',
      '清理临时文件',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
        dangerouslyUseHTMLString: true
      }
    )
    
    cleanupLoading.value = true
    const response = await settingsApi.cleanupTempFiles()
    
    if (response.data.success) {
      ElMessage.success(response.data.message || '临时文件清理完成')
    } else {
      ElMessage.error(response.data.message || '临时文件清理失败')
    }
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('清理临时文件失败')
    }
  } finally {
    cleanupLoading.value = false
  }
}

// 加载系统信息
async function loadSystemInfo() {
  try {
    // 获取系统统计信息
    const statsResponse = await settingsApi.getSystemStats()
    const statsData = statsResponse.data?.data || {}
    
    // 获取健康检查信息
    const healthResponse = await settingsApi.getSystemInfo()
    const healthData = healthResponse.data || {}
    
    systemInfo.value = {
      system: {
        nodeVersion: statsData.system?.nodeVersion || process.version,
        platform: statsData.system?.platform || healthData.environment || 'production',
        version: statsData.system?.version || healthData.version || '2.0.0',
        pid: statsData.system?.pid || '-',
        uptime: statsData.system?.uptime || healthData.uptime || 0,
        memoryUsage: statsData.system?.memoryUsage || {
          used: healthData.memory?.used || '0MB'
        }
      },
      database: {
        active_groups: statsData.database?.active_groups || 0,
        today_reminders: statsData.database?.today_reminders || 0,
        active_files: statsData.database?.active_files || 0,
        total_users: statsData.database?.total_users || 0
      }
    }
  } catch (error) {
    console.error('加载系统信息失败:', error)
    // 如果新接口失败，尝试只使用健康检查接口
    try {
      const response = await settingsApi.getSystemInfo()
      const data = response.data
      systemInfo.value = {
        system: {
          nodeVersion: process.version,
          platform: data.environment || 'production',
          version: data.version || '2.0.0',
          pid: '-',
          uptime: data.uptime || 0,
          memoryUsage: {
            used: data.memory?.used || '0MB'
          }
        },
        database: {
          active_groups: 0,
          today_reminders: 0,
          active_files: 0,
          total_users: 0
        }
      }
    } catch (fallbackError) {
      console.error('备用加载也失败:', fallbackError)
    }
  }
}

// 加载系统日志
async function loadLogs() {
  try {
    const response = await settingsApi.getLogs({ level: logLevel.value, limit: 50 })
    // 修正数据访问路径：response.data.data.logs
    logs.value = response.data?.data?.logs || []
  } catch (error) {
    console.error('加载系统日志失败:', error)
    // 出错时设置为空数组
    logs.value = []
    // 静默处理错误，不显示错误消息
  }
}

// 加载所有日志（错误日志和信息日志）
async function loadAllLogs() {
  try {
    // 并行加载错误日志和信息日志
    const [errorResponse, infoResponse] = await Promise.all([
      settingsApi.getLogs({ level: 'error', limit: 30 }),
      settingsApi.getLogs({ level: 'info', limit: 30 })
    ])
    
    errorLogs.value = errorResponse.data?.data?.logs || []
    infoLogs.value = infoResponse.data?.data?.logs || []
    
    // 同时更新统一的日志数组
    logs.value = [...errorLogs.value, ...infoLogs.value]
  } catch (error) {
    console.error('加载日志失败:', error)
    errorLogs.value = []
    infoLogs.value = []
    logs.value = []
  }
}

// 清理系统日志
async function clearLogs() {
  try {
    await ElMessageBox.confirm(
      '确定要清理系统日志吗？此操作将删除所有日志文件。',
      '确认清理',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    
    const response = await settingsApi.clearLogs()
    ElMessage.success(response.data?.message || '系统日志清理成功')
    // 清理后重新加载日志
    await loadLogs()
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('清理系统日志失败')
    }
  }
}


// 处理时间变化
function handleTimeChange(time) {
  settingsForm.daily_load_time = time || '02:00'
}

function handleCleanupTimeChange(time) {
  settingsForm.cleanup_time = time || '03:00'
}

function handleReportTimeChange(time) {
  settingsForm.daily_report_time = time || '09:00'
}

// 测试Webhook连接
async function testWebhook() {
  if (!settingsForm.notification_webhook) {
    ElMessage.warning('请先输入Webhook URL')
    return
  }
  
  try {
    const response = await settingsApi.testWebhook(settingsForm.notification_webhook)
    if (response.data?.success) {
      ElMessage.success('Webhook测试成功')
    } else {
      ElMessage.error(response.data?.message || 'Webhook测试失败')
    }
  } catch (error) {
    ElMessage.error('测试Webhook失败: ' + error.message)
  }
}

// 工具函数
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

function formatUptime(seconds) {
  if (!seconds) return '-'
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  return `${days}天 ${hours}小时 ${minutes}分钟`
}

function formatMemory(bytes) {
  if (!bytes) return '-'
  const mb = (bytes / 1024 / 1024).toFixed(2)
  return `${mb} MB`
}

function getLogLevel(level) {
  const levels = {
    info: '信息',
    warn: '警告',
    error: '错误',
    debug: '调试'
  }
  return levels[level] || level
}

// 自动刷新功能
function startAutoRefresh() {
  if (refreshTimer.value) {
    clearInterval(refreshTimer.value)
  }
  
  if (autoRefresh.value) {
    refreshTimer.value = setInterval(async () => {
      try {
        await Promise.all([
          loadSchedulerStatus(),
          loadSystemInfo(),
          loadAllLogs()  // 使用新的加载函数
        ])
      } catch (error) {
        console.warn('自动刷新失败:', error)
      }
    }, 30000) // 30秒刷新一次
  }
}

function stopAutoRefresh() {
  if (refreshTimer.value) {
    clearInterval(refreshTimer.value)
    refreshTimer.value = null
  }
}

function toggleAutoRefresh() {
  autoRefresh.value = !autoRefresh.value
  if (autoRefresh.value) {
    startAutoRefresh()
  } else {
    stopAutoRefresh()
  }
}

// 初始化函数
const initializeSettings = async () => {
  // 确保用户信息是最新的，特别是管理员权限状态
  if (authStore.isAuthenticated && !authStore.user) {
    try {
      await authStore.fetchUserInfo()
      console.log('[Settings] 用户信息刷新完成，isAdmin状态:', authStore.isAdmin)
    } catch (error) {
      console.error('[Settings] 获取用户信息失败:', error)
    }
  }
  
  await Promise.all([
    loadSettings(),
    loadSchedulerStatus(),
    loadSystemInfo(),
    loadAllLogs(),  // 使用新的加载函数
    loadRedisStatus()
  ])
  
  // 启动自动刷新
  startAutoRefresh()
}

// 组件挂载 - 不使用async
onMounted(() => {
  // 直接调用异步函数，不等待
  initializeSettings()
})

// 组件卸载时清理定时器
onBeforeUnmount(() => {
  stopAutoRefresh()
})
</script>

<style scoped>
.settings {
  padding: 0;
}

/* 桌面端布局 */
.desktop-layout {
  display: block;
}

.desktop-row {
  margin-top: 20px;
}

/* 移动端手风琴布局 */
.mobile-accordion {
  display: none;
  margin-bottom: 20px;
}

.mobile-accordion :deep(.el-collapse-item__header) {
  height: 56px;
  padding: 0 16px;
  font-size: 16px;
  font-weight: 600;
  background-color: var(--el-fill-color-extra-light);
}

.mobile-accordion :deep(.el-collapse-item__content) {
  padding: 0;
}

.collapse-card {
  border: none;
  box-shadow: none;
}

.collapse-card :deep(.el-card__body) {
  padding: 16px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.header-controls {
  display: flex;
  gap: 8px;
  align-items: center;
}

.form-tip {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
  line-height: 1.4;
}

.mobile-form {
  margin-top: 16px;
}

.mobile-form :deep(.el-form-item__label) {
  font-size: 14px;
  font-weight: 500;
}

.scheduler-info {
  margin-top: 12px;
}

.scheduler-controls {
  margin-top: 20px;
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.mobile-controls {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.control-btn {
  width: 100%;
  justify-content: center;
}

.system-row {
  margin-top: 20px;
}

.logs-row {
  margin-top: 20px;
}

.logs-container {
  max-height: 400px;
  overflow-y: auto;
  background: #f5f7fa;
  border-radius: 4px;
  padding: 8px;
}

/* 日志分栏样式 */
.log-section {
  height: 100%;
}

.log-section-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.log-section-title {
  font-weight: 500;
  font-size: 14px;
  color: #303133;
}

.no-logs {
  text-align: center;
  padding: 20px;
}

.logs-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.log-item {
  display: flex;
  align-items: flex-start;
  padding: 8px;
  border-radius: 4px;
  border-left: 3px solid #dcdfe6;
  background-color: #f8f9fa;
}

.log-item.log-info {
  border-left-color: #409eff;
}

.log-item.log-warn {
  border-left-color: #e6a23c;
}

.log-item.log-error {
  border-left-color: #f56c6c;
  background-color: #fef0f0;
}

.log-time {
  font-size: 12px;
  color: #909399;
  width: 140px;
  flex-shrink: 0;
}

.log-level {
  font-size: 12px;
  width: 50px;
  flex-shrink: 0;
  font-weight: 500;
}

.log-message {
  flex: 1;
  font-size: 13px;
  word-break: break-word;
}

.data-row {
  margin-top: 20px;
}

.data-controls {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.control-buttons {
  margin-top: 16px;
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.backup-info {
  line-height: 1.6;
}

.backup-info code {
  background-color: #f5f7fa;
  padding: 2px 6px;
  border-radius: 3px;
  font-family: 'Courier New', Courier, monospace;
}

/* 移动端适配 */
@media (max-width: 767px) {
  .settings {
    padding: 0;
  }
  
  /* 隐藏桌面端布局，显示移动端手风琴 */
  .desktop-layout,
  .desktop-row {
    display: none;
  }
  
  .mobile-accordion {
    display: block;
  }
  
  /* 移动端表单优化 */
  .mobile-form :deep(.el-form-item__label) {
    width: 120px !important;
    font-size: 13px;
  }
  
  .mobile-form :deep(.el-input),
  .mobile-form :deep(.el-time-picker),
  .mobile-form :deep(.el-input-number) {
    width: 100%;
  }
  
  /* 移动端按钮组优化 */
  .mobile-controls {
    grid-template-columns: 1fr;
    gap: 8px;
  }
  
  .scheduler-controls {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
  
  .control-btn {
    font-size: 13px;
    padding: 8px 12px;
  }
  
  /* 系统信息移动端单列适配 */
  .system-row {
    flex-direction: column;
  }
  
  .system-row .el-col {
    width: 100% !important;
    margin-bottom: 16px;
  }
  
  /* 系统信息描述单列 */
  .system-descriptions :deep(.el-descriptions) {
    font-size: 13px;
  }
  
  .system-descriptions :deep(.el-descriptions__body) {
    display: block !important;
  }
  
  .system-descriptions :deep(.el-descriptions__table) {
    display: block !important;
  }
  
  .system-descriptions :deep(.el-descriptions__body) tr {
    display: block !important;
    margin-bottom: 1px;
  }
  
  .system-descriptions :deep(.el-descriptions__body) td {
    display: block !important;
    width: 100% !important;
    border-right: none !important;
  }
  
  /* 移动端系统信息优化 */
  .collapse-card :deep(.el-descriptions) {
    font-size: 13px;
  }
  
  .collapse-card :deep(.el-descriptions-item__label) {
    font-weight: 500;
    min-width: 80px;
  }
  
  /* 日志控制按钮移动端优化 */
  .header-controls {
    flex-direction: column;
    gap: 8px;
    align-items: stretch;
  }
  
  .log-level-select {
    width: 100% !important;
  }
  
  /* 移动端日志优化 */
  .logs-container {
    max-height: 300px;
  }
  
  .log-time {
    width: 100px;
    font-size: 11px;
  }
  
  .log-level {
    width: 40px;
    font-size: 11px;
  }
  
  .log-message {
    font-size: 12px;
  }
  
  /* 移动端控制按钮 */
  .control-buttons {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  
  .control-buttons .el-button {
    width: 100%;
  }
}

/* 平板端适配 */
@media (min-width: 768px) and (max-width: 991px) {
  .desktop-layout {
    display: block;
  }
  
  .mobile-accordion {
    display: none;
  }
  
  .scheduler-controls {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }
  
  .control-buttons {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }
}

/* 大屏幕优化 */
@media (min-width: 1200px) {
  .scheduler-controls {
    gap: 16px;
  }
  
  .control-buttons {
    gap: 16px;
  }
}
</style>