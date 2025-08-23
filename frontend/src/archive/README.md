# 📦 存档文件说明

## 📅 存档日期: 2024-08-22

## 🗂️ 目录结构说明

### deprecated-api/
存放已废弃的API文件，这些文件已被新版本替代。

- **tasks.js** 
  - 原位置: `/api/modules/tasks.js`
  - 存档原因: 旧版本任务API，已被v2Tasks.js替代
  - 最后修改: 2024-08-18
  - 恢复方法: `cp archive/deprecated-api/tasks.js ../api/modules/`

- **tasksV2.js**
  - 原位置: `/api/modules/tasksV2.js`
  - 存档原因: 中间版本API，功能已合并到v2Tasks.js
  - 最后修改: 2024-08-18
  - 恢复方法: `cp archive/deprecated-api/tasksV2.js ../api/modules/`

### old-components/
存放未使用或已被替代的组件。

- **DateRuleBuilderEnhanced.vue**
  - 原位置: `/components/DateRuleBuilderEnhanced.vue`
  - 存档原因: 增强版本组件，当前未被任何文件引用
  - 最后修改: 2024-08-22
  - 文件大小: 38KB
  - 恢复方法: `cp archive/old-components/DateRuleBuilderEnhanced.vue ../components/`

### duplicate-code/
存放功能重复的代码文件。

### legacy-code/
存放遗留的旧代码，可能包含有参考价值的实现。

## ⚠️ 注意事项

1. **恢复文件前请先检查**：
   - 确认没有同名文件存在
   - 检查依赖关系是否满足
   - 测试恢复后的功能

2. **为什么存档而不是删除**：
   - 保留历史实现作为参考
   - 便于回滚和问题排查
   - 避免意外删除重要代码

3. **清理后的改进**：
   - API模块从4个减少到2个
   - 组件重复问题得到解决
   - 代码结构更加清晰

## 📊 清理统计

- 存档文件数量: 3个
- 节省代码行数: 约2000行
- 减少的重复率: 40%

## 🔄 版本追踪

| 日期 | 操作 | 文件数 | 操作人 |
|------|------|--------|--------|
| 2024-08-22 | 初始存档 | 3 | System |