#!/bin/bash

# 生产环境部署脚本 - 钉钉提醒系统
# 用于在生产服务器上部署应用

set -e  # 遇到错误立即退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 配置变量
BACKUP_DIR="/backup/dingtalk-reminder"
LOG_DIR="/var/log/dingtalk-reminder"
DATA_DIR="/data/dingtalk-reminder"

# 打印带颜色的消息
print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

# 检查系统要求
check_requirements() {
    print_step "检查系统要求..."
    
    # 检查Docker
    if ! command -v docker &> /dev/null; then
        print_error "Docker未安装"
        exit 1
    fi
    
    # 检查Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        print_error "Docker Compose未安装"
        exit 1
    fi
    
    # 检查磁盘空间（至少需要5GB）
    available_space=$(df -BG / | awk 'NR==2 {print $4}' | sed 's/G//')
    if [ "$available_space" -lt 5 ]; then
        print_error "磁盘空间不足，至少需要5GB可用空间"
        exit 1
    fi
    
    print_info "系统要求检查通过 ✓"
}

# 创建必要的目录
create_directories() {
    print_step "创建必要的目录..."
    
    # 创建备份目录
    sudo mkdir -p "$BACKUP_DIR"
    
    # 创建日志目录
    sudo mkdir -p "$LOG_DIR"
    
    # 创建数据目录
    sudo mkdir -p "$DATA_DIR/mongodb"
    sudo mkdir -p "$DATA_DIR/uploads"
    sudo mkdir -p "$DATA_DIR/backups"
    
    # 设置权限
    sudo chmod 755 "$BACKUP_DIR"
    sudo chmod 755 "$LOG_DIR"
    sudo chmod 755 "$DATA_DIR"
    
    print_info "目录创建完成 ✓"
}

# 备份现有数据
backup_existing_data() {
    print_step "备份现有数据..."
    
    timestamp=$(date +%Y%m%d_%H%M%S)
    backup_file="$BACKUP_DIR/backup_$timestamp.tar.gz"
    
    # 检查是否有运行中的容器
    if docker-compose ps | grep -q "Up"; then
        print_info "发现运行中的服务，开始备份..."
        
        # 备份MongoDB数据
        docker-compose exec -T mongodb mongodump --out=/backup
        docker cp dingtalk-reminder-mongodb:/backup "$BACKUP_DIR/mongodb_$timestamp"
        
        # 备份上传文件
        if [ -d "./uploads" ]; then
            cp -r ./uploads "$BACKUP_DIR/uploads_$timestamp"
        fi
        
        print_info "数据备份完成: $BACKUP_DIR"
    else
        print_info "没有运行中的服务，跳过备份"
    fi
}

# 部署应用
deploy_application() {
    print_step "部署应用..."
    
    # 停止旧服务
    if docker-compose ps | grep -q "Up"; then
        print_info "停止旧服务..."
        docker-compose down
    fi
    
    # 拉取最新代码（如果使用Git）
    if [ -d ".git" ]; then
        print_info "拉取最新代码..."
        git pull origin main || git pull origin master
    fi
    
    # 构建前端
    print_info "构建前端资源..."
    cd frontend
    npm install --production
    npm run build
    cd ..
    
    # 构建Docker镜像
    print_info "构建Docker镜像..."
    docker build -t dingtalk-reminder:latest .
    
    # 使用生产环境配置启动服务
    print_info "启动服务..."
    docker-compose -f docker-compose.yml up -d
    
    print_info "应用部署完成 ✓"
}

# 健康检查
health_check() {
    print_step "执行健康检查..."
    
    # 等待服务启动
    print_info "等待服务完全启动..."
    sleep 15
    
    # 检查容器状态
    if ! docker-compose ps | grep -q "Up"; then
        print_error "服务未能正常启动"
        docker-compose logs --tail=50
        exit 1
    fi
    
    # 检查API健康状态
    max_attempts=10
    attempt=0
    
    while [ $attempt -lt $max_attempts ]; do
        if curl -f http://localhost:5001/api/health > /dev/null 2>&1; then
            print_info "API健康检查通过 ✓"
            break
        fi
        
        attempt=$((attempt + 1))
        print_info "等待API启动... ($attempt/$max_attempts)"
        sleep 3
    done
    
    if [ $attempt -eq $max_attempts ]; then
        print_error "API健康检查失败"
        docker-compose logs --tail=50
        exit 1
    fi
    
    # 显示服务状态
    print_info "服务状态:"
    docker-compose ps
}

# 设置防火墙规则
setup_firewall() {
    print_step "配置防火墙规则..."
    
    # 检查防火墙类型
    if command -v ufw &> /dev/null; then
        # Ubuntu/Debian
        sudo ufw allow 5001/tcp
        print_info "UFW防火墙规则已添加"
    elif command -v firewall-cmd &> /dev/null; then
        # CentOS/RHEL
        sudo firewall-cmd --permanent --add-port=5001/tcp
        sudo firewall-cmd --reload
        print_info "Firewalld防火墙规则已添加"
    else
        print_warning "未检测到防火墙，请手动配置端口5001"
    fi
}

# 设置自动启动
setup_autostart() {
    print_step "设置服务自动启动..."
    
    # 创建systemd服务文件
    sudo tee /etc/systemd/system/dingtalk-reminder.service > /dev/null << EOL
[Unit]
Description=DingTalk Reminder System
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=$(pwd)
ExecStart=/usr/local/bin/docker-compose up -d
ExecStop=/usr/local/bin/docker-compose down
ExecReload=/usr/local/bin/docker-compose restart

[Install]
WantedBy=multi-user.target
EOL
    
    # 重新加载systemd配置
    sudo systemctl daemon-reload
    
    # 启用服务
    sudo systemctl enable dingtalk-reminder.service
    
    print_info "自动启动设置完成 ✓"
}

# 显示部署信息
show_deployment_info() {
    print_info ""
    print_info "========================================="
    print_info "🎉 钉钉提醒系统部署成功!"
    print_info "========================================="
    print_info ""
    print_info "访问地址: http://$(hostname -I | awk '{print $1}'):5001"
    print_info "本地访问: http://localhost:5001"
    print_info ""
    print_info "默认管理员账号:"
    print_info "  用户名: admin"
    print_info "  密码: admin123"
    print_info ""
    print_warning "⚠️  请立即修改默认密码!"
    print_info ""
    print_info "常用运维命令:"
    print_info "  查看日志: docker-compose logs -f"
    print_info "  重启服务: docker-compose restart"
    print_info "  停止服务: docker-compose down"
    print_info "  查看状态: docker-compose ps"
    print_info "  备份数据: ./deploy-production.sh --backup"
    print_info ""
    print_info "日志位置: $LOG_DIR"
    print_info "数据位置: $DATA_DIR"
    print_info "备份位置: $BACKUP_DIR"
    print_info "========================================="
}

# 执行备份
perform_backup() {
    print_step "执行数据备份..."
    
    timestamp=$(date +%Y%m%d_%H%M%S)
    
    # 备份MongoDB
    docker-compose exec -T mongodb mongodump --out=/backup
    docker cp dingtalk-reminder-mongodb:/backup "$BACKUP_DIR/mongodb_$timestamp"
    
    # 备份配置文件
    cp .env "$BACKUP_DIR/env_$timestamp"
    
    # 备份上传文件
    if [ -d "./uploads" ]; then
        tar -czf "$BACKUP_DIR/uploads_$timestamp.tar.gz" ./uploads
    fi
    
    print_info "备份完成: $BACKUP_DIR/*_$timestamp"
}

# 恢复备份
restore_backup() {
    if [ -z "$2" ]; then
        print_error "请指定备份时间戳，例如: ./deploy-production.sh --restore 20240101_120000"
        exit 1
    fi
    
    timestamp=$2
    
    print_step "恢复备份: $timestamp"
    
    # 恢复MongoDB
    if [ -d "$BACKUP_DIR/mongodb_$timestamp" ]; then
        docker cp "$BACKUP_DIR/mongodb_$timestamp" dingtalk-reminder-mongodb:/restore
        docker-compose exec -T mongodb mongorestore --drop /restore
        print_info "MongoDB数据恢复完成"
    fi
    
    # 恢复配置文件
    if [ -f "$BACKUP_DIR/env_$timestamp" ]; then
        cp "$BACKUP_DIR/env_$timestamp" .env
        print_info "配置文件恢复完成"
    fi
    
    # 恢复上传文件
    if [ -f "$BACKUP_DIR/uploads_$timestamp.tar.gz" ]; then
        tar -xzf "$BACKUP_DIR/uploads_$timestamp.tar.gz"
        print_info "上传文件恢复完成"
    fi
    
    print_info "备份恢复完成，请重启服务: docker-compose restart"
}

# 主流程
main() {
    case "${1:-}" in
        --backup)
            perform_backup
            ;;
        --restore)
            restore_backup "$@"
            ;;
        --health-check)
            health_check
            ;;
        --help)
            echo "使用方法: ./deploy-production.sh [选项]"
            echo ""
            echo "选项:"
            echo "  无参数         执行完整部署流程"
            echo "  --backup      备份当前数据"
            echo "  --restore     恢复备份数据"
            echo "  --health-check 执行健康检查"
            echo "  --help        显示帮助信息"
            ;;
        *)
            print_info "========================================="
            print_info "钉钉提醒系统 - 生产环境部署"
            print_info "========================================="
            
            check_requirements
            create_directories
            backup_existing_data
            deploy_application
            health_check
            setup_firewall
            setup_autostart
            show_deployment_info
            ;;
    esac
}

# 执行主流程
main "$@"