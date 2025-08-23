<template>
  <div class="date-rule-builder">
    <div class="rule-header">
      <h4>调度规则配置</h4>
      <p>设置任务的执行周期和时间</p>
    </div>

    <!-- 月份选择器 -->
    <div class="rule-section">
      <div class="section-title">
        <el-icon><Calendar /></el-icon>
        选择月份
      </div>
      <div class="section-description">
        选择任务在哪些月份执行（默认全年）
      </div>
      <div class="month-selector">
        <el-checkbox
          v-model="allMonthsSelected"
          :indeterminate="isMonthIndeterminate"
          @change="handleAllMonthsChange"
        >
          全选
        </el-checkbox>
        <div class="months-grid">
          <el-checkbox
            v-for="month in 12"
            :key="month"
            v-model="selectedMonths"
            :label="month"
            @change="handleMonthChange"
          >
            {{ getMonthName(month) }}
          </el-checkbox>
        </div>
      </div>
    </div>

    <!-- 调度模式选择 -->
    <div class="rule-section">
      <div class="section-title">
        <el-icon><Setting /></el-icon>
        调度模式
      </div>
      <div class="section-description">
        选择任务执行的时间规律
      </div>
      <el-radio-group v-model="ruleType" class="rule-type-selector" @change="handleRuleTypeChange">
        <el-radio label="by_day" class="rule-type-option">
          <div class="option-content">
            <div class="option-icon">📅</div>
            <div class="option-info">
              <div class="option-title">按日期执行</div>
              <div class="option-desc">每月的特定日期执行</div>
            </div>
          </div>
        </el-radio>
        
        <el-radio label="by_week" class="rule-type-option">
          <div class="option-content">
            <div class="option-icon">📋</div>
            <div class="option-info">
              <div class="option-title">按星期执行</div>
              <div class="option-desc">每周的特定星期几执行</div>
            </div>
          </div>
        </el-radio>
        
        <el-radio label="by_interval" class="rule-type-option">
          <div class="option-content">
            <div class="option-icon">🔄</div>
            <div class="option-info">
              <div class="option-title">按间隔执行</div>
              <div class="option-desc">固定时间间隔执行</div>
            </div>
          </div>
        </el-radio>
      </el-radio-group>
    </div>

    <!-- 按日期模式配置 -->
    <div v-if="ruleType === 'by_day'" class="rule-section">
      <div class="section-title">
        <el-icon><Calendar /></el-icon>
        日期设置
      </div>
      <div class="day-mode-selector">
        <el-radio-group v-model="dayMode.type" @change="handleDayModeChange">
          <el-radio label="specific_days">
            <div class="sub-option">
              <span>指定日期</span>
              <div v-if="dayMode.type === 'specific_days'" class="specific-days-config">
                <div class="days-grid">
                  <el-checkbox
                    v-for="day in 31"
                    :key="day"
                    v-model="dayMode.days"
                    :label="day"
                    :disabled="!isDayValid(day)"
                  >
                    {{ day }}
                  </el-checkbox>
                </div>
              </div>
            </div>
          </el-radio>
          
          <el-radio label="last_day">
            <span>每月最后一天</span>
          </el-radio>
          
          <el-radio label="last_workday">
            <span>每月最后一个工作日</span>
          </el-radio>
          
          <el-radio label="nth_workday">
            <div class="sub-option">
              <span>第</span>
              <el-input-number
                v-if="dayMode.type === 'nth_workday'"
                v-model="dayMode.nthDay"
                :min="1"
                :max="31"
                size="small"
                style="width: 80px; margin: 0 8px;"
              />
              <span>个工作日</span>
            </div>
          </el-radio>
        </el-radio-group>
      </div>
    </div>

    <!-- 按星期模式配置 -->
    <div v-if="ruleType === 'by_week'" class="rule-section">
      <div class="section-title">
        <el-icon><Calendar /></el-icon>
        星期设置
      </div>
      <div class="week-config">
        <div class="weekdays-selector">
          <el-checkbox
            v-for="(day, index) in weekDays"
            :key="index"
            v-model="weekMode.weekdays"
            :label="index + 1"
          >
            {{ day }}
          </el-checkbox>
        </div>
        
        <div class="week-occurrence">
          <el-radio-group v-model="weekMode.occurrence">
            <el-radio label="every">每周</el-radio>
            <el-radio label="first">第一周</el-radio>
            <el-radio label="second">第二周</el-radio>
            <el-radio label="third">第三周</el-radio>
            <el-radio label="fourth">第四周</el-radio>
            <el-radio label="last">最后一周</el-radio>
          </el-radio-group>
        </div>
      </div>
    </div>

    <!-- 按间隔模式配置 -->
    <div v-if="ruleType === 'by_interval'" class="rule-section">
      <div class="section-title">
        <el-icon><Timer /></el-icon>
        间隔设置
      </div>
      <div class="interval-config">
        <div class="interval-input">
          <span>每</span>
          <el-input-number
            v-model="intervalMode.value"
            :min="1"
            :max="365"
            size="small"
            style="width: 100px; margin: 0 8px;"
          />
          <el-select v-model="intervalMode.unit" style="width: 100px;">
            <el-option label="天" value="days" />
            <el-option label="周" value="weeks" />
            <el-option label="月" value="months" />
          </el-select>
          <span>执行一次</span>
        </div>
        
        <div class="reference-date">
          <el-form-item label="起始参考日期:">
            <el-date-picker
              v-model="intervalMode.referenceDate"
              type="date"
              placeholder="选择参考日期"
              format="YYYY-MM-DD"
              value-format="YYYY-MM-DD"
            />
          </el-form-item>
        </div>
      </div>
    </div>

    <!-- 执行时间设置 -->
    <div class="rule-section">
      <div class="section-title">
        <el-icon><Clock /></el-icon>
        执行时间
      </div>
      <div class="section-description">
        设置任务每天的执行时间点
      </div>
      <div class="execution-times">
        <div class="times-list">
          <div
            v-for="(time, index) in executionTimes"
            :key="index"
            class="time-item"
          >
            <el-time-picker
              v-model="executionTimes[index]"
              format="HH:mm"
              value-format="HH:mm"
              placeholder="选择时间"
            />
            <el-button
              type="danger"
              size="small"
              link
              @click="removeExecutionTime(index)"
            >
              <el-icon><Delete /></el-icon>
            </el-button>
          </div>
        </div>
        <el-button
          type="primary"
          size="small"
          @click="addExecutionTime"
        >
          <el-icon><Plus /></el-icon>
          添加时间
        </el-button>
      </div>
    </div>

    <!-- 预览面板 -->
    <div class="rule-section">
      <div class="section-title">
        <el-icon><View /></el-icon>
        执行计划预览
      </div>
      <div class="preview-panel">
        <div class="preview-header">
          <span>未来7天执行计划</span>
          <el-button size="small" @click="generatePreview">
            <el-icon><Refresh /></el-icon>
            刷新预览
          </el-button>
        </div>
        <div v-loading="previewLoading" class="preview-content">
          <div v-if="previewData.length === 0" class="empty-preview">
            <el-empty description="暂无执行计划" :image-size="80" />
          </div>
          <div v-else class="preview-list">
            <div
              v-for="item in previewData"
              :key="item.key"
              class="preview-item"
            >
              <div class="preview-date">
                <div class="date-main">{{ item.dateDisplay }}</div>
                <div class="date-sub">{{ item.weekday }}</div>
              </div>
              <div class="preview-times">
                <el-tag
                  v-for="time in item.times"
                  :key="time"
                  size="small"
                  class="time-tag"
                >
                  {{ time }}
                </el-tag>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 规则摘要 -->
    <div class="rule-section">
      <div class="section-title">
        <el-icon><Document /></el-icon>
        规则摘要
      </div>
      <div class="rule-summary">
        <el-alert
          :title="ruleSummary"
          type="info"
          :closable="false"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import {
  Calendar, Setting, Clock, Timer, View, Document, Refresh,
  Plus, Delete
} from '@element-plus/icons-vue'
import { scheduleAPI } from '@/api/modules/schedule'

const props = defineProps({
  modelValue: {
    type: Object,
    default: () => ({
      ruleType: 'by_day',
      months: [],
      dayMode: { type: 'specific_days', days: [] },
      weekMode: { weekdays: [], occurrence: 'every' },
      intervalMode: { value: 1, unit: 'days', referenceDate: '' },
      executionTimes: ['09:00']
    })
  }
})

const emit = defineEmits(['update:modelValue', 'change'])

// 响应式数据
const ruleType = ref(props.modelValue.ruleType || 'by_day')
// 修复：默认选择全部月份（1-12月）
const selectedMonths = ref(props.modelValue.months?.length > 0 ? props.modelValue.months : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
// 修复：默认选择每月15号
const dayMode = reactive(props.modelValue.dayMode || { type: 'specific_days', days: [15] })
const weekMode = reactive(props.modelValue.weekMode || { weekdays: [], occurrence: 'every' })
const intervalMode = reactive(props.modelValue.intervalMode || { value: 1, unit: 'days', referenceDate: '' })
const executionTimes = ref(props.modelValue.executionTimes || ['09:00'])

const previewLoading = ref(false)
const previewData = ref([])

const weekDays = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']

// 计算属性
const allMonthsSelected = computed({
  get: () => selectedMonths.value.length === 12,
  set: (value) => {
    if (value) {
      selectedMonths.value = Array.from({ length: 12 }, (_, i) => i + 1)
    } else {
      selectedMonths.value = []
    }
  }
})

const isMonthIndeterminate = computed(() => {
  return selectedMonths.value.length > 0 && selectedMonths.value.length < 12
})

const ruleSummary = computed(() => {
  let summary = ''
  
  // 月份部分
  if (selectedMonths.value.length === 12) {
    summary += '全年'
  } else if (selectedMonths.value.length === 0) {
    summary += '无月份选择'
  } else {
    summary += `${selectedMonths.value.map(m => getMonthName(m)).join('、')}月`
  }
  
  // 规则部分
  if (ruleType.value === 'by_day') {
    if (dayMode.type === 'specific_days') {
      if (dayMode.days.length > 0) {
        summary += `，每月${dayMode.days.join('、')}日`
      } else {
        summary += '，未选择日期'
      }
    } else if (dayMode.type === 'last_day') {
      summary += '，每月最后一天'
    } else if (dayMode.type === 'last_workday') {
      summary += '，每月最后一个工作日'
    } else if (dayMode.type === 'nth_workday') {
      summary += `，每月第${dayMode.nthDay}个工作日`
    }
  } else if (ruleType.value === 'by_week') {
    if (weekMode.weekdays.length > 0) {
      const weekdayNames = weekMode.weekdays.map(d => weekDays[d - 1]).join('、')
      const occurrenceText = {
        every: '每周',
        first: '第一周',
        second: '第二周',
        third: '第三周',
        fourth: '第四周',
        last: '最后一周'
      }[weekMode.occurrence] || '每周'
      summary += `，${occurrenceText}${weekdayNames}`
    } else {
      summary += '，未选择星期'
    }
  } else if (ruleType.value === 'by_interval') {
    const unitText = { days: '天', weeks: '周', months: '月' }[intervalMode.unit]
    summary += `，每${intervalMode.value}${unitText}执行一次`
    if (intervalMode.referenceDate) {
      summary += `（从${intervalMode.referenceDate}开始）`
    }
  }
  
  // 执行时间
  if (executionTimes.value.length > 0) {
    summary += `，在${executionTimes.value.join('、')}执行`
  }
  
  return summary || '请配置调度规则'
})

// 方法
const getMonthName = (month) => {
  const names = [
    '1月', '2月', '3月', '4月', '5月', '6月',
    '7月', '8月', '9月', '10月', '11月', '12月'
  ]
  return names[month - 1] || `${month}月`
}

const handleAllMonthsChange = (value) => {
  if (value) {
    selectedMonths.value = Array.from({ length: 12 }, (_, i) => i + 1)
  } else {
    selectedMonths.value = []
  }
  emitChange()
}

const handleMonthChange = () => {
  emitChange()
}

const handleRuleTypeChange = () => {
  emitChange()
}

const handleDayModeChange = () => {
  if (dayMode.type === 'specific_days' && !dayMode.days) {
    dayMode.days = []
  }
  if (dayMode.type === 'nth_workday' && !dayMode.nthDay) {
    dayMode.nthDay = 1
  }
  emitChange()
}

const isDayValid = (day) => {
  // 简单验证，可以根据选择的月份进行更精确的验证
  return day >= 1 && day <= 31
}

const addExecutionTime = () => {
  executionTimes.value.push('09:00')
  emitChange()
}

const removeExecutionTime = (index) => {
  if (executionTimes.value.length > 1) {
    executionTimes.value.splice(index, 1)
    emitChange()
  } else {
    ElMessage.warning('至少需要保留一个执行时间')
  }
}

const generatePreview = async () => {
  previewLoading.value = true
  try {
    const rule = buildRuleObject()
    const response = await scheduleAPI.previewSchedule(rule, 7)
    
    if (response.success) {
      previewData.value = response.data.preview.map(item => ({
        ...item,
        key: `${item.date}_${item.times.join('_')}`,
        dateDisplay: formatDate(item.date),
        weekday: getWeekdayName(item.date)
      }))
    } else {
      ElMessage.error('预览失败: ' + response.error)
      previewData.value = []
    }
  } catch (error) {
    ElMessage.error('预览失败: ' + error.message)
    previewData.value = []
  } finally {
    previewLoading.value = false
  }
}

const formatDate = (dateStr) => {
  const date = new Date(dateStr)
  return `${date.getMonth() + 1}月${date.getDate()}日`
}

const getWeekdayName = (dateStr) => {
  const date = new Date(dateStr)
  return weekDays[date.getDay() === 0 ? 6 : date.getDay() - 1]
}

const buildRuleObject = () => {
  return {
    ruleType: ruleType.value,
    months: selectedMonths.value,
    dayMode: dayMode,
    weekMode: weekMode,
    intervalMode: intervalMode,
    executionTimes: executionTimes.value.filter(time => time)
  }
}

const emitChange = () => {
  const rule = buildRuleObject()
  emit('update:modelValue', rule)
  emit('change', rule)
}

// 监听器
watch(() => props.modelValue, (newValue) => {
  if (newValue) {
    ruleType.value = newValue.ruleType || 'by_day'
    // 修复：如果没有月份，默认选择全部月份
    selectedMonths.value = newValue.months?.length > 0 ? newValue.months : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
    // 修复：如果没有日期，默认选择15号
    Object.assign(dayMode, newValue.dayMode || { type: 'specific_days', days: [15] })
    Object.assign(weekMode, newValue.weekMode || { weekdays: [], occurrence: 'every' })
    Object.assign(intervalMode, newValue.intervalMode || { value: 1, unit: 'days', referenceDate: '' })
    executionTimes.value = newValue.executionTimes || ['09:00']
  }
}, { deep: true })

watch([ruleType, selectedMonths, executionTimes], () => {
  emitChange()
}, { deep: true })

watch([dayMode, weekMode, intervalMode], () => {
  emitChange()
}, { deep: true })

// 生命周期
onMounted(() => {
  // 如果有默认值，生成预览
  if (selectedMonths.value.length > 0 && executionTimes.value.length > 0) {
    generatePreview()
  }
})
</script>

<style scoped>
.date-rule-builder {
  padding: 20px;
  background: #f8f9fa;
  border-radius: 8px;
}

.rule-header {
  margin-bottom: 20px;
}

.rule-header h4 {
  margin: 0 0 5px 0;
  color: #303133;
}

.rule-header p {
  margin: 0;
  color: #909399;
  font-size: 14px;
}

.rule-section {
  background: white;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 15px;
  border: 1px solid #e4e7ed;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 5px;
}

.section-description {
  color: #909399;
  font-size: 14px;
  margin-bottom: 15px;
}

.month-selector {
  padding: 10px;
}

.months-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
  gap: 10px;
  margin-top: 10px;
}

.rule-type-selector {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 15px;
}

.rule-type-option {
  border: 2px solid #e4e7ed;
  border-radius: 8px;
  padding: 15px;
  margin: 0;
  cursor: pointer;
  transition: all 0.3s;
}

.rule-type-option:hover {
  border-color: #409eff;
  box-shadow: 0 2px 8px rgba(64, 158, 255, 0.1);
}

.rule-type-option.is-checked {
  border-color: #409eff;
  background: #f0f7ff;
}

.option-content {
  display: flex;
  align-items: center;
  gap: 12px;
}

.option-icon {
  font-size: 24px;
}

.option-info {
  flex: 1;
}

.option-title {
  font-weight: 600;
  color: #303133;
  margin-bottom: 4px;
}

.option-desc {
  color: #909399;
  font-size: 13px;
}

.day-mode-selector {
  padding: 10px;
}

.sub-option {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.specific-days-config {
  width: 100%;
  margin-top: 10px;
}

.days-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(60px, 1fr));
  gap: 8px;
  margin-top: 10px;
}

.week-config {
  padding: 10px;
}

.weekdays-selector {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(80px, 1fr));
  gap: 10px;
  margin-bottom: 15px;
}

.week-occurrence {
  display: flex;
  flex-wrap: wrap;
  gap: 15px;
}

.interval-config {
  padding: 10px;
}

.interval-input {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 15px;
  flex-wrap: wrap;
}

.execution-times {
  padding: 10px;
}

.times-list {
  margin-bottom: 15px;
}

.time-item {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}

.preview-panel {
  background: #f8f9fa;
  border-radius: 6px;
  padding: 15px;
}

.preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
  font-weight: 600;
  color: #303133;
}

.preview-content {
  min-height: 100px;
}

.empty-preview {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100px;
}

.preview-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.preview-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px;
  background: white;
  border-radius: 6px;
  border: 1px solid #e4e7ed;
}

.preview-date {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 80px;
}

.date-main {
  font-weight: 600;
  color: #303133;
}

.date-sub {
  font-size: 12px;
  color: #909399;
}

.preview-times {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.time-tag {
  font-size: 12px;
}

.rule-summary {
  padding: 10px;
}

@media (max-width: 768px) {
  .date-rule-builder {
    padding: 15px;
  }
  
  .rule-section {
    padding: 15px;
  }
  
  .rule-type-selector {
    grid-template-columns: 1fr;
  }
  
  .months-grid {
    grid-template-columns: repeat(auto-fit, minmax(80px, 1fr));
  }
  
  .days-grid {
    grid-template-columns: repeat(auto-fill, minmax(50px, 1fr));
  }
  
  .weekdays-selector {
    grid-template-columns: repeat(auto-fit, minmax(70px, 1fr));
  }
  
  .preview-item {
    flex-direction: column;
    gap: 10px;
  }
  
  .preview-times {
    justify-content: center;
  }
}
</style>