# 🏗️ 钉钉提醒系统 - 整理后的项目结构

## 📅 整理日期: 2024-08-22

## 🎯 项目说明
这是经过整理和优化后的钉钉提醒系统项目，具有清晰的跨平台架构和统一的API管理。

## 📂 项目结构

```
dingtalk-reminder-clean/
├── backend/                    # 后端服务
│   ├── app.js                 # 后端应用入口
│   ├── server.js              # 服务器配置
│   ├── config/                # 配置文件
│   ├── models/                # 数据模型
│   │   └── mongodb/           # MongoDB模型
│   ├── routes/                # API路由
│   ├── services/              # 业务服务
│   │   ├── agendaSchedulerMongoDB.js  # 调度器
│   │   ├── dingTalkBot.js    # 钉钉机器人
│   │   └── excelParser.js    # Excel解析
│   ├── middleware/            # 中间件
│   └── utils/                 # 工具函数
│
├── frontend/                   # 前端应用
│   ├── package.json          # 前端依赖
│   ├── vite.config.js        # Vite配置
│   ├── index.html            # 入口HTML
│   └── src/                  # 源代码【已优化结构】
│       ├── main.js           # 应用入口
│       ├── App.vue           # 根组件
│       ├── router/           # 路由配置
│       ├── stores/           # Pinia状态管理
│       │
│       ├── shared/           # 🆕 跨平台共享代码
│       │   ├── api/          # 统一API服务
│       │   │   ├── base-api.service.ts
│       │   │   ├── dashboard.service.ts
│       │   │   └── tasks.service.ts
│       │   ├── types/        # TypeScript类型定义
│       │   │   └── api.types.ts
│       │   ├── hooks/        # 通用Hooks
│       │   │   ├── useApiData.ts
│       │   │   └── useSmartRefresh.ts
│       │   └── utils/        # 工具函数
│       │       └── platform.utils.ts
│       │
│       ├── mobile/           # 🆕 移动端代码
│       │   ├── adapters/     # 平台适配器
│       │   │   └── api-client.adapter.ts
│       │   ├── components/   # 移动端组件
│       │   │   ├── Dashboard.tsx
│       │   │   └── DateRuleBuilderMobile.vue
│       │   ├── hooks/        # 移动端Hooks
│       │   │   └── useMobileAuth.ts
│       │   └── README.md     # 移动端集成指南
│       │
│       ├── api/              # API模块
│       │   ├── index.js      # API客户端
│       │   └── modules/      # API模块
│       │       ├── tasks-unified.js  # 🆕 统一的任务API
│       │       ├── auth.js
│       │       ├── dashboard.js
│       │       ├── files.js
│       │       ├── groups.js
│       │       └── settings.js
│       │
│       ├── components/       # Vue组件
│       │   ├── TaskEditor.vue
│       │   ├── TaskEditorOptimized.vue
│       │   ├── DateRuleBuilder.vue
│       │   ├── TaskAssociationDialog.vue
│       │   ├── ExecutionPlanDialog.vue
│       │   └── ExecutionHistoryDialog.vue
│       │
│       ├── views/            # 页面组件
│       │   ├── Dashboard.vue
│       │   ├── TaskManagement.vue
│       │   ├── Groups.vue
│       │   ├── Files.vue
│       │   ├── Settings.vue
│       │   └── Profile.vue
│       │
│       ├── composables/      # Vue组合式函数
│       │   ├── useRefresh.js
│       │   └── useAutoLogout.js
│       │
│       ├── utils/            # 工具函数
│       │   ├── date.js
│       │   └── timeUtils.js
│       │
│       ├── archive/          # 🆕 存档目录
│       │   ├── README.md     # 存档说明
│       │   ├── CLEANUP_REPORT.md
│       │   └── old-components/
│       │       └── DateRuleBuilderEnhanced.vue
│       │
│       ├── MIGRATION_GUIDE.md    # 🆕 迁移指南
│       └── MIGRATION_STATUS.md   # 🆕 迁移状态
│
├── docker-compose.yml        # Docker编排配置
├── Dockerfile               # Docker镜像配置
├── package.json            # 项目依赖
├── README.md               # 项目说明
└── .env.example            # 环境变量示例

```

## 🔥 主要改进

### 1. 跨平台架构
- ✅ 创建 `shared/` 目录用于跨平台共享代码
- ✅ 创建 `mobile/` 目录用于移动端特有代码
- ✅ TypeScript类型定义支持

### 2. API统一管理
- ✅ 所有任务API统一到 `tasks-unified.js`
- ✅ 统一的错误处理和响应格式
- ✅ 向后兼容的API适配器

### 3. 代码整理
- ✅ 存档未使用的组件
- ✅ 清理重复的API文件
- ✅ 统一导入路径

### 4. 文档完善
- ✅ 迁移指南
- ✅ 集成文档
- ✅ 清理报告

## 🚀 快速开始

### 安装依赖
```bash
# 安装后端依赖
cd backend
npm install

# 安装前端依赖
cd ../frontend
npm install
```

### 启动开发环境
```bash
# 启动MongoDB（Docker）
docker-compose up -d mongodb

# 启动后端服务
cd backend
npm run dev

# 启动前端开发服务器
cd ../frontend
npm run dev
```

### 构建生产版本
```bash
# 构建前端
cd frontend
npm run build

# 构建Docker镜像
docker build -t dingtalk-reminder .
```

## 📝 环境变量配置

复制 `.env.example` 为 `.env` 并配置：

```bash
# MongoDB配置
MONGODB_URI=mongodb://admin:admin123456@localhost:27017/dingtalk-scheduler?authSource=admin

# JWT配置
JWT_SECRET=your-jwt-secret
JWT_REFRESH_SECRET=your-refresh-secret

# 服务端口
PORT=3000
```

## 🔧 API路径说明

所有组件现在使用统一的API路径：

```javascript
// 统一导入方式
import tasksAPI from '@/api/modules/tasks-unified'
import { taskAPI } from '@/api/modules/tasks-unified'
import { taskAssociationAPI } from '@/api/modules/tasks-unified'
```

## 📱 移动端集成

查看 `frontend/src/mobile/README.md` 了解如何集成移动端功能。

## 🗂️ 存档文件

旧文件已存档在 `frontend/src/archive/` 目录，包括：
- 未使用的组件
- 旧版本API文件（原文件暂时保留作为备份）

## ⚠️ 注意事项

1. **MongoDB必须先启动**：系统依赖MongoDB数据库
2. **环境变量**：确保正确配置所有必需的环境变量
3. **端口占用**：默认使用3000（后端）和5173（前端）端口

## 📊 项目状态

- 构建状态: ✅ 通过
- API统一: ✅ 完成
- 路径更新: ✅ 完成
- 文档: ✅ 完善

---

*此项目已经过整理优化，具有清晰的架构和统一的代码管理*