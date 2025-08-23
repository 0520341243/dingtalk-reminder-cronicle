const mysql = require('mysql2/promise');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

async function initDatabase() {
    let connection = null;
    
    try {
        console.log('🚀 开始初始化数据库...');
        
        // 连接到MySQL服务器（不指定数据库）
        connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            port: process.env.DB_PORT || 3306,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            charset: 'utf8mb4'
        });

        console.log('✅ 已连接到MySQL服务器');

        // 读取SQL初始化脚本
        const sqlPath = path.join(__dirname, 'init-db.sql');
        const sqlContent = await fs.readFile(sqlPath, 'utf8');
        
        // 分割SQL语句（以分号分隔）
        const sqlStatements = sqlContent
            .split(';')
            .map(statement => statement.trim())
            .filter(statement => statement.length > 0 && !statement.startsWith('--'));

        console.log(`📄 找到 ${sqlStatements.length} 条SQL语句`);

        // 执行每条SQL语句
        for (let i = 0; i < sqlStatements.length; i++) {
            const statement = sqlStatements[i];
            
            try {
                await connection.execute(statement);
                
                // 显示执行进度
                if (statement.toUpperCase().includes('CREATE TABLE')) {
                    const tableName = statement.match(/CREATE TABLE.*?`?(\w+)`?/i)?.[1];
                    console.log(`✅ 创建表: ${tableName}`);
                } else if (statement.toUpperCase().includes('INSERT INTO')) {
                    const tableName = statement.match(/INSERT INTO.*?`?(\w+)`?/i)?.[1];
                    console.log(`✅ 插入数据: ${tableName}`);
                } else if (statement.toUpperCase().includes('CREATE DATABASE')) {
                    console.log('✅ 创建数据库');
                }
                
            } catch (error) {
                console.warn(`⚠️  SQL执行警告 (${i + 1}/${sqlStatements.length}):`, error.message);
                // 继续执行其他语句
            }
        }

        // 验证数据库结构
        await connection.execute(`USE ${process.env.DB_NAME || 'dingtalkreminder'}`);
        
        const [tables] = await connection.execute('SHOW TABLES');
        console.log('📋 已创建的数据表:');
        tables.forEach(table => {
            const tableName = Object.values(table)[0];
            console.log(`   - ${tableName}`);
        });

        // 检查默认管理员账户
        const [adminUser] = await connection.execute(
            'SELECT username FROM users WHERE role = "admin" LIMIT 1'
        );
        
        if (adminUser.length > 0) {
            console.log('👤 默认管理员账户已创建:');
            console.log('   用户名: admin');
            console.log('   密码: admin123 (请及时修改)');
        }

        console.log('🎉 数据库初始化完成！');
        
        // 输出连接信息
        console.log('\n📊 数据库连接信息:');
        console.log(`   主机: ${process.env.DB_HOST || 'localhost'}`);
        console.log(`   端口: ${process.env.DB_PORT || 3306}`);
        console.log(`   数据库: ${process.env.DB_NAME || 'dingtalkreminder'}`);
        console.log(`   用户: ${process.env.DB_USER}`);

    } catch (error) {
        console.error('❌ 数据库初始化失败:', error.message);
        
        if (error.code === 'ER_ACCESS_DENIED_ERROR') {
            console.error('💡 请检查数据库用户名和密码是否正确');
        } else if (error.code === 'ECONNREFUSED') {
            console.error('💡 请检查MySQL服务是否启动以及连接配置');
        } else {
            console.error('💡 详细错误信息:', error);
        }
        
        process.exit(1);
        
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

// 检查环境变量
function checkEnvironment() {
    const requiredEnvVars = ['DB_USER', 'DB_PASSWORD'];
    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
        console.error('❌ 缺少必需的环境变量:');
        missingVars.forEach(varName => {
            console.error(`   - ${varName}`);
        });
        console.error('\n💡 请创建 .env 文件并设置这些变量，或参考 .env.example');
        process.exit(1);
    }
}

// 主函数
async function main() {
    console.log('🔧 钉钉提醒系统 - 数据库初始化工具');
    console.log('=====================================\n');
    
    // 检查环境变量
    checkEnvironment();
    
    // 初始化数据库
    await initDatabase();
}

// 运行脚本
if (require.main === module) {
    main().catch(error => {
        console.error('❌ 程序执行失败:', error);
        process.exit(1);
    });
}

module.exports = { initDatabase };