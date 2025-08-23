#!/bin/bash

# 迁移Git仓库脚本
# 从父目录迁移到项目独立仓库

echo "========================================="
echo "迁移Git仓库到项目独立目录"
echo "========================================="

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 1. 确保在正确的目录
CURRENT_DIR=$(pwd)
PROJECT_DIR="/Users/mengbowang/代码/dingtalk-reminder-clean"
PARENT_DIR="/Users/mengbowang/代码"

if [[ "$CURRENT_DIR" != "$PROJECT_DIR" ]]; then
    echo -e "${YELLOW}切换到项目目录...${NC}"
    cd "$PROJECT_DIR"
fi

echo -e "${GREEN}当前目录: $(pwd)${NC}"

# 2. 备份父目录的Git历史（保存提交信息）
echo -e "${BLUE}保存提交历史...${NC}"
cd "$PARENT_DIR"
git log --pretty=format:"%h %ai %an <%ae>%n%s%n%b%n---" > "$PROJECT_DIR/git-history-backup.txt"
echo -e "${GREEN}提交历史已保存到 git-history-backup.txt${NC}"

# 3. 回到项目目录
cd "$PROJECT_DIR"

# 4. 检查并删除项目目录中的.git（如果存在）
if [ -d ".git" ]; then
    echo -e "${YELLOW}删除项目目录中的旧.git...${NC}"
    rm -rf .git
fi

# 5. 初始化新的Git仓库
echo -e "${GREEN}初始化新的Git仓库...${NC}"
git init

# 6. 添加所有项目文件
echo -e "${GREEN}添加项目文件...${NC}"
git add .

# 7. 创建综合提交（包含所有历史信息）
echo -e "${GREEN}创建提交...${NC}"
git commit -m "feat: 钉钉智能提醒系统 - 完整实现

包含以下功能更新：
1. 修复系统设置界面功能缺失的问题，优化任务界面布局和功能，优化仪表盘界面显示
2. 修复了任务关联问题
3. 完善了用户管理功能
4. 优化一些细节，增加Docker部署文件

主要特性：
- Vue 3 + Element Plus 前端界面
- Node.js + Express 后端服务
- MongoDB 数据存储
- Docker 容器化部署
- 支持复杂调度规则
- Excel 批量导入
- 任务关联管理
- 系统设置和监控

历史提交记录已保存在 git-history-backup.txt"

# 8. 重命名分支为main
git branch -M main

# 9. 询问是否删除父目录的.git
echo ""
echo -e "${YELLOW}=========================================${NC}"
echo -e "${YELLOW}重要：是否删除父目录的Git仓库？${NC}"
echo -e "${YELLOW}路径：$PARENT_DIR/.git${NC}"
echo -e "${YELLOW}=========================================${NC}"
read -p "确认删除父目录的.git？这将影响其他项目！(yes/no): " -r
echo

if [[ "$REPLY" == "yes" ]]; then
    echo -e "${RED}删除父目录的Git仓库...${NC}"
    rm -rf "$PARENT_DIR/.git"
    echo -e "${GREEN}✅ 父目录Git仓库已删除${NC}"
else
    echo -e "${YELLOW}保留父目录的Git仓库${NC}"
    echo -e "${YELLOW}注意：你需要手动处理父目录的Git仓库${NC}"
fi

# 10. 显示结果
echo ""
echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}✅ 项目Git仓库设置完成！${NC}"
echo -e "${GREEN}=========================================${NC}"
echo ""
echo "当前状态："
git status --short
echo ""
echo "当前分支："
git branch
echo ""
echo "下一步操作："
echo "1. 在GitHub上创建新仓库（不要初始化README）"
echo "2. 添加远程仓库："
echo "   git remote add origin https://github.com/YOUR_USERNAME/dingtalk-reminder-system.git"
echo "3. 推送到GitHub："
echo "   git push -u origin main"
echo ""
echo -e "${GREEN}提示：历史提交记录已保存在 git-history-backup.txt 文件中${NC}"