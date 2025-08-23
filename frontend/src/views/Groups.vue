<template>
  <div class="groups">
    <!-- 操作栏 -->
    <el-card class="toolbar-card">
      <div class="toolbar">
        <div class="toolbar-left">
          <el-button type="primary" @click="createGroup" class="create-btn">
            <el-icon><Plus /></el-icon>
            <span class="btn-text">新建群组</span>
          </el-button>
          <div class="batch-actions" v-if="selectedGroups.length > 0">
            <el-button 
              type="success" 
              size="small"
              @click="batchActivate"
              class="batch-btn"
            >
              <el-icon><Check /></el-icon>
              <span class="btn-text">批量激活</span>
            </el-button>
            <el-button 
              type="warning" 
              size="small"
              @click="batchDeactivate"
              class="batch-btn"
            >
              <el-icon><Close /></el-icon>
              <span class="btn-text">批量停用</span>
            </el-button>
          </div>
        </div>
        
        <div class="toolbar-right">
          <div class="filter-group">
            <!-- 群组类型筛选已移除，现在所有群组统一管理 -->
            <el-select 
              v-model="filters.status" 
              placeholder="状态" 
              size="small"
              class="filter-select"
              @change="loadGroups"
            >
              <el-option label="全部状态" value="" />
              <el-option label="活跃" value="active" />
              <el-option label="停用" value="inactive" />
            </el-select>
          </div>
          <el-button @click="loadGroups" size="small" class="refresh-btn">
            <el-icon><Refresh /></el-icon>
            <span class="btn-text">刷新</span>
          </el-button>
        </div>
      </div>
    </el-card>

    <!-- 群组列表 -->
    <el-card>
      <!-- 桌面端表格 -->
      <el-table 
        :data="groups" 
        v-loading="loading"
        @selection-change="handleSelectionChange"
        style="width: 100%"
        class="groups-table"
      >
        <el-table-column type="selection" width="55" />
        
        <el-table-column prop="name" label="群组名称" min-width="150">
          <template #default="{ row }">
            <div class="group-name">
              <strong>{{ row.name }}</strong>
              <div class="group-desc" v-if="row.description">{{ row.description }}</div>
            </div>
          </template>
        </el-table-column>
        
        <!-- 群组类型列已移除，现在所有群组统一显示 -->
        
        <el-table-column prop="status" label="状态" width="80">
          <template #default="{ row }">
            <el-tag :type="row.status === 'active' ? 'success' : 'danger'" size="small">
              {{ row.status === 'active' ? '活跃' : '停用' }}
            </el-tag>
          </template>
        </el-table-column>
        
        <el-table-column prop="today_reminder_count" label="今日提醒" width="80" />
        
        <el-table-column prop="creator_name" label="创建者" width="100" />
        
        <el-table-column prop="created_at" label="创建时间" width="120">
          <template #default="{ row }">
            {{ formatDate(row.created_at) }}
          </template>
        </el-table-column>
        
        <el-table-column label="操作" width="260" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" size="small" @click="editGroup(row)">
              编辑
            </el-button>
            <el-button type="warning" size="small" @click="copyGroup(row)">
              复制
            </el-button>
            <el-button type="success" size="small" @click="testConnection(row)">
              测试
            </el-button>
            <el-button 
              type="danger" 
              size="small" 
              @click="deleteGroup(row)"
              :disabled="row.today_reminder_count > 0"
            >
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
      
      <!-- 移动端卡片列表 -->
      <div class="mobile-card-list" v-loading="loading">
        <div 
          v-for="group in groups" 
          :key="group.id"
          class="mobile-card-item"
        >
          <div class="card-header">
            <div class="card-title">
              <el-checkbox 
                :model-value="selectedGroups.includes(group.id)"
                @change="toggleGroupSelection(group)"
                class="group-checkbox"
              />
              <div class="group-info">
                <strong>{{ group.name }}</strong>
                <div class="group-desc" v-if="group.description">{{ group.description }}</div>
              </div>
            </div>
            <div class="card-actions">
              <el-dropdown class="mobile-action-menu" trigger="click">
                <el-button type="primary" size="small" circle>
                  <el-icon><More /></el-icon>
                </el-button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item @click="editGroup(group)">
                      <el-icon><Edit /></el-icon>
                      编辑群组
                    </el-dropdown-item>
                    <el-dropdown-item @click="copyGroup(group)">
                      <el-icon><CopyDocument /></el-icon>
                      复制群组
                    </el-dropdown-item>
                    <el-dropdown-item @click="testConnection(group)">
                      <el-icon><Connection /></el-icon>
                      测试连接
                    </el-dropdown-item>
                    <el-dropdown-item 
                      @click="deleteGroup(group)"
                      :disabled="group.today_reminder_count > 0"
                    >
                      <el-icon><Delete /></el-icon>
                      删除群组
                    </el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>
          </div>
          <div class="card-content">
            <!-- 群组类型字段已移除，现在所有群组统一显示 -->
            <div class="card-field">
              <span class="field-label">状态</span>
              <el-tag :type="group.status === 'active' ? 'success' : 'danger'" size="small">
                {{ group.status === 'active' ? '活跃' : '停用' }}
              </el-tag>
            </div>
            <div class="card-field">
              <span class="field-label">今日提醒</span>
              <span class="field-value">{{ group.today_reminder_count || 0 }}</span>
            </div>
            <div class="card-field">
              <span class="field-label">创建者</span>
              <span class="field-value">{{ group.creator_name || '-' }}</span>
            </div>
            <div class="card-field">
              <span class="field-label">创建时间</span>
              <span class="field-value">{{ formatDate(group.created_at) }}</span>
            </div>
          </div>
        </div>
        
        <div v-if="!groups.length && !loading" class="no-data">
          <el-empty description="暂无群组数据" />
        </div>
      </div>

      <!-- 分页 -->
      <div class="pagination-wrapper">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.limit"
          :total="pagination.total"
          :page-sizes="[10, 20, 50, 100]"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="loadGroups"
          @current-change="loadGroups"
        />
      </div>
    </el-card>

    <!-- 创建/编辑群组对话框 -->
    <el-dialog 
      :title="editingGroup ? '编辑群组' : '新建群组'"
      v-model="showCreateDialog"
      width="500px"
    >
      <el-form 
        ref="groupFormRef"
        :model="groupForm"
        :rules="groupRules"
        label-width="100px"
      >
        <el-form-item label="群组名称" prop="name">
          <el-input v-model="groupForm.name" placeholder="请输入群组名称" />
        </el-form-item>
        
        <!-- 群组类型选择已移除，现在所有群组统一管理 -->
        
        <el-form-item label="群组描述" prop="description">
          <el-input 
            v-model="groupForm.description" 
            type="textarea" 
            :rows="3"
            placeholder="请输入群组描述"
          />
        </el-form-item>
        
        <el-form-item label="Webhook URL" prop="webhook_url">
          <el-input 
            v-model="groupForm.webhook_url" 
            placeholder="https://oapi.dingtalk.com/robot/send?access_token=..."
          />
          <div class="form-tip">
            请确保Webhook URL是有效的钉钉机器人地址
          </div>
        </el-form-item>
        
        <el-form-item label="加签密钥" prop="secret">
          <el-input 
            v-model="groupForm.secret" 
            type="password"
            show-password
            placeholder="钉钉机器人的加签密钥（可选）"
          />
          <div class="form-tip">
            如果机器人启用了加签安全设置，请输入对应的密钥
          </div>
        </el-form-item>
        
        <el-form-item label="状态" prop="status">
          <el-radio-group v-model="groupForm.status">
            <el-radio value="active">活跃</el-radio>
            <el-radio value="inactive">停用</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      
      <template #footer>
        <el-button @click="cancelDialog">取消</el-button>
        <el-button type="primary" @click="saveGroup" :loading="saving">
          {{ editingGroup ? '更新' : '创建' }}
        </el-button>
      </template>
    </el-dialog>

  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { groupsApi } from '@/api/modules/groups'
import { useSmartRefresh, refreshEvents, pageRefreshConfig } from '@/composables/useRefresh'
import { useTokenSafeApi, commonApiConfigs } from '@/composables/useTokenSafeApi'

// 初始化Token安全API调用
const { safeApiCall } = useTokenSafeApi({
  cacheTimeout: 3000,
  retryAttempts: 2
})

// 数据
const groups = ref([])
const selectedGroups = ref([])
const loading = ref(false)

// 智能刷新配置
const groupsRefreshConfig = {
  ...pageRefreshConfig.groups,
  events: [
    ...pageRefreshConfig.groups.events,
    'group:created',
    'group:updated',
    'group:deleted',
    'groups:changed'
  ]
}

// 初始化智能刷新
const { 
  refresh: smartRefresh, 
  queueRefresh, 
  loading: refreshLoading,
  canRefresh
} = useSmartRefresh({
  ...groupsRefreshConfig,
  fetchFn: async () => {
    await loadGroupsWithSafeApi()
  }
})
const saving = ref(false)
const showCreateDialog = ref(false)
const editingGroup = ref(null)

// 分页
const pagination = reactive({
  page: 1,
  limit: 20,
  total: 0
})

// 筛选
const filters = reactive({
  status: '',
  group_type: ''
})

// 表单
const groupFormRef = ref()
const groupForm = reactive({
  name: '',
  description: '',
  webhook_url: '',
  secret: '',
  status: 'active',
  group_type: 'regular'
})

// 表单验证规则
const groupRules = {
  name: [
    { required: true, message: '请输入群组名称', trigger: 'blur' },
    { min: 2, max: 50, message: '长度在 2 到 50 个字符', trigger: 'blur' }
  ],
  webhook_url: [
    { required: true, message: '请输入Webhook URL', trigger: 'blur' },
    { 
      pattern: /^https:\/\/oapi\.dingtalk\.com/, 
      message: '请输入有效的钉钉Webhook URL', 
      trigger: 'blur' 
    }
  ]
}


// Token安全的群组列表加载
async function loadGroupsWithSafeApi() {
  const params = {
    page: pagination.page,
    limit: pagination.limit,
    ...filters
  }
  
  const response = await safeApiCall(
    () => groupsApi.getGroups(params),
    { ...commonApiConfigs.groupList, key: 'groups-list' }
  )
  
  // 防御性检查：确保response和response.data存在
  if (!response || !response.data) {
    throw new Error('API响应格式错误: 缺少data字段')
  }
  
  // 确保groups数组存在
  if (!Array.isArray(response.data.groups)) {
    throw new Error('API响应格式错误: groups不是数组')
  }
  
  groups.value = response.data.groups
  pagination.total = response.data.total || 0
  console.log(`[Groups] 加载群组列表成功: ${response.data.groups.length}个群组`)
}

// 兼容性保持原有loadGroups函数
async function loadGroups() {
  loading.value = true
  try {
    await loadGroupsWithSafeApi()
  } catch (error) {
    console.error('[Groups] 加载群组列表失败:', error)
    if (!error.code || error.code !== 'AUTH_REQUIRED') {
      ElMessage.error('加载群组列表失败')
    }
  } finally {
    loading.value = false
  }
}

// 处理选择变化
function handleSelectionChange(selection) {
  selectedGroups.value = selection.map(item => item.id)
}

// 切换单个群组选择状态 (移动端用)
function toggleGroupSelection(group) {
  const index = selectedGroups.value.indexOf(group.id)
  if (index > -1) {
    selectedGroups.value.splice(index, 1)
  } else {
    selectedGroups.value.push(group.id)
  }
}

// 创建新群组
function createGroup() {
  resetForm()
  showCreateDialog.value = true
}

// 编辑群组
function editGroup(group) {
  editingGroup.value = group
  Object.assign(groupForm, {
    name: group.name,
    description: group.description || '',
    webhook_url: group.webhookUrl || group.webhook_url || '',  // 兼容驼峰和下划线
    secret: group.secret || '',
    status: group.status,
    group_type: group.groupType || group.group_type || 'regular'  // 兼容驼峰和下划线
  })
  showCreateDialog.value = true
}

// 保存群组
async function saveGroup() {
  if (!groupFormRef.value) return
  
  try {
    await groupFormRef.value.validate()
    saving.value = true
    
    if (editingGroup.value) {
      await groupsApi.updateGroup(editingGroup.value.id, groupForm)
      ElMessage.success('群组更新成功')
      
      // 触发群组更新事件
      refreshEvents.groupUpdated(editingGroup.value.id)
    } else {
      const response = await groupsApi.createGroup(groupForm)
      ElMessage.success('群组创建成功')
      
      // 触发群组创建事件
      refreshEvents.groupCreated({
        groupId: response.data.id,
        groupName: groupForm.name,
        groupType: groupForm.group_type
      })
    }
    
    showCreateDialog.value = false
    resetForm()
    
    // 智能刷新群组列表
    queueRefresh()
    await loadGroups()
  } catch (error) {
    ElMessage.error(editingGroup.value ? '更新群组失败' : '创建群组失败')
  } finally {
    saving.value = false
  }
}

// 重置表单
function resetForm() {
  editingGroup.value = null
  Object.assign(groupForm, {
    name: '',
    description: '',
    webhook_url: '',
    secret: '',
    status: 'active',
    group_type: 'regular'
  })
}

// 取消对话框
function cancelDialog() {
  showCreateDialog.value = false
  resetForm()
}

// 删除群组
async function deleteGroup(group) {
  try {
    await ElMessageBox.confirm(
      `确定要删除群组 "${group.name}" 吗？此操作不可恢复。`,
      '确认删除',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    
    await groupsApi.deleteGroup(group.id)
    ElMessage.success('群组删除成功')
    
    // 触发群组删除事件
    refreshEvents.groupDeleted(group.id)
    
    // 智能刷新群组列表
    queueRefresh()
    
    await loadGroups()
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('删除群组失败')
    }
  }
}

// 测试连接
async function testConnection(group) {
  try {
    loading.value = true
    const response = await groupsApi.testGroup(group.id)
    
    if (response.data.success) {
      ElMessage.success('连接测试成功')
    } else {
      ElMessage.error(`连接测试失败: ${response.data.message}`)
    }
  } catch (error) {
    ElMessage.error('连接测试失败')
  } finally {
    loading.value = false
  }
}


// 批量激活
async function batchActivate() {
  try {
    await groupsApi.batchOperation('activate', selectedGroups.value)
    ElMessage.success(`成功激活 ${selectedGroups.value.length} 个群组`)
    
    // 触发群组批量更新事件
    selectedGroups.value.forEach(groupId => refreshEvents.groupUpdated(groupId))
    refreshEvents.groupsChanged()
    
    // 智能刷新群组列表
    queueRefresh()
    
    await loadGroups()
  } catch (error) {
    ElMessage.error('批量激活失败')
  }
}

// 批量停用
async function batchDeactivate() {
  try {
    await groupsApi.batchOperation('deactivate', selectedGroups.value)
    ElMessage.success(`成功停用 ${selectedGroups.value.length} 个群组`)
    
    // 触发群组批量更新事件
    selectedGroups.value.forEach(groupId => refreshEvents.groupUpdated(groupId))
    refreshEvents.groupsChanged()
    
    // 智能刷新群组列表
    queueRefresh()
    
    await loadGroups()
  } catch (error) {
    ElMessage.error('批量停用失败')
  }
}

// 复制群组
async function copyGroup(group) {
  try {
    const copyName = `${group.name} - 副本`
    
    // 使用确认对话框让用户编辑群组名称
    const result = await ElMessageBox.prompt(
      '请输入复制后的群组名称：',
      '复制群组',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        inputValue: copyName,
        inputValidator: (value) => {
          if (!value || value.trim().length < 2) {
            return '群组名称至少需要2个字符'
          }
          if (value.trim().length > 50) {
            return '群组名称不能超过50个字符'
          }
          return true
        }
      }
    )
    
    const newGroupData = {
      name: result.value.trim(),
      description: group.description ? `${group.description} (复制)` : '',
      webhook_url: group.webhookUrl || group.webhook_url,  // 兼容驼峰和下划线
      secret: group.secret || '',
      status: 'inactive', // 复制的群组默认为停用状态
      group_type: group.groupType || group.group_type || 'regular'  // 兼容驼峰和下划线
    }
    
    await groupsApi.createGroup(newGroupData)
    ElMessage.success('群组复制成功')
    await loadGroups()
    
    // 触发群组复制事件，自动刷新相关组件
    refreshEvents.groupCopied({
      sourceGroupId: group.id,
      sourceGroupName: group.name,
      targetGroupName: result.value.trim(),
      groupType: group.group_type
    })
    
  } catch (error) {
    if (error !== 'cancel') {
      console.error('复制群组失败:', error)
      const errorMessage = error.response?.data?.message || error.message || '复制群组失败'
      ElMessage.error(errorMessage)
    }
  }
}

// 格式化日期
function formatDate(dateString) {
  if (!dateString) return '-'
  return new Date(dateString).toLocaleDateString('zh-CN')
}

// 组件挂载
onMounted(() => {
  console.log('[Groups] 组件已挂载，启用智能刷新')
  
  // 智能刷新系统会自动处理初始数据加载
  console.log('[Groups] 智能刷新状态:', {
    canRefresh: canRefresh.value,
    refreshLoading: refreshLoading.value
  })
})
</script>

<style scoped>
.groups {
  padding: 0;
}

.toolbar-card {
  margin-bottom: 20px;
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
}

.toolbar-left {
  display: flex;
  flex-direction: column;
  gap: 12px;
  flex: 1;
}

.batch-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.toolbar-right {
  display: flex;
  flex-direction: column;
  gap: 12px;
  align-items: flex-end;
}

.filter-group {
  display: flex;
  gap: 8px;
}

.filter-select {
  width: 120px;
}

.group-name strong {
  display: block;
  margin-bottom: 4px;
}

.group-desc {
  font-size: 12px;
  color: #909399;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 200px;
}

/* 移动端卡片样式扩展 */
.mobile-card-item .card-header {
  align-items: flex-start;
}

.mobile-card-item .card-title {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  flex: 1;
}

.group-checkbox {
  margin-top: 2px;
}

.group-info {
  flex: 1;
}

.group-info strong {
  font-size: 16px;
  color: var(--el-text-color-primary);
  margin-bottom: 4px;
}

.mobile-card-item .group-desc {
  font-size: 13px;
  color: var(--el-text-color-regular);
  max-width: none;
  white-space: normal;
  line-height: 1.4;
  margin-top: 4px;
}

.pagination-wrapper {
  margin-top: 20px;
  text-align: right;
}

.form-tip {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
}

.mapping-config {
  max-height: 400px;
  overflow-y: auto;
}

.mapping-tip {
  margin-bottom: 16px;
}

/* 移动端适配 */
@media (max-width: 767px) {
  .groups {
    padding: 0;
  }
  
  /* 工具栏移动端适配 */
  .toolbar {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }
  
  .toolbar-left {
    order: 2;
  }
  
  .toolbar-right {
    order: 1;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
  }
  
  .filter-group {
    flex: 1;
    gap: 6px;
  }
  
  .filter-select {
    width: 100px;
  }
  
  /* 按钮文字在移动端隐藏 */
  .btn-text {
    display: none;
  }
  
  .create-btn {
    width: 100%;
    justify-content: center;
  }
  
  .create-btn .btn-text {
    display: inline;
  }
  
  .batch-actions {
    justify-content: center;
  }
  
  .batch-btn {
    flex: 1;
    min-width: 60px;
  }
  
  /* 分页移动端适配 */
  .pagination-wrapper {
    text-align: center;
    margin-top: 16px;
  }
  
  .pagination-wrapper :deep(.el-pagination) {
    justify-content: center;
  }
  
  .pagination-wrapper :deep(.el-pagination .el-pager) {
    flex-wrap: wrap;
  }
  
  /* 对话框移动端适配 */
  .el-dialog {
    width: calc(100vw - 20px) !important;
    margin: 10px !important;
  }
  
  /* 表单移动端优化 */
  .form-tip {
    font-size: 11px;
    line-height: 1.4;
  }
}

/* 平板端适配 */
@media (min-width: 768px) and (max-width: 991px) {
  .toolbar {
    flex-direction: row;
    align-items: center;
  }
  
  .toolbar-left {
    flex-direction: row;
    align-items: center;
  }
  
  .toolbar-right {
    flex-direction: row;
    align-items: center;
  }
  
  .filter-select {
    width: 100px;
  }
  
  .batch-btn .btn-text {
    display: none;
  }
}

/* 大屏幕优化 */
@media (min-width: 1200px) {
  .filter-select {
    width: 140px;
  }
  
  .group-desc {
    max-width: 300px;
  }
}
</style>