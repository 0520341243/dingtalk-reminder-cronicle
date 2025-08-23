<template>
  <div class="date-rule-builder">
    <div class="rule-header">
      <h4>调度规则配置</h4>
      <p>设置任务的执行周期和时间</p>
    </div>

    <!-- 年间隔设置 -->
    <div class="rule-section">
      <div class="section-title">
        <el-icon><Calendar /></el-icon>
        年间隔设置
      </div>
      <div class="section-description">
        设置任务的年度执行间隔（0表示仅今年执行，1表示每年执行，2表示每2年执行）
      </div>
      <div class="year-interval-config">
        <div class="year-interval-input">
          <span>间隔</span>
          <el-input-number
            v-model="yearIntervalValue"
            :min="0"
            :max="10"
            size="small"
            style="width: 100px; margin: 0 8px;"
            @change="handleYearIntervalChange"
          />
          <span>年</span>
          <el-tag v-if="yearIntervalValue === 0" type="warning" style="margin-left: 16px;">
            仅今年执行（一次性任务）
          </el-tag>
          <el-tag v-else-if="yearIntervalValue === 1" type="success" style="margin-left: 16px;">
            每年执行
          </el-tag>
          <el-tag v-else type="info" style="margin-left: 16px;">
            每{{ yearIntervalValue }}年执行
          </el-tag>
        </div>
        <div v-if="yearIntervalValue === 0" style="margin-top: 16px; color: #909399; font-size: 12px;">
          提示：任务仅在今年执行，具体日期由下方的月份和日期设置决定
        </div>
        <div v-else-if="yearIntervalValue > 1" style="margin-top: 16px; color: #909399; font-size: 12px;">
          提示：任务将每{{ yearIntervalValue }}年执行，具体日期由下方的月份和日期设置决定
        </div>
      </div>
    </div>

    <!-- 月份选择器 - 增强版 -->
    <div class="rule-section">
      <div class="section-title">
        <el-icon><Calendar /></el-icon>
        选择月份
      </div>
      <div class="section-description">
        选择任务在哪些月份执行（默认全年）
      </div>
      
      <!-- 快捷选择按钮 -->
      <div class="quick-select-buttons">
        <el-button-group>
          <el-button size="small" @click="selectAllMonths">全选</el-button>
          <el-button size="small" @click="clearMonths">清空</el-button>
          <el-button size="small" @click="selectQuarter(1)">第一季度</el-button>
          <el-button size="small" @click="selectQuarter(2)">第二季度</el-button>
          <el-button size="small" @click="selectQuarter(3)">第三季度</el-button>
          <el-button size="small" @click="selectQuarter(4)">第四季度</el-button>
        </el-button-group>
      </div>
      
      <div class="month-selector">
        <el-checkbox
          v-model="allMonthsSelected"
          :indeterminate="isMonthIndeterminate"
          @change="handleAllMonthsChange"
        >
          全选
        </el-checkbox>
        <el-checkbox-group v-model="selectedMonths" class="months-grid">
          <el-checkbox
            v-for="month in 12"
            :key="month"
            :label="month"
            @change="handleMonthChange"
          >
            {{ getMonthName(month) }}
          </el-checkbox>
        </el-checkbox-group>
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
        <el-radio-group v-model="dayMode.type" @change="handleDayModeChange" class="day-mode-radio-group">
          <el-radio label="specific_days" class="day-mode-radio">
            <span>指定日期</span>
          </el-radio>
          
          <el-radio label="last_day" class="day-mode-radio">
            <span>每月最后一天</span>
          </el-radio>
          
          <el-radio label="last_workday" class="day-mode-radio">
            <span>每月最后一个工作日</span>
          </el-radio>
          
          <el-radio label="nth_workday" class="day-mode-radio">
            <div class="nth-workday-option">
              <span style="margin-right: 8px;">第</span>
              <el-input-number
                v-model="dayMode.nthDay"
                :min="1"
                :max="31"
                size="small"
                :controls-position="'right'"
                style="width: 80px;"
                :disabled="dayMode.type !== 'nth_workday'"
              />
              <span style="margin-left: 8px;">个工作日</span>
            </div>
          </el-radio>
        </el-radio-group>
        
        <!-- 指定日期选择面板 - 独立显示 -->
        <div v-if="dayMode.type === 'specific_days'" class="specific-days-panel">
          <div class="quick-day-select">
            <el-button-group size="small">
              <el-button @click="selectDayRange('early')">月初(1-10)</el-button>
              <el-button @click="selectDayRange('middle')">月中(11-20)</el-button>
              <el-button @click="selectDayRange('late')">月末(21-31)</el-button>
              <el-button @click="clearDays">清空</el-button>
            </el-button-group>
          </div>
          <el-checkbox-group v-model="dayMode.days" class="days-grid">
            <el-checkbox
              v-for="day in 31"
              :key="day"
              :label="day"
              :disabled="!isDayValid(day)"
              size="small"
            >
              {{ day }}
            </el-checkbox>
          </el-checkbox-group>
        </div>
      </div>
    </div>

    <!-- 按星期模式配置 - 增强版 -->
    <div v-if="ruleType === 'by_week'" class="rule-section">
      <div class="section-title">
        <el-icon><Calendar /></el-icon>
        星期设置
      </div>
      <div class="week-config">
        <!-- 星期快捷选择 -->
        <div class="quick-week-select">
          <el-button-group size="small">
            <el-button @click="selectWeekdays">工作日(周一至周五)</el-button>
            <el-button @click="selectWeekend">周末(周六周日)</el-button>
            <el-button @click="selectAllWeekdays">全选</el-button>
            <el-button @click="clearWeekdays">清空</el-button>
          </el-button-group>
        </div>
        
        <el-checkbox-group v-model="weekMode.weekdays" class="weekdays-selector">
          <el-checkbox
            v-for="(day, index) in weekDays"
            :key="index"
            :label="index + 1"
          >
            {{ day }}
          </el-checkbox>
        </el-checkbox-group>
        
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
      <div class="section-description">
        设置固定时间间隔执行（月份选择仍然有效，只在选中的月份执行）
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
              :teleported="true"
              style="width: 200px;"
            />
          </el-form-item>
        </div>
      </div>
    </div>

    <!-- 排除日期设置 - 新增功能 -->
    <div class="rule-section">
      <div class="section-title">
        <el-icon><CircleClose /></el-icon>
        排除日期
      </div>
      <div class="section-description">
        设置不执行任务的特定日期（如节假日、特殊日期等）
      </div>
      <div class="exclude-dates-config">
        <div class="exclude-options">
          <el-checkbox v-model="excludeSettings.excludeHolidays">
            排除法定节假日
          </el-checkbox>
          <el-button 
            v-if="excludeSettings.excludeHolidays" 
            link 
            type="primary" 
            size="small"
            @click="showHolidayManager"
          >
            查看/配置节假日
          </el-button>
          <el-checkbox v-model="excludeSettings.excludeWeekends" style="margin-left: 20px;">
            排除周末
          </el-checkbox>
        </div>
        
        <div class="specific-exclude-dates">
          <div class="exclude-date-label">指定排除日期：</div>
          <el-date-picker
            v-model="excludeSettings.specificDates"
            type="dates"
            placeholder="选择要排除的日期"
            format="YYYY-MM-DD"
            value-format="YYYY-MM-DD"
            :disabled-date="disabledDate"
            :teleported="true"
            :popper-class="'date-picker-popper'"
            style="width: 100%;"
          />
        </div>
        
        <div v-if="excludeSettings.specificDates && excludeSettings.specificDates.length > 0" class="excluded-dates-list">
          <el-tag
            v-for="date in excludeSettings.specificDates"
            :key="date"
            closable
            @close="removeExcludeDate(date)"
            style="margin-right: 8px; margin-bottom: 8px;"
          >
            {{ date }}
          </el-tag>
        </div>
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
          <div class="preview-header-left">
            <span>未来7天执行计划</span>
            <!-- 工作表模式时显示时间选择 -->
            <el-select 
              v-if="props.contentSource === 'worksheet' && props.worksheetTimes.length > 0"
              v-model="selectedPreviewTime"
              size="small"
              placeholder="选择预览时间"
              style="margin-left: 12px; width: 150px;"
            >
              <el-option
                v-for="time in props.worksheetTimes"
                :key="time.time"
                :label="`${time.time} - ${time.content?.substring(0, 20)}...`"
                :value="time.time"
              />
            </el-select>
            <!-- 手动模式显示单一时间 -->
            <el-tag v-else-if="props.executionTime" size="small" style="margin-left: 12px;">
              执行时间: {{ props.executionTime }}
            </el-tag>
          </div>
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
              :class="{ excluded: item.excluded }"
            >
              <div class="preview-date">
                <div class="date-main">{{ item.dateDisplay }}</div>
                <div class="date-sub">{{ item.weekday }}</div>
                <el-tag v-if="item.excluded" type="danger" size="small">
                  {{ item.excludeReason || '已排除' }}
                </el-tag>
              </div>
              <div v-if="!item.excluded" class="preview-status">
                <el-tag v-if="displayTime" type="info" size="small">
                  {{ displayTime }}
                </el-tag>
                <el-tag type="success" size="small">
                  将执行
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
    
    <!-- 节假日管理器 -->
    <HolidayManager 
      v-model="holidayManagerVisible"
      :year="currentYear"
      @save="handleHolidaysSave"
    />
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import {
  Calendar, Setting, Clock, Timer, View, Document, Refresh,
  Plus, Delete, CircleClose
} from '@element-plus/icons-vue'
import HolidayManager from './HolidayManager.vue'

const props = defineProps({
  modelValue: {
    type: Object,
    default: () => ({
      ruleType: 'by_day',
      months: [],
      dayMode: { type: 'specific_days', days: [], nthDay: 1 },
      weekMode: { weekdays: [], occurrence: 'every' },
      intervalMode: { value: 1, unit: 'days', referenceDate: '' },
      excludeSettings: {
        excludeHolidays: false,
        excludeWeekends: false,
        specificDates: []
      }
    })
  },
  executionTime: {
    type: String,
    default: '09:00'
  },
  contentSource: {
    type: String,
    default: 'manual' // manual | worksheet
  },
  worksheetTimes: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['update:modelValue', 'change'])

// 响应式数据
const ruleType = ref(props.modelValue.ruleType || 'by_day')
const selectedMonths = ref(props.modelValue.months !== undefined ? props.modelValue.months : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
const dayMode = reactive(props.modelValue.dayMode || { type: 'specific_days', days: [], nthDay: 1 }) // 不默认15号
const weekMode = reactive(props.modelValue.weekMode || { weekdays: [], occurrence: 'every' })
const intervalMode = reactive(props.modelValue.intervalMode || { value: 1, unit: 'days', referenceDate: '' })

// 年间隔相关数据
const yearIntervalValue = ref(1) // 默认每年执行
const yearReferenceDate = ref('')

// 初始化年间隔设置
const initYearInterval = () => {
  if (props.modelValue.intervalMode && props.modelValue.intervalMode.unit === 'years') {
    yearIntervalValue.value = props.modelValue.intervalMode.value || 1
    yearReferenceDate.value = props.modelValue.intervalMode.referenceDate || ''
  }
}
initYearInterval()

// 确保 excludeSettings 的值是正确的类型
const initExcludeSettings = () => {
  const settings = props.modelValue.excludeSettings || {}
  return {
    excludeHolidays: typeof settings.excludeHolidays === 'boolean' ? settings.excludeHolidays : false,
    excludeWeekends: typeof settings.excludeWeekends === 'boolean' ? settings.excludeWeekends : false,
    specificDates: Array.isArray(settings.specificDates) ? settings.specificDates : []
  }
}

const excludeSettings = reactive(initExcludeSettings())

const previewLoading = ref(false)
const previewData = ref([])
const holidayManagerVisible = ref(false)
const currentYear = ref(new Date().getFullYear())
const configuredHolidays = ref([])
const selectedPreviewTime = ref('')

const weekDays = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']

// 计算属性
const allMonthsSelected = computed({
  get: () => selectedMonths.value.length === 12,
  set: (val) => {
    if (val) {
      selectedMonths.value = Array.from({ length: 12 }, (_, i) => i + 1)
    } else {
      selectedMonths.value = []
    }
  }
})

const isMonthIndeterminate = computed(() => {
  return selectedMonths.value.length > 0 && selectedMonths.value.length < 12
})

const displayTime = computed(() => {
  if (props.contentSource === 'worksheet' && selectedPreviewTime.value) {
    return selectedPreviewTime.value
  } else if (props.contentSource === 'manual' && props.executionTime) {
    return props.executionTime
  }
  return ''
})

const ruleSummary = computed(() => {
  const parts = []
  
  // 年间隔
  if (yearIntervalValue.value === 0) {
    parts.push('仅今年执行（一次性任务）')
  } else if (yearIntervalValue.value > 1) {
    parts.push(`每${yearIntervalValue.value}年`)
  }
  // 如果是每年执行（yearIntervalValue === 1），不特别说明
  
  // 月份
  if (selectedMonths.value.length === 12) {
    if (yearIntervalValue.value === 1 || yearIntervalValue.value === undefined) {  // 每年执行才显示"全年"
      parts.push('全年')
    }
  } else if (selectedMonths.value.length > 0) {
    parts.push(`${selectedMonths.value.map(m => `${m}月`).join('、')}`)
  }
  
  // 执行规则
  if (ruleType.value === 'by_day') {
    if (dayMode.type === 'specific_days' && dayMode.days.length > 0) {
      parts.push(`每月${dayMode.days.join('、')}号`)
    } else if (dayMode.type === 'last_day') {
      parts.push('每月最后一天')
    } else if (dayMode.type === 'last_workday') {
      parts.push('每月最后一个工作日')
    } else if (dayMode.type === 'nth_workday') {
      parts.push(`每月第${dayMode.nthDay}个工作日`)
    }
  } else if (ruleType.value === 'by_week') {
    const weekdayNames = weekMode.weekdays.map(d => weekDays[d - 1]).join('、')
    const occurrenceText = {
      'every': '每周',
      'first': '第一周',
      'second': '第二周',
      'third': '第三周',
      'fourth': '第四周',
      'last': '最后一周'
    }[weekMode.occurrence] || '每周'
    
    if (weekdayNames) {
      parts.push(`${occurrenceText}的${weekdayNames}`)
    }
  } else if (ruleType.value === 'by_interval') {
    const unitText = {
      'days': '天',
      'weeks': '周',
      'months': '月',
      'years': '年'
    }[intervalMode.unit] || '天'
    
    parts.push(`每${intervalMode.value}${unitText}`)
    
    // 如果不是全年执行，添加月份说明
    if (selectedMonths.value.length < 12) {
      parts.push(`(限${selectedMonths.value.map(m => `${m}月`).join('、')})`)
    }
  }
  
  // 排除设置
  const excludeParts = []
  if (excludeSettings.excludeHolidays) excludeParts.push('法定节假日')
  if (excludeSettings.excludeWeekends) excludeParts.push('周末')
  if (excludeSettings.specificDates?.length > 0) {
    excludeParts.push(`${excludeSettings.specificDates.length}个指定日期`)
  }
  if (excludeParts.length > 0) {
    parts.push(`（排除${excludeParts.join('、')}）`)
  }
  
  return parts.join('，') || '请配置调度规则'
})

// 方法
const getMonthName = (month) => {
  return `${month}月`
}

// 季度选择
const selectQuarter = (quarter) => {
  const quarterMonths = {
    1: [1, 2, 3],
    2: [4, 5, 6],
    3: [7, 8, 9],
    4: [10, 11, 12]
  }
  selectedMonths.value = quarterMonths[quarter]
  ElMessage.success(`已选择第${quarter}季度`)
}

const selectAllMonths = () => {
  selectedMonths.value = Array.from({ length: 12 }, (_, i) => i + 1)
}

const clearMonths = () => {
  console.log('清空月份前:', selectedMonths.value)
  selectedMonths.value = []
  console.log('清空月份后:', selectedMonths.value)
  emitChange()
}

// 日期范围选择
const selectDayRange = (range) => {
  const ranges = {
    'early': Array.from({ length: 10 }, (_, i) => i + 1),
    'middle': Array.from({ length: 10 }, (_, i) => i + 11),
    'late': Array.from({ length: 11 }, (_, i) => i + 21)
  }
  dayMode.days = ranges[range]
}

const clearDays = () => {
  dayMode.days = []
}

// 星期快捷选择
const selectWeekdays = () => {
  weekMode.weekdays = [1, 2, 3, 4, 5] // 周一至周五
  ElMessage.success('已选择工作日')
}

const selectWeekend = () => {
  weekMode.weekdays = [6, 7] // 周六周日
  ElMessage.success('已选择周末')
}

const selectAllWeekdays = () => {
  weekMode.weekdays = [1, 2, 3, 4, 5, 6, 7]
}

const clearWeekdays = () => {
  weekMode.weekdays = []
}

const isDayValid = (day) => {
  // 2月最多29天，4、6、9、11月最多30天
  const has30Days = [4, 6, 9, 11]
  if (selectedMonths.value.some(m => has30Days.includes(m)) && day > 30) {
    return false
  }
  if (selectedMonths.value.includes(2) && day > 29) {
    return false
  }
  return true
}

const handleAllMonthsChange = (val) => {
  if (val) {
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
  emitChange()
}

// 年间隔处理方法
const handleYearIntervalChange = () => {
  // 年间隔仅用于控制年度执行，不影响月/周/日的选择
  // 所有年间隔（包括0年）都通过月份和日期规则确定执行时间
  emitChange()
}

const handleYearReferenceDateChange = () => {
  emitChange()
}

const removeExcludeDate = (date) => {
  const index = excludeSettings.specificDates.indexOf(date)
  if (index > -1) {
    excludeSettings.specificDates.splice(index, 1)
    emitChange()
  }
}

const disabledDate = (date) => {
  // 可以添加逻辑限制可选日期范围
  return false
}

const showHolidayManager = () => {
  holidayManagerVisible.value = true
}

const handleHolidaysSave = (data) => {
  configuredHolidays.value = data.holidays
  // 可以在这里更新预览
  generatePreview()
}

const loadHolidays = () => {
  // 从localStorage加载已配置的节假日
  const savedHolidays = localStorage.getItem(`holidays_${currentYear.value}`)
  if (savedHolidays) {
    configuredHolidays.value = JSON.parse(savedHolidays)
  }
}

const generatePreview = async () => {
  previewLoading.value = true
  try {
    // 模拟生成预览数据
    const preview = []
    const today = new Date()
    const weekdayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(today.getTime() + i * 24 * 60 * 60 * 1000)
      const month = date.getMonth() + 1
      const day = date.getDate()
      const weekday = date.getDay()
      
      // 检查是否被排除
      let excluded = false
      let excludeReason = ''
      
      // 检查是否排除周末
      if (excludeSettings.excludeWeekends && (weekday === 0 || weekday === 6)) {
        excluded = true
        excludeReason = '周末'
      }
      
      // 检查是否在排除日期列表中
      const dateStr = `${date.getFullYear()}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      if (excludeSettings.specificDates?.includes(dateStr)) {
        excluded = true
        excludeReason = '指定排除'
      }
      
      // 检查是否是法定节假日
      if (excludeSettings.excludeHolidays && configuredHolidays.value.some(h => h.date === dateStr)) {
        excluded = true
        const holiday = configuredHolidays.value.find(h => h.date === dateStr)
        excludeReason = holiday ? holiday.name : '节假日'
      }
      
      // 检查是否符合执行规则
      let shouldExecute = false
      
      if (selectedMonths.value.includes(month)) {
        if (ruleType.value === 'by_day') {
          if (dayMode.type === 'specific_days' && dayMode.days.includes(day)) {
            shouldExecute = true
          }
        } else if (ruleType.value === 'by_week') {
          if (weekMode.weekdays.includes(weekday === 0 ? 7 : weekday)) {
            shouldExecute = true
          }
        } else if (ruleType.value === 'by_interval') {
          // 简化的间隔计算
          shouldExecute = i % intervalMode.value === 0
        }
      }
      
      if (shouldExecute) {
        preview.push({
          key: dateStr,
          dateDisplay: `${month}月${day}日`,
          weekday: weekdayNames[weekday],
          excluded,
          excludeReason
        })
      }
    }
    
    previewData.value = preview
  } catch (error) {
    ElMessage.error('生成预览失败')
  } finally {
    previewLoading.value = false
  }
}

const emitChange = () => {
  // 构建完整的调度规则
  let finalRuleType = ruleType.value
  let finalIntervalMode = { ...intervalMode }
  
  // 处理年间隔逻辑
  if (yearIntervalValue.value === 0 || yearIntervalValue.value > 1) {
    // 0年（仅今年）或大于1年时，添加年间隔信息
    // 年间隔作为额外的过滤条件，与月份/日期/星期规则组合
    finalIntervalMode.yearInterval = yearIntervalValue.value
    
    // 保持当前的规则类型（by_day、by_week 或 by_interval）
    // 年间隔只作为额外的过滤条件
  } else if (yearIntervalValue.value === 1) {
    // 每年执行，清除年间隔相关信息
    delete finalIntervalMode.yearInterval
    delete finalIntervalMode.yearReferenceDate
    
    // 如果之前是年间隔模式，重置
    if (intervalMode.unit === 'years') {
      finalIntervalMode.value = 1
      finalIntervalMode.unit = 'days'
      finalIntervalMode.referenceDate = ''
    }
  }
  
  const value = {
    ruleType: finalRuleType,
    months: selectedMonths.value,
    dayMode: { ...dayMode },
    weekMode: { ...weekMode },
    intervalMode: finalIntervalMode,
    excludeSettings: { ...excludeSettings }
  }
  emit('update:modelValue', value)
  emit('change', value)
}

// 监听变化
watch(() => props.modelValue, (newVal) => {
  if (newVal) {
    ruleType.value = newVal.ruleType || 'by_day'
    // 如果 months 是 undefined 或 null，使用全部月份；如果是空数组，保持为空数组
    selectedMonths.value = newVal.months !== undefined ? newVal.months : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
    Object.assign(dayMode, newVal.dayMode || { type: 'specific_days', days: [], nthDay: 1 }) // 改为空数组，不默认15号
    Object.assign(weekMode, newVal.weekMode || { weekdays: [], occurrence: 'every' })
    Object.assign(intervalMode, newVal.intervalMode || { value: 1, unit: 'days', referenceDate: '' })
    // 使用相同的类型检查逻辑
    const settings = newVal.excludeSettings || {}
    Object.assign(excludeSettings, {
      excludeHolidays: typeof settings.excludeHolidays === 'boolean' ? settings.excludeHolidays : false,
      excludeWeekends: typeof settings.excludeWeekends === 'boolean' ? settings.excludeWeekends : false,
      specificDates: Array.isArray(settings.specificDates) ? settings.specificDates : []
    })
  }
}, { deep: true })

// 监听所有数据变化并更新父组件
watch([ruleType, selectedMonths, dayMode, weekMode, intervalMode, excludeSettings], () => {
  emitChange()
}, { deep: true })

// 初始化
onMounted(() => {
  loadHolidays()
  // 如果是工作表模式，初始化选择的预览时间
  if (props.contentSource === 'worksheet' && props.worksheetTimes.length > 0) {
    selectedPreviewTime.value = props.worksheetTimes[0].time
  }
  generatePreview()
})

// 监听工作表时间变化
watch(() => props.worksheetTimes, (newTimes) => {
  if (newTimes && newTimes.length > 0 && !selectedPreviewTime.value) {
    selectedPreviewTime.value = newTimes[0].time
  }
}, { immediate: true })
</script>

<style scoped lang="scss">
.date-rule-builder {
  padding: 16px;
  max-height: 65vh;
  overflow-y: auto;
  overflow-x: hidden;
  
  &::-webkit-scrollbar {
    width: 6px;
  }
  
  &::-webkit-scrollbar-track {
    background: #f1f1f1;
    border-radius: 3px;
  }
  
  &::-webkit-scrollbar-thumb {
    background: #c1c1c1;
    border-radius: 3px;
    
    &:hover {
      background: #a1a1a1;
    }
  }
  
  .rule-header {
    margin-bottom: 24px;
    
    h4 {
      margin: 0 0 8px 0;
      font-size: 18px;
      color: #303133;
    }
    
    p {
      margin: 0;
      color: #909399;
      font-size: 14px;
    }
  }
  
  .rule-section {
    background: #fff;
    border-radius: 8px;
    padding: 16px;
    margin-bottom: 12px;
    border: 1px solid #ebeef5;
    
    .section-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 16px;
      font-weight: 500;
      color: #303133;
      margin-bottom: 8px;
    }
    
    .section-description {
      color: #909399;
      font-size: 14px;
      margin-bottom: 16px;
    }
  }
  
  .quick-select-buttons {
    margin-bottom: 16px;
  }
  
  .month-selector {
    .months-grid {
      display: grid;
      grid-template-columns: repeat(6, 1fr);
      gap: 12px;
      margin-top: 12px;
    }
  }
  
  .rule-type-selector {
    display: flex;
    flex-direction: column;
    gap: 12px;
    
    :deep(.el-radio) {
      width: 100%;
      height: auto;
      margin: 0;
      
      .el-radio__input {
        display: none;
      }
      
      .el-radio__label {
        width: 100%;
        padding: 0;
      }
    }
    
    :deep(.el-radio__input.is-checked + .el-radio__label .option-content) {
      border-color: #409eff;
      background: #ecf5ff;
    }
    
    .rule-type-option {
      width: 100%;
      
      .option-content {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 16px;
        border: 2px solid #dcdfe6;
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.3s;
        
        &:hover {
          border-color: #409eff;
          background: #f5f7fa;
        }
        
        .option-icon {
          font-size: 24px;
          flex-shrink: 0;
        }
        
        .option-info {
          flex: 1;
          
          .option-title {
            font-size: 14px;
            font-weight: 500;
            color: #303133;
            margin-bottom: 4px;
          }
          
          .option-desc {
            font-size: 12px;
            color: #909399;
          }
        }
      }
    }
  }
  
  .day-mode-selector {
    .day-mode-radio-group {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin-bottom: 16px;
      
      .day-mode-radio {
        display: block;
        
        .nth-workday-option {
          display: inline-flex;
          align-items: center;
          
          :deep(.el-input-number) {
            display: inline-block !important;
            
            .el-input__wrapper {
              padding: 0 32px 0 8px;
            }
            
            .el-input__inner {
              text-align: center;
              font-weight: 500;
            }
            
            .el-input-number__decrease,
            .el-input-number__increase {
              width: 24px;
            }
            
            &.is-disabled {
              opacity: 0.5;
              
              .el-input__wrapper {
                background-color: #f5f7fa;
              }
            }
          }
        }
      }
    }
    
    .specific-days-panel {
      background: #f5f7fa;
      border-radius: 6px;
      padding: 16px;
      margin-top: 12px;
      
      .quick-day-select {
        margin-bottom: 16px;
        
        :deep(.el-button-group) {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
          
          .el-button {
            flex: 1;
            min-width: 100px;
          }
        }
      }
      
      .days-grid {
        display: grid;
        grid-template-columns: repeat(7, minmax(40px, 1fr));
        gap: 4px;
        max-width: 100%;
        
        :deep(.el-checkbox) {
          margin: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          
          .el-checkbox__input {
            margin-right: 4px;
          }
          
          .el-checkbox__label {
            padding-left: 4px;
            font-size: 13px;
            min-width: 20px;
            text-align: center;
          }
        }
      }
    }
  }
  
  .week-config {
    .quick-week-select {
      margin-bottom: 16px;
    }
    
    .weekdays-selector {
      display: flex;
      gap: 12px;
      margin-bottom: 16px;
    }
    
    .week-occurrence {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
    }
  }
  
  .interval-config {
    .interval-input {
      display: flex;
      align-items: center;
      margin-bottom: 16px;
    }
    
    .reference-date {
      .el-form-item {
        margin-bottom: 0;
      }
    }
  }
  
  .exclude-dates-config {
    .exclude-options {
      display: flex;
      gap: 24px;
      margin-bottom: 16px;
      flex-wrap: wrap;
    }
    
    .specific-exclude-dates {
      margin-bottom: 16px;
      
      .exclude-date-label {
        margin-bottom: 8px;
        font-size: 14px;
        color: #606266;
      }
      
      :deep(.el-date-picker) {
        width: 100%;
      }
    }
    
    .excluded-dates-list {
      margin-top: 12px;
      padding: 12px;
      background: #f5f7fa;
      border-radius: 4px;
    }
  }
  
  .execution-times {
    .times-list {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      margin-bottom: 12px;
      
      .time-item {
        display: flex;
        align-items: center;
        gap: 8px;
      }
    }
  }
  
  .preview-panel {
    border: 1px solid #e4e7ed;
    border-radius: 6px;
    overflow: hidden;
    
    .preview-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 16px;
      background: #f5f7fa;
      border-bottom: 1px solid #e4e7ed;
      
      .preview-header-left {
        display: flex;
        align-items: center;
        flex: 1;
        
        > span {
          font-weight: 500;
          color: #303133;
        }
      }
    }
    
    .preview-content {
      min-height: 200px;
      max-height: 400px;
      overflow-y: auto;
      
      .empty-preview {
        padding: 40px;
        text-align: center;
      }
      
      .preview-list {
        padding: 12px;
        
        .preview-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px;
          border-bottom: 1px solid #ebeef5;
          
          &:last-child {
            border-bottom: none;
          }
          
          &.excluded {
            opacity: 0.5;
            background: #fef0f0;
          }
          
          .preview-date {
            display: flex;
            align-items: center;
            gap: 12px;
            
            .date-main {
              font-size: 16px;
              font-weight: 500;
              color: #303133;
            }
            
            .date-sub {
              color: #909399;
              font-size: 14px;
            }
          }
          
          .preview-status {
            display: flex;
            gap: 8px;
          }
        }
      }
    }
  }
  
  .rule-summary {
    margin-top: 8px;
  }
}

/* 移动端适配 */
@media (max-width: 768px) {
  .date-rule-builder {
    padding: 12px;
    
    .rule-section {
      padding: 12px;
      margin-bottom: 12px;
    }
    
    .month-selector {
      .months-grid {
        grid-template-columns: repeat(3, 1fr);
        gap: 8px;
      }
    }
    
    .rule-type-selector {
      flex-direction: column;
    }
    
    .day-mode-selector {
      .specific-days-panel {
        padding: 12px;
        
        .days-grid {
          grid-template-columns: repeat(5, 1fr) !important;
          gap: 6px;
        }
      }
    }
    
    .quick-select-buttons {
      :deep(.el-button-group) {
        display: flex;
        flex-wrap: wrap;
        
        .el-button {
          flex: 1 1 auto;
          min-width: 80px;
          margin-bottom: 8px;
        }
      }
    }
    
    .preview-panel {
      .preview-content {
        max-height: 250px;
      }
    }
  }
}
</style>

<style>
/* 全局样式，确保日期选择器弹出层正确显示 */
.date-picker-popper {
  z-index: 9999 !important;
}

.el-picker__popper {
  z-index: 9999 !important;
}

.el-time-panel {
  z-index: 9999 !important;
}
</style>