#!/bin/bash

# 钉钉提醒系统 - 开发环境启动脚本

echo "🚀 启动钉钉提醒系统开发环境..."

# 检查MongoDB是否运行
echo "📦 检查MongoDB状态..."
if docker ps | grep -q mongodb; then
    echo "✅ MongoDB已在运行"
else
    echo "🔄 启动MongoDB..."
    docker-compose up -d mongodb
    echo "⏳ 等待MongoDB启动..."
    sleep 5
fi

# 安装依赖（如果需要）
if [ ! -d "backend/node_modules" ]; then
    echo "📦 安装后端依赖..."
    cd backend && npm install && cd ..
fi

if [ ! -d "frontend/node_modules" ]; then
    echo "📦 安装前端依赖..."
    cd frontend && npm install && cd ..
fi

# 启动后端
echo "🖥️ 启动后端服务..."
cd backend
npm run dev &
BACKEND_PID=$!
cd ..

# 等待后端启动
sleep 3

# 启动前端
echo "🎨 启动前端开发服务器..."
cd frontend
npm run dev &
FRONTEND_PID=$!
cd ..

echo "✅ 系统启动完成！"
echo ""
echo "📍 访问地址："
echo "   前端: http://localhost:5173"
echo "   后端API: http://localhost:3000"
echo ""
echo "💡 按 Ctrl+C 停止所有服务"

# 等待用户中断
trap "echo '🛑 停止所有服务...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT

# 保持脚本运行
wait