#!/bin/bash

# Docker构建脚本 - 钉钉提醒系统
# 用于构建和部署Docker容器

set -e  # 遇到错误立即退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

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

# 检查Docker是否安装
check_docker() {
    if ! command -v docker &> /dev/null; then
        print_error "Docker未安装，请先安装Docker"
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        print_error "Docker Compose未安装，请先安装Docker Compose"
        exit 1
    fi
    
    print_info "Docker环境检查通过 ✓"
}

# 创建环境配置文件
create_env_file() {
    if [ ! -f .env ]; then
        print_info "创建环境配置文件..."
        cat > .env << EOL
# MongoDB配置
MONGO_ROOT_USER=root
MONGO_ROOT_PASSWORD=root123456
MONGO_DB=dingtalk-scheduler
MONGO_USER=admin
MONGO_PASSWORD=admin123456

# 应用配置
NODE_ENV=production
APP_PORT=5001

# JWT配置 (生产环境请修改)
JWT_SECRET=your_jwt_secret_change_in_production
JWT_REFRESH_SECRET=your_jwt_refresh_secret_change_in_production
JWT_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

# Redis配置 (可选)
REDIS_ENABLED=false
REDIS_PASSWORD=redis123456

# 日志级别
LOG_LEVEL=info

# 监控阈值
CPU_THRESHOLD=80
MEMORY_THRESHOLD=85
DISK_THRESHOLD=90
RESPONSE_TIME_THRESHOLD=2000
ERROR_RATE_THRESHOLD=5

# 钉钉配置 (请填入实际值)
DINGTALK_WEBHOOK=
DINGTALK_SECRET=

# 任务配置
MAX_RETRY_COUNT=3
RETRY_INTERVAL=60
EOL
        print_info "环境配置文件创建成功，请编辑 .env 文件配置实际参数"
    else
        print_info "使用现有的 .env 文件"
    fi
}

# 构建前端
build_frontend() {
    print_info "开始构建前端..."
    
    if [ ! -d "frontend/node_modules" ]; then
        print_info "安装前端依赖..."
        cd frontend
        npm install
        cd ..
    fi
    
    cd frontend
    npm run build
    cd ..
    
    print_info "前端构建完成 ✓"
}

# 构建Docker镜像
build_docker_image() {
    print_info "开始构建Docker镜像..."
    
    # 构建镜像
    docker build -t dingtalk-reminder:latest .
    
    print_info "Docker镜像构建完成 ✓"
}

# 启动服务
start_services() {
    print_info "启动服务..."
    
    # 停止旧容器（如果存在）
    docker-compose down
    
    # 启动新容器
    docker-compose up -d
    
    # 等待服务启动
    print_info "等待服务启动..."
    sleep 10
    
    # 检查服务状态
    if docker-compose ps | grep -q "Up"; then
        print_info "服务启动成功 ✓"
        
        # 显示服务状态
        docker-compose ps
        
        print_info ""
        print_info "========================================="
        print_info "钉钉提醒系统已成功部署!"
        print_info "访问地址: http://localhost:5001"
        print_info "默认账号: admin"
        print_info "默认密码: admin123 (请及时修改)"
        print_info "========================================="
        print_info ""
        print_info "常用命令:"
        print_info "  查看日志: docker-compose logs -f"
        print_info "  停止服务: docker-compose down"
        print_info "  重启服务: docker-compose restart"
        print_info "  查看状态: docker-compose ps"
    else
        print_error "服务启动失败，请查看日志"
        docker-compose logs
        exit 1
    fi
}

# 初始化数据库
init_database() {
    print_info "初始化数据库..."
    
    # 等待MongoDB完全启动
    print_info "等待MongoDB启动..."
    sleep 5
    
    # 运行初始化脚本
    docker-compose exec dingtalk-reminder node backend/scripts/init-mongodb.js
    
    print_info "数据库初始化完成 ✓"
}

# 主流程
main() {
    print_info "========================================="
    print_info "钉钉提醒系统 - Docker部署脚本"
    print_info "========================================="
    
    # 参数解析
    case "${1:-}" in
        --build-only)
            check_docker
            create_env_file
            build_frontend
            build_docker_image
            print_info "构建完成，未启动服务"
            ;;
        --start-only)
            check_docker
            start_services
            ;;
        --init-db)
            init_database
            ;;
        --clean)
            print_info "清理Docker容器和镜像..."
            docker-compose down -v
            docker rmi dingtalk-reminder:latest || true
            print_info "清理完成"
            ;;
        --help)
            echo "使用方法: ./docker-build.sh [选项]"
            echo ""
            echo "选项:"
            echo "  无参数        完整构建和部署流程"
            echo "  --build-only  仅构建镜像，不启动服务"
            echo "  --start-only  仅启动服务，不重新构建"
            echo "  --init-db     初始化数据库"
            echo "  --clean       清理容器和镜像"
            echo "  --help        显示帮助信息"
            ;;
        *)
            check_docker
            create_env_file
            build_frontend
            build_docker_image
            start_services
            ;;
    esac
}

# 执行主流程
main "$@"