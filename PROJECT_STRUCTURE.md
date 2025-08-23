# 🏗️ 钉钉提醒系统 - 项目结构说明

## 📅 更新日期: 2025-08-23

## 🎯 项目概述

钉钉智能提醒系统采用前后端分离架构，后端使用Node.js + Express + MongoDB，前端使用Vue 3 + Element Plus，支持Docker容器化部署。

## 📂 完整项目结构

```
dingtalk-reminder-clean/
├── backend/                         # 后端服务 (Node.js + Express)
│   ├── app.js                      # Express应用主入口
│   ├── server.js                   # HTTP服务器启动文件
│   │
│   ├── config/                     # 配置文件目录
│   │   └── redis.js               # Redis连接配置
│   │
│   ├── models/                     # 数据模型层
│   │   └── mongodb/               # MongoDB数据模型
│   │       ├── index.js          # 模型导出入口
│   │       └── Setting.js        # 系统设置模型
│   │
│   ├── routes/                     # API路由层
│   │   ├── mongo-auth.js         # 认证相关路由
│   │   ├── mongo-tasks.js        # 任务管理路由
│   │   ├── mongo-groups.js       # 群组管理路由
│   │   ├── mongo-files.js        # 文件上传处理路由
│   │   ├── mongo-dashboard.js    # 仪表盘数据路由
│   │   ├── scheduler.js          # 调度器控制路由
│   │   ├── logs.js               # 日志查询路由
│   │   └── mongo/                # MongoDB特定路由
│   │       └── settings.js      # 系统设置路由
│   │
│   ├── services/                   # 业务服务层
│   │   ├── cronicleScheduler.js  # Cronicle调度引擎
│   │   ├── dingTalkBot.js        # 钉钉机器人服务
│   │   ├── excelParser.js        # Excel文件解析
│   │   ├── dailyTaskLoader.js    # 每日任务加载器
│   │   ├── executionPlanGenerator.js # 执行计划生成
│   │   ├── taskAssociationService.js # 任务关联服务
│   │   ├── advancedScheduleEngine.js # 高级调度引擎
│   │   ├── scheduleRuleConverter.js  # 调度规则转换
│   │   ├── holidayManager.js     # 节假日管理
│   │   ├── monitoring.js         # 系统监控服务
│   │   └── errorRecovery.js      # 错误恢复机制
│   │
│   ├── middleware/                 # Express中间件
│   │   ├── mongo-auth.js         # MongoDB认证中间件
│   │   ├── adminMiddleware.js    # 管理员权限验证
│   │   ├── errorHandler.js       # 全局错误处理
│   │   ├── security.js           # 安全中间件
│   │   ├── rateLimit.js          # 速率限制
│   │   ├── csrf.js               # CSRF保护
│   │   ├── xssProtection.js      # XSS防护
│   │   ├── monitoring.js         # 性能监控
│   │   └── cache.js              # 缓存中间件
│   │
│   ├── utils/                      # 工具函数
│   │   ├── logger.js             # 日志工具
│   │   ├── jwt.js                # JWT处理
│   │   ├── beijingTime.js        # 时区处理
│   │   ├── responseFormatter.js  # 响应格式化
│   │   ├── cacheManager.js       # 缓存管理
│   │   └── errors.js             # 错误定义
│   │
│   ├── scripts/                    # 脚本文件
│   │   ├── init-mongodb.js       # MongoDB初始化
│   │   ├── createAdmin.js        # 创建管理员账户
│   │   └── generate-execution-plans.js # 生成执行计划
│   │
│   ├── domains/                    # 领域模型
│   │   ├── Task.js               # 任务领域模型
│   │   ├── TaskAssociation.js    # 任务关联
│   │   ├── ScheduleRule.js       # 调度规则
│   │   └── NotificationConfig.js # 通知配置
│   │
│   ├── logs/                       # 日志文件目录
│   ├── uploads/                    # 文件上传目录
│   └── backups/                    # 备份文件目录
│
├── frontend/                        # 前端应用 (Vue 3 + Vite)
│   ├── package.json               # 前端依赖配置
│   ├── vite.config.js             # Vite构建配置
│   ├── index.html                 # HTML入口文件
│   │
│   └── src/                       # 源代码目录
│       ├── main.js               # Vue应用入口
│       ├── App.vue               # 根组件
│       │
│       ├── views/                # 页面组件
│       │   ├── Login.vue        # 登录页面
│       │   ├── Dashboard.vue    # 仪表盘
│       │   ├── TaskManagement.vue # 任务管理
│       │   ├── Groups.vue       # 群组管理
│       │   ├── Files.vue        # 文件管理
│       │   ├── Profile.vue      # 个人资料
│       │   ├── Settings.vue     # 系统设置
│       │   └── NotFound.vue     # 404页面
│       │
│       ├── components/           # 可复用组件
│       │   ├── DateRuleBuilderEnhanced.vue # 日期规则构建器
│       │   ├── TaskEditor.vue   # 任务编辑器
│       │   ├── TaskAssociationDialog.vue # 任务关联对话框
│       │   ├── ExecutionPlanDialog.vue # 执行计划对话框
│       │   ├── GlobalExecutionPlanDialog.vue # 全局执行计划
│       │   ├── JobDetailsDialog.vue # 任务详情对话框
│       │   └── HolidayManager.vue # 节假日管理组件
│       │
│       ├── layouts/              # 布局组件
│       │   └── MainLayout.vue   # 主布局
│       │
│       ├── api/                  # API客户端
│       │   ├── index.js         # API配置
│       │   └── modules/         # API模块
│       │       ├── tasks-unified.js # 统一任务API
│       │       ├── auth.js      # 认证API
│       │       ├── dashboard.js # 仪表盘API
│       │       ├── groups.js    # 群组API
│       │       ├── files.js     # 文件API
│       │       ├── settings.js  # 设置API
│       │       └── schedule.js  # 调度API
│       │
│       ├── router/               # Vue Router配置
│       │   └── index.js         # 路由定义
│       │
│       ├── stores/               # Pinia状态管理
│       │   └── auth.js          # 认证状态
│       │
│       ├── composables/          # Vue组合式API
│       │   ├── useAutoLogout.js # 自动登出
│       │   ├── useRefresh.js    # 刷新逻辑
│       │   └── useTokenSafeApi.js # 安全API调用
│       │
│       ├── utils/                # 工具函数
│       │   ├── date.js          # 日期处理
│       │   ├── timeUtils.js     # 时间工具
│       │   └── apiHelper.js     # API辅助函数
│       │
│       ├── styles/               # 全局样式
│       │   └── index.scss       # 主样式文件
│       │
│       ├── config/               # 前端配置
│       │   └── api.config.js    # API配置
│       │
│       ├── shared/               # 跨平台共享代码
│       │   ├── api/             # 共享API服务
│       │   ├── types/           # TypeScript类型
│       │   ├── hooks/           # 共享Hooks
│       │   └── utils/           # 共享工具
│       │
│       ├── mobile/               # 移动端适配
│       │   ├── adapters/        # 平台适配器
│       │   ├── components/      # 移动端组件
│       │   └── hooks/           # 移动端Hooks
│       │
│       └── archive/              # 归档文件
│           └── old-components/  # 旧版组件
│
├── docker/                          # Docker相关文件
│   └── mongo-init.js               # MongoDB初始化脚本
│
├── 配置文件                         # 项目配置
│   ├── .env.example                # 环境变量示例
│   ├── .gitignore                  # Git忽略文件
│   ├── docker-compose.yml          # Docker编排配置
│   ├── Dockerfile                  # Docker镜像定义
│   ├── package.json                # 根目录依赖
│   └── package-lock.json          # 依赖锁定文件
│
├── 脚本文件                         # 自动化脚本
│   ├── start-dev.sh                # 开发环境启动脚本
│   ├── docker-build.sh             # Docker构建脚本
│   ├── deploy-production.sh        # 生产部署脚本
│   ├── setup-git.sh                # Git设置脚本
│   └── migrate-git.sh              # Git迁移脚本
│
└── 文档                             # 项目文档
    ├── README.md                   # 项目说明文档
    ├── PROJECT_STRUCTURE.md        # 项目结构说明（本文件）
    ├── DEPLOYMENT.md               # 部署指南
    ├── CLAUDE.md                   # AI助手开发指南
    └── REQUIREMENTS.md             # 需求文档
```

## 🔑 关键目录说明

### Backend（后端）

#### `/routes` - API路由
- **mongo-auth.js**: 处理用户登录、注册、token刷新
- **mongo-tasks.js**: 任务的CRUD操作、批量操作、执行控制
- **mongo-groups.js**: 钉钉群组配置管理
- **mongo-files.js**: Excel文件上传和解析
- **scheduler.js**: 调度器的启动、停止、状态查询

#### `/services` - 核心服务
- **cronicleScheduler.js**: 基于Cronicle的任务调度引擎
- **dingTalkBot.js**: 钉钉消息发送服务
- **excelParser.js**: Excel文件解析和任务导入
- **taskAssociationService.js**: 处理任务间的关联关系

#### `/middleware` - 中间件
- **mongo-auth.js**: JWT认证验证
- **errorHandler.js**: 全局错误捕获和处理
- **rateLimit.js**: API速率限制
- **security.js**: 安全头设置（Helmet）

### Frontend（前端）

#### `/views` - 页面视图
- **Dashboard.vue**: 系统概览和统计图表
- **TaskManagement.vue**: 任务创建、编辑、管理界面
- **Settings.vue**: 系统配置和参数设置

#### `/components` - 组件库
- **DateRuleBuilderEnhanced.vue**: 复杂日期规则构建器
- **TaskAssociationDialog.vue**: 任务关联配置对话框
- **ExecutionPlanDialog.vue**: 查看任务执行计划

#### `/api/modules` - API模块
- **tasks-unified.js**: 统一的任务API接口
- **auth.js**: 认证相关API
- **dashboard.js**: 仪表盘数据API

## 🔄 数据流

```
用户界面 (Vue)
    ↓
API客户端 (Axios)
    ↓
后端路由 (Express Router)
    ↓
认证中间件 (JWT)
    ↓
业务服务层 (Services)
    ↓
数据模型 (Mongoose)
    ↓
MongoDB数据库
```

## 🚀 技术栈

### 后端技术
- **运行时**: Node.js 18+
- **框架**: Express 4.x
- **数据库**: MongoDB 6.0
- **ODM**: Mongoose
- **认证**: JWT (jsonwebtoken)
- **调度**: Cronicle
- **日志**: Winston
- **安全**: Helmet, CORS, CSRF

### 前端技术
- **框架**: Vue 3.4
- **UI库**: Element Plus
- **构建工具**: Vite 5
- **状态管理**: Pinia
- **路由**: Vue Router 4
- **HTTP客户端**: Axios
- **样式**: SCSS

### 部署技术
- **容器化**: Docker
- **编排**: Docker Compose
- **反向代理**: Nginx（可选）
- **缓存**: Redis（可选）

## 📦 主要依赖版本

### 后端依赖
```json
{
  "express": "^4.19.2",
  "mongoose": "^8.5.3",
  "jsonwebtoken": "^9.0.2",
  "bcryptjs": "^2.4.3",
  "multer": "^1.4.5-lts.2",
  "exceljs": "^4.4.0",
  "winston": "^3.14.2",
  "helmet": "^7.1.0",
  "cors": "^2.8.5"
}
```

### 前端依赖
```json
{
  "vue": "^3.4.38",
  "element-plus": "^2.8.0",
  "vue-router": "^4.4.3",
  "pinia": "^2.2.2",
  "axios": "^1.7.4",
  "vite": "^5.4.19"
}
```

## 🔐 环境变量

关键环境变量配置（`.env`文件）：

```env
# 应用配置
NODE_ENV=production
APP_PORT=5001

# MongoDB配置
MONGODB_URL=mongodb://admin:password@mongodb:27017/dingtalk-scheduler

# JWT配置
JWT_SECRET=your-secret-key
JWT_REFRESH_SECRET=your-refresh-secret

# 钉钉配置
DINGTALK_WEBHOOK=https://oapi.dingtalk.com/robot/send?access_token=xxx
DINGTALK_SECRET=SECxxx

# Redis配置（可选）
REDIS_ENABLED=false
REDIS_HOST=redis
REDIS_PORT=6379
```

## 📝 开发规范

### 命名规范
- **文件名**: 使用kebab-case（如 `mongo-auth.js`）
- **组件名**: 使用PascalCase（如 `TaskEditor.vue`）
- **变量名**: 使用camelCase（如 `taskData`）
- **常量名**: 使用UPPER_SNAKE_CASE（如 `MAX_RETRY_COUNT`）

### 代码组织
- 路由按功能模块划分
- 服务层处理复杂业务逻辑
- 中间件处理横切关注点
- 组件保持单一职责

### Git提交规范
- feat: 新功能
- fix: 修复bug
- docs: 文档更新
- style: 代码格式
- refactor: 重构
- test: 测试相关
- chore: 构建/工具

---

**最后更新**: 2025-08-23 | **版本**: 1.0.0