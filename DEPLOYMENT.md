# 📋 钉钉提醒系统 - 部署指南

本文档详细说明如何将项目推送到GitHub并在服务器上部署。

## 🚀 第一步：推送到GitHub

### 1.1 本地Git初始化

```bash
# 初始化Git仓库（如果还没有）
git init

# 添加所有文件到暂存区
git add .

# 提交代码
git commit -m "feat: 完整的钉钉提醒系统实现"
```

### 1.2 创建GitHub仓库

1. 登录 [GitHub](https://github.com)
2. 点击右上角 `+` → `New repository`
3. 填写仓库信息：
   - Repository name: `dingtalk-reminder-system`
   - Description: 钉钉智能提醒系统 - 支持复杂调度规则的自动化提醒工具
   - 选择 `Private`（如果不想公开）
4. **不要**勾选 "Initialize this repository with a README"
5. 点击 `Create repository`

### 1.3 推送到GitHub

```bash
# 添加远程仓库（替换YOUR_USERNAME为你的GitHub用户名）
git remote add origin https://github.com/YOUR_USERNAME/dingtalk-reminder-system.git

# 推送代码到main分支
git branch -M main
git push -u origin main
```

如果使用SSH：
```bash
git remote add origin git@github.com:YOUR_USERNAME/dingtalk-reminder-system.git
git branch -M main
git push -u origin main
```

## 🖥️ 第二步：服务器部署

### 2.1 服务器要求

- **操作系统**: Ubuntu 20.04+ / CentOS 7+ / Debian 10+
- **内存**: 最少2GB，建议4GB+
- **磁盘**: 最少10GB可用空间
- **软件要求**:
  - Docker 20.10+
  - Docker Compose 1.29+
  - Git

### 2.2 安装Docker（如果未安装）

#### Ubuntu/Debian:
```bash
# 更新包索引
sudo apt update

# 安装必要的包
sudo apt install -y apt-transport-https ca-certificates curl software-properties-common

# 添加Docker官方GPG密钥
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo apt-key add -

# 添加Docker仓库
sudo add-apt-repository "deb [arch=amd64] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable"

# 安装Docker
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io

# 安装Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# 启动Docker服务
sudo systemctl start docker
sudo systemctl enable docker

# 将当前用户添加到docker组（可选，避免使用sudo）
sudo usermod -aG docker $USER
# 重新登录生效
```

#### CentOS/RHEL:
```bash
# 安装必要的包
sudo yum install -y yum-utils

# 添加Docker仓库
sudo yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo

# 安装Docker
sudo yum install -y docker-ce docker-ce-cli containerd.io

# 安装Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# 启动Docker服务
sudo systemctl start docker
sudo systemctl enable docker
```

### 2.3 克隆项目并部署

```bash
# 1. 选择部署目录
cd /opt  # 或其他你喜欢的目录

# 2. 克隆项目（替换为你的仓库地址）
sudo git clone https://github.com/YOUR_USERNAME/dingtalk-reminder-system.git
cd dingtalk-reminder-system

# 3. 创建环境配置文件
sudo cp .env.example .env

# 4. 编辑环境配置（必须！）
sudo nano .env
# 或使用 vim
sudo vim .env
```

### 2.4 配置环境变量

编辑 `.env` 文件，**必须修改**以下配置：

```env
# MongoDB密码（请使用强密码）
MONGO_ROOT_PASSWORD=your_strong_root_password
MONGO_PASSWORD=your_strong_admin_password

# JWT密钥（使用以下命令生成）
# openssl rand -base64 32
JWT_SECRET=生成的密钥1
JWT_REFRESH_SECRET=生成的密钥2

# 钉钉机器人配置（从钉钉群获取）
DINGTALK_WEBHOOK=https://oapi.dingtalk.com/robot/send?access_token=你的TOKEN
DINGTALK_SECRET=你的加签密钥
```

### 2.5 执行部署

```bash
# 赋予脚本执行权限
sudo chmod +x docker-build.sh
sudo chmod +x deploy-production.sh

# 方式1：使用快速部署脚本
sudo ./docker-build.sh

# 方式2：使用生产环境部署脚本（推荐，包含更多配置）
sudo ./deploy-production.sh
```

### 2.6 验证部署

```bash
# 检查服务状态
docker-compose ps

# 查看日志
docker-compose logs -f

# 测试API健康状态
curl http://localhost:5001/api/health
```

### 2.7 配置防火墙（如需外网访问）

```bash
# Ubuntu/Debian (UFW)
sudo ufw allow 5001/tcp

# CentOS/RHEL (firewalld)
sudo firewall-cmd --permanent --add-port=5001/tcp
sudo firewall-cmd --reload
```

## 🔄 更新部署

当代码有更新时：

```bash
# 1. 进入项目目录
cd /opt/dingtalk-reminder-system

# 2. 拉取最新代码
sudo git pull origin main

# 3. 重新构建并部署
sudo ./docker-build.sh

# 或者只重启服务（如果只是配置变更）
docker-compose restart
```

## 🔧 常用运维命令

```bash
# 查看服务状态
docker-compose ps

# 查看服务日志
docker-compose logs -f
docker-compose logs -f dingtalk-reminder  # 只看应用日志
docker-compose logs -f mongodb            # 只看数据库日志

# 重启服务
docker-compose restart

# 停止服务
docker-compose stop

# 启动服务
docker-compose start

# 完全停止并删除容器（数据不会丢失）
docker-compose down

# 备份数据
sudo ./deploy-production.sh --backup

# 恢复备份
sudo ./deploy-production.sh --restore 20240101_120000

# 进入应用容器
docker-compose exec dingtalk-reminder sh

# 进入MongoDB容器
docker-compose exec mongodb mongosh -u admin -p

# 查看资源使用
docker stats
```

## 🔐 安全建议

1. **修改默认密码**：
   - 首次登录后立即修改admin账户密码
   - 使用强密码作为MongoDB密码
   - 定期更新JWT密钥

2. **网络安全**：
   - 使用HTTPS（配置Nginx反向代理）
   - 限制MongoDB端口（27017）只能本地访问
   - 配置防火墙规则

3. **数据备份**：
   - 定期执行备份脚本
   - 将备份文件传输到其他服务器或云存储

4. **监控告警**：
   - 监控服务运行状态
   - 设置磁盘空间告警
   - 监控错误日志

## 🆘 故障排除

### 问题1：Docker容器无法启动

```bash
# 查看详细日志
docker-compose logs --tail=100

# 检查端口占用
sudo netstat -tulpn | grep 5001
sudo netstat -tulpn | grep 27017

# 清理并重建
docker-compose down -v
docker-compose up -d --build
```

### 问题2：MongoDB连接失败

```bash
# 检查MongoDB状态
docker-compose ps mongodb

# 查看MongoDB日志
docker-compose logs mongodb

# 手动测试连接
docker-compose exec mongodb mongosh -u admin -p
```

### 问题3：前端页面无法访问

```bash
# 检查应用容器状态
docker-compose ps dingtalk-reminder

# 查看应用日志
docker-compose logs dingtalk-reminder

# 检查端口映射
docker port dingtalk-reminder-app
```

### 问题4：钉钉消息发送失败

- 检查 `.env` 中的 `DINGTALK_WEBHOOK` 和 `DINGTALK_SECRET`
- 确认钉钉机器人设置中的IP白名单包含服务器IP
- 查看应用日志中的错误信息

## 📞 支持

如有问题，请查看：
- 项目Issues：https://github.com/YOUR_USERNAME/dingtalk-reminder-system/issues
- 应用日志：`docker-compose logs -f`
- 系统状态：访问 http://your-server:5001 后登录查看系统设置

## 🎉 部署成功后

1. 访问：`http://服务器IP:5001`
2. 使用默认账户登录：
   - 用户名：`admin`
   - 密码：`admin123`
3. **立即修改默认密码！**
4. 配置钉钉群组和任务
5. 开始使用！

---

祝部署顺利！ 🚀