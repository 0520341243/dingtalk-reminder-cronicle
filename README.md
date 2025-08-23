# 📱 钉钉智能提醒系统 (整理优化版)

## 🌟 项目概述

这是经过架构整理和优化的钉钉智能提醒系统，支持复杂的调度规则、Excel批量导入、任务关联等功能。本版本具有清晰的跨平台架构和统一的API管理。

## ✨ 主要特性

- 🔄 **复杂调度规则**: 支持日、周、月、年、间隔等多种调度模式
- 📊 **Excel批量导入**: 从Excel工作表导入任务数据
- 🔗 **任务关联**: 支持任务间的优先级和关联管理
- 📱 **跨平台架构**: 桌面端(Vue) + 移动端(React/React Native)支持
- 🔐 **安全认证**: JWT认证 + 刷新令牌机制
- 📈 **实时监控**: 任务执行状态实时监控和统计

## 🏗️ 项目结构（已优化）

```
dingtalk-reminder-clean/
├── backend/                    # 后端服务 (Node.js + Express)
├── frontend/                   # 前端应用 (Vue 3 + Vite)
│   └── src/
│       ├── shared/            # 🆕 跨平台共享代码
│       ├── mobile/            # 🆕 移动端代码
│       ├── api/modules/
│       │   └── tasks-unified.js  # 🆕 统一的API管理
│       └── archive/           # 🆕 存档目录
├── docker-compose.yml         # Docker编排
├── start-dev.sh              # 🆕 快速启动脚本
└── PROJECT_STRUCTURE.md     # 🆕 详细结构说明
```

## 🚀 快速开始

### 方式1: 使用启动脚本（推荐）

```bash
# 进入项目目录
cd dingtalk-reminder-clean

# 运行启动脚本
./start-dev.sh
```

脚本会自动：
- ✅ 启动MongoDB
- ✅ 安装依赖
- ✅ 启动后端服务
- ✅ 启动前端开发服务器

### 方式2: 手动启动

#### 1. 启动MongoDB
```bash
docker-compose up -d mongodb
```

#### 2. 配置环境变量
```bash
# 复制环境变量文件
cp .env.cronicle .env

# 或使用示例文件
cp .env.example .env

# 编辑配置
vim .env
```

#### 3. 安装依赖
```bash
# 安装后端依赖
cd backend
npm install

# 安装前端依赖
cd ../frontend
npm install
```

#### 4. 启动服务
```bash
# 启动后端（新终端）
cd backend
npm run dev

# 启动前端（新终端）
cd frontend
npm run dev
```

## 🔧 环境配置

### 必需的环境变量
```env
# MongoDB配置
MONGODB_URI=mongodb://admin:admin123456@localhost:27017/dingtalk-scheduler?authSource=admin

# JWT密钥
JWT_SECRET=your-jwt-secret
JWT_REFRESH_SECRET=your-refresh-secret

# 服务端口
PORT=3000
```

### 钉钉机器人配置
```env
DINGTALK_WEBHOOK=https://oapi.dingtalk.com/robot/send?access_token=YOUR_TOKEN
DINGTALK_SECRET=YOUR_SECRET
```

## 📝 API使用说明

### 统一的API导入方式

所有任务相关的API调用已统一到 `tasks-unified.js`：

```javascript
// 新的统一导入方式
import tasksAPI from '@/api/modules/tasks-unified'

// 使用示例
const tasks = await tasksAPI.getTasks()
const newTask = await tasksAPI.createTask(taskData)
```

### API端点列表

| 端点 | 方法 | 描述 |
|-----|------|-----|
| `/api/mongo/tasks` | GET | 获取任务列表 |
| `/api/mongo/tasks` | POST | 创建新任务 |
| `/api/mongo/tasks/:id` | PUT | 更新任务 |
| `/api/mongo/tasks/:id` | DELETE | 删除任务 |
| `/api/mongo/tasks/batch` | POST | 批量操作 |

## 🗂️ 功能模块

### 1. 任务管理
- 创建/编辑/删除任务
- 复杂调度规则设置
- 任务状态管理
- 批量操作支持

### 2. Excel导入
- 支持多工作表
- 时间和内容列解析
- 批量任务创建

### 3. 任务关联
- 设置任务优先级
- 关联任务管理
- 冲突自动解决

### 4. 执行监控
- 实时执行状态
- 历史记录查询
- 统计分析报表

## 🎯 开发调试

### 前端调试
```bash
# 开发模式（热重载）
cd frontend
npm run dev

# 构建生产版本
npm run build

# 预览生产构建
npm run preview
```

### 后端调试
```bash
# 开发模式（使用nodemon）
cd backend
npm run dev

# 生产模式
npm start
```

### 查看日志
```bash
# 查看后端日志
tail -f backend/logs/app.log

# 查看Docker日志
docker-compose logs -f
```

## 📱 移动端集成

查看 `frontend/src/mobile/README.md` 了解如何集成移动端功能。

主要特性：
- React Native支持
- 统一的API服务
- 跨平台Hooks
- 平台适配器

## 🐳 Docker部署

### 构建镜像
```bash
docker build -t dingtalk-reminder .
```

### 使用Docker Compose
```bash
# 启动所有服务
docker-compose up -d

# 查看状态
docker-compose ps

# 停止服务
docker-compose down
```

## 📊 项目改进

### 已完成的优化
- ✅ API层统一管理
- ✅ 跨平台架构建立
- ✅ 代码结构整理
- ✅ 路径导入统一
- ✅ 文档完善

### 计划中的改进
- [ ] TypeScript全面迁移
- [ ] 单元测试覆盖
- [ ] 性能优化
- [ ] UI/UX改进

## 🔍 常见问题

### 1. MongoDB连接失败
```bash
# 检查MongoDB是否运行
docker ps | grep mongodb

# 重启MongoDB
docker-compose restart mongodb
```

### 2. 端口被占用
```bash
# 修改端口配置
# backend: 修改 .env 中的 PORT
# frontend: 修改 vite.config.js
```

### 3. 依赖安装失败
```bash
# 清理缓存
npm cache clean --force

# 删除node_modules重新安装
rm -rf node_modules package-lock.json
npm install
```

## 📚 相关文档

- [项目结构说明](PROJECT_STRUCTURE.md)
- [迁移指南](frontend/src/MIGRATION_GUIDE.md)
- [移动端集成](frontend/src/mobile/README.md)
- [API文档](backend/docs/API.md)

## 🤝 贡献指南

1. Fork项目
2. 创建功能分支
3. 提交改动
4. 推送到分支
5. 创建Pull Request

## 📄 许可证

MIT License

## 👥 联系方式

如有问题或建议，请提交Issue或联系维护者。

---

*最后更新: 2024-08-22*