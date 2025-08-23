# 🔄 路径迁移指南

## 📅 创建日期: 2024-08-22

## 🎯 目标
统一项目中的导入路径，使用新的跨平台架构。

## 📊 当前路径使用情况

### API导入路径映射

| 组件/文件 | 当前导入 | 建议新路径 | 状态 |
|----------|---------|-----------|------|
| TaskManagement.vue | `@/api/modules/tasksV2` | `@/api/modules/tasks-unified` | ⏳ 待更新 |
| TaskManagement.vue | `@/api/modules/tasks` | `@/api/modules/tasks-unified` | ⏳ 待更新 |
| ExecutionHistoryDialog.vue | `@/api/modules/tasksV2` | `@/api/modules/tasks-unified` | ⏳ 待更新 |
| TestScheduleRule.vue | `@/api/modules/tasksV2` | `@/api/modules/tasks-unified` | ⏳ 待更新 |
| TaskAssociationDialog.vue | `@/api/modules/v2Tasks` | `@/api/modules/tasks-unified` | ⏳ 待更新 |
| ExecutionPlanDialog.vue | `@/api/modules/v2Tasks` | `@/api/modules/tasks-unified` | ⏳ 待更新 |
| Profile.vue | `@/api/modules/v2Tasks` | `@/api/modules/tasks-unified` | ⏳ 待更新 |

### 组件路径映射

| 原路径 | 新路径 | 说明 |
|--------|--------|------|
| `@/components/DateRuleBuilderEnhanced.vue` | 已存档 | 未被使用，已移至 archive/old-components/ |
| `@/components/DateRuleBuilderMobile.vue` | `@/mobile/components/DateRuleBuilderMobile.vue` | 移动端组件 |

## 🔧 迁移步骤

### Phase 1: 使用统一API适配器（当前阶段）

#### 方法1: 最小改动（推荐）
只需要更改导入路径，不改变使用方式：

```javascript
// 原代码
import tasksV2API from '@/api/modules/tasksV2'
import { taskAPI } from '@/api/modules/tasks'
import { v2TasksAPI } from '@/api/modules/v2Tasks'

// 更新为
import tasksV2API from '@/api/modules/tasks-unified'
import { taskAPI } from '@/api/modules/tasks-unified'
import { v2TasksAPI } from '@/api/modules/tasks-unified'
```

#### 方法2: 使用TypeScript服务（未来）
迁移到TypeScript版本的统一服务：

```typescript
// 未来的使用方式
import { createTasksService } from '@/shared/api/tasks.service'
import apiClient from '@/api'

const tasksService = createTasksService(apiClient)
```

### Phase 2: 逐个组件更新

#### TaskManagement.vue
```javascript
// 当前代码
import tasksV2API from '@/api/modules/tasksV2'
import { taskAPI } from '@/api/modules/tasks'

// Step 1: 更新为统一适配器
import tasksV2API from '@/api/modules/tasks-unified'
import { taskAPI } from '@/api/modules/tasks-unified'

// Step 2: (未来) 迁移到TypeScript服务
import { createTasksService } from '@/shared/api/tasks.service'
```

#### ExecutionHistoryDialog.vue
```javascript
// 当前代码
import tasksV2API from '@/api/modules/tasksV2'

// 更新为
import tasksV2API from '@/api/modules/tasks-unified'
```

#### TaskAssociationDialog.vue
```javascript
// 当前代码
import { taskAssociationAPI } from '@/api/modules/v2Tasks'

// 更新为
import { taskAssociationAPI } from '@/api/modules/tasks-unified'
```

## ⚠️ 注意事项

### 1. 兼容性保证
`tasks-unified.js` 完全兼容原有的三个API文件：
- ✅ 保持相同的函数签名
- ✅ 保持相同的返回格式
- ✅ 保持相同的错误处理

### 2. 测试要点
更新路径后需要测试：
- [ ] 任务列表加载
- [ ] 任务创建/编辑
- [ ] 任务删除
- [ ] 批量操作
- [ ] 任务关联功能
- [ ] 执行计划查看
- [ ] 执行历史查看

### 3. 回滚方案
如果出现问题，可以快速回滚：
```javascript
// 恢复原路径即可
import tasksV2API from '@/api/modules/tasksV2'  // 原文件还在
```

## 📋 执行清单

### 立即执行（安全）
- [ ] 更新 TaskManagement.vue 的导入路径
- [ ] 更新 ExecutionHistoryDialog.vue 的导入路径
- [ ] 更新 TestScheduleRule.vue 的导入路径
- [ ] 测试基本功能

### 稍后执行（需要更多测试）
- [ ] 更新 TaskAssociationDialog.vue
- [ ] 更新 ExecutionPlanDialog.vue
- [ ] 更新 Profile.vue
- [ ] 完整功能测试

### 未来计划
- [ ] 迁移到 TypeScript 服务
- [ ] 删除旧的API文件
- [ ] 更新单元测试

## 🔍 验证命令

```bash
# 检查是否还有旧路径引用
grep -r "from.*tasksV2" src/ --include="*.vue" --include="*.js"
grep -r "from.*v2Tasks" src/ --include="*.vue" --include="*.js"
grep -r "from.*modules/tasks'" src/ --include="*.vue" --include="*.js"

# 构建测试
npm run build

# 开发测试
npm run dev
```

## 📊 进度跟踪

| 文件 | 状态 | 更新日期 | 测试结果 |
|------|------|----------|----------|
| tasks-unified.js | ✅ 创建 | 2024-08-22 | - |
| TaskManagement.vue | ⏳ 待更新 | - | - |
| ExecutionHistoryDialog.vue | ⏳ 待更新 | - | - |
| TestScheduleRule.vue | ⏳ 待更新 | - | - |
| TaskAssociationDialog.vue | ⏳ 待更新 | - | - |
| ExecutionPlanDialog.vue | ⏳ 待更新 | - | - |
| Profile.vue | ⏳ 待更新 | - | - |

---

*使用此指南逐步完成路径迁移，确保系统稳定性*