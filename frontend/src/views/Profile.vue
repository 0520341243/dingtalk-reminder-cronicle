<template>
  <div class="profile">
    <el-row :gutter="20" class="profile-main-row">
      <!-- 用户信息 -->
      <el-col :xs="24" :sm="24" :md="12">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>个人信息</span>
              <el-button type="primary" size="small" @click="loadProfile">
                <el-icon><Refresh /></el-icon>
                刷新
              </el-button>
            </div>
          </template>
          
          <div class="profile-info" v-if="profile">
            <div class="avatar-section">
              <el-avatar :size="80" class="profile-avatar">
                <el-icon><User /></el-icon>
              </el-avatar>
              <div class="avatar-info">
                <h3 class="username">{{ profile.username }}</h3>
                <el-tag :type="getRoleType(profile.role)" size="small">
                  {{ getRoleText(profile.role) }}
                </el-tag>
              </div>
            </div>
            
            <el-descriptions :column="1" border class="profile-details">
              <el-descriptions-item label="用户名">
                {{ profile.username }}
              </el-descriptions-item>
              <el-descriptions-item label="邮箱">
                {{ profile.email || '未设置' }}
              </el-descriptions-item>
              <el-descriptions-item label="角色">
                <el-tag :type="getRoleType(profile.role)">
                  {{ getRoleText(profile.role) }}
                </el-tag>
              </el-descriptions-item>
              <el-descriptions-item label="注册时间">
                {{ formatDateTime(profile.created_at) }}
              </el-descriptions-item>
            </el-descriptions>
            
            <!-- 统计信息 -->
            <div class="user-stats" v-if="userStats">
              <h4>我的统计</h4>
              <el-row :gutter="16" class="stats-row">
                <el-col :xs="24" :sm="8" :md="8">
                  <div class="stat-item">
                    <div class="stat-value">{{ userStats.groups_count || 0 }}</div>
                    <div class="stat-label">管理群组</div>
                  </div>
                </el-col>
                <el-col :xs="24" :sm="8" :md="8">
                  <div class="stat-item">
                    <div class="stat-value">{{ userStats.files_count || 0 }}</div>
                    <div class="stat-label">上传文件</div>
                  </div>
                </el-col>
                <el-col :xs="24" :sm="8" :md="8">
                  <div class="stat-item">
                    <div class="stat-value">{{ userStats.reminders_count || 0 }}</div>
                    <div class="stat-label">任务总数</div>
                  </div>
                </el-col>
              </el-row>
            </div>
          </div>
          
          <div v-else class="no-profile">
            <el-empty description="加载用户信息失败" />
          </div>
        </el-card>
      </el-col>
      
      <!-- 修改密码 -->
      <el-col :xs="24" :sm="24" :md="12">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>修改密码</span>
            </div>
          </template>
          
          <el-form 
            ref="passwordFormRef"
            :model="passwordForm"
            :rules="passwordRules"
            label-width="100px"
          >
            <el-form-item label="原密码" prop="oldPassword">
              <el-input
                v-model="passwordForm.oldPassword"
                type="password"
                placeholder="请输入原密码"
                show-password
              />
            </el-form-item>
            
            <el-form-item label="新密码" prop="newPassword">
              <el-input
                v-model="passwordForm.newPassword"
                type="password"
                placeholder="请输入新密码"
                show-password
              />
              <div class="form-tip">密码长度至少6位</div>
            </el-form-item>
            
            <el-form-item label="确认密码" prop="confirmPassword">
              <el-input
                v-model="passwordForm.confirmPassword"
                type="password"
                placeholder="请再次输入新密码"
                show-password
              />
            </el-form-item>
            
            <el-form-item>
              <el-button 
                type="primary" 
                @click="changePassword" 
                :loading="changingPassword"
              >
                <el-icon><Lock /></el-icon>
                修改密码
              </el-button>
              <el-button @click="resetPasswordForm">
                重置
              </el-button>
            </el-form-item>
          </el-form>
        </el-card>
      </el-col>
    </el-row>
    
    <!-- 用户管理 (仅管理员) -->
    <el-row :gutter="20" class="admin-row" v-if="isAdmin">
      <el-col :span="24">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>用户管理</span>
              <el-button type="primary" @click="showCreateUserDialog = true">
                <el-icon><Plus /></el-icon>
                新建用户
              </el-button>
            </div>
          </template>
          
          <!-- 桌面端表格 -->
          <el-table :data="users" v-loading="usersLoading" style="width: 100%" class="users-table">
            <el-table-column prop="id" label="ID" width="60" />
            <el-table-column prop="username" label="用户名" />
            <el-table-column prop="email" label="邮箱">
              <template #default="{ row }">
                {{ row.email || '未设置' }}
              </template>
            </el-table-column>
            <el-table-column prop="role" label="角色" width="100">
              <template #default="{ row }">
                <el-tag :type="getRoleType(row.role)">
                  {{ getRoleText(row.role) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="created_at" label="注册时间" width="140">
              <template #default="{ row }">
                {{ formatDateTime(row.created_at) }}
              </template>
            </el-table-column>
            <el-table-column label="操作" width="120">
              <template #default="{ row }">
                <el-button 
                  type="danger" 
                  size="small" 
                  @click="deleteUser(row)"
                  :disabled="row.id === profile?.id"
                >
                  删除
                </el-button>
              </template>
            </el-table-column>
          </el-table>
          
          <!-- 移动端卡片列表 -->
          <div class="mobile-card-list" v-loading="usersLoading">
            <div 
              v-for="user in users" 
              :key="user.id"
              class="mobile-card-item"
            >
              <div class="card-header">
                <div class="card-title">{{ user.username }}</div>
                <div class="card-actions">
                  <el-button 
                    type="danger" 
                    size="small" 
                    @click="deleteUser(user)"
                    :disabled="user.id === profile?.id"
                  >
                    删除
                  </el-button>
                </div>
              </div>
              <div class="card-content">
                <div class="card-field">
                  <span class="field-label">ID</span>
                  <span class="field-value">{{ user.id }}</span>
                </div>
                <div class="card-field">
                  <span class="field-label">邮箱</span>
                  <span class="field-value">{{ user.email || '未设置' }}</span>
                </div>
                <div class="card-field">
                  <span class="field-label">角色</span>
                  <el-tag :type="getRoleType(user.role)" size="small">
                    {{ getRoleText(user.role) }}
                  </el-tag>
                </div>
                <div class="card-field">
                  <span class="field-label">注册时间</span>
                  <span class="field-value">{{ formatDateTime(user.created_at) }}</span>
                </div>
              </div>
            </div>
            
            <div v-if="!users.length && !usersLoading" class="no-data">
              <el-empty description="暂无用户数据" />
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 新建用户对话框 -->
    <el-dialog 
      title="新建用户"
      v-model="showCreateUserDialog"
      width="500px"
    >
      <el-form 
        ref="createUserFormRef"
        :model="createUserForm"
        :rules="createUserRules"
        label-width="100px"
      >
        <el-form-item label="用户名" prop="username">
          <el-input v-model="createUserForm.username" placeholder="请输入用户名" />
        </el-form-item>
        
        <el-form-item label="邮箱" prop="email">
          <el-input v-model="createUserForm.email" placeholder="请输入邮箱" />
        </el-form-item>
        
        <el-form-item label="密码" prop="password">
          <el-input 
            v-model="createUserForm.password" 
            type="password"
            placeholder="请输入密码"
            show-password
          />
          <div class="form-tip">密码长度至少6位</div>
        </el-form-item>
        
        <el-form-item label="角色" prop="role">
          <el-radio-group v-model="createUserForm.role">
            <el-radio value="user">普通用户</el-radio>
            <el-radio value="admin">管理员</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      
      <template #footer>
        <el-button @click="showCreateUserDialog = false">取消</el-button>
        <el-button type="primary" @click="createUser" :loading="creatingUser">
          创建
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useAuthStore } from '@/stores/auth'
import { authApi } from '@/api/modules/auth'
import { groupsApi } from '@/api/modules/groups'
import { filesApi } from '@/api/modules/files'
import { v2TasksAPI as tasksApi } from '@/api/modules/tasks-unified'

const authStore = useAuthStore()

// 数据
const profile = ref(null)
const userStats = ref({})
const users = ref([])
const changingPassword = ref(false)
const usersLoading = ref(false)
const creatingUser = ref(false)
const showCreateUserDialog = ref(false)

// 计算属性
const isAdmin = computed(() => authStore.isAdmin)

// 修改密码表单
const passwordFormRef = ref()
const passwordForm = reactive({
  oldPassword: '',
  newPassword: '',
  confirmPassword: ''
})

// 新建用户表单
const createUserFormRef = ref()
const createUserForm = reactive({
  username: '',
  email: '',
  password: '',
  role: 'user'
})

// 表单验证规则
const passwordRules = {
  oldPassword: [
    { required: true, message: '请输入原密码', trigger: 'blur' }
  ],
  newPassword: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    { min: 6, message: '密码长度至少6位', trigger: 'blur' }
  ],
  confirmPassword: [
    { required: true, message: '请再次输入新密码', trigger: 'blur' },
    {
      validator: (rule, value, callback) => {
        if (value !== passwordForm.newPassword) {
          callback(new Error('两次输入密码不一致'))
        } else {
          callback()
        }
      },
      trigger: 'blur'
    }
  ]
}

const createUserRules = {
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' },
    { min: 3, max: 20, message: '用户名长度在3到20个字符', trigger: 'blur' }
  ],
  email: [
    { type: 'email', message: '请输入正确的邮箱格式', trigger: 'blur' }
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, message: '密码长度至少6位', trigger: 'blur' }
  ],
  role: [
    { required: true, message: '请选择角色', trigger: 'change' }
  ]
}

// 加载用户资料
async function loadProfile() {
  try {
    const response = await authApi.getProfile()
    // 兼容不同的响应格式
    profile.value = response.data?.user || response.user || response.data
    
    // 更新authStore中的用户信息以确保isAdmin计算属性正确
    if (profile.value) {
      authStore.setUser(profile.value)
    }
    
    // 调试：打印用户信息
    console.log('用户信息:', profile.value)
    console.log('用户角色:', profile.value?.role)
    console.log('是否管理员:', isAdmin.value)
    console.log('authStore用户:', authStore.user)
    console.log('authStore.isAdmin:', authStore.isAdmin)
    
    // 加载用户统计信息
    await loadUserStats()
  } catch (error) {
    console.error('加载用户信息失败:', error)
    ElMessage.error('加载用户信息失败')
  }
}

// 加载用户统计
async function loadUserStats() {
  try {
    // 获取用户的群组、文件、任务统计
    const [groupsRes, filesRes, tasksRes] = await Promise.all([
      groupsApi.getGroups({ limit: 1000 }),
      filesApi.getFiles({ limit: 1000 }),
      tasksApi.getTasks({ limit: 1000 })
    ])
    
    userStats.value = {
      groups_count: groupsRes.data?.total || groupsRes.total || 0,
      files_count: filesRes.data?.total || filesRes.total || 0,
      reminders_count: tasksRes.data?.total || tasksRes.total || 0
    }
  } catch (error) {
    console.warn('加载用户统计失败:', error)
    // 如果任务API不可用，至少显示群组和文件统计
    try {
      const [groupsRes, filesRes] = await Promise.all([
        groupsApi.getGroups({ limit: 1000 }),
        filesApi.getFiles({ limit: 1000 })
      ])
      
      userStats.value = {
        groups_count: groupsRes.data?.total || groupsRes.total || 0,
        files_count: filesRes.data?.total || filesRes.total || 0,
        reminders_count: 0
      }
    } catch (fallbackError) {
      console.warn('加载基础统计失败:', fallbackError)
    }
  }
}

// 修改密码
async function changePassword() {
  if (!passwordFormRef.value) return
  
  try {
    await passwordFormRef.value.validate()
    changingPassword.value = true
    
    await authApi.changePassword({
      oldPassword: passwordForm.oldPassword,
      newPassword: passwordForm.newPassword
    })
    
    ElMessage.success('密码修改成功')
    resetPasswordForm()
  } catch (error) {
    ElMessage.error('修改密码失败')
  } finally {
    changingPassword.value = false
  }
}

// 重置密码表单
function resetPasswordForm() {
  Object.assign(passwordForm, {
    oldPassword: '',
    newPassword: '',
    confirmPassword: ''
  })
  passwordFormRef.value?.clearValidate()
}

// 加载用户列表 (管理员)
async function loadUsers() {
  if (!isAdmin.value) return
  
  usersLoading.value = true
  try {
    const response = await authApi.getUsers()
    // 兼容不同的响应格式
    users.value = response.data?.users || response.users || []
  } catch (error) {
    // 如果API不存在，设置空数组
    users.value = []
    console.warn('加载用户列表失败，可能需要在后端添加相应API')
  } finally {
    usersLoading.value = false
  }
}

// 创建用户
async function createUser() {
  if (!createUserFormRef.value) return
  
  try {
    await createUserFormRef.value.validate()
    creatingUser.value = true
    
    await authApi.register(createUserForm)
    
    ElMessage.success('用户创建成功')
    showCreateUserDialog.value = false
    resetCreateUserForm()
    await loadUsers()
  } catch (error) {
    ElMessage.error('创建用户失败')
  } finally {
    creatingUser.value = false
  }
}

// 删除用户
async function deleteUser(user) {
  try {
    await ElMessageBox.confirm(
      `确定要删除用户 "${user.username}" 吗？此操作不可恢复。`,
      '确认删除',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    
    await authApi.deleteUser(user.id)
    
    ElMessage.success('用户删除成功')
    await loadUsers()
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('删除用户失败')
    }
  }
}

// 重置创建用户表单
function resetCreateUserForm() {
  Object.assign(createUserForm, {
    username: '',
    email: '',
    password: '',
    role: 'user'
  })
  createUserFormRef.value?.clearValidate()
}

// 工具函数
function getRoleType(role) {
  return role === 'admin' ? 'danger' : 'primary'
}

function getRoleText(role) {
  return role === 'admin' ? '管理员' : '普通用户'
}

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

// 初始化函数
const initializeProfile = async () => {
  await loadProfile()
  if (isAdmin.value) {
    await loadUsers()
  }
}

// 组件挂载 - 不使用async
onMounted(() => {
  initializeProfile()
})
</script>

<style scoped>
.profile {
  padding: 0;
}

.profile-main-row {
  margin-bottom: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.profile-info {
  margin-top: 12px;
}

.avatar-section {
  display: flex;
  align-items: center;
  margin-bottom: 24px;
  padding: 20px;
  background-color: #f8f9fa;
  border-radius: 8px;
}

.profile-avatar {
  margin-right: 20px;
  background-color: #409EFF;
}

.avatar-info {
  flex: 1;
}

.username {
  margin: 0 0 8px 0;
  color: #303133;
  font-size: 20px;
  font-weight: 600;
}

.profile-details {
  margin-bottom: 24px;
}

.user-stats h4 {
  margin-bottom: 16px;
  color: #303133;
  font-size: 16px;
}

.stats-row {
  margin-bottom: 0;
}

.stat-item {
  text-align: center;
  padding: 20px;
  background-color: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #ebeef5;
  margin-bottom: 16px;
}

.stat-value {
  font-size: 24px;
  font-weight: bold;
  color: #409EFF;
  line-height: 1;
  margin-bottom: 8px;
}

.stat-label {
  font-size: 14px;
  color: #606266;
}

.no-profile {
  text-align: center;
  padding: 40px;
}

.form-tip {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
}

.admin-row {
  margin-top: 20px;
}

.no-data {
  text-align: center;
  padding: 20px;
}

/* 移动端适配 */
@media (max-width: 767px) {
  .profile {
    padding: 0;
  }
  
  /* 主要布局移动端单列 */
  .profile-main-row {
    flex-direction: column;
    margin-bottom: 16px;
  }
  
  .profile-main-row .el-col {
    width: 100% !important;
    margin-bottom: 16px;
  }
  
  /* 头像区域移动端优化 */
  .avatar-section {
    flex-direction: column;
    text-align: center;
    padding: 16px;
  }
  
  .profile-avatar {
    margin-right: 0;
    margin-bottom: 12px;
  }
  
  .username {
    font-size: 18px;
    margin-bottom: 6px;
  }
  
  /* 统计卡片移动端单列 */
  .stats-row {
    flex-direction: column;
  }
  
  .stats-row .el-col {
    width: 100% !important;
    margin-bottom: 12px;
  }
  
  .stat-item {
    padding: 16px;
    margin-bottom: 0;
  }
  
  .stat-value {
    font-size: 20px;
  }
  
  .stat-label {
    font-size: 13px;
  }
  
  /* 表单优化 */
  .el-form-item {
    margin-bottom: 16px;
  }
  
  .el-input, .el-select {
    width: 100% !important;
  }
  
  /* 表格移动端隐藏，显示卡片 */
  .users-table {
    display: none;
  }
  
  .mobile-card-list {
    display: block;
  }
  
  /* 移动端卡片样式 */
  .mobile-card-item {
    background: var(--el-bg-color);
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 8px;
    padding: 16px;
    margin-bottom: 12px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  }
  
  .mobile-card-item .card-header {
    margin-bottom: 12px;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--el-border-color-extra-light);
  }
  
  .mobile-card-item .card-title {
    font-size: 16px;
    font-weight: 600;
    color: var(--el-text-color-primary);
  }
  
  .mobile-card-item .card-content {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  
  .mobile-card-item .card-field {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 4px 0;
  }
  
  .mobile-card-item .field-label {
    font-size: 13px;
    color: var(--el-text-color-regular);
    min-width: 60px;
  }
  
  .mobile-card-item .field-value {
    font-size: 14px;
    color: var(--el-text-color-primary);
    text-align: right;
    flex: 1;
    margin-left: 8px;
  }
  
  /* 对话框移动端适配 */
  .el-dialog {
    width: calc(100vw - 20px) !important;
    margin: 10px !important;
  }
}

/* 桌面端显示表格，隐藏移动端卡片 */
@media (min-width: 768px) {
  .mobile-card-list {
    display: none;
  }
  
  .users-table {
    display: table;
  }
}

/* 平板端适配 */
@media (min-width: 768px) and (max-width: 991px) {
  .avatar-section {
    padding: 16px;
  }
  
  .stat-item {
    padding: 16px;
  }
  
  .stat-value {
    font-size: 22px;
  }
}
</style>