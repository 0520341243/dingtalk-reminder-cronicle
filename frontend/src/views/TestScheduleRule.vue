<template>
  <div class="test-schedule-rule">
    <el-card>
      <template #header>
        <div class="card-header">
          <h2>调度规则测试页面</h2>
          <p>测试增强版的调度规则配置器</p>
        </div>
      </template>
      
      <DateRuleBuilderEnhanced
        v-model="scheduleRule"
        @change="handleScheduleChange"
      />
      
      <el-divider />
      
      <div class="rule-output">
        <h3>配置输出</h3>
        <el-alert type="info" :closable="false">
          <pre>{{ JSON.stringify(scheduleRule, null, 2) }}</pre>
        </el-alert>
      </div>
      
      <el-divider />
      
      <div class="test-actions">
        <el-button type="primary" @click="testCreateTask">创建测试任务</el-button>
        <el-button @click="resetRule">重置配置</el-button>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import DateRuleBuilderEnhanced from '@/components/DateRuleBuilderEnhanced.vue'
import tasksApi from '@/api/modules/tasks-unified'

const scheduleRule = ref({
  ruleType: 'by_day',
  months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
  dayMode: { type: 'specific_days', days: [15] },
  weekMode: { weekdays: [], occurrence: 'every' },
  intervalMode: { value: 1, unit: 'days', referenceDate: '' },
  executionTimes: ['09:00'],
  excludeSettings: {
    excludeHolidays: false,
    excludeWeekends: false,
    specificDates: []
  }
})

const handleScheduleChange = (value) => {
  console.log('调度规则变更:', value)
}

const testCreateTask = async () => {
  try {
    // 创建测试任务数据
    const taskData = {
      name: `测试任务 - ${new Date().toLocaleString()}`,
      type: 'simple',
      description: '测试增强版调度规则',
      groupId: '68a0398e6a471a9d89913a10', // 需要替换为实际的群组ID
      messageContent: '这是一条测试消息',
      priority: 'normal',
      status: 'active',
      scheduleRule: scheduleRule.value
    }
    
    console.log('创建任务数据:', taskData)
    
    const response = await tasksApi.createTask(taskData)
    
    if (response.data?.success) {
      ElMessage.success('测试任务创建成功！')
      console.log('任务创建响应:', response.data)
    } else {
      ElMessage.error('任务创建失败')
    }
  } catch (error) {
    console.error('创建任务错误:', error)
    ElMessage.error('创建任务失败：' + (error.message || '未知错误'))
  }
}

const resetRule = () => {
  scheduleRule.value = {
    ruleType: 'by_day',
    months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    dayMode: { type: 'specific_days', days: [15] },
    weekMode: { weekdays: [], occurrence: 'every' },
    intervalMode: { value: 1, unit: 'days', referenceDate: '' },
    executionTimes: ['09:00'],
    excludeSettings: {
      excludeHolidays: false,
      excludeWeekends: false,
      specificDates: []
    }
  }
  ElMessage.success('配置已重置')
}
</script>

<style scoped lang="scss">
.test-schedule-rule {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
  
  .card-header {
    h2 {
      margin: 0 0 8px 0;
      font-size: 20px;
      color: #303133;
    }
    
    p {
      margin: 0;
      color: #909399;
      font-size: 14px;
    }
  }
  
  .rule-output {
    h3 {
      margin-bottom: 16px;
      color: #303133;
    }
    
    pre {
      margin: 0;
      font-size: 12px;
      line-height: 1.5;
      max-height: 400px;
      overflow-y: auto;
    }
  }
  
  .test-actions {
    display: flex;
    gap: 12px;
    justify-content: center;
    margin-top: 20px;
  }
}
</style>