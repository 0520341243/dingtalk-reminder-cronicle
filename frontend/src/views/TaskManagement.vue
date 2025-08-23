<template>
  <div class="task-management">
    <!-- 页面标题和操作 -->
    <div class="page-header">
      <div class="header-left">
        <h2>任务管理</h2>
        <p>智能调度系统 - 支持复杂周期规则和任务关联</p>
      </div>
      <div class="header-actions">
        <el-button type="primary" @click="showCreateTask = true">
          <el-icon><Plus /></el-icon>
          创建任务
        </el-button>
      </div>
    </div>

    <!-- 统计概览 -->
    <el-row :gutter="20" class="stats-row">
      <el-col :xs="24" :sm="12" :md="6">
        <el-card class="stat-card">
          <div class="stat-content">
            <div class="stat-icon total">
              <el-icon size="28"><CollectionTag /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-number">{{ statistics.totalTasks }}</div>
              <div class="stat-label">总任务数</div>
            </div>
          </div>
        </el-card>
      </el-col>
      
      <el-col :xs="24" :sm="12" :md="6">
        <el-card class="stat-card">
          <div class="stat-content">
            <div class="stat-icon active">
              <el-icon size="28"><CircleCheck /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-number">{{ statistics.activeTasks }}</div>
              <div class="stat-label">活跃任务</div>
            </div>
          </div>
        </el-card>
      </el-col>

      <el-col :xs="24" :sm="12" :md="6">
        <el-card class="stat-card">
          <div class="stat-content">
            <div class="stat-icon scheduled">
              <el-icon size="28"><AlarmClock /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-number">{{ statistics.scheduledToday }}</div>
              <div class="stat-label">今日计划</div>
            </div>
          </div>
        </el-card>
      </el-col>

      <el-col :xs="24" :sm="12" :md="6">
        <el-card class="stat-card">
          <div class="stat-content">
            <div class="stat-icon associations">
              <el-icon size="28"><Connection /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-number">{{ statistics.associatedTasks }}</div>
              <div class="stat-label">关联任务</div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 筛选和搜索 -->
    <el-card class="filter-card">
      <el-row :gutter="20" class="filter-row">
        <el-col :xs="24" :sm="6">
          <el-input
            v-model="searchQuery"
            placeholder="搜索任务名称..."
            prefix-icon="Search"
            clearable
            @clear="handleSearch"
            @keyup.enter="handleSearch"
          />
        </el-col>
        <el-col :xs="24" :sm="4">
          <el-select v-model="statusFilter" placeholder="任务状态" clearable @change="handleFilter">
            <el-option label="活跃" value="active" />
            <el-option label="暂停" value="paused" />
            <el-option label="已过期" value="expired" />
          </el-select>
        </el-col>
        <el-col :xs="24" :sm="4">
          <el-select v-model="priorityFilter" placeholder="优先级" clearable @change="handleFilter">
            <el-option label="高优先级" value="high" />
            <el-option label="普通" value="normal" />
            <el-option label="低优先级" value="low" />
          </el-select>
        </el-col>
        <el-col :xs="24" :sm="4">
          <el-select v-model="groupFilter" placeholder="选择群组" clearable @change="handleFilter">
            <el-option
              v-for="group in availableGroups"
              :key="group.id"
              :label="group.name"
              :value="group.id"
            />
          </el-select>
        </el-col>
        <el-col :xs="24" :sm="3">
          <el-button type="primary" @click="handleSearch">
            <el-icon><Search /></el-icon>
            搜索
          </el-button>
        </el-col>
        <el-col :xs="24" :sm="3">
          <el-button type="info" @click="showGlobalExecutionPlan">
            <el-icon><Calendar /></el-icon>
            执行计划
          </el-button>
        </el-col>
      </el-row>
    </el-card>

    <!-- 任务列表 -->
    <el-card class="table-card">
      <template #header>
        <div class="card-header">
          <span>任务列表</span>
          <div class="header-actions">
            <!-- 批量操作按钮 -->
            <el-button-group v-if="selectedTasks.length > 0" style="margin-right: 10px;">
              <el-button
                size="small"
                type="success"
                @click="batchExecuteTasks"
              >
                <el-icon><CaretRight /></el-icon>
                批量执行({{ selectedTasks.length }})
              </el-button>
              <el-button
                size="small"
                type="warning"
                @click="batchToggleStatus"
              >
                <el-icon><VideoPause /></el-icon>
                批量暂停/启用({{ selectedTasks.length }})
              </el-button>
              <el-button
                size="small"
                type="danger"
                @click="batchDeleteTasks"
              >
                <el-icon><Delete /></el-icon>
                批量删除({{ selectedTasks.length }})
              </el-button>
            </el-button-group>
            <el-button size="small" @click="refreshTasks" :loading="loading">
              <el-icon><Refresh /></el-icon>
              刷新
            </el-button>
            <el-tooltip :content="enableAutoRefresh ? '点击停止自动刷新' : '点击启用自动刷新（30秒）'" placement="top">
              <el-button
                size="small"
                :type="enableAutoRefresh ? 'success' : 'info'"
                @click="toggleAutoRefresh"
              >
                <el-icon>
                  <component :is="enableAutoRefresh ? 'VideoPlay' : 'VideoPause'" />
                </el-icon>
                {{ enableAutoRefresh ? '自动刷新' : '已暂停' }}
              </el-button>
            </el-tooltip>
          </div>
        </div>
      </template>

      <!-- 桌面端表格视图 -->
      <el-table
        v-loading="loading"
        :data="paginatedTasks"
        style="width: 100%"
        class="desktop-table"
        @sort-change="handleSortChange"
        @selection-change="handleSelectionChange"
      >
        <!-- 选择列 -->
        <el-table-column
          type="selection"
          width="55"
          :selectable="checkSelectable"
        />
        <el-table-column prop="id" label="ID" width="80" sortable />
        
        <el-table-column prop="name" label="任务名称" min-width="200">
          <template #default="{ row }">
            <div class="task-name-cell">
              <span class="task-name">{{ row.name }}</span>
              <el-tag
                v-if="row.associations && row.associations.length > 0"
                size="small"
                type="info"
                class="association-tag"
              >
                关联{{ row.associations.length }}
              </el-tag>
            </div>
          </template>
        </el-table-column>

        <el-table-column prop="type" label="任务类型" width="200">
          <template #default="{ row }">
            <div class="task-type-cell">
              <el-tag
                :type="row.type === 'worksheet' ? 'success' : 'primary'"
                :effect="row.status === 'active' ? 'dark' : 'light'"
                size="small"
              >
                <el-icon class="mr-1">
                  <component :is="row.type === 'worksheet' ? 'Document' : 'Clock'" />
                </el-icon>
                {{ row.type === 'worksheet' ? '工作表任务' : '简单任务' }}
              </el-tag>
              <div class="task-type-info" v-if="row.type === 'worksheet' || row.type === 'simple'">
                <span v-if="row.type === 'worksheet' && row.worksheetName" class="worksheet-name">
                  <el-tooltip :content="`工作表: ${row.worksheetName}`" placement="top">
                    <span>
                      <el-icon size="12"><Document /></el-icon>
                      {{ row.worksheetName }}
                    </span>
                  </el-tooltip>
                </span>
                <span v-else-if="row.type === 'simple' && (row.reminderTime || (row.scheduleRule && row.scheduleRule.executionTimes && row.scheduleRule.executionTimes[0]))" class="execution-time">
                  <el-tooltip :content="`执行时间: ${row.reminderTime || (row.scheduleRule.executionTimes && row.scheduleRule.executionTimes[0])}`" placement="top">
                    <span>
                      <el-icon size="12"><Clock /></el-icon>
                      {{ row.reminderTime || (row.scheduleRule.executionTimes && row.scheduleRule.executionTimes[0]) || '未设置' }}
                    </span>
                  </el-tooltip>
                </span>
              </div>
            </div>
          </template>
        </el-table-column>

        <el-table-column prop="priority" label="优先级" width="100">
          <template #default="{ row }">
            <el-tag
              :type="getPriorityTagType(row.priority)"
              size="small"
            >
              {{ getPriorityLabel(row.priority) }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag
              :type="getStatusTagType(row.status)"
              size="small"
            >
              {{ getStatusLabel(row.status) }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column label="调度规则" min-width="250">
          <template #default="{ row }">
            <div class="schedule-rules">
              <el-tag
                v-if="row.schedule_rule || row.scheduleRule"
                size="small"
                class="rule-tag"
                :type="getScheduleRuleType(row.schedule_rule || row.scheduleRule)"
              >
                {{ getScheduleRuleLabel(row.schedule_rule || row.scheduleRule) }}
              </el-tag>
              <span v-else class="text-muted">未设置</span>
            </div>
          </template>
        </el-table-column>

        <el-table-column prop="groupName" label="群组" width="120" />

        <el-table-column prop="nextExecution" label="下次执行" width="180" sortable>
          <template #default="{ row }">
            <span v-if="row.nextExecution">
              {{ formatDateTime(row.nextExecution) }}
            </span>
            <span v-else class="text-muted">未计划</span>
          </template>
        </el-table-column>

        <el-table-column prop="createdAt" label="创建时间" width="180" sortable>
          <template #default="{ row }">
            {{ formatDateTime(row.createdAt) }}
          </template>
        </el-table-column>

        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-space wrap>
              <el-button
                size="small"
                type="primary"
                link
                @click="editTask(row)"
              >
                <el-icon><Edit /></el-icon>
                编辑
              </el-button>
              
              <el-dropdown @command="handleTaskAction">
                <el-button size="small" type="info" link>
                  更多
                  <el-icon><ArrowDown /></el-icon>
                </el-button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item :command="{ action: 'duplicate', task: row }">
                      <el-icon><CopyDocument /></el-icon>
                      复制任务
                    </el-dropdown-item>
                    <el-dropdown-item :command="{ action: 'associations', task: row }">
                      <el-icon><Connection /></el-icon>
                      任务关联
                    </el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </el-space>
          </template>
        </el-table-column>
      </el-table>

      <!-- 移动端卡片视图 -->
      <div class="mobile-card-list" v-loading="loading">
        <div 
          v-for="task in paginatedTasks" 
          :key="task.id"
          class="mobile-card-item"
          :class="{ selected: selectedTasks.find(t => t.id === task.id) }"
        >
          <!-- 选择框 -->
          <div class="card-select">
            <el-checkbox
              :model-value="!!selectedTasks.find(t => t.id === task.id)"
              @change="(checked) => handleMobileTaskSelect(task, checked)"
            />
          </div>
          
          <div class="card-header">
            <div class="card-title">{{ task.name }}</div>
            <div class="card-status">
              <el-tag
                :type="getStatusTagType(task.status)"
                size="small"
              >
                {{ getStatusLabel(task.status) }}
              </el-tag>
            </div>
          </div>
          
          <div class="card-content">
            <div class="card-field">
              <span class="field-label">任务类型</span>
              <span class="field-value">
                <el-tag
                  :type="task.type === 'worksheet' ? 'success' : 'primary'"
                  size="small"
                >
                  <el-icon>
                    <component :is="task.type === 'worksheet' ? 'Document' : 'Clock'" />
                  </el-icon>
                  {{ task.type === 'worksheet' ? '工作表任务' : '简单任务' }}
                </el-tag>
              </span>
            </div>
            
            <div class="card-field">
              <span class="field-label">优先级</span>
              <span class="field-value">
                <el-tag
                  :type="getPriorityTagType(task.priority)"
                  size="small"
                >
                  {{ getPriorityLabel(task.priority) }}
                </el-tag>
              </span>
            </div>
            
            <div class="card-field">
              <span class="field-label">调度规则</span>
              <span class="field-value">
                <el-tag
                  v-if="task.schedule_rule || task.scheduleRule"
                  size="small"
                  :type="getScheduleRuleType(task.schedule_rule || task.scheduleRule)"
                >
                  {{ getScheduleRuleLabel(task.schedule_rule || task.scheduleRule) }}
                </el-tag>
                <span v-else class="text-muted">未设置</span>
              </span>
            </div>
            
            <div class="card-field">
              <span class="field-label">群组</span>
              <span class="field-value">{{ task.groupName }}</span>
            </div>
            
            <div class="card-field" v-if="task.nextExecution">
              <span class="field-label">下次执行</span>
              <span class="field-value">{{ formatDateTime(task.nextExecution) }}</span>
            </div>
            
            <div class="card-field">
              <span class="field-label">创建时间</span>
              <span class="field-value">{{ formatDateTime(task.createdAt) }}</span>
            </div>
            
            <!-- 关联任务标签 -->
            <div class="card-field" v-if="task.associations && task.associations.length > 0">
              <span class="field-label">关联任务</span>
              <span class="field-value">
                <el-tag size="small" type="info">
                  关联{{ task.associations.length }}
                </el-tag>
              </span>
            </div>
          </div>
          
          <!-- 操作按钮 -->
          <div class="card-actions">
            <el-button
              size="small"
              type="primary"
              @click="editTask(task)"
            >
              <el-icon><Edit /></el-icon>
              编辑
            </el-button>
            
            <el-dropdown @command="handleTaskAction" trigger="click" class="mobile-action-dropdown">
              <el-button size="small" type="info">
                更多
                <el-icon><ArrowDown /></el-icon>
              </el-button>
              <template #dropdown>
                <el-dropdown-menu class="mobile-action-menu">
                  <el-dropdown-item :command="{ action: 'duplicate', task: task }">
                    <el-icon><CopyDocument /></el-icon>
                    复制任务
                  </el-dropdown-item>
                  <el-dropdown-item :command="{ action: 'associations', task: task }">
                    <el-icon><Connection /></el-icon>
                    任务关联
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
        </div>
        
        <!-- 空状态 -->
        <div v-if="!paginatedTasks.length && !loading" class="empty-state">
          <el-empty description="暂无任务数据" />
        </div>
      </div>

      <!-- 分页 -->
      <div class="pagination-container">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :page-sizes="[10, 20, 50, 100]"
          :total="filteredTasks.length"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="handleSizeChange"
          @current-change="handleCurrentChange"
        />
      </div>
    </el-card>

    <!-- 创建/编辑任务对话框 -->
    <TaskEditor
      v-if="showCreateTask || editingTask"
      :visible="showCreateTask || !!editingTask"
      :task="editingTask"
      :available-groups="availableGroups"
      @close="handleTaskEditorClose"
      @save="handleTaskSave"
      :key="editingTask?.id || 'create'"
    />

    <!-- 任务关联管理对话框 -->
    <TaskAssociationDialog
      v-if="showAssociations"
      :visible="showAssociations"
      :task="selectedTask"
      :all-tasks="tasks"
      @close="showAssociations = false"
      @save="handleAssociationsSave"
    />

    <!-- 单个任务执行计划查看对话框 -->
    <ExecutionPlanDialog
      v-if="showExecutionPlans"
      :visible="showExecutionPlans"
      :task="selectedTask"
      @close="showExecutionPlans = false"
    />

    <!-- 全局执行计划对话框 -->
    <GlobalExecutionPlanDialog
      v-if="showGlobalPlans"
      :visible="showGlobalPlans"
      @close="showGlobalPlans = false"
    />
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { extractArrayData } from '@/utils/apiHelper'
import {
  Plus, Search, Refresh, Edit, View, MoreFilled,
  CollectionTag, CircleCheck, AlarmClock, Connection,
  VideoPause, VideoPlay, CaretRight, ArrowDown,
  CopyDocument, Clock, Calendar, Delete, Document
} from '@element-plus/icons-vue'

import TaskEditor from '@/components/TaskEditorOptimized.vue'
import TaskAssociationDialog from '@/components/TaskAssociationDialog.vue'
import ExecutionPlanDialog from '@/components/ExecutionPlanDialog.vue'
import GlobalExecutionPlanDialog from '@/components/GlobalExecutionPlanDialog.vue'

// 使用V2 API - 完整的任务管理功能
import tasksV2API from '@/api/modules/tasks-unified'
import { groupsApi as groupAPI } from '@/api/modules/groups'
import { taskAPI, taskAssociationAPI } from '@/api/modules/tasks-unified' // 导入统计API和关联API

// 使用V2 API
const tasksAPI = tasksV2API
import { formatDateTime } from '@/utils/date'

// 响应式数据
const loading = ref(false)
const tasks = ref([])
const availableGroups = ref([])
const selectedTasks = ref([]) // 添加选中任务数组
const statistics = reactive({
  totalTasks: 0,
  activeTasks: 0,
  scheduledToday: 0,
  associatedTasks: 0
})

// 统计数据加载状态
const statisticsLoading = ref(false)

// 自动刷新定时器
let refreshTimer = null
const autoRefreshInterval = 30000 // 30秒自动刷新
const enableAutoRefresh = ref(true) // 是否启用自动刷新

// 筛选和搜索
const searchQuery = ref('')
const statusFilter = ref('')
const priorityFilter = ref('')
const groupFilter = ref('')

// 分页
const currentPage = ref(1)
const pageSize = ref(20)

// 对话框状态
const showCreateTask = ref(false)
const editingTask = ref(null)
const showAssociations = ref(false)
const showExecutionPlans = ref(false)
const showGlobalPlans = ref(false)
const selectedTask = ref(null)

// 计算属性
const filteredTasks = computed(() => {
  let result = tasks.value

  // 搜索过滤
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter(task =>
      task.name.toLowerCase().includes(query) ||
      (task.description && task.description.toLowerCase().includes(query))
    )
  }

  // 状态过滤
  if (statusFilter.value) {
    result = result.filter(task => task.status === statusFilter.value)
  }

  // 优先级过滤
  if (priorityFilter.value) {
    result = result.filter(task => task.priority === priorityFilter.value)
  }

  // 群组过滤
  if (groupFilter.value) {
    result = result.filter(task => task.groupId === groupFilter.value)
  }

  return result
})

const paginatedTasks = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  const end = start + pageSize.value
  return filteredTasks.value.slice(start, end)
})

// 方法
const loadTasks = async () => {
  loading.value = true
  try {
    console.log('正在加载V2任务数据...')
    
    const response = await tasksAPI.getTaskList({
      page: 1,
      limit: 1000,
      sortBy: 'createdAt',
      sortOrder: 'desc'
    })
    
    console.log('V2任务API响应:', response)
    console.log('API响应数据结构检查:', {
      hasSuccess: !!response.success,
      hasData: !!response.data,
      hasTasks: !!response.tasks,
      dataType: typeof response.data,
      isArray: Array.isArray(response)
    })
    
    // 处理V2 API响应格式
    let taskList = []
    
    console.log('API响应基本信息:', {
      status: response?.status,
      hasData: !!response?.data,
      dataKeys: response?.data ? Object.keys(response.data) : []
    })
    
    // Axios包装后的响应格式: response.data 包含实际API数据
    const apiData = response.data || response
    
    console.log('提取的API数据:', {
      hasApiData: !!apiData,
      hasSuccess: !!apiData?.success,
      successValue: apiData?.success,
      hasData: !!apiData?.data,
      hasTasks: !!apiData?.data?.tasks,
      tasksCount: apiData?.data?.tasks?.length
    })
    
    // V2 API标准格式: { success: true, data: [], pagination: {} }
    if (apiData && apiData.success === true && Array.isArray(apiData.data)) {
      taskList = apiData.data
      console.log('✅ V2 API标准格式解析成功，任务数量:', taskList.length)
    }
    // 兼容格式：apiData.data包含任务数组
    else if (apiData && apiData.data && Array.isArray(apiData.data.tasks)) {
      taskList = apiData.data.tasks
      console.log('✅ V2 API兼容格式（data.tasks），任务数量:', taskList.length)  
    }
    // 兼容格式：apiData.tasks直接存在
    else if (apiData && Array.isArray(apiData.tasks)) {
      taskList = apiData.tasks
      console.log('✅ 兼容格式（response.tasks），任务数量:', taskList.length)
    }
    // 兼容格式：apiData直接是数组
    else if (Array.isArray(apiData)) {
      taskList = apiData
      console.log('✅ 直接数组格式，任务数量:', taskList.length)
    }
    else {
      console.error('❌ 无法解析任务数据，响应格式未知')
      console.log('问题分析:', {
        响应存在: !!response,
        API数据存在: !!apiData,
        成功标志: apiData?.success,
        数据容器: !!apiData?.data,
        任务数组: Array.isArray(apiData?.data),
        任务数量: apiData?.data?.length || 0
      })
      taskList = []
    }
    
    // 处理任务数据，确保包含必要字段
    tasks.value = taskList.map(task => ({
      ...task,
      groupId: task.group?.id || task.groupId || task.group_id, // 添加groupId映射
      groupName: task.group?.name || task.groupName || task.group_name || '未知群组', // 从group对象获取name
      // 注意：后端返回的是 schedule_rule（单数），不是复数
      scheduleRule: task.schedule_rule || task.scheduleRule,
      scheduleRules: task.schedule_rules || task.scheduleRules || [],
      nextExecution: task.nextRunAt || task.nextExecution || task.next_execution, // 添加nextRunAt映射
      createdAt: task.created_at || task.createdAt,
      associations: task.associations || [],
      // 添加工作表名称字段
      worksheetName: task.fileConfig?.worksheet || task.fileConfig?.worksheetName || null
    }))
    
    console.log('处理后的任务数据示例:', tasks.value[0])
    
    // 更新统计数据
    updateStatistics()
    
    // 成功加载任务后，加载关联信息
    if (tasks.value && tasks.value.length > 0) {
      console.log('开始加载任务关联信息...')
      await loadTaskAssociations()
    }
    
  } catch (error) {
    console.error('加载任务失败:', error)
    // 如果API失败，显示空列表而不是错误（用户可能没有任务）
    tasks.value = []
    updateStatistics()
    
    // 只在非404错误时显示错误消息
    if (error.response?.status !== 404) {
      console.warn('V2任务API调用失败，显示空列表:', error.message)
    }
  } finally {
    loading.value = false
  }
}

// 加载任务关联信息
const loadTaskAssociations = async () => {
  try {
    if (!tasks.value || tasks.value.length === 0) {
      console.log('没有任务，跳过加载关联信息')
      return
    }
    
    console.log(`开始为 ${tasks.value.length} 个任务加载关联信息...`)
    
    // 批量获取所有任务的关联信息
    const associationPromises = tasks.value.map(async (task) => {
      try {
        console.log(`正在获取任务 ${task.name} (${task.id}) 的关联信息...`)
        const response = await taskAssociationAPI.getTaskAssociations(task.id)
        console.log(`任务 ${task.name} 的关联响应:`, response)
        
        // 处理Axios响应格式
        const apiData = response.data || response
        console.log(`任务 ${task.name} 的API数据:`, apiData)
        
        if (apiData && apiData.success && apiData.data) {
          console.log(`任务 ${task.name} 找到 ${apiData.data.length} 个关联`)
          return { taskId: task.id, associations: apiData.data }
        }
        return { taskId: task.id, associations: [] }
      } catch (error) {
        console.warn(`获取任务${task.id}的关联信息失败:`, error)
        return { taskId: task.id, associations: [] }
      }
    })
    
    const associationResults = await Promise.all(associationPromises)
    
    // 更新任务数据，添加关联信息
    tasks.value = tasks.value.map(task => {
      const taskAssociations = associationResults.find(r => r.taskId === task.id)
      const associations = taskAssociations ? taskAssociations.associations : []
      console.log(`任务 ${task.name} 有 ${associations.length} 个关联`)
      return {
        ...task,
        associations: associations
      }
    })
    
    console.log('任务关联信息加载完成，更新后的任务:', tasks.value)
  } catch (error) {
    console.error('加载任务关联信息失败:', error)
  }
}

const loadGroups = async () => {
  try {
    const response = await groupAPI.getGroups()
    // 使用统一的数据提取函数
    const groups = extractArrayData(response, 'groups')
    
    // 过滤出有效的群组（必须有id和name）
    availableGroups.value = groups.filter(g => g && g.id && g.name)
    
    if (availableGroups.value.length === 0) {
      console.warn('没有可用的群组数据，响应:', response)
      // 尝试重新加载一次
      setTimeout(async () => {
        try {
          const retryResponse = await groupAPI.getGroups()
          const retryGroups = extractArrayData(retryResponse, 'groups')
          availableGroups.value = retryGroups.filter(g => g && g.id && g.name)
        } catch (e) {
          console.error('重试加载群组失败:', e)
        }
      }, 1000)
    } else {
      console.log('成功加载群组:', availableGroups.value.length, '个')
    }
  } catch (error) {
    console.error('加载群组失败:', error)
    ElMessage.warning('加载群组列表失败，请稍后重试')
    // 确保始终有值，避免组件错误
    availableGroups.value = []
  }
}

// 从后端获取统计数据（暂时禁用，改用本地计算）
const fetchStatistics = async () => {
  // 暂时直接使用本地计算，避免API问题
  updateStatisticsLocally()
  return
  
  // 以下代码暂时注释
  /*
  try {
    statisticsLoading.value = true
    const response = await taskAPI.getTaskStatistics()
    const data = response.data?.data || response.data || {}
    
    // 更新统计数据
    statistics.totalTasks = data.total || 0
    statistics.activeTasks = data.byStatus?.active || 0
    statistics.scheduledToday = data.today?.scheduled || 0
    statistics.associatedTasks = data.associated || 0
    
  } catch (error) {
    console.error('获取统计数据失败:', error)
    // 失败时使用本地计算作为降级方案
    updateStatisticsLocally()
  } finally {
    statisticsLoading.value = false
  }
  */
}

// 本地计算统计（降级方案）
const updateStatisticsLocally = () => {
  statistics.totalTasks = tasks.value.length
  statistics.activeTasks = tasks.value.filter(t => t.status === 'active').length
  statistics.scheduledToday = tasks.value.filter(t => 
    t.nextExecution && 
    new Date(t.nextExecution).toDateString() === new Date().toDateString()
  ).length
  statistics.associatedTasks = tasks.value.filter(t => 
    t.associations && t.associations.length > 0
  ).length
}

// 旧updateStatistics改为调用fetchStatistics
const updateStatistics = () => {
  fetchStatistics()
}

const refreshTasks = async () => {
  await Promise.all([
    loadTasks(),
    fetchStatistics()
  ])
  ElMessage.success('数据已刷新')
}

// 启动自动刷新
const startAutoRefresh = () => {
  if (!enableAutoRefresh.value) return
  
  stopAutoRefresh() // 先清除已有定时器
  refreshTimer = setInterval(async () => {
    if (document.visibilityState === 'visible') {
      // 只在页面可见时刷新，使用静默错误处理
      try {
        await loadTasks()
      } catch (error) {
        console.error('自动刷新任务失败:', error)
      }
      
      try {
        await fetchStatistics()
      } catch (error) {
        console.error('自动刷新统计失败:', error)
      }
    }
  }, autoRefreshInterval)
}

// 停止自动刷新
const stopAutoRefresh = () => {
  if (refreshTimer) {
    clearInterval(refreshTimer)
    refreshTimer = null
  }
}

// 切换自动刷新
const toggleAutoRefresh = () => {
  enableAutoRefresh.value = !enableAutoRefresh.value
  if (enableAutoRefresh.value) {
    startAutoRefresh()
    ElMessage.success('已启用自动刷新')
  } else {
    stopAutoRefresh()
    ElMessage.info('已停止自动刷新')
  }
}

// 页面可见性变化处理
const handleVisibilityChange = () => {
  if (document.visibilityState === 'visible' && enableAutoRefresh.value) {
    // 页面变为可见时立即刷新一次
    refreshTasks()
  }
}

const handleSearch = () => {
  currentPage.value = 1
}

const handleFilter = () => {
  currentPage.value = 1
}

const handleSortChange = ({ prop, order }) => {
  // 实现排序逻辑
  if (order === 'ascending') {
    tasks.value.sort((a, b) => (a[prop] > b[prop] ? 1 : -1))
  } else if (order === 'descending') {
    tasks.value.sort((a, b) => (a[prop] < b[prop] ? 1 : -1))
  }
}

const handleSizeChange = (size) => {
  pageSize.value = size
  currentPage.value = 1
}

const handleCurrentChange = (page) => {
  currentPage.value = page
}

const editTask = (task) => {
  console.log('编辑任务 - 原始数据:', task)
  
  // 将后端返回的下划线命名转换为前端期望的驼峰命名
  const editData = {
    ...task,
    id: task.id,
    name: task.name,
    description: task.description,
    priority: task.priority,
    status: task.status,
    groupId: task.group_id || task.groupId,
    messageContent: task.message_content || task.messageContent,
    scheduleRule: task.schedule_rule || task.scheduleRule,
    fileConfig: task.file_config || task.fileConfig,
    contentSource: task.content_source || task.contentSource || (task.file_config ? 'worksheet' : 'manual'),
    reminderTime: task.reminder_time || task.reminderTime || (task.schedule_rule?.executionTime || '09:00'),
    effectiveDate: task.effective_date || task.effectiveDate,
    expiryDate: task.expiry_date || task.expiryDate,
    enableRetry: task.enable_retry !== undefined ? task.enable_retry : (task.enableRetry !== false),
    enableLogging: task.enable_logging || task.enableLogging || false,
    createdAt: task.created_at || task.createdAt,
    updatedAt: task.updated_at || task.updatedAt,
    lastRunAt: task.last_run_at || task.lastRunAt,
    nextRunAt: task.next_run_at || task.nextRunAt
  }
  
  console.log('编辑任务 - 处理后的数据:', editData)
  console.log('scheduleRule内容:', editData.scheduleRule)
  console.log('fileConfig内容:', editData.fileConfig)
  
  editingTask.value = editData
  showCreateTask.value = false // 确保对话框重新打开触发watch
}

const viewExecutionPlans = (task) => {
  selectedTask.value = task
  showExecutionPlans.value = true
}

const showGlobalExecutionPlan = () => {
  showGlobalPlans.value = true
}

const handleTaskAction = async ({ action, task }) => {
  switch (action) {
    case 'toggle':
      await toggleTaskStatus(task)
      break
    case 'duplicate':
      await duplicateTask(task)
      break
    case 'associations':
      console.log('打开任务关联对话框，任务信息:', task)
      selectedTask.value = task
      showAssociations.value = true
      break
  }
}

const executeTask = async (task) => {
  try {
    await ElMessageBox.confirm(
      `确认立即执行任务"${task.name}"吗？`,
      '执行确认',
      {
        confirmButtonText: '确定执行',
        cancelButtonText: '取消',
        type: 'info'
      }
    )
    
    const response = await tasksAPI.executeTask(task.id)
    const result = response.data || response
    
    if (result.success) {
      ElMessage.success('任务执行成功')
      // 刷新任务列表以更新最后执行时间
      await loadTasks()
    } else {
      ElMessage.error('执行失败: ' + (result.error || result.message || '未知错误'))
    }
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('执行失败: ' + (error.message || '网络错误'))
    }
  }
}

const toggleTaskStatus = async (task) => {
  try {
    const response = await tasksAPI.toggleTaskStatus(task.id)
    
    // 处理Axios包装的响应
    const result = response.data || response
    
    if (result.success) {
      // 更新本地状态
      task.status = task.status === 'active' ? 'paused' : 'active'
      ElMessage.success(`任务已${task.status === 'active' ? '激活' : '暂停'}`)
      updateStatistics()
    } else {
      ElMessage.error('操作失败: ' + (result.error || result.message || '未知错误'))
    }
  } catch (error) {
    ElMessage.error('操作失败: ' + error.message)
  }
}

const duplicateTask = async (task) => {
  try {
    const response = await tasksAPI.duplicateTask(task.id, {
      name: `${task.name} (副本)`
    })
    
    // 处理Axios包装的响应
    const result = response.data || response
    
    if (result.success) {
      ElMessage.success('任务复制成功')
      await loadTasks()
    } else {
      ElMessage.error('复制失败: ' + (result.error || result.message || '未知错误'))
    }
  } catch (error) {
    ElMessage.error('复制失败: ' + error.message)
  }
}

const deleteTask = async (task) => {
  try {
    await ElMessageBox.confirm(
      `确认删除任务"${task.name}"吗？此操作不可恢复。`,
      '删除确认',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    
    const response = await tasksAPI.deleteTask(task.id)
    // 处理Axios包装的响应
    const result = response.data || response
    
    if (result.success) {
      ElMessage.success('任务删除成功')
      await loadTasks()
    } else {
      ElMessage.error('删除失败: ' + (result.error || '未知错误'))
    }
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('删除失败: ' + error.message)
    }
  }
}

// 批量操作方法
const handleSelectionChange = (selection) => {
  selectedTasks.value = selection
}

// 移动端任务选择处理
const handleMobileTaskSelect = (task, checked) => {
  if (checked) {
    // 添加到选中列表
    if (!selectedTasks.value.find(t => t.id === task.id)) {
      selectedTasks.value.push(task)
    }
  } else {
    // 从选中列表移除
    const index = selectedTasks.value.findIndex(t => t.id === task.id)
    if (index > -1) {
      selectedTasks.value.splice(index, 1)
    }
  }
}

// 检查任务是否可选择
const checkSelectable = (row) => {
  // 可以根据任务状态或其他条件限制选择
  return true
}

// 批量执行任务
const batchExecuteTasks = async () => {
  try {
    const taskNames = selectedTasks.value.map(t => t.name).slice(0, 3).join('、')
    const moreText = selectedTasks.value.length > 3 ? `等${selectedTasks.value.length}个任务` : ''
    
    await ElMessageBox.confirm(
      `确认立即执行以下任务吗？\n${taskNames}${moreText}`,
      '批量执行确认',
      {
        confirmButtonText: '确定执行',
        cancelButtonText: '取消',
        type: 'info'
      }
    )
    
    loading.value = true
    const taskIds = selectedTasks.value.map(t => t.id)
    const response = await tasksAPI.batchExecuteTasks(taskIds)
    const result = response.data || response
    
    if (result.success) {
      ElMessage.success(`成功执行${result.successCount || taskIds.length}个任务`)
      selectedTasks.value = []
      await loadTasks()
    } else {
      ElMessage.error('批量执行失败: ' + (result.error || result.message || '未知错误'))
    }
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('批量执行失败: ' + (error.message || '网络错误'))
    }
  } finally {
    loading.value = false
  }
}

// 批量切换任务状态
const batchToggleStatus = async () => {
  try {
    const activeCount = selectedTasks.value.filter(t => t.status === 'active').length
    const pausedCount = selectedTasks.value.length - activeCount
    const action = activeCount > pausedCount ? '暂停' : '启用'
    
    await ElMessageBox.confirm(
      `确认批量${action}选中的${selectedTasks.value.length}个任务吗？`,
      `批量${action}确认`,
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    
    loading.value = true
    const taskIds = selectedTasks.value.map(t => t.id)
    const targetStatus = activeCount > pausedCount ? 'paused' : 'active'
    const response = await tasksAPI.batchToggleStatus(taskIds, targetStatus)
    const result = response.data || response
    
    if (result.success) {
      ElMessage.success(`成功${action}${result.successCount || taskIds.length}个任务`)
      selectedTasks.value = []
      await loadTasks()
    } else {
      ElMessage.error(`批量${action}失败: ` + (result.error || '未知错误'))
    }
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('操作失败: ' + error.message)
    }
  } finally {
    loading.value = false
  }
}

// 批量删除任务
const batchDeleteTasks = async () => {
  try {
    await ElMessageBox.confirm(
      `确认删除选中的${selectedTasks.value.length}个任务吗？此操作不可恢复。`,
      '批量删除确认',
      {
        confirmButtonText: '确定删除',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    
    loading.value = true
    const taskIds = selectedTasks.value.map(t => t.id)
    const response = await tasksAPI.batchDeleteTasks(taskIds)
    const result = response.data || response
    
    if (result.success) {
      ElMessage.success(`成功删除${result.successCount || taskIds.length}个任务`)
      selectedTasks.value = []
      await loadTasks()
    } else {
      ElMessage.error('批量删除失败: ' + (result.error || '未知错误'))
    }
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('批量删除失败: ' + error.message)
    }
  } finally {
    loading.value = false
  }
}

const handleTaskEditorClose = () => {
  showCreateTask.value = false
  editingTask.value = null
}

const handleTaskSave = async (taskData) => {
  try {
    console.log('保存任务数据:', taskData)
    
    let response
    if (editingTask.value?.id) {
      response = await tasksAPI.updateTask(editingTask.value.id, taskData)
    } else {
      response = await tasksAPI.createTask(taskData)
    }
    
    console.log('API响应:', response)
    
    // 处理多种响应格式
    const success = response?.success || (response?.data && !response?.error)
    const errorMsg = response?.error || response?.message || response?.data?.error
    
    if (success) {
      ElMessage.success(editingTask.value?.id ? '任务更新成功' : '任务创建成功')
      handleTaskEditorClose()
      console.log('任务创建成功，开始重新加载任务列表...')
      await loadTasks()
      console.log('任务列表重新加载完成，当前任务数量:', tasks.value.length)
    } else {
      // 显示具体错误信息
      const displayError = errorMsg || '未知错误'
      ElMessage.error(`保存失败: ${displayError}`)
    }
  } catch (error) {
    console.error('保存任务异常:', error)
    // 显示更详细的错误信息
    const errorMsg = error?.response?.data?.error || error?.message || '网络错误'
    ElMessage.error(`保存失败: ${errorMsg}`)
  }
}

const handleAssociationsSave = async (associations) => {
  try {
    // 使用简化后的API管理任务关联
    const response = await tasksAPI.manageTaskAssociations(selectedTask.value.id, {
      associations: associations
    })
    
    const result = response.data || response
    
    if (result.success !== false) {
      ElMessage.success('任务覆盖设置保存成功')
      showAssociations.value = false
      selectedTask.value = null
      await loadTasks()
    } else {
      ElMessage.error('保存失败: ' + (result.error || result.message || '未知错误'))
    }
  } catch (error) {
    ElMessage.error('保存失败: ' + error.message)
    // 即使出错也关闭对话框，避免用户困在界面
    showAssociations.value = false
    selectedTask.value = null
  }
}

// 辅助方法
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

const getStatusTagType = (status) => {
  const types = {
    active: 'success',
    paused: 'warning',
    expired: 'info'
  }
  return types[status] || 'success'
}

const getStatusLabel = (status) => {
  const labels = {
    active: '活跃',
    paused: '暂停',
    expired: '已过期'
  }
  return labels[status] || '活跃'
}

const getScheduleRuleLabel = (rule) => {
  if (!rule) return '未设置'
  
  let label = ''
  
  const ruleType = rule.ruleType || rule.rule_type || 'custom'
  const hasMonths = rule.months && rule.months.length > 0 && rule.months.length < 12
  const hasQuarters = rule.quarters && rule.quarters.length > 0
  const weekDayNames = ['日', '一', '二', '三', '四', '五', '六']
  
  // 辅助函数：获取星期名称，处理7转0的情况（有些系统中7代表周日）
  const getWeekdayName = (day) => {
    const d = day === 7 ? 0 : day // 如果是7，转换为0（周日）
    return weekDayNames[d] || '?'
  }
  
  // 处理年间隔前缀
  let yearPrefix = ''
  if (rule.intervalMode && rule.intervalMode.yearInterval !== undefined) {
    const yearInterval = rule.intervalMode.yearInterval
    if (yearInterval === 0) {
      yearPrefix = '今年 '
    } else if (yearInterval === 1) {
      yearPrefix = '每年 '
    } else if (yearInterval > 1) {
      yearPrefix = `每${yearInterval}年 `
    }
  }
  
  // 首先判断是否为复杂规则（根据需求书）
  
  // 复杂规则一：特定月份 + 特定星期几（如：3/9月 每周一/三）
  if (ruleType === 'by_week' && hasMonths) {
    if (hasQuarters) {
      const quarterLabel = rule.quarters.map(q => `Q${q}`).join('/')
      label = quarterLabel
    } else {
      const monthsLabel = rule.months.map(m => `${m}`).join('/')
      label = `${monthsLabel}月`
    }
    if (rule.weekMode && rule.weekMode.weekdays && rule.weekMode.weekdays.length > 0) {
      const days = rule.weekMode.weekdays.map(d => `周${getWeekdayName(d)}`).join('/')
      label += ` ${days}`
    }
  }
  // 复杂规则二：特定月份 + 特定日期（如：1/6/12月 1/15/30号）
  else if (ruleType === 'by_day' && hasMonths) {
    if (hasQuarters) {
      const quarterLabel = rule.quarters.map(q => `Q${q}`).join('/')
      label = quarterLabel
    } else {
      const monthsLabel = rule.months.map(m => `${m}`).join('/')
      label = `${monthsLabel}月`
    }
    if (rule.dayMode && rule.dayMode.type === 'specific_days' && rule.dayMode.days && rule.dayMode.days.length > 0) {
      label += ` ${rule.dayMode.days.join('/')}号`
    } else if (rule.dayMode && rule.dayMode.type === 'nth_weekday') {
      // 第n个星期几（如：每月第二个周三）
      const nthLabels = ['', '第一个', '第二个', '第三个', '第四个', '最后一个']
      const nth = rule.dayMode.nthDay || 1
      const weekday = rule.dayMode.weekday || 0
      label += `的${nthLabels[nth] || `第${nth}个`}周${weekDayNames[weekday]}`
    }
  }
  // 基本规则和间隔规则
  else if (ruleType === 'by_interval') {
    // 间隔规则：每N天/周/月
    if (rule.intervalMode) {
      const interval = rule.intervalMode.value || rule.intervalMode.interval || 1
      const unit = rule.intervalMode.unit || 'days'
      
      const unitLabels = {
        day: '天', days: '天',
        week: '周', weeks: '周',
        month: '个月', months: '个月'
      }
      label = `每${interval}${unitLabels[unit] || unit}`
    } else {
      label = '间隔'
    }
  }
  // 基本规则
  else {
    const typeLabels = {
      by_day: '每天',
      by_week: '每周',
      monthly: '每月',
      yearly: '每年',
      quarterly: '每季度',
      custom: '自定义'
    }
    label = typeLabels[ruleType] || '自定义'
  }
  
  // 添加具体时间或详细信息
  if (ruleType === 'by_day' && !hasMonths) {
    // 基本的每日规则
    if (rule.dayMode) {
      if (rule.dayMode.type === 'specific_days' && rule.dayMode.days && rule.dayMode.days.length > 0) {
        // 每月特定日期
        label = `每月${rule.dayMode.days.join('/')}号`
      } else if (rule.dayMode.type === 'interval' && rule.dayMode.interval) {
        // 间隔天数
        label = `每${rule.dayMode.interval}天`
      }
    }
  } else if (ruleType === 'by_week' && !hasMonths) {
    // 基本的每周规则
    if (rule.weekMode && rule.weekMode.weekdays && rule.weekMode.weekdays.length > 0) {
      const days = rule.weekMode.weekdays.map(d => `周${getWeekdayName(d)}`).join('/')
      label += ` ${days}`
    }
  } else if (ruleType === 'monthly') {
    // 每月规则
    if (rule.dayMode && rule.dayMode.days && rule.dayMode.days.length > 0) {
      label += ` ${rule.dayMode.days.join('/')}号`
    }
  } else if (ruleType === 'yearly') {
    // 每年规则
    if (rule.months && rule.months.length > 0) {
      label += ` ${rule.months.join('/')}月`
    }
    if (rule.dayMode && rule.dayMode.days && rule.dayMode.days.length > 0) {
      label += ` ${rule.dayMode.days.join('/')}号`
    }
  }
  
  // 添加执行时间（所有规则都可能有执行时间）
  if (rule.executionTime) {
    label += ` ${rule.executionTime}`
  } else if (rule.executionTimes && rule.executionTimes.length > 0) {
    if (rule.executionTimes.length === 1) {
      label += ` ${rule.executionTimes[0]}`
    } else {
      label += ` ${rule.executionTimes.join('、')}`
    }
  }
  
  // 添加季度信息（如果没有在上面处理）
  if (hasQuarters && !label.includes('季度')) {
    const quarterLabel = rule.quarters.map(q => `第${q}季度`).join('、')
    label = label.replace('每年', `每年${quarterLabel}`)
  }
  
  // 添加排除设置信息
  if (rule.excludeSettings) {
    const excludes = []
    if (rule.excludeSettings.excludeWeekends) {
      excludes.push('排除周末')
    }
    if (rule.excludeSettings.excludeHolidays) {
      excludes.push('排除节假日')
    }
    if (rule.excludeSettings.specificDates && rule.excludeSettings.specificDates.length > 0) {
      excludes.push(`排除${rule.excludeSettings.specificDates.length}个特定日期`)
    }
    if (excludes.length > 0) {
      label += ` (${excludes.join('、')})`
    }
  }
  
  // 添加年间隔前缀
  if (yearPrefix && label) {
    label = yearPrefix + label
  }
  
  return label || '未设置'
}


// 获取调度规则标签类型（用于不同颜色）
const getScheduleRuleType = (rule) => {
  if (!rule) return 'info'
  
  const ruleType = rule.ruleType || rule.rule_type
  
  // 特殊处理：间隔0年的一次性任务
  if (rule.intervalMode && rule.intervalMode.yearInterval !== undefined) {
    if (rule.intervalMode.yearInterval === 0) {
      return 'danger' // 今年执行（一次性任务）用红色标签
    }
  }
  
  const typeMap = {
    by_day: 'success',
    by_week: 'primary',
    by_interval: 'warning',
    monthly: 'danger',
    yearly: 'info'
  }
  
  return typeMap[ruleType] || 'info'
}

// 初始化函数
const initializeTaskManagement = async () => {
  try {
    await loadGroups()
    
    // 分别处理，避免一个失败影响另一个
    const taskPromise = loadTasks().catch(error => {
      console.error('加载任务失败:', error)
      ElMessage.error('加载任务列表失败')
    })
    
    const statsPromise = fetchStatistics().catch(error => {
      console.error('加载统计失败:', error)
      // 统计失败不影响主功能，静默处理
    })
    
    await Promise.all([taskPromise, statsPromise])
    
    // 启动自动刷新
    startAutoRefresh()
    
    // 监听页面可见性变化
    document.addEventListener('visibilitychange', handleVisibilityChange)
  } catch (error) {
    console.error('初始化失败:', error)
    ElMessage.error('页面初始化失败，请刷新重试')
  }
}

// 生命周期 - 不使用async
onMounted(() => {
  initializeTaskManagement()
})

// 组件卸载时清理
onUnmounted(() => {
  stopAutoRefresh()
  document.removeEventListener('visibilitychange', handleVisibilityChange)
})

// 监听器
watch([statusFilter, priorityFilter, groupFilter], () => {
  handleFilter()
})
</script>

<style scoped>
.task-management {
  padding: 20px;
  min-width: 320px;
  overflow-x: auto;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  flex-wrap: wrap;
  gap: 10px;
}

.header-left h2 {
  margin: 0 0 5px 0;
  color: #303133;
}

.header-left p {
  margin: 0;
  color: #909399;
  font-size: 14px;
}

.stats-row {
  margin-bottom: 20px;
}

.stat-card {
  min-height: 100px;
  height: auto;
  margin-bottom: 10px;
  overflow: hidden;
}

.stat-content {
  display: flex;
  align-items: center;
  padding: 20px;
  height: 100%;
}

.stat-icon {
  width: 60px;
  height: 60px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 15px;
}

.stat-icon.total { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; }
.stat-icon.active { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; }
.stat-icon.scheduled { background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); color: white; }
.stat-icon.associations { background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%); color: white; }

.stat-info {
  flex: 1;
}

.stat-number {
  font-size: 28px;
  font-weight: bold;
  color: #303133;
  margin-bottom: 5px;
}

.stat-label {
  font-size: 14px;
  color: #606266;
}

.filter-card {
  margin-bottom: 20px;
}

.filter-row {
  display: flex;
  align-items: center;
}

.table-card {
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
  overflow-x: auto;
}

/* 表格容器响应式处理 */
.table-card :deep(.el-table) {
  min-width: 800px;
}

/* 移动端适配 */
@media (max-width: 768px) {
  .task-management {
    padding: 10px;
  }
  
  .page-header {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .filter-row {
    flex-direction: column;
  }
  
  .filter-row .el-col {
    margin-bottom: 10px;
  }
  
  .stat-card {
    margin-bottom: 15px;
    min-height: 90px;
    height: auto;
  }
  
  .table-card {
    margin: 0 -10px;
    border-radius: 0;
  }
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.task-name-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}

.task-name {
  font-weight: 500;
}

.association-tag {
  font-size: 12px;
}

.schedule-rules {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.rule-tag {
  font-size: 12px;
}

.text-muted {
  color: #c0c4cc;
}

.pagination-container {
  display: flex;
  justify-content: center;
  margin-top: 20px;
}

.danger-item {
  color: #f56c6c;
}

.danger-item:hover {
  background-color: #fef0f0;
  color: #f56c6c;
}

@media (max-width: 768px) {
  .task-management {
    padding: 10px;
  }
  
  .page-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
  }
  
  .stats-row {
    margin-bottom: 15px;
  }
  
  .stat-card {
    min-height: 80px;
    height: auto;
    margin-bottom: 8px;
  }
  
  .stat-content {
    padding: 15px;
  }
  
  .stat-icon {
    width: 45px;
    height: 45px;
    margin-right: 10px;
  }
  
  .stat-number {
    font-size: 22px;
    margin-bottom: 2px;
  }
  
  .stat-label {
    font-size: 12px;
  }
  
  .filter-row {
    flex-direction: column;
    gap: 10px;
  }
  
  .filter-row .el-col {
    width: 100%;
  }
  
  /* 移动端任务表格优化 */
  .table-card .el-table {
    font-size: 14px;
  }
  
  .table-card .el-table__cell {
    padding: 8px 4px;
  }
  
  /* 确保移动端显示所有任务数据 */
  .el-table__body-wrapper {
    overflow-x: auto;
  }
  
  /* 任务名称列在移动端优化 */
  .task-name {
    font-size: 13px;
    word-break: break-word;
  }
  
  .association-tag {
    font-size: 10px;
  }
}

@media (max-width: 480px) {
  .task-management {
    padding: 8px;
  }
  
  .stat-card {
    min-height: 70px;
    height: auto;
    margin-bottom: 6px;
  }
  
  .stat-content {
    padding: 12px;
  }
  
  .stat-icon {
    width: 40px;
    height: 40px;
    margin-right: 8px;
  }
  
  .stat-number {
    font-size: 20px;
  }
  
  .stat-label {
    font-size: 11px;
  }
}

/* 任务类型显示样式 */
.task-type-cell {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.task-type-info {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-top: 2px;
}

.task-type-info span {
  display: flex;
  align-items: center;
  gap: 4px;
}

.worksheet-name,
.execution-time {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--el-text-color-regular);
}

.worksheet-name {
  color: var(--el-color-success);
}

.execution-time {
  color: var(--el-color-primary);
}

/* 任务类型标签悬停效果 */
.task-type-cell .el-tag {
  transition: all 0.3s ease;
  cursor: default;
}

.task-type-cell .el-tag:hover {
  transform: translateY(-2px);
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
}

/* 活跃任务的强调效果 */
.task-type-cell .el-tag--dark {
  font-weight: 600;
}

/* 信息文本动画 */
.task-type-info span {
  transition: color 0.3s ease;
}

.task-type-info span:hover {
  filter: brightness(1.2);
}

/* 移动端卡片视图样式 */
.mobile-card-list {
  display: none;
}

@media (max-width: 767px) {
  .desktop-table {
    display: none !important;
  }
  
  .mobile-card-list {
    display: block !important;
    margin-top: 16px;
  }
  
  .mobile-card-item {
    background: white;
    border: 1px solid #e4e7ed;
    border-radius: 12px;
    margin-bottom: 16px;
    padding: 16px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    transition: all 0.3s ease;
    position: relative;
    overflow: hidden;
  }
  
  .mobile-card-item.selected {
    border-color: #409eff;
    box-shadow: 0 4px 12px rgba(64, 158, 255, 0.2);
  }
  
  .mobile-card-item.selected::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 3px;
    background: linear-gradient(90deg, #409eff, #66b3ff);
  }
  
  .card-select {
    position: absolute;
    top: 16px;
    right: 16px;
    z-index: 10;
  }
  
  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 16px;
    padding-right: 40px; /* 为选择框留空间 */
  }
  
  .card-title {
    font-size: 16px;
    font-weight: 600;
    color: #303133;
    line-height: 1.5;
    flex: 1;
    margin-right: 8px;
    word-break: break-word;
  }
  
  .card-status {
    flex-shrink: 0;
  }
  
  .card-content {
    margin-bottom: 16px;
  }
  
  .card-field {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding: 8px 0;
    border-bottom: 1px solid #f5f5f5;
    min-height: 32px;
  }
  
  .card-field:last-child {
    border-bottom: none;
  }
  
  .field-label {
    font-size: 13px;
    color: #909399;
    min-width: 70px;
    flex-shrink: 0;
    font-weight: 500;
  }
  
  .field-value {
    font-size: 14px;
    color: #303133;
    text-align: right;
    flex: 1;
    margin-left: 12px;
    word-break: break-word;
  }
  
  .card-actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    justify-content: space-between;
    padding-top: 12px;
    border-top: 1px solid #f5f5f5;
  }
  
  .card-actions .el-button {
    flex: 1;
    min-width: 60px;
    font-size: 12px;
    padding: 8px 12px;
    border-radius: 8px;
  }
  
  .mobile-action-dropdown {
    flex: 1;
  }
  
  .mobile-action-dropdown .el-button {
    width: 100%;
  }
  
  .empty-state {
    padding: 40px 20px;
    text-align: center;
  }
  
  /* 移动端操作菜单优化 */
  .mobile-action-menu .el-dropdown-menu__item {
    padding: 12px 16px;
    font-size: 14px;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  
  .mobile-action-menu .el-dropdown-menu__item .el-icon {
    font-size: 16px;
  }
  
  .mobile-action-menu .danger-item {
    color: #f56c6c;
  }
  
  .mobile-action-menu .danger-item:hover {
    background-color: #fef0f0;
    color: #f56c6c;
  }
}

/* 小屏幕适配 */
@media (max-width: 480px) {
  .card-actions {
    flex-direction: column;
    gap: 6px;
  }
  
  .card-actions .el-button {
    flex: none;
    width: 100%;
  }
  
  .card-field {
    flex-direction: column;
    align-items: stretch;
    gap: 4px;
    padding: 6px 0;
  }
  
  .field-label {
    min-width: auto;
    font-size: 12px;
    margin-bottom: 2px;
  }
  
  .field-value {
    text-align: left;
    margin-left: 0;
  }
  
  .card-title {
    font-size: 15px;
  }
}
</style>