/**
 * MongoDB数据库初始化脚本
 * 用于Docker容器启动时初始化数据库
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const logger = require('../utils/logger');

// MongoDB连接配置
const mongoUrl = process.env.MONGODB_URL || 
    `mongodb://${process.env.MONGO_USER || 'admin'}:${process.env.MONGO_PASSWORD || 'admin123456'}@${process.env.MONGO_HOST || 'localhost'}:${process.env.MONGO_PORT || '27017'}/${process.env.MONGO_DB || 'dingtalk-scheduler'}?authSource=admin`;

// 导入模型
const { User, Group, Setting } = require('../models/mongodb');

async function initMongoDB() {
    try {
        console.log('🚀 开始初始化MongoDB数据库...');
        console.log(`📊 连接URL: ${mongoUrl.replace(/\/\/.*:.*@/, '//***:***@')}`); // 隐藏密码
        
        // 连接到MongoDB
        await mongoose.connect(mongoUrl);
        console.log('✅ 已连接到MongoDB服务器');

        // 检查是否已有管理员用户
        const adminCount = await User.countDocuments({ role: 'admin' });
        
        if (adminCount === 0) {
            console.log('👤 创建默认管理员账户...');
            
            // 创建默认管理员
            const adminUser = new User({
                username: 'admin',
                password: 'admin123', // 密码会自动加密
                role: 'admin',
                email: 'admin@dingtalk.com'
            });
            
            await adminUser.save();
            console.log('✅ 默认管理员账户创建成功');
            console.log('   用户名: admin');
            console.log('   密码: admin123 (请及时修改)');
        } else {
            console.log('ℹ️  管理员账户已存在，跳过创建');
        }

        // 初始化默认设置
        const settingsCount = await Setting.countDocuments();
        
        if (settingsCount === 0) {
            console.log('⚙️  初始化系统默认设置...');
            
            const defaultSettings = [
                { key: 'scheduler_enabled', value: 'true', description: '调度器状态' },
                { key: 'daily_load_time', value: '02:00', description: '每日加载时间' },
                { key: 'max_retry_count', value: 3, description: '最大重试次数' },
                { key: 'retry_interval', value: 300, description: '重试间隔(秒)' },
                { key: 'task_timeout', value: 30, description: '任务超时时间(秒)' },
                { key: 'max_concurrent_tasks', value: 10, description: '最大并发任务数' },
                { key: 'history_retention_days', value: 90, description: '历史记录保留天数' },
                { key: 'log_retention_days', value: 30, description: '日志保留天数' },
                { key: 'auto_cleanup_enabled', value: true, description: '自动清理' },
                { key: 'cleanup_time', value: '03:00', description: '清理时间' }
            ];
            
            for (const setting of defaultSettings) {
                await Setting.create(setting);
            }
            
            console.log('✅ 系统默认设置初始化完成');
        } else {
            console.log('ℹ️  系统设置已存在，跳过初始化');
        }

        // 创建示例群组（可选）
        const groupCount = await Group.countDocuments();
        
        if (groupCount === 0 && process.env.CREATE_SAMPLE_DATA === 'true') {
            console.log('📱 创建示例群组...');
            
            const sampleGroup = new Group({
                name: '测试群组',
                description: '这是一个示例群组，请根据实际情况修改',
                webhookUrl: 'https://oapi.dingtalk.com/robot/send?access_token=YOUR_TOKEN',
                secret: '',
                status: 'inactive', // 默认不激活
                groupType: 'regular'
            });
            
            await sampleGroup.save();
            console.log('✅ 示例群组创建成功（状态：未激活）');
        }

        // 验证数据库结构
        console.log('\n📋 数据库集合状态:');
        const collections = await mongoose.connection.db.listCollections().toArray();
        collections.forEach(collection => {
            console.log(`   - ${collection.name}`);
        });

        // 统计数据
        console.log('\n📊 数据统计:');
        console.log(`   用户数: ${await User.countDocuments()}`);
        console.log(`   群组数: ${await Group.countDocuments()}`);
        console.log(`   设置项: ${await Setting.countDocuments()}`);

        console.log('\n🎉 MongoDB数据库初始化完成！');
        
        // 输出连接信息
        console.log('\n📊 数据库连接信息:');
        console.log(`   主机: ${process.env.MONGO_HOST || 'localhost'}`);
        console.log(`   端口: ${process.env.MONGO_PORT || '27017'}`);
        console.log(`   数据库: ${process.env.MONGO_DB || 'dingtalk-scheduler'}`);

    } catch (error) {
        console.error('❌ MongoDB初始化失败:', error.message);
        
        if (error.name === 'MongoServerError' && error.code === 18) {
            console.error('💡 认证失败，请检查用户名和密码');
        } else if (error.name === 'MongoNetworkError') {
            console.error('💡 连接失败，请检查MongoDB服务是否启动');
        } else {
            console.error('💡 详细错误信息:', error);
        }
        
        throw error;
        
    } finally {
        // 关闭连接
        if (mongoose.connection.readyState === 1) {
            await mongoose.disconnect();
            console.log('🔌 数据库连接已关闭');
        }
    }
}

// 检查环境变量
function checkEnvironment() {
    // MongoDB可以使用默认值，所以不强制要求环境变量
    console.log('🔍 环境变量检查:');
    console.log(`   MONGO_HOST: ${process.env.MONGO_HOST || 'localhost (默认)'}`);
    console.log(`   MONGO_PORT: ${process.env.MONGO_PORT || '27017 (默认)'}`);
    console.log(`   MONGO_DB: ${process.env.MONGO_DB || 'dingtalk-scheduler (默认)'}`);
    console.log(`   MONGO_USER: ${process.env.MONGO_USER ? '已设置' : '未设置 (使用默认)'}`);
    console.log(`   MONGO_PASSWORD: ${process.env.MONGO_PASSWORD ? '已设置' : '未设置 (使用默认)'}`);
}

// 主函数
async function main() {
    console.log('🔧 钉钉提醒系统 - MongoDB初始化工具');
    console.log('=====================================\n');
    
    // 检查环境变量
    checkEnvironment();
    
    // 等待MongoDB启动（Docker环境）
    if (process.env.WAIT_FOR_MONGO === 'true') {
        console.log('⏳ 等待MongoDB服务启动...');
        await new Promise(resolve => setTimeout(resolve, 5000));
    }
    
    // 初始化数据库
    await initMongoDB();
}

// 运行脚本
if (require.main === module) {
    main()
        .then(() => {
            console.log('✅ 初始化脚本执行成功');
            process.exit(0);
        })
        .catch(error => {
            console.error('❌ 初始化脚本执行失败:', error);
            process.exit(1);
        });
}

module.exports = { initMongoDB };