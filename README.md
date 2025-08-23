# 📱 钉钉智能提醒系统

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org)
[![MongoDB](https://img.shields.io/badge/MongoDB-6.0-green)](https://www.mongodb.com)
[![Docker](https://img.shields.io/badge/Docker-Ready-blue)](https://www.docker.com)

## 🌟 项目概述

钉钉智能提醒系统是一个功能强大的自动化任务调度和提醒平台，专为团队协作和任务管理设计。系统支持复杂的调度规则、批量导入、任务关联等企业级功能，并提供完整的Docker容器化部署方案。

## ✨ 核心特性

### 🎯 任务调度
- **多样化调度模式**: 支持每日、每周、每月、每年、间隔等多种调度规则
- **灵活时间设置**: 精确到分钟的时间点设置，支持多时间点配置
- **节假日管理**: 智能识别工作日和节假日，支持自定义节假日规则
- **任务关联**: 支持任务间的优先级管理和依赖关系设置

### 📊 数据管理
- **Excel批量导入**: 从Excel文件批量导入任务，支持多工作表处理
- **任务模板**: 快速复制和创建相似任务
- **数据导出**: 支持任务数据导出为Excel或CSV格式
- **历史记录**: 完整的任务执行历史记录和审计日志

### 🔐 安全与认证
- **JWT双令牌机制**: Access Token + Refresh Token确保安全性
- **角色权限管理**: 管理员、普通用户等多角色权限控制
- **操作审计**: 所有关键操作都有审计日志记录
- **数据加密**: 敏感数据加密存储

### 📈 监控与统计
- **实时仪表盘**: 任务执行状态实时监控
- **统计报表**: 任务执行成功率、响应时间等关键指标
- **系统监控**: CPU、内存、磁盘使用率监控
- **告警通知**: 异常情况自动告警

## 🏗️ 系统架构

```
dingtalk-reminder-clean/
├── backend/                     # 后端服务 (Node.js + Express)
│   ├── routes/                  # API路由
│   │   ├── mongo-auth.js       # 认证相关
│   │   ├── mongo-tasks.js      # 任务管理
│   │   ├── mongo-groups.js     # 群组管理
│   │   ├── mongo-files.js      # 文件处理
│   │   └── scheduler.js        # 调度器控制
│   ├── services/                # 业务服务
│   │   ├── cronicleScheduler.js # Cronicle调度引擎
│   │   ├── dingTalkBot.js      # 钉钉机器人
│   │   └── excelParser.js      # Excel解析
│   ├── models/mongodb/         # MongoDB数据模型
│   └── middleware/              # 中间件
│
├── frontend/                    # 前端应用 (Vue 3 + Element Plus)
│   ├── src/
│   │   ├── views/              # 页面组件
│   │   │   ├── Dashboard.vue   # 仪表盘
│   │   │   ├── TaskManagement.vue # 任务管理
│   │   │   ├── Groups.vue      # 群组管理
│   │   │   └── Settings.vue    # 系统设置
│   │   ├── api/                # API客户端
│   │   └── components/         # 可复用组件
│
├── docker/                      # Docker相关文件
│   └── mongo-init.js           # MongoDB初始化脚本
├── docker-compose.yml          # Docker编排配置
├── Dockerfile                  # Docker镜像定义
└── deploy-production.sh        # 生产部署脚本
```

## 🚀 快速开始

### 前置要求

- Node.js >= 18.0.0
- Docker & Docker Compose
- Git

### 方式1: Docker一键部署（推荐）

```bash
# 克隆项目
git clone https://github.com/YOUR_USERNAME/dingtalk-reminder-system.git
cd dingtalk-reminder-system

# 复制环境配置
cp .env.example .env

# 编辑配置文件（必须配置钉钉机器人信息）
vim .env

# 执行部署脚本
chmod +x docker-build.sh
./docker-build.sh
```

### 方式2: 本地开发环境

```bash
# 1. 启动MongoDB容器
docker-compose up -d mongodb

# 2. 安装依赖并启动
chmod +x start-dev.sh
./start-dev.sh

# 或手动启动
cd backend && npm install && npm run dev
cd ../frontend && npm install && npm run dev
```

### 访问系统

- 前端界面: http://localhost:5001
- API文档: http://localhost:5001/api-docs
- 默认账号: admin / admin123

⚠️ **重要**: 首次登录后请立即修改默认密码！

## 🔧 配置说明

### 核心配置项

```env
# MongoDB数据库
MONGODB_URL=mongodb://admin:password@mongodb:27017/dingtalk-scheduler

# JWT认证（使用 openssl rand -base64 32 生成）
JWT_SECRET=your_secure_secret_key
JWT_REFRESH_SECRET=your_secure_refresh_key

# 钉钉机器人（从钉钉群获取）
DINGTALK_WEBHOOK=https://oapi.dingtalk.com/robot/send?access_token=xxx
DINGTALK_SECRET=SECxxx

# 应用端口
APP_PORT=5001
```

### 高级配置

查看 `.env.example` 文件了解所有可配置项，包括：
- Redis缓存配置
- 日志级别设置
- 任务调度参数
- 监控阈值配置
- 数据保留策略

## 📝 API接口

### 认证相关

| 端点 | 方法 | 描述 | 需要认证 |
|-----|------|-----|---------|
| `/api/mongo/auth/login` | POST | 用户登录 | ❌ |
| `/api/mongo/auth/refresh` | POST | 刷新令牌 | ❌ |
| `/api/mongo/auth/logout` | POST | 用户登出 | ✅ |
| `/api/mongo/auth/profile` | GET | 获取用户信息 | ✅ |

### 任务管理

| 端点 | 方法 | 描述 | 需要认证 |
|-----|------|-----|---------|
| `/api/mongo/tasks` | GET | 获取任务列表 | ✅ |
| `/api/mongo/tasks` | POST | 创建新任务 | ✅ |
| `/api/mongo/tasks/:id` | PUT | 更新任务 | ✅ |
| `/api/mongo/tasks/:id` | DELETE | 删除任务 | ✅ |
| `/api/mongo/tasks/batch` | POST | 批量操作 | ✅ |
| `/api/mongo/tasks/:id/execute` | POST | 手动执行任务 | ✅ |

### 文件处理

| 端点 | 方法 | 描述 | 需要认证 |
|-----|------|-----|---------|
| `/api/mongo/files/upload` | POST | 上传Excel文件 | ✅ |
| `/api/mongo/files/:id/parse` | POST | 解析Excel文件 | ✅ |
| `/api/mongo/files/:id/import` | POST | 导入任务数据 | ✅ |

## 🎯 主要功能模块

### 1. 任务管理 📋
- 创建、编辑、删除任务
- 设置复杂调度规则
- 任务启用/禁用控制
- 批量任务操作
- 任务执行历史查看

### 2. 群组管理 👥
- 创建钉钉群组配置
- 管理Webhook和密钥
- 群组状态监控
- 消息发送测试

### 3. Excel导入 📊
- 支持.xlsx和.xls格式
- 多工作表同时处理
- 智能列识别
- 导入预览和确认
- 错误处理和回滚

### 4. 系统监控 📈
- 实时任务执行状态
- 系统资源使用情况
- 任务成功率统计
- 响应时间监控
- 错误日志查看

### 5. 系统设置 ⚙️
- 调度器配置
- 全局参数设置
- 用户管理
- 角色权限配置
- 系统维护工具

## 🐳 Docker部署

### 构建和运行

```bash
# 构建镜像
docker build -t dingtalk-reminder:latest .

# 使用Docker Compose启动
docker-compose up -d

# 查看运行状态
docker-compose ps

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down
```

### 生产环境部署

```bash
# 使用生产部署脚本
chmod +x deploy-production.sh
./deploy-production.sh

# 备份数据
./deploy-production.sh --backup

# 恢复数据
./deploy-production.sh --restore 20240101_120000
```

## 🔍 故障排除

### 常见问题

1. **MongoDB连接失败**
```bash
# 检查MongoDB状态
docker-compose ps mongodb
docker-compose logs mongodb

# 重启MongoDB
docker-compose restart mongodb
```

2. **端口占用**
```bash
# 检查端口占用
netstat -tulpn | grep 5001

# 修改端口
# 编辑 .env 文件中的 APP_PORT
```

3. **钉钉消息发送失败**
- 检查Webhook URL是否正确
- 确认加签密钥配置正确
- 验证服务器IP在钉钉白名单中

4. **任务不执行**
- 检查调度器状态
- 查看任务日志
- 确认系统时间正确

## 📊 性能优化

- **数据库索引**: 已为常用查询字段创建索引
- **Redis缓存**: 可选启用Redis缓存提升性能
- **连接池**: 数据库连接池优化
- **响应压缩**: 启用gzip压缩
- **静态资源CDN**: 生产环境建议使用CDN

## 🔒 安全建议

1. **修改默认密码**: 首次部署后立即修改admin密码
2. **使用强密钥**: JWT密钥使用强随机字符串
3. **HTTPS部署**: 生产环境配置SSL证书
4. **防火墙配置**: 限制不必要的端口访问
5. **定期备份**: 设置自动备份策略
6. **日志审计**: 定期检查审计日志

## 📚 相关文档

- [部署指南](DEPLOYMENT.md) - 详细的部署说明
- [项目结构](PROJECT_STRUCTURE.md) - 代码组织说明
- [API文档](http://localhost:5001/api-docs) - 在线API文档
- [CLAUDE.md](CLAUDE.md) - AI助手开发指南

## 🤝 贡献指南

欢迎贡献代码！请遵循以下步骤：

1. Fork本仓库
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情

## 🙏 致谢

- [Vue.js](https://vuejs.org/) - 渐进式JavaScript框架
- [Element Plus](https://element-plus.org/) - Vue 3 UI组件库
- [Express](https://expressjs.com/) - Node.js Web框架
- [MongoDB](https://www.mongodb.com/) - NoSQL数据库
- [Docker](https://www.docker.com/) - 容器化平台

## 📞 支持

如遇到问题，请通过以下方式获取帮助：

- 提交 [Issue](https://github.com/YOUR_USERNAME/dingtalk-reminder-system/issues)
- 查看 [Wiki](https://github.com/YOUR_USERNAME/dingtalk-reminder-system/wiki)
- 发送邮件至: your-email@example.com

---

**项目状态**: 🟢 活跃开发中 | **版本**: 1.0.0 | **最后更新**: 2025-08-23