<template>
  <div class="holiday-manager">
    <el-dialog
      v-model="visible"
      title="法定节假日管理"
      width="800px"
      :close-on-click-modal="false"
    >
      <div class="holiday-header">
        <el-alert
          title="说明"
          type="info"
          :closable="false"
          show-icon
        >
          请根据国务院发布的节假日安排配置当年的法定节假日。系统会在"排除法定节假日"选项启用时跳过这些日期。
        </el-alert>
      </div>

      <div class="holiday-toolbar">
        <el-select v-model="selectedYear" @change="loadHolidays" style="width: 120px;">
          <el-option
            v-for="year in yearOptions"
            :key="year"
            :label="`${year}年`"
            :value="year"
          />
        </el-select>
        
        <el-button-group>
          <el-button @click="importDefault">导入默认节假日</el-button>
          <el-button @click="clearAll">清空所有</el-button>
        </el-button-group>
        
        <el-button type="primary" @click="showAddDialog">
          <el-icon><Plus /></el-icon>
          添加节假日
        </el-button>
      </div>

      <div class="holiday-list">
        <el-table :data="holidays" stripe style="width: 100%">
          <el-table-column prop="name" label="节假日名称" width="150" />
          <el-table-column prop="date" label="日期" width="120">
            <template #default="{ row }">
              {{ formatDate(row.date) }}
            </template>
          </el-table-column>
          <el-table-column prop="weekday" label="星期" width="80">
            <template #default="{ row }">
              {{ getWeekday(row.date) }}
            </template>
          </el-table-column>
          <el-table-column prop="type" label="类型" width="100">
            <template #default="{ row }">
              <el-tag :type="row.type === 'legal' ? 'success' : 'info'" size="small">
                {{ row.type === 'legal' ? '法定节假日' : '调休' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="description" label="备注" />
          <el-table-column label="操作" width="100" fixed="right">
            <template #default="{ row }">
              <el-button type="danger" size="small" link @click="removeHoliday(row)">
                删除
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <div class="holiday-summary">
        <el-tag>共 {{ holidays.length }} 天节假日</el-tag>
        <el-tag type="success">法定节假日: {{ legalHolidaysCount }} 天</el-tag>
        <el-tag type="info">调休: {{ compensatoryDaysCount }} 天</el-tag>
      </div>

      <template #footer>
        <el-button @click="visible = false">关闭</el-button>
        <el-button type="primary" @click="saveHolidays">保存</el-button>
      </template>
    </el-dialog>

    <!-- 添加节假日对话框 -->
    <el-dialog
      v-model="addDialogVisible"
      title="添加节假日"
      width="500px"
      :close-on-click-modal="false"
    >
      <el-form :model="holidayForm" :rules="holidayRules" ref="holidayFormRef" label-width="100px">
        <el-form-item label="节假日名称" prop="name">
          <el-input v-model="holidayForm.name" placeholder="如：元旦、春节" />
        </el-form-item>
        
        <el-form-item label="日期" prop="date">
          <el-date-picker
            v-model="holidayForm.date"
            type="date"
            placeholder="选择日期"
            format="YYYY-MM-DD"
            value-format="YYYY-MM-DD"
            style="width: 100%"
          />
        </el-form-item>
        
        <el-form-item label="类型" prop="type">
          <el-radio-group v-model="holidayForm.type">
            <el-radio value="legal">法定节假日</el-radio>
            <el-radio value="compensatory">调休</el-radio>
          </el-radio-group>
        </el-form-item>
        
        <el-form-item label="备注">
          <el-input v-model="holidayForm.description" type="textarea" :rows="2" />
        </el-form-item>
      </el-form>
      
      <template #footer>
        <el-button @click="addDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="addHoliday">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  year: {
    type: Number,
    default: () => new Date().getFullYear()
  }
})

const emit = defineEmits(['update:modelValue', 'save'])

const visible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})

// 数据
const selectedYear = ref(props.year)
const holidays = ref([])
const addDialogVisible = ref(false)
const holidayFormRef = ref()

const holidayForm = reactive({
  name: '',
  date: '',
  type: 'legal',
  description: ''
})

const holidayRules = {
  name: [{ required: true, message: '请输入节假日名称', trigger: 'blur' }],
  date: [{ required: true, message: '请选择日期', trigger: 'change' }],
  type: [{ required: true, message: '请选择类型', trigger: 'change' }]
}

// 年份选项
const yearOptions = computed(() => {
  const currentYear = new Date().getFullYear()
  return Array.from({ length: 5 }, (_, i) => currentYear - 2 + i)
})

// 统计
const legalHolidaysCount = computed(() => {
  return holidays.value.filter(h => h.type === 'legal').length
})

const compensatoryDaysCount = computed(() => {
  return holidays.value.filter(h => h.type === 'compensatory').length
})

// 方法
const loadHolidays = async () => {
  // 从localStorage或后端加载节假日数据
  const savedHolidays = localStorage.getItem(`holidays_${selectedYear.value}`)
  if (savedHolidays) {
    holidays.value = JSON.parse(savedHolidays)
  } else {
    holidays.value = []
  }
}

const importDefault = () => {
  // 导入默认的中国法定节假日（示例数据）
  const defaultHolidays = getDefaultHolidays(selectedYear.value)
  
  ElMessageBox.confirm(
    `将导入${selectedYear.value}年的默认法定节假日，这将覆盖现有配置，是否继续？`,
    '提示',
    {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    }
  ).then(() => {
    holidays.value = defaultHolidays
    ElMessage.success('已导入默认节假日')
  }).catch(() => {})
}

const getDefaultHolidays = (year) => {
  // 这里应该根据年份返回相应的法定节假日
  // 实际应用中应该从后端API获取或维护一个节假日数据库
  const holidays = []
  
  // 元旦（1月1日）
  holidays.push({
    name: '元旦',
    date: `${year}-01-01`,
    type: 'legal',
    description: '元旦节'
  })
  
  // 春节（农历正月初一到初三，需要农历转换）
  // 这里使用示例日期，实际需要根据农历计算
  if (year === 2025) {
    holidays.push(
      { name: '春节', date: '2025-01-29', type: 'legal', description: '春节（初一）' },
      { name: '春节', date: '2025-01-30', type: 'legal', description: '春节（初二）' },
      { name: '春节', date: '2025-01-31', type: 'legal', description: '春节（初三）' }
    )
  }
  
  // 清明节（公历4月4日或5日）
  holidays.push({
    name: '清明节',
    date: `${year}-04-05`,
    type: 'legal',
    description: '清明节'
  })
  
  // 劳动节（5月1日）
  holidays.push({
    name: '劳动节',
    date: `${year}-05-01`,
    type: 'legal',
    description: '国际劳动节'
  })
  
  // 端午节（农历五月初五）
  if (year === 2025) {
    holidays.push({
      name: '端午节',
      date: '2025-05-31',
      type: 'legal',
      description: '端午节'
    })
  }
  
  // 中秋节（农历八月十五）
  if (year === 2025) {
    holidays.push({
      name: '中秋节',
      date: '2025-10-06',
      type: 'legal',
      description: '中秋节'
    })
  }
  
  // 国庆节（10月1日到3日）
  holidays.push(
    { name: '国庆节', date: `${year}-10-01`, type: 'legal', description: '国庆节' },
    { name: '国庆节', date: `${year}-10-02`, type: 'legal', description: '国庆节' },
    { name: '国庆节', date: `${year}-10-03`, type: 'legal', description: '国庆节' }
  )
  
  return holidays
}

const clearAll = () => {
  ElMessageBox.confirm('确定要清空所有节假日吗？', '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(() => {
    holidays.value = []
    ElMessage.success('已清空所有节假日')
  }).catch(() => {})
}

const showAddDialog = () => {
  holidayForm.name = ''
  holidayForm.date = ''
  holidayForm.type = 'legal'
  holidayForm.description = ''
  addDialogVisible.value = true
}

const addHoliday = async () => {
  const valid = await holidayFormRef.value.validate()
  if (!valid) return
  
  // 检查是否已存在
  if (holidays.value.some(h => h.date === holidayForm.date)) {
    ElMessage.warning('该日期已存在节假日配置')
    return
  }
  
  holidays.value.push({
    ...holidayForm,
    id: Date.now()
  })
  
  // 按日期排序
  holidays.value.sort((a, b) => new Date(a.date) - new Date(b.date))
  
  addDialogVisible.value = false
  ElMessage.success('添加成功')
}

const removeHoliday = (holiday) => {
  ElMessageBox.confirm(`确定要删除"${holiday.name}"吗？`, '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(() => {
    const index = holidays.value.findIndex(h => h.id === holiday.id || h.date === holiday.date)
    if (index > -1) {
      holidays.value.splice(index, 1)
      ElMessage.success('删除成功')
    }
  }).catch(() => {})
}

const saveHolidays = () => {
  // 保存到localStorage或后端
  localStorage.setItem(`holidays_${selectedYear.value}`, JSON.stringify(holidays.value))
  
  // 触发保存事件
  emit('save', {
    year: selectedYear.value,
    holidays: holidays.value
  })
  
  ElMessage.success('保存成功')
  visible.value = false
}

const formatDate = (date) => {
  return date
}

const getWeekday = (date) => {
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  const d = new Date(date)
  return weekdays[d.getDay()]
}

// 监听显示状态
watch(visible, (val) => {
  if (val) {
    loadHolidays()
  }
})

// 监听年份变化
watch(() => props.year, (val) => {
  selectedYear.value = val
  if (visible.value) {
    loadHolidays()
  }
})
</script>

<style scoped lang="scss">
.holiday-manager {
  .holiday-header {
    margin-bottom: 20px;
  }
  
  .holiday-toolbar {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 20px;
    
    .el-select {
      flex-shrink: 0;
    }
    
    .el-button-group {
      flex: 1;
    }
  }
  
  .holiday-list {
    margin-bottom: 20px;
    max-height: 400px;
    overflow-y: auto;
  }
  
  .holiday-summary {
    display: flex;
    gap: 12px;
    padding: 12px;
    background: #f5f7fa;
    border-radius: 4px;
  }
}
</style>