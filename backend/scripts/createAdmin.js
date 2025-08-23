/**
 * 创建管理员账户的脚本
 * 使用方法: node scripts/createAdmin.js
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// MongoDB连接配置
// 使用本地MongoDB实例，端口27018（Docker映射端口）
// 使用与server.js相同的认证信息
const MONGODB_URI = 'mongodb://cronicle:cronicle123456@localhost:27018/cronicle?authSource=admin';

// 用户模型
const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        minlength: 3,
        maxlength: 20
    },
    password: {
        type: String,
        required: true,
        minlength: 6
    },
    email: {
        type: String,
        trim: true,
        lowercase: true,
        match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, '请填写有效的邮箱地址']
    },
    role: {
        type: String,
        enum: ['admin', 'user'],
        default: 'user'
    },
    lastLoginAt: Date
}, {
    timestamps: true
});

// 密码加密中间件
userSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    
    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

const User = mongoose.model('User', userSchema);

async function createAdmin() {
    try {
        // 连接MongoDB
        await mongoose.connect(MONGODB_URI);
        console.log('已连接到MongoDB');
        
        // 管理员账户信息
        const adminData = {
            username: 'admin',
            password: 'admin123', // 请及时修改密码
            email: 'admin@dingtalk.com',
            role: 'admin'
        };
        
        // 检查是否已存在admin用户
        const existingAdmin = await User.findOne({ username: 'admin' });
        
        if (existingAdmin) {
            console.log('管理员账户已存在');
            
            // 更新为管理员角色
            if (existingAdmin.role !== 'admin') {
                existingAdmin.role = 'admin';
                await existingAdmin.save();
                console.log('已将现有用户更新为管理员角色');
            }
            
            // 询问是否重置密码
            console.log('如需重置密码，请删除用户后重新运行此脚本');
        } else {
            // 创建新的管理员用户
            const admin = new User(adminData);
            await admin.save();
            
            console.log('管理员账户创建成功:');
            console.log('用户名: admin');
            console.log('密码: admin123');
            console.log('请尽快登录并修改密码！');
        }
        
        // 显示所有管理员用户
        const allAdmins = await User.find({ role: 'admin' }).select('username email createdAt');
        console.log('\n当前系统管理员列表:');
        allAdmins.forEach(admin => {
            console.log(`- ${admin.username} (${admin.email || '无邮箱'}) - 创建于: ${admin.createdAt}`);
        });
        
    } catch (error) {
        console.error('创建管理员失败:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n已断开MongoDB连接');
    }
}

// 执行创建
createAdmin();