<template>
  <el-dialog
    :model-value="visible"
    :title="isEdit ? '编辑任务' : '创建任务'"
    width="900px"
    :close-on-click-modal="false"
    class="task-editor-dialog"
    @close="handleClose"
  >
    <el-form
      ref="formRef"
      :model="formData"
      :rules="formRules"
      label-width="100px"
      class="task-form"
    >
      <!-- 基本信息 -->
      <div class="form-section">
        <div class="section-title">
          <el-icon><Document /></el-icon>
          基本信息
        </div>
        
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="任务名称" prop="name">
              <el-input
                v-model="formData.name"
                placeholder="请输入任务名称"
                maxlength="100"
                show-word-limit
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="所属群组" prop="groupId">
              <el-select
                v-model="formData.groupId"
                placeholder="选择群组"
                style="width: 100%"
              >
                <el-option
                  v-for="group in availableGroups"
                  :key="group.id"
                  :label="group.name"
                  :value="group.id"
                />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item label="任务描述" prop="description">
          <el-input
            v-model="formData.description"
            type="textarea"
            :rows="3"
            placeholder="请输入任务描述（可选）"
            maxlength="500"
            show-word-limit
          />
        </el-form-item>

        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="优先级" prop="priority">
              <el-select v-model="formData.priority" style="width: 100%">
                <el-option label="高优先级" value="high">
                  <div class="priority-option">
                    <el-tag type="danger" size="small">高</el-tag>
                    <span style="margin-left: 10px;">紧急重要任务</span>
                  </div>
                </el-option>
                <el-option label="普通优先级" value="normal">
                  <div class="priority-option">
                    <el-tag type="primary" size="small">普通</el-tag>
                    <span style="margin-left: 10px;">常规任务</span>
                  </div>
                </el-option>
                <el-option label="低优先级" value="low">
                  <div class="priority-option">
                    <el-tag type="info" size="small">低</el-tag>
                    <span style="margin-left: 10px;">非紧急任务</span>
                  </div>
                </el-option>
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="状态" prop="status">
              <el-select v-model="formData.status" style="width: 100%">
                <el-option label="活跃" value="active">
                  <div class="status-option">
                    <el-tag type="success" size="small">活跃</el-tag>
                    <span style="margin-left: 10px;">正常执行</span>
                  </div>
                </el-option>
                <el-option label="暂停" value="paused">
                  <div class="status-option">
                    <el-tag type="warning" size="small">暂停</el-tag>
                    <span style="margin-left: 10px;">暂时停止</span>
                  </div>
                </el-option>
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="启用时间">
              <el-date-picker
                v-model="formData.enableTime"
                type="datetime"
                placeholder="选择启用时间（可选）"
                style="width: 100%"
                format="YYYY-MM-DD HH:mm:ss"
                value-format="YYYY-MM-DD HH:mm:ss"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="禁用时间">
              <el-date-picker
                v-model="formData.disableTime"
                type="datetime"
                placeholder="选择禁用时间（可选）"
                style="width: 100%"
                format="YYYY-MM-DD HH:mm:ss"
                value-format="YYYY-MM-DD HH:mm:ss"
              />
            </el-form-item>
          </el-col>
        </el-row>
      </div>

      <!-- 消息内容 -->
      <div class="form-section">
        <div class="section-title">
          <el-icon><ChatLineRound /></el-icon>
          消息内容
        </div>

        <el-form-item label="消息内容" prop="messageContent">
          <el-input
            v-model="formData.messageContent"
            type="textarea"
            :rows="4"
            placeholder="请输入要发送的消息内容"
            maxlength="1000"
            show-word-limit
          />
        </el-form-item>

        <el-form-item label="消息格式" prop="messageFormat">
          <el-radio-group v-model="formData.messageFormat">
            <el-radio label="text">纯文本</el-radio>
            <el-radio label="markdown">Markdown</el-radio>
          </el-radio-group>
        </el-form-item>

        <el-form-item label="@指定人员">
          <el-input
            v-model="formData.atPersons"
            placeholder="多个手机号用逗号分隔，如：13800138000,13900139000"
          />
          <div class="form-tip">
            留空则不@任何人，填写手机号则@指定人员
          </div>
        </el-form-item>
      </div>

      <!-- 调度规则配置 -->
      <div class="form-section">
        <div class="section-title">
          <el-icon><AlarmClock /></el-icon>
          调度规则
        </div>
        
        <DateRuleBuilder
          v-model="formData.scheduleRule"
          @change="handleScheduleRuleChange"
        />
      </div>

      <!-- 钉钉配置 -->
      <div class="form-section">
        <div class="section-title">
          <el-icon><Link /></el-icon>
          钉钉配置
        </div>

        <el-form-item label="Webhook URL" prop="webhookUrl">
          <el-input
            v-model="formData.webhookUrl"
            placeholder="留空则使用群组默认配置"
          />
        </el-form-item>

        <el-form-item label="加签密钥">
          <el-input
            v-model="formData.webhookSecret"
            type="password"
            placeholder="留空则使用群组默认配置"
            show-password
          />
        </el-form-item>

        <div class="form-tip">
          <el-icon><InfoFilled /></el-icon>
          如果留空，将使用所属群组的默认钉钉配置
        </div>
      </div>

      <!-- 高级设置 -->
      <div class="form-section">
        <div class="section-title">
          <el-icon><Setting /></el-icon>
          高级设置
        </div>

        <el-form-item label="失败重试">
          <el-switch
            v-model="formData.enableRetry"
            active-text="开启"
            inactive-text="关闭"
          />
          <div class="form-tip">
            开启后，发送失败时会自动重试
          </div>
        </el-form-item>

        <el-form-item v-if="formData.enableRetry" label="重试次数">
          <el-input-number
            v-model="formData.maxRetries"
            :min="1"
            :max="5"
            style="width: 120px"
          />
        </el-form-item>

        <el-form-item label="执行日志">
          <el-switch
            v-model="formData.enableLogging"
            active-text="开启"
            inactive-text="关闭"
          />
          <div class="form-tip">
            记录任务执行日志，便于问题排查
          </div>
        </el-form-item>
      </div>
    </el-form>

    <template #footer>
      <div class="dialog-footer">
        <el-button @click="handleClose">取消</el-button>
        <el-button type="primary" :loading="saving" @click="handleSave">
          {{ isEdit ? '更新任务' : '创建任务' }}
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, reactive, computed, watch, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import {
  Document, ChatLineRound, AlarmClock, Link, Setting,
  InfoFilled
} from '@element-plus/icons-vue'
import DateRuleBuilder from './DateRuleBuilder.vue'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  task: {
    type: Object,
    default: null
  },
  availableGroups: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['close', 'save'])

// 响应式数据
const formRef = ref()
const saving = ref(false)

const isEdit = computed(() => !!props.task?.id)

const formData = reactive({
  name: '',
  description: '',
  priority: 'normal',
  status: 'active',
  enableTime: '',
  disableTime: '',
  groupId: '',
  messageContent: '',
  messageFormat: 'text',
  atPersons: '',
  webhookUrl: '',
  webhookSecret: '',
  enableRetry: true,
  maxRetries: 3,
  enableLogging: true,
  scheduleRule: {
    ruleType: 'by_day',
    months: [],
    dayMode: { type: 'specific_days', days: [] },
    weekMode: { weekdays: [], occurrence: 'every' },
    intervalMode: { value: 1, unit: 'days', referenceDate: '' },
    executionTimes: ['09:00']
  }
})

const formRules = {
  name: [
    { required: true, message: '请输入任务名称', trigger: 'blur' },
    { min: 2, max: 100, message: '名称长度在 2 到 100 个字符', trigger: 'blur' }
  ],
  groupId: [
    { required: true, message: '请选择所属群组', trigger: 'change' }
  ],
  messageContent: [
    { required: true, message: '请输入消息内容', trigger: 'blur' },
    { min: 1, max: 1000, message: '消息内容长度在 1 到 1000 个字符', trigger: 'blur' }
  ],
  priority: [
    { required: true, message: '请选择优先级', trigger: 'change' }
  ],
  status: [
    { required: true, message: '请选择状态', trigger: 'change' }
  ]
}

// 方法
const initializeForm = () => {
  if (props.task) {
    // 编辑模式，填充现有数据
    Object.keys(formData).forEach(key => {
      if (props.task[key] !== undefined) {
        if (key === 'scheduleRule') {
          Object.assign(formData.scheduleRule, props.task[key] || {})
        } else {
          formData[key] = props.task[key]
        }
      }
    })
  } else {
    // 创建模式，重置表单
    Object.assign(formData, {
      name: '',
      description: '',
      priority: 'normal',
      status: 'active',
      enableTime: '',
      disableTime: '',
      groupId: props.availableGroups[0]?.id || '',
      messageContent: '',
      messageFormat: 'text',
      atPersons: '',
      webhookUrl: '',
      webhookSecret: '',
      enableRetry: true,
      maxRetries: 3,
      enableLogging: true,
      scheduleRule: {
        ruleType: 'by_day',
        months: [],
        dayMode: { type: 'specific_days', days: [] },
        weekMode: { weekdays: [], occurrence: 'every' },
        intervalMode: { value: 1, unit: 'days', referenceDate: '' },
        executionTimes: ['09:00']
      }
    })
  }
}

const handleScheduleRuleChange = (rule) => {
  formData.scheduleRule = rule
}

const validateScheduleRule = () => {
  const rule = formData.scheduleRule
  
  if (!rule.executionTimes || rule.executionTimes.length === 0) {
    ElMessage.error('请至少设置一个执行时间')
    return false
  }

  if (rule.ruleType === 'by_day') {
    if (rule.dayMode.type === 'specific_days' && (!rule.dayMode.days || rule.dayMode.days.length === 0)) {
      ElMessage.error('请选择执行日期')
      return false
    }
  } else if (rule.ruleType === 'by_week') {
    if (!rule.weekMode.weekdays || rule.weekMode.weekdays.length === 0) {
      ElMessage.error('请选择执行的星期')
      return false
    }
  } else if (rule.ruleType === 'by_interval') {
    if (!rule.intervalMode.value || rule.intervalMode.value < 1) {
      ElMessage.error('间隔值必须大于0')
      return false
    }
    if (rule.intervalMode.unit === 'months' && !rule.intervalMode.referenceDate) {
      ElMessage.error('按月间隔执行需要设置参考日期')
      return false
    }
  }

  return true
}

const handleSave = async () => {
  try {
    // 表单验证
    await formRef.value.validate()
    
    // 调度规则验证
    if (!validateScheduleRule()) {
      return
    }

    saving.value = true

    // 准备保存数据
    const saveData = {
      ...formData,
      atPersons: formData.atPersons ? formData.atPersons.split(',').map(s => s.trim()).filter(s => s) : []
    }

    emit('save', saveData)
  } catch (error) {
    ElMessage.error('请检查表单填写')
  } finally {
    saving.value = false
  }
}

const handleClose = () => {
  formRef.value?.clearValidate()
  emit('close')
}

// 监听器
watch(() => props.visible, (visible) => {
  if (visible) {
    nextTick(() => {
      initializeForm()
    })
  }
})

watch(() => props.task, () => {
  if (props.visible) {
    nextTick(() => {
      initializeForm()
    })
  }
})
</script>

<style scoped>
.task-form {
  max-height: 70vh;
  overflow-y: auto;
  padding-right: 10px;
}

.form-section {
  margin-bottom: 30px;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  padding: 20px;
  background: #fafafa;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 20px;
  padding-bottom: 10px;
  border-bottom: 2px solid #409eff;
}

.priority-option,
.status-option {
  display: flex;
  align-items: center;
  width: 100%;
}

.form-tip {
  font-size: 12px;
  color: #909399;
  margin-top: 5px;
  display: flex;
  align-items: center;
  gap: 4px;
}

.dialog-footer {
  text-align: right;
}

/* 自定义滚动条 */
.task-form::-webkit-scrollbar {
  width: 6px;
}

.task-form::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 3px;
}

.task-form::-webkit-scrollbar-thumb {
  background: #c0c4cc;
  border-radius: 3px;
}

.task-form::-webkit-scrollbar-thumb:hover {
  background: #a8abb2;
}

@media (max-width: 768px) {
  .task-editor-dialog :deep(.el-dialog) {
    width: 95% !important;
    margin: 10px;
    max-height: calc(100vh - 20px);
    border-radius: 12px;
  }
  
  .task-editor-dialog :deep(.el-dialog__body) {
    padding: 16px;
    max-height: calc(100vh - 140px);
    overflow-y: auto;
  }
  
  .task-editor-dialog :deep(.el-dialog__header) {
    padding: 16px;
    border-bottom: 1px solid #eee;
  }
  
  .task-editor-dialog :deep(.el-dialog__footer) {
    padding: 12px 16px;
    border-top: 1px solid #eee;
  }
  
  .form-section {
    padding: 12px;
    margin-bottom: 16px;
  }
  
  .el-row .el-col {
    margin-bottom: 12px;
  }
  
  .el-row .el-col:last-child {
    margin-bottom: 0;
  }
  
  /* 移动端表单项优化 */
  .task-form :deep(.el-form-item) {
    margin-bottom: 16px;
  }
  
  .task-form :deep(.el-form-item__label) {
    font-size: 14px;
    line-height: 1.4;
    margin-bottom: 6px;
  }
  
  .task-form :deep(.el-input__inner),
  .task-form :deep(.el-textarea__inner) {
    font-size: 16px; /* 防止iOS缩放 */
    min-height: 44px; /* 触摸友好 */
  }
  
  .task-form :deep(.el-select) {
    width: 100% !important;
  }
  
  .task-form :deep(.el-button) {
    min-height: 44px;
    padding: 12px 16px;
  }
  
  /* 移动端响应式列布局 */
  .task-form .el-row {
    flex-direction: column;
  }
  
  .task-form .el-col {
    width: 100% !important;
    max-width: 100% !important;
    flex: none;
  }
}
</style>