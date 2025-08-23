<template>
  <div class="mobile-date-rule-builder">
    <!-- 头部信息 -->
    <div class="rule-header">
      <h4 class="header-title">调度规则配置</h4>
      <p class="header-desc">设置任务的执行周期和时间</p>
    </div>

    <!-- 年间隔设置 - 与桌面端保持一致的第一个模块 -->
    <div class="rule-card">
      <div class="card-header">
        <div class="card-icon">
          <span class="icon-emoji">📅</span>
        </div>
        <div class="card-title-group">
          <div class="card-title">年间隔设置</div>
          <div class="card-subtitle">设置任务的年度执行间隔</div>
        </div>
      </div>
      
      <div class="card-content">
        <div class="year-interval-control">
          <label class="control-label">间隔</label>
          <div class="number-stepper">
            <button type="button" @click.prevent="decreaseYear" :disabled="localRule.intervalMode.yearInterval <= 0" class="stepper-btn">
              <span>−</span>
            </button>
            <input 
              type="number" 
              v-model.number="localRule.intervalMode.yearInterval" 
              min="0"
              max="10"
              class="stepper-input"
              @change="handleYearIntervalChange"
            />
            <button type="button" @click.prevent="increaseYear" :disabled="localRule.intervalMode.yearInterval >= 10" class="stepper-btn">
              <span>+</span>
            </button>
          </div>
          <span class="control-suffix">年</span>
        </div>
        
        <div class="status-badge-container">
          <div v-if="localRule.intervalMode.yearInterval === 0" class="status-badge warning">
            <span class="badge-icon">⚠️</span>
            <span>仅今年执行（一次性任务）</span>
          </div>
          <div v-else-if="localRule.intervalMode.yearInterval === 1" class="status-badge success">
            <span class="badge-icon">✅</span>
            <span>每年执行</span>
          </div>
          <div v-else class="status-badge info">
            <span class="badge-icon">🔄</span>
            <span>每{{ localRule.intervalMode.yearInterval }}年执行</span>
          </div>
        </div>
        
        <div v-if="localRule.yearInterval === 0 || localRule.yearInterval > 1" class="helper-text">
          <span class="helper-icon">💡</span>
          <span v-if="localRule.yearInterval === 0">
            任务仅在今年执行，具体日期由下方的月份和日期设置决定
          </span>
          <span v-else>
            任务将每{{ localRule.yearInterval }}年执行，具体日期由下方的月份和日期设置决定
          </span>
        </div>
      </div>
    </div>

    <!-- 月份选择器 - 与桌面端保持一致的第二个模块 -->
    <div class="rule-card">
      <div class="card-header">
        <div class="card-icon">
          <span class="icon-emoji">📆</span>
        </div>
        <div class="card-title-group">
          <div class="card-title">选择月份</div>
          <div class="card-subtitle">选择任务在哪些月份执行</div>
        </div>
      </div>
      
      <div class="card-content">
        <!-- 快捷选择按钮组 -->
        <div class="quick-select-group">
          <button type="button" @click.prevent="selectAllMonths($event)" class="quick-btn">全选</button>
          <button type="button" @click.prevent="clearMonths($event)" class="quick-btn">清空</button>
          <button type="button" @click.prevent="selectQuarter(1, $event)" class="quick-btn">Q1</button>
          <button type="button" @click.prevent="selectQuarter(2, $event)" class="quick-btn">Q2</button>
          <button type="button" @click.prevent="selectQuarter(3, $event)" class="quick-btn">Q3</button>
          <button type="button" @click.prevent="selectQuarter(4, $event)" class="quick-btn">Q4</button>
        </div>
        
        <!-- 月份网格 -->
        <div class="month-grid">
          <div
            v-for="month in 12"
            :key="month"
            class="month-item"
            :class="{ active: localRule.months.includes(month) }"
            @click="toggleMonth(month)"
          >
            <span class="month-number">{{ month }}</span>
            <span class="month-label">月</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 调度模式选择 - 与桌面端保持一致的第三个模块 -->
    <div class="rule-card">
      <div class="card-header">
        <div class="card-icon">
          <span class="icon-emoji">⚙️</span>
        </div>
        <div class="card-title-group">
          <div class="card-title">调度模式</div>
          <div class="card-subtitle">选择任务执行的时间规律</div>
        </div>
      </div>
      
      <div class="card-content">
        <div class="mode-selector">
          <div 
            class="mode-option"
            :class="{ active: localRule.ruleType === 'by_day' }"
            @click="setRuleType('by_day')"
          >
            <div class="mode-icon">📅</div>
            <div class="mode-info">
              <div class="mode-title">按日期执行</div>
              <div class="mode-desc">每月的特定日期</div>
            </div>
          </div>
          
          <div 
            class="mode-option"
            :class="{ active: localRule.ruleType === 'by_week' }"
            @click="setRuleType('by_week')"
          >
            <div class="mode-icon">📋</div>
            <div class="mode-info">
              <div class="mode-title">按星期执行</div>
              <div class="mode-desc">每周的特定星期</div>
            </div>
          </div>
          
          <div 
            class="mode-option"
            :class="{ active: localRule.ruleType === 'by_interval' }"
            @click="setRuleType('by_interval')"
          >
            <div class="mode-icon">🔄</div>
            <div class="mode-info">
              <div class="mode-title">按间隔执行</div>
              <div class="mode-desc">固定时间间隔</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 按日期模式配置 -->
    <div v-if="localRule.ruleType === 'by_day'" class="rule-card">
      <div class="card-header">
        <div class="card-icon">
          <span class="icon-emoji">📅</span>
        </div>
        <div class="card-title-group">
          <div class="card-title">日期设置</div>
          <div class="card-subtitle">选择每月执行的日期</div>
        </div>
      </div>
      
      <div class="card-content">
        <!-- 日期模式选择 -->
        <div class="day-mode-tabs">
          <div 
            class="day-mode-tab"
            :class="{ active: localRule.dayMode.type === 'specific_days' }"
            @click="localRule.dayMode.type = 'specific_days'; handleDayModeChange()"
          >
            指定日期
          </div>
          <div 
            class="day-mode-tab"
            :class="{ active: localRule.dayMode.type === 'last_day' }"
            @click="localRule.dayMode.type = 'last_day'; handleDayModeChange()"
          >
            月末
          </div>
          <div 
            class="day-mode-tab"
            :class="{ active: localRule.dayMode.type === 'last_workday' }"
            @click="localRule.dayMode.type = 'last_workday'; handleDayModeChange()"
          >
            最后工作日
          </div>
          <div 
            class="day-mode-tab"
            :class="{ active: localRule.dayMode.type === 'nth_workday' }"
            @click="localRule.dayMode.type = 'nth_workday'; handleDayModeChange()"
          >
            第N个工作日
          </div>
        </div>
        
        <!-- 指定日期选择 -->
        <div v-if="localRule.dayMode.type === 'specific_days'" class="specific-days-section">
          <div class="quick-select-group">
            <button type="button" @click.prevent="selectDayRange('early')" class="quick-btn">月初</button>
            <button type="button" @click.prevent="selectDayRange('middle')" class="quick-btn">月中</button>
            <button type="button" @click.prevent="selectDayRange('late')" class="quick-btn">月末</button>
            <button type="button" @click.prevent="clearDays" class="quick-btn">清空</button>
          </div>
          
          <div class="days-grid">
            <div
              v-for="day in 31"
              :key="day"
              class="day-item"
              :class="{ active: localRule.dayMode.days.includes(day) }"
              @click="toggleDay(day)"
            >
              {{ day }}
            </div>
          </div>
        </div>
        
        <!-- 第N个工作日 -->
        <div v-else-if="localRule.dayMode.type === 'nth_workday'" class="nth-workday-section">
          <div class="nth-selector">
            <label>第</label>
            <select v-model.number="localRule.dayMode.nthDay" class="nth-select">
              <option v-for="n in 31" :key="n" :value="n">{{ n }}</option>
            </select>
            <label>个工作日</label>
          </div>
        </div>
      </div>
    </div>

    <!-- 按星期模式配置 -->
    <div v-if="localRule.ruleType === 'by_week'" class="rule-card">
      <div class="card-header">
        <div class="card-icon">
          <span class="icon-emoji">📋</span>
        </div>
        <div class="card-title-group">
          <div class="card-title">星期设置</div>
          <div class="card-subtitle">选择每周执行的星期</div>
        </div>
      </div>
      
      <div class="card-content">
        <!-- 快捷选择 -->
        <div class="quick-select-group">
          <button type="button" @click.prevent="selectWeekdays" class="quick-btn">工作日</button>
          <button type="button" @click.prevent="selectWeekend" class="quick-btn">周末</button>
          <button type="button" @click.prevent="selectAllWeekdays" class="quick-btn">全选</button>
          <button type="button" @click.prevent="clearWeekdays" class="quick-btn">清空</button>
        </div>
        
        <!-- 星期选择 -->
        <div class="weekdays-grid">
          <div
            v-for="(weekday, index) in weekdays"
            :key="weekday.value"
            class="weekday-item"
            :class="{ active: localRule.weekMode.weekdays.includes(weekday.value) }"
            @click="toggleWeekday(weekday.value)"
          >
            {{ weekday.label }}
          </div>
        </div>
        
        <!-- 周期选择 -->
        <div class="occurrence-selector">
          <label>执行周期</label>
          <select v-model="localRule.weekMode.occurrence" class="occurrence-select">
            <option value="every">每周</option>
            <option value="first">第一周</option>
            <option value="second">第二周</option>
            <option value="third">第三周</option>
            <option value="fourth">第四周</option>
            <option value="last">最后一周</option>
          </select>
        </div>
      </div>
    </div>

    <!-- 按间隔模式配置 -->
    <div v-if="localRule.ruleType === 'by_interval'" class="rule-card">
      <div class="card-header">
        <div class="card-icon">
          <span class="icon-emoji">⏱️</span>
        </div>
        <div class="card-title-group">
          <div class="card-title">间隔设置</div>
          <div class="card-subtitle">设置固定时间间隔执行</div>
        </div>
      </div>
      
      <div class="card-content">
        <div class="interval-control">
          <label>每</label>
          <input 
            type="number" 
            v-model.number="localRule.intervalMode.value" 
            min="1"
            max="365"
            class="interval-input"
          />
          <select v-model="localRule.intervalMode.unit" @change="handleIntervalUnitChange" class="interval-select">
            <option value="days">天</option>
            <option value="weeks">周</option>
            <option value="months">月</option>
            <option value="years">年</option>
          </select>
          <label>执行一次</label>
        </div>
        
        <!-- 年间隔特殊说明 -->
        <div v-if="localRule.intervalMode.unit === 'years'" class="status-badge-container">
          <div v-if="localRule.intervalMode.value === 0" class="status-badge warning">
            <span class="badge-icon">⚠️</span>
            <span>仅今年执行</span>
          </div>
          <div v-else-if="localRule.intervalMode.value === 1" class="status-badge success">
            <span class="badge-icon">✅</span>
            <span>每年执行</span>
          </div>
          <div v-else class="status-badge info">
            <span class="badge-icon">🔄</span>
            <span>每{{ localRule.intervalMode.value }}年执行一次</span>
          </div>
        </div>
        
        <!-- 参考日期 -->
        <div class="reference-date-section">
          <label>起始参考日期</label>
          <input 
            type="date" 
            v-model="localRule.intervalMode.referenceDate"
            class="date-input"
          />
        </div>
      </div>
    </div>

    <!-- 排除设置 -->
    <div class="rule-card">
      <div class="card-header">
        <div class="card-icon">
          <span class="icon-emoji">🚫</span>
        </div>
        <div class="card-title-group">
          <div class="card-title">排除日期</div>
          <div class="card-subtitle">设置不执行任务的特定日期</div>
        </div>
      </div>
      
      <div class="card-content">
        <!-- 排除选项 -->
        <div class="exclude-options">
          <label class="checkbox-option">
            <input 
              type="checkbox" 
              v-model="localRule.excludeSettings.excludeHolidays"
              class="checkbox-input"
            />
            <span class="checkbox-label">排除法定节假日</span>
          </label>
          
          <label class="checkbox-option">
            <input 
              type="checkbox" 
              v-model="localRule.excludeSettings.excludeWeekends"
              class="checkbox-input"
            />
            <span class="checkbox-label">排除周末</span>
          </label>
        </div>
        
        <!-- 特定日期排除 -->
        <div class="specific-dates-section">
          <label class="section-label">指定排除日期</label>
          <div class="date-tags">
            <div 
              v-for="(date, index) in localRule.excludeSettings.specificDates" 
              :key="index"
              class="date-tag"
            >
              <span>{{ date }}</span>
              <button type="button" @click.prevent="removeSpecificDate(index)" class="tag-remove">×</button>
            </div>
          </div>
          <div class="add-date-control">
            <input 
              type="date" 
              v-model="newExcludeDate"
              class="date-input"
              placeholder="选择日期"
            />
            <button type="button" @click.prevent="addSpecificDate" class="add-btn">
              <span>添加</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 执行计划预览 - 与桌面端保持一致 -->
    <div class="rule-card">
      <div class="card-header">
        <div class="card-icon">
          <span class="icon-emoji">👁️</span>
        </div>
        <div class="card-title-group">
          <div class="card-title">执行计划预览</div>
          <div class="card-subtitle">查看未来7天的执行计划</div>
        </div>
      </div>
      
      <div class="card-content">
        <div class="preview-section">
          <!-- 工作表模式时显示时间选择 -->
          <div v-if="props.contentSource === 'worksheet' && props.worksheetTimes.length > 0" class="preview-time-selector">
            <label class="section-label">预览时间</label>
            <select v-model="selectedPreviewTime" class="modern-select">
              <option v-for="time in props.worksheetTimes" :key="time" :value="time">
                {{ time }}
              </option>
            </select>
          </div>
          
          <div class="preview-dates">
            <div class="preview-header">
              <span class="preview-title">未来7天执行计划</span>
              <button type="button" @click.prevent="refreshPreview" class="refresh-btn">
                <span>🔄</span>
              </button>
            </div>
            
            <div v-if="previewDates.length > 0" class="preview-list">
              <div v-for="date in previewDates" :key="date" class="preview-item">
                <div class="preview-date">
                  <span class="date-text">{{ formatPreviewDate(date) }}</span>
                  <span class="weekday-text">{{ getWeekdayName(new Date(date).getDay()) }}</span>
                </div>
                <div class="preview-time">
                  {{ selectedPreviewTime || props.executionTime || '09:00' }}
                </div>
              </div>
            </div>
            
            <div v-else class="preview-empty">
              <span class="empty-icon">📭</span>
              <span class="empty-text">未来7天内没有执行计划</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, reactive, onMounted, nextTick } from 'vue'

const props = defineProps({
  modelValue: {
    type: Object,
    default: () => ({
      ruleType: 'by_day',
      months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      dayMode: { type: 'specific_days', days: [], nthDay: 1 },
      weekMode: { weekdays: [], occurrence: 'every' },
      intervalMode: { value: 1, unit: 'days', referenceDate: '' },
      excludeSettings: {
        excludeHolidays: false,
        excludeWeekends: false,
        specificDates: []
      },
      executionTime: '09:00',
      yearInterval: 1
    })
  },
  executionTime: {
    type: String,
    default: '09:00'
  },
  contentSource: {
    type: String,
    default: 'manual'
  },
  worksheetTimes: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['update:modelValue', 'change'])

// 本地规则副本
const localRule = reactive({
  ruleType: 'by_day',
  months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
  dayMode: { type: 'specific_days', days: [], nthDay: 1 },
  weekMode: { weekdays: [], occurrence: 'every' },
  intervalMode: { value: 1, unit: 'days', referenceDate: '', yearInterval: 1 },
  excludeSettings: {
    excludeHolidays: false,
    excludeWeekends: false,
    specificDates: []
  }
})

// 新的排除日期
const newExcludeDate = ref('')

// 预览相关数据
const previewDates = ref([])
const selectedPreviewTime = ref('')

// 星期数据
const weekdays = [
  { value: 1, label: '一' },
  { value: 2, label: '二' },
  { value: 3, label: '三' },
  { value: 4, label: '四' },
  { value: 5, label: '五' },
  { value: 6, label: '六' },
  { value: 0, label: '日' }
]

// 年间隔操作
const decreaseYear = () => {
  if (localRule.intervalMode.yearInterval > 0) {
    localRule.intervalMode.yearInterval--
    handleYearIntervalChange()
  }
}

const increaseYear = () => {
  if (localRule.intervalMode.yearInterval < 10) {
    localRule.intervalMode.yearInterval++
    handleYearIntervalChange()
  }
}

// 设置规则类型
const setRuleType = (type) => {
  localRule.ruleType = type
  emitChange()
}

// 切换月份
const toggleMonth = (month) => {
  const index = localRule.months.indexOf(month)
  if (index > -1) {
    localRule.months.splice(index, 1)
  } else {
    localRule.months.push(month)
    localRule.months.sort((a, b) => a - b)
  }
  emitChange()
}

// 全选月份
const selectAllMonths = (event) => {
  if (event) {
    event.preventDefault()
    event.stopPropagation()
  }
  localRule.months = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
  emitChange()
}

// 清空月份
const clearMonths = (event) => {
  // 防止事件冒泡和默认行为
  if (event) {
    event.preventDefault()
    event.stopPropagation()
    event.stopImmediatePropagation()
  }
  
  // 使用 nextTick 确保 DOM 更新完成
  nextTick(() => {
    localRule.months = []
    emitChange()
  })
}

// 选择季度
const selectQuarter = (quarter, event) => {
  if (event) {
    event.preventDefault()
    event.stopPropagation()
  }
  const quarters = {
    1: [1, 2, 3],
    2: [4, 5, 6],
    3: [7, 8, 9],
    4: [10, 11, 12]
  }
  localRule.months = quarters[quarter] || []
  emitChange()
}

// 切换天数
const toggleDay = (day) => {
  const index = localRule.dayMode.days.indexOf(day)
  if (index > -1) {
    localRule.dayMode.days.splice(index, 1)
  } else {
    localRule.dayMode.days.push(day)
    localRule.dayMode.days.sort((a, b) => a - b)
  }
  emitChange()
}

// 选择日期范围
const selectDayRange = (range) => {
  const ranges = {
    early: Array.from({ length: 10 }, (_, i) => i + 1),
    middle: Array.from({ length: 10 }, (_, i) => i + 11),
    late: Array.from({ length: 11 }, (_, i) => i + 21)
  }
  localRule.dayMode.days = ranges[range] || []
  emitChange()
}

// 清空天数
const clearDays = () => {
  localRule.dayMode.days = []
  emitChange()
}

// 切换星期
const toggleWeekday = (weekday) => {
  const index = localRule.weekMode.weekdays.indexOf(weekday)
  if (index > -1) {
    localRule.weekMode.weekdays.splice(index, 1)
  } else {
    localRule.weekMode.weekdays.push(weekday)
  }
  emitChange()
}

// 选择工作日
const selectWeekdays = () => {
  localRule.weekMode.weekdays = [1, 2, 3, 4, 5]
  emitChange()
}

// 选择周末
const selectWeekend = () => {
  localRule.weekMode.weekdays = [0, 6]
  emitChange()
}

// 全选星期
const selectAllWeekdays = () => {
  localRule.weekMode.weekdays = [0, 1, 2, 3, 4, 5, 6]
  emitChange()
}

// 清空星期
const clearWeekdays = () => {
  localRule.weekMode.weekdays = []
  emitChange()
}

// 处理天模式变化
const handleDayModeChange = () => {
  if (localRule.dayMode.type === 'specific_days') {
    localRule.dayMode.days = []
  }
  emitChange()
}

// 处理年间隔变化
const handleYearIntervalChange = () => {
  // 年间隔改变时直接更新

  emitChange()
}

// 处理间隔单位变化
const handleIntervalUnitChange = () => {
  if (localRule.intervalMode.unit === 'years') {
    localRule.yearInterval = localRule.intervalMode.value
  }
  emitChange()
}

// 添加排除日期
const addSpecificDate = () => {
  if (newExcludeDate.value && !localRule.excludeSettings.specificDates.includes(newExcludeDate.value)) {
    localRule.excludeSettings.specificDates.push(newExcludeDate.value)
    localRule.excludeSettings.specificDates.sort()
    newExcludeDate.value = ''
    emitChange()
  }
}

// 移除排除日期
const removeSpecificDate = (index) => {
  localRule.excludeSettings.specificDates.splice(index, 1)
  emitChange()
}

// 发送变更事件
const emitChange = () => {
  emit('update:modelValue', { ...localRule })
  emit('change', { ...localRule })
}

// 获取星期名称
const getWeekdayName = (day) => {
  const names = ['日', '一', '二', '三', '四', '五', '六']
  return `周${names[day]}`
}

// 格式化预览日期
const formatPreviewDate = (dateStr) => {
  const date = new Date(dateStr)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${month}月${day}日`
}

// 刷新预览
const refreshPreview = () => {
  generatePreviewDates()
}

// 生成预览日期
const generatePreviewDates = () => {
  const dates = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  for (let i = 0; i < 30; i++) { // 检查未来30天
    const checkDate = new Date(today)
    checkDate.setDate(today.getDate() + i)
    
    if (shouldRunOnDate(checkDate)) {
      dates.push(checkDate.toISOString().split('T')[0])
      if (dates.length >= 7) break // 只显示前7个执行日期
    }
  }
  
  previewDates.value = dates
}

// 检查日期是否应该执行
const shouldRunOnDate = (date) => {
  const month = date.getMonth() + 1
  const dayOfMonth = date.getDate()
  const dayOfWeek = date.getDay()
  
  // 检查年间隔
  if (localRule.intervalMode.yearInterval === 0) {
    // 仅今年执行
    const today = new Date()
    if (date.getFullYear() !== today.getFullYear()) {
      return false
    }
  } else if (localRule.intervalMode.yearInterval > 1) {
    // 每N年执行
    const today = new Date()
    const yearDiff = date.getFullYear() - today.getFullYear()
    if (yearDiff % localRule.intervalMode.yearInterval !== 0) {
      return false
    }
  }
  
  // 检查月份
  if (!localRule.months.includes(month)) {
    return false
  }
  
  // 检查排除设置
  if (localRule.excludeSettings.excludeWeekends && (dayOfWeek === 0 || dayOfWeek === 6)) {
    return false
  }
  
  const dateStr = date.toISOString().split('T')[0]
  if (localRule.excludeSettings.specificDates?.includes(dateStr)) {
    return false
  }
  
  // 根据规则类型检查
  switch (localRule.ruleType) {
    case 'by_day':
      if (localRule.dayMode.type === 'specific_days') {
        return localRule.dayMode.days.includes(dayOfMonth)
      } else if (localRule.dayMode.type === 'last_day') {
        const nextDay = new Date(date)
        nextDay.setDate(date.getDate() + 1)
        return nextDay.getMonth() !== date.getMonth()
      }
      break
      
    case 'by_week':
      const weekdayMatch = localRule.weekMode.weekdays.includes(dayOfWeek === 0 ? 7 : dayOfWeek)
      if (!weekdayMatch) return false
      
      if (localRule.weekMode.occurrence !== 'every') {
        const weekOfMonth = Math.ceil(dayOfMonth / 7)
        const isLastWeek = dayOfMonth + 7 > new Date(date.getFullYear(), month, 0).getDate()
        
        switch (localRule.weekMode.occurrence) {
          case 'first': return weekOfMonth === 1
          case 'second': return weekOfMonth === 2
          case 'third': return weekOfMonth === 3
          case 'fourth': return weekOfMonth === 4
          case 'last': return isLastWeek
        }
      }
      return true
      
    case 'by_interval':
      if (localRule.intervalMode.referenceDate) {
        const refDate = new Date(localRule.intervalMode.referenceDate)
        const daysDiff = Math.floor((date - refDate) / (1000 * 60 * 60 * 24))
        
        switch (localRule.intervalMode.unit) {
          case 'days':
            return daysDiff >= 0 && daysDiff % localRule.intervalMode.value === 0
          case 'weeks':
            return daysDiff >= 0 && daysDiff % (localRule.intervalMode.value * 7) === 0
          case 'months':
            const monthsDiff = (date.getFullYear() - refDate.getFullYear()) * 12 + 
                             (date.getMonth() - refDate.getMonth())
            return monthsDiff >= 0 && monthsDiff % localRule.intervalMode.value === 0 &&
                   date.getDate() === refDate.getDate()
        }
      }
      break
  }
  
  return false
}

// 初始化预览时间
watch(() => props.worksheetTimes, (times) => {
  if (times && times.length > 0 && !selectedPreviewTime.value) {
    selectedPreviewTime.value = times[0]
  }
}, { immediate: true })

// 监听规则变化，更新预览
watch(() => localRule, () => {
  generatePreviewDates()
}, { deep: true })

// 监听props变化
watch(() => props.modelValue, (newVal) => {
  if (newVal) {
    const ruleCopy = JSON.parse(JSON.stringify(newVal))
    // 确保intervalMode.yearInterval有默认值
    if (!ruleCopy.intervalMode) {
      ruleCopy.intervalMode = { value: 1, unit: 'days', referenceDate: '', yearInterval: 1 }
    }
    if (ruleCopy.intervalMode.yearInterval === undefined) {
      ruleCopy.intervalMode.yearInterval = 1
    }
    Object.assign(localRule, ruleCopy)
  }
}, { immediate: true, deep: true })

// 组件挂载时初始化预览
onMounted(() => {
  generatePreviewDates()
})
</script>

<style scoped>
/* 现代化移动端设计风格 */
.mobile-date-rule-builder {
  padding: 0;
  background: #f5f6fa;
  min-height: 100vh;
}

/* 头部样式 */
.rule-header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 24px 20px;
  margin-bottom: 16px;
}

.header-title {
  font-size: 20px;
  font-weight: 600;
  margin: 0 0 8px 0;
}

.header-desc {
  font-size: 14px;
  opacity: 0.9;
  margin: 0;
}

/* 卡片容器 */
.rule-card {
  background: white;
  border-radius: 16px;
  margin: 0 16px 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  overflow: hidden;
  transition: all 0.3s ease;
}

.rule-card:active {
  transform: scale(0.98);
}

/* 卡片头部 */
.card-header {
  display: flex;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid #f0f0f0;
}

.card-icon {
  width: 40px;
  height: 40px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 12px;
  flex-shrink: 0;
}

.icon-emoji {
  font-size: 20px;
  filter: grayscale(0%) brightness(1.2);
}

.card-title-group {
  flex: 1;
}

.card-title {
  font-size: 16px;
  font-weight: 600;
  color: #2c3e50;
  margin-bottom: 4px;
}

.card-subtitle {
  font-size: 12px;
  color: #95a5a6;
}

/* 卡片内容 */
.card-content {
  padding: 16px;
}

/* 年间隔控制 */
.year-interval-control {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.control-label {
  font-size: 14px;
  color: #7f8c8d;
}

.number-stepper {
  display: flex;
  align-items: center;
  background: #f8f9fa;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid #e9ecef;
}

.stepper-btn {
  width: 44px;
  height: 44px;
  border: none;
  background: transparent;
  color: #667eea;
  font-size: 20px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.stepper-btn:active {
  background: #667eea;
  color: white;
}

.stepper-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.stepper-input {
  width: 60px;
  height: 44px;
  border: none;
  background: transparent;
  text-align: center;
  font-size: 18px;
  font-weight: 600;
  color: #2c3e50;
}

.control-suffix {
  font-size: 14px;
  color: #7f8c8d;
}

/* 状态徽章 */
.status-badge-container {
  margin: 16px 0;
}

.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 500;
}

.status-badge.warning {
  background: #fff3cd;
  color: #856404;
  border: 1px solid #ffeaa7;
}

.status-badge.success {
  background: #d4edda;
  color: #155724;
  border: 1px solid #c3e6cb;
}

.status-badge.info {
  background: #d1ecf1;
  color: #0c5460;
  border: 1px solid #bee5eb;
}

.badge-icon {
  font-size: 16px;
}

/* 帮助文本 */
.helper-text {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 12px;
  background: #f8f9fa;
  border-radius: 8px;
  font-size: 12px;
  color: #6c757d;
  line-height: 1.5;
}

.helper-icon {
  font-size: 14px;
  flex-shrink: 0;
}

/* 快捷选择按钮组 */
.quick-select-group {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.quick-btn {
  flex: 1;
  min-width: 60px;
  padding: 10px 12px;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  background: white;
  color: #495057;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.quick-btn:active {
  background: #667eea;
  color: white;
  border-color: #667eea;
  transform: scale(0.95);
}

/* 月份网格 */
.month-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
}

.month-item {
  aspect-ratio: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border: 2px solid #e9ecef;
  border-radius: 12px;
  background: white;
  cursor: pointer;
  transition: all 0.2s;
  position: relative;
  overflow: hidden;
}

.month-item.active {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-color: #667eea;
  color: white;
  transform: scale(0.95);
}

.month-item:active {
  transform: scale(0.9);
}

.month-number {
  font-size: 18px;
  font-weight: 600;
}

.month-label {
  font-size: 12px;
  margin-top: 2px;
}

/* 模式选择器 */
.mode-selector {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.mode-option {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  border: 2px solid #e9ecef;
  border-radius: 12px;
  background: white;
  cursor: pointer;
  transition: all 0.2s;
}

.mode-option.active {
  border-color: #667eea;
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%);
}

.mode-option:active {
  transform: scale(0.98);
}

.mode-icon {
  font-size: 24px;
  width: 48px;
  height: 48px;
  background: #f8f9fa;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.mode-option.active .mode-icon {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.mode-info {
  flex: 1;
}

.mode-title {
  font-size: 15px;
  font-weight: 600;
  color: #2c3e50;
  margin-bottom: 4px;
}

.mode-desc {
  font-size: 12px;
  color: #95a5a6;
}

/* 日期模式标签 */
.day-mode-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

.day-mode-tab {
  flex: 1;
  min-width: 80px;
  padding: 10px 12px;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  background: white;
  color: #495057;
  font-size: 13px;
  font-weight: 500;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.day-mode-tab.active {
  background: #667eea;
  color: white;
  border-color: #667eea;
}

/* 天数网格 */
.days-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 8px;
  margin-top: 16px;
}

.day-item {
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  background: white;
  font-size: 14px;
  font-weight: 500;
  color: #495057;
  cursor: pointer;
  transition: all 0.2s;
}

.day-item.active {
  background: #667eea;
  color: white;
  border-color: #667eea;
  transform: scale(0.9);
}

.day-item:active {
  transform: scale(0.85);
}

/* 第N个工作日 */
.nth-selector {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  background: #f8f9fa;
  border-radius: 8px;
}

.nth-select {
  padding: 8px 12px;
  border: 1px solid #e9ecef;
  border-radius: 6px;
  background: white;
  font-size: 14px;
  min-height: 44px;
}

/* 星期网格 */
.weekdays-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 8px;
  margin-bottom: 16px;
}

.weekday-item {
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid #e9ecef;
  border-radius: 12px;
  background: white;
  font-size: 16px;
  font-weight: 600;
  color: #495057;
  cursor: pointer;
  transition: all 0.2s;
}

.weekday-item.active {
  background: #667eea;
  color: white;
  border-color: #667eea;
  transform: scale(0.9);
}

/* 周期选择器 */
.occurrence-selector {
  display: flex;
  align-items: center;
  gap: 12px;
}

.occurrence-select {
  flex: 1;
  padding: 12px;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  background: white;
  font-size: 14px;
  min-height: 44px;
}

/* 间隔控制 */
.interval-control {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  background: #f8f9fa;
  border-radius: 8px;
  margin-bottom: 16px;
}

.interval-input {
  width: 80px;
  padding: 10px;
  border: 1px solid #e9ecef;
  border-radius: 6px;
  background: white;
  text-align: center;
  font-size: 16px;
  min-height: 44px;
}

.interval-select {
  padding: 10px;
  border: 1px solid #e9ecef;
  border-radius: 6px;
  background: white;
  font-size: 14px;
  min-height: 44px;
}

/* 参考日期 */
.reference-date-section {
  margin-top: 16px;
}

.reference-date-section label {
  display: block;
  font-size: 14px;
  color: #7f8c8d;
  margin-bottom: 8px;
}

/* 排除选项 */
.exclude-options {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 20px;
}

.checkbox-option {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: #f8f9fa;
  border-radius: 8px;
  cursor: pointer;
}

.checkbox-input {
  width: 20px;
  height: 20px;
  accent-color: #667eea;
}

.checkbox-label {
  font-size: 14px;
  color: #495057;
  user-select: none;
}

/* 特定日期 */
.specific-dates-section {
  margin-top: 16px;
}

.section-label {
  display: block;
  font-size: 14px;
  color: #7f8c8d;
  margin-bottom: 12px;
}

.date-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
  min-height: 32px;
}

.date-tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  background: #e3f2fd;
  border: 1px solid #90caf9;
  border-radius: 20px;
  font-size: 13px;
  color: #1976d2;
}

.tag-remove {
  width: 18px;
  height: 18px;
  border: none;
  background: #1976d2;
  color: white;
  border-radius: 50%;
  font-size: 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.tag-remove:active {
  transform: scale(0.8);
}

/* 添加日期控制 */
.add-date-control {
  display: flex;
  gap: 8px;
}

.date-input {
  flex: 1;
  padding: 12px;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  background: white;
  font-size: 16px;
  min-height: 44px;
}

.add-btn {
  padding: 12px 24px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  min-height: 44px;
}

.add-btn:active {
  transform: scale(0.95);
}

/* 时间输入 */
.time-input {
  width: 100%;
  padding: 12px;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  background: white;
  font-size: 16px;
  min-height: 44px;
}

/* 预览相关样式 */
.preview-section {
  padding: 4px;
}

.preview-time-selector {
  margin-bottom: 16px;
}

.preview-dates {
  background: #f8f9fa;
  border-radius: 12px;
  padding: 16px;
}

.preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.preview-title {
  font-size: 14px;
  font-weight: 600;
  color: #333;
}

.refresh-btn {
  background: white;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  padding: 6px 10px;
  font-size: 18px;
  cursor: pointer;
  transition: all 0.2s;
}

.refresh-btn:active {
  transform: scale(0.95);
}

.preview-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.preview-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  background: white;
  border-radius: 8px;
  border: 1px solid #e9ecef;
}

.preview-date {
  display: flex;
  align-items: center;
  gap: 8px;
}

.date-text {
  font-size: 14px;
  font-weight: 500;
  color: #333;
}

.weekday-text {
  font-size: 12px;
  color: #999;
  background: #f0f0f0;
  padding: 2px 6px;
  border-radius: 4px;
}

.preview-time {
  font-size: 14px;
  font-weight: 600;
  color: #667eea;
}

.preview-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px;
  gap: 12px;
}

.empty-icon {
  font-size: 48px;
  opacity: 0.5;
}

.empty-text {
  font-size: 14px;
  color: #999;
}

/* 响应式优化 */
@media (max-width: 360px) {
  .month-grid {
    grid-template-columns: repeat(3, 1fr);
  }
  
  .days-grid {
    grid-template-columns: repeat(6, 1fr);
  }
  
  .weekdays-grid {
    grid-template-columns: repeat(4, 1fr);
  }
}
</style>