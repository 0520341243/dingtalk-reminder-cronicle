#!/bin/bash

# 设置独立Git仓库的脚本
# 这将为dingtalk-reminder-clean项目创建独立的Git仓库

echo "========================================="
echo "设置钉钉提醒系统独立Git仓库"
echo "========================================="

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 1. 确保在正确的目录
CURRENT_DIR=$(pwd)
if [[ ! "$CURRENT_DIR" == *"dingtalk-reminder-clean"* ]]; then
    echo -e "${RED}错误：请在dingtalk-reminder-clean目录内运行此脚本${NC}"
    exit 1
fi

echo -e "${GREEN}当前目录: $CURRENT_DIR${NC}"

# 2. 检查是否已有.git目录
if [ -d ".git" ]; then
    echo -e "${YELLOW}警告：当前目录已有.git目录${NC}"
    read -p "是否删除并重新初始化？(y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        rm -rf .git
        echo -e "${GREEN}已删除旧的.git目录${NC}"
    else
        echo "退出脚本"
        exit 0
    fi
fi

# 3. 初始化新的Git仓库
echo -e "${GREEN}初始化Git仓库...${NC}"
git init

# 4. 配置Git（可选）
echo -e "${GREEN}配置Git...${NC}"
# 如果需要设置用户信息，取消下面的注释
# git config user.name "Your Name"
# git config user.email "your.email@example.com"

# 5. 添加所有文件
echo -e "${GREEN}添加项目文件...${NC}"
git add .

# 6. 创建初始提交
echo -e "${GREEN}创建初始提交...${NC}"
git commit -m "Initial commit: 钉钉智能提醒系统 - 完整实现

功能特性:
- Vue 3 + Element Plus前端
- Node.js + Express后端
- MongoDB数据存储
- Docker容器化部署
- 支持复杂调度规则
- Excel批量导入
- 任务关联管理"

# 7. 重命名分支为main
git branch -M main

echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}✅ Git仓库初始化完成！${NC}"
echo -e "${GREEN}=========================================${NC}"
echo ""
echo "下一步操作："
echo "1. 在GitHub上创建新仓库（不要初始化README）"
echo "2. 运行以下命令添加远程仓库："
echo ""
echo "   git remote add origin https://github.com/YOUR_USERNAME/dingtalk-reminder-system.git"
echo ""
echo "3. 推送代码到GitHub："
echo ""
echo "   git push -u origin main"
echo ""
echo "当前Git状态："
git status --short
echo ""
echo "当前分支："
git branch
echo ""
echo -e "${YELLOW}提示：请将YOUR_USERNAME替换为你的GitHub用户名${NC}"