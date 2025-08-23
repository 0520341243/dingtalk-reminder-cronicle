const fs = require('fs');
const path = require('path');
const { pool } = require('../config/database');

/**
 * 智能分割SQL语句，正确处理PostgreSQL函数定义
 */
function splitSQLStatements(sql) {
    const statements = [];
    let currentStatement = '';
    let inDollarQuoted = false;
    let dollarTag = '';
    
    const lines = sql.split('\n');
    
    for (const line of lines) {
        const trimmedLine = line.trim();
        
        if (!inDollarQuoted) {
            // 检查是否开始dollar-quoted字符串
            const dollarMatch = trimmedLine.match(/\$(\w*)\$/);
            if (dollarMatch) {
                inDollarQuoted = true;
                dollarTag = dollarMatch[1];
            }
        } else {
            // 检查是否结束dollar-quoted字符串
            const endTag = `$${dollarTag}$`;
            if (trimmedLine.includes(endTag)) {
                inDollarQuoted = false;
                dollarTag = '';
            }
        }
        
        currentStatement += line + '\n';
        
        // 如果不在dollar-quoted字符串中，且行以分号结尾，则视为语句结束
        if (!inDollarQuoted && trimmedLine.endsWith(';')) {
            statements.push(currentStatement.trim());
            currentStatement = '';
        }
    }
    
    // 添加最后一个语句（如果有）
    if (currentStatement.trim()) {
        statements.push(currentStatement.trim());
    }
    
    return statements;
}

/**
 * 初始化数据库
 */
async function initDatabase() {
    console.log('🔄 开始初始化数据库...');
    
    try {
        // 读取 SQL 初始化文件
        const sqlFilePath = path.join(__dirname, '../scripts/init-db.sql');
        const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');
        
        // 清理 SQL 内容，移除注释
        const cleanedSql = sqlContent
            .split('\n')
            .filter(line => !line.trim().startsWith('--') && line.trim().length > 0)
            .join('\n');
            
        // 智能分割 SQL 语句，处理 PostgreSQL 函数定义
        const sqlStatements = splitSQLStatements(cleanedSql)
            .map(statement => statement.trim())
            .filter(statement => {
                const upperStatement = statement.toUpperCase();
                return statement.length > 0 && 
                       !upperStatement.startsWith('USE') &&
                       !upperStatement.startsWith('CREATE DATABASE');
            });
        
        console.log(`📝 找到 ${sqlStatements.length} 条 SQL 语句`);
        
        // 调试信息：显示前几条语句
        if (sqlStatements.length > 0) {
            console.log('🔍 前3条SQL语句预览:');
            sqlStatements.slice(0, 3).forEach((stmt, i) => {
                console.log(`   ${i + 1}: ${stmt.substring(0, 100)}${stmt.length > 100 ? '...' : ''}`);
            });
        } else {
            console.log('⚠️  没有找到有效的SQL语句，检查SQL文件内容...');
            console.log('📄 SQL文件路径:', sqlFilePath);
            console.log('📄 文件大小:', sqlContent.length, '字符');
        }
        
        // 如果没有解析到SQL语句，使用内置的表创建语句
        if (sqlStatements.length === 0) {
            console.log('🔧 使用内置SQL语句创建表...');
            await createTablesManually();
        } else {
            let hasFailures = false;
            // 逐条执行 SQL 语句
            for (let i = 0; i < sqlStatements.length; i++) {
                const statement = sqlStatements[i];
                
                try {
                    const client = await pool.connect();
                    await client.query(statement);
                    client.release();
                    console.log(`✅ 执行成功: SQL 语句 ${i + 1}`);
                    
                } catch (error) {
                    // 忽略表已存在等常见错误 (PostgreSQL错误码)
                    if (error.code === '42P07' || // relation already exists
                        error.code === '42710' || // duplicate object
                        error.code === '23505') {  // unique violation
                        console.log(`⚠️  跳过已存在: SQL 语句 ${i + 1}`);
                    } else {
                        console.error(`❌ 执行失败: SQL 语句 ${i + 1}`, error.message);
                        hasFailures = true;
                    }
                }
            }
            
            // 如果有失败的语句，检查关键表是否存在，不存在则使用备用方案
            if (hasFailures) {
                console.log('🔧 检测到SQL执行失败，检查关键表状态...');
                const missingTables = await checkMissingTables();
                if (missingTables.length > 0) {
                    console.log(`🔧 缺少关键表: ${missingTables.join(', ')}，使用备用方案创建...`);
                    await createTablesManually();
                }
            }
        }
        
        // 验证表是否创建成功
        await verifyTables();
        
        // 初始化测试数据（如果存在测试数据文件）
        const testDataPath = path.join(__dirname, '../scripts/init-test-data.sql');
        if (fs.existsSync(testDataPath)) {
            console.log('📝 加载测试数据...');
            try {
                const testDataSql = fs.readFileSync(testDataPath, 'utf8');
                const testStatements = splitSQLStatements(testDataSql)
                    .map(statement => statement.trim())
                    .filter(statement => statement.length > 0 && !statement.toUpperCase().startsWith('--'));
                
                for (const statement of testStatements) {
                    try {
                        const client = await pool.connect();
                        await client.query(statement);
                        client.release();
                        console.log('✅ 测试数据语句执行成功');
                    } catch (error) {
                        if (error.code === '23505') {
                            console.log('⚠️  测试数据已存在，跳过');
                        } else {
                            console.log('⚠️  测试数据执行失败（非关键）:', error.message);
                        }
                    }
                }
                console.log('✅ 测试数据加载完成');
            } catch (error) {
                console.log('⚠️  无法加载测试数据（非关键）:', error.message);
            }
        }
        
        console.log('✅ 数据库初始化完成');
        return true;
        
    } catch (error) {
        console.error('❌ 数据库初始化失败:', error.message);
        return false;
    }
}

/**
 * 手动创建数据库表（备用方案）
 */
async function createTablesManually() {
    // First create ENUM types
    const enumTypes = [
        "CREATE TYPE user_role AS ENUM ('admin', 'user')",
        "CREATE TYPE group_status AS ENUM ('active', 'inactive')",
        "CREATE TYPE group_type AS ENUM ('regular', 'custom')",
        "CREATE TYPE reminder_status AS ENUM ('pending', 'sent', 'failed', 'sending', 'cancelled')",
        "CREATE TYPE repeat_type AS ENUM ('none', 'daily', 'weekly', 'monthly', 'yearly', 'custom', 'single')",
        "CREATE TYPE file_type AS ENUM ('regular', 'temp', 'custom_reminder')",
        "CREATE TYPE file_status AS ENUM ('active', 'processed', 'archived')"
    ];
    
    // Create enum types first
    for (let i = 0; i < enumTypes.length; i++) {
        try {
            const client = await pool.connect();
            await client.query(enumTypes[i]);
            client.release();
            console.log(`✅ 创建枚举类型成功: ${i + 1}/${enumTypes.length}`);
        } catch (error) {
            if (error.code === '42710') { // duplicate object
                console.log(`⚠️  枚举类型已存在: ${i + 1}/${enumTypes.length}`);
            } else {
                console.error(`❌ 创建枚举类型失败: ${i + 1}/${enumTypes.length}`, error.message);
            }
        }
    }
    
    const tables = [
        // 用户表
        `CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            username VARCHAR(50) UNIQUE NOT NULL,
            password VARCHAR(255) NOT NULL,
            role user_role DEFAULT 'user',
            email VARCHAR(100),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )`,
        
        // 群组配置表
        `CREATE TABLE IF NOT EXISTS groups (
            id SERIAL PRIMARY KEY,
            name VARCHAR(100) NOT NULL,
            description TEXT,
            webhook_url VARCHAR(500) NOT NULL,
            secret VARCHAR(255),
            status group_status DEFAULT 'active',
            group_type group_type DEFAULT 'regular',
            created_by INTEGER REFERENCES users(id),
            last_send_time TIMESTAMP WITH TIME ZONE,
            send_count INTEGER DEFAULT 0,
            fail_count INTEGER DEFAULT 0,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )`,
        
        // 系统配置表
        `CREATE TABLE IF NOT EXISTS settings (
            id SERIAL PRIMARY KEY,
            setting_key VARCHAR(100) UNIQUE NOT NULL,
            setting_value TEXT,
            description VARCHAR(255),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )`,
        
        // 提醒计划表
        `CREATE TABLE IF NOT EXISTS reminders (
            id SERIAL PRIMARY KEY,
            group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
            schedule_date DATE NOT NULL,
            schedule_time TIME NOT NULL,
            message_content TEXT NOT NULL,
            status reminder_status DEFAULT 'pending',
            worksheet_name VARCHAR(50),
            file_name VARCHAR(255),
            is_temp BOOLEAN DEFAULT FALSE,
            sent_at TIMESTAMP WITH TIME ZONE,
            error_message TEXT,
            repeat_rule TEXT,
            repeat_type repeat_type DEFAULT 'none',
            parent_reminder_id INTEGER REFERENCES reminders(id),
            is_recurring BOOLEAN DEFAULT FALSE,
            recurring_end_date DATE,
            next_occurrence_date DATE,
            occurrence_count INTEGER DEFAULT 0,
            max_occurrences INTEGER,
            created_by INTEGER REFERENCES users(id),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )`,
        
        // 发送记录表
        `CREATE TABLE IF NOT EXISTS send_logs (
            id SERIAL PRIMARY KEY,
            group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
            reminder_id INTEGER REFERENCES reminders(id) ON DELETE SET NULL,
            message_content TEXT,
            send_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            response_code INTEGER,
            response_message TEXT,
            is_success BOOLEAN DEFAULT FALSE,
            retry_count INTEGER DEFAULT 0
        )`,
        
        // 文件管理表
        `CREATE TABLE IF NOT EXISTS files (
            id SERIAL PRIMARY KEY,
            group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
            original_name VARCHAR(255) NOT NULL,
            stored_name VARCHAR(255) NOT NULL,
            file_path VARCHAR(500) NOT NULL,
            file_size INTEGER,
            file_type file_type DEFAULT 'regular',
            status file_status DEFAULT 'active',
            upload_by INTEGER REFERENCES users(id),
            processed_at TIMESTAMP WITH TIME ZONE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )`,
        
        // 工作表映射配置表
        `CREATE TABLE IF NOT EXISTS worksheet_mappings (
            id SERIAL PRIMARY KEY,
            group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
            weekday SMALLINT NOT NULL CHECK (weekday >= 1 AND weekday <= 7),
            worksheet_name VARCHAR(50) NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            UNIQUE (group_id, weekday)
        )`,
        
        // 重复规则模板表
        `CREATE TABLE IF NOT EXISTS recurring_templates (
            id SERIAL PRIMARY KEY,
            template_name VARCHAR(100) NOT NULL UNIQUE,
            rule_pattern TEXT NOT NULL,
            rule_type repeat_type NOT NULL,
            description TEXT,
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )`,
        
        // 自定义提醒日志表
        `CREATE TABLE IF NOT EXISTS custom_reminder_logs (
            id SERIAL PRIMARY KEY,
            parent_reminder_id INTEGER NOT NULL REFERENCES reminders(id) ON DELETE CASCADE,
            executed_date DATE NOT NULL,
            executed_time TIME NOT NULL,
            status reminder_status NOT NULL,
            error_message TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )`
    ];
    
    const initialData = [
        // 默认管理员用户
        "INSERT INTO users (username, password, role, email) VALUES ('admin', '$2a$10$H9da3PREyly/m7iXjCsVHu9K7V.Q5oCLuC0JQdZkJs44tllb723bG', 'admin', 'admin@example.com') ON CONFLICT (username) DO NOTHING",
        
        // 默认系统配置
        "INSERT INTO settings (setting_key, setting_value, description) VALUES ('scheduler_enabled', 'true', '调度器是否启用') ON CONFLICT (setting_key) DO NOTHING",
        "INSERT INTO settings (setting_key, setting_value, description) VALUES ('daily_load_time', '02:00', '每日计划加载时间') ON CONFLICT (setting_key) DO NOTHING",
        "INSERT INTO settings (setting_key, setting_value, description) VALUES ('max_retry_count', '3', '消息发送最大重试次数') ON CONFLICT (setting_key) DO NOTHING",
        "INSERT INTO settings (setting_key, setting_value, description) VALUES ('retry_interval', '60', '重试间隔(秒)') ON CONFLICT (setting_key) DO NOTHING",
        "INSERT INTO settings (setting_key, setting_value, description) VALUES ('temp_file_cleanup_time', '02:00', '临时文件清理时间') ON CONFLICT (setting_key) DO NOTHING",
        "INSERT INTO settings (setting_key, setting_value, description) VALUES ('custom_reminder_enabled', 'true', '是否启用自定义重复提醒功能') ON CONFLICT (setting_key) DO NOTHING",
        "INSERT INTO settings (setting_key, setting_value, description) VALUES ('recurring_generation_days', '30', '重复任务提前生成天数') ON CONFLICT (setting_key) DO NOTHING",
        "INSERT INTO settings (setting_key, setting_value, description) VALUES ('max_recurring_occurrences', '365', '单个重复规则最大生成次数') ON CONFLICT (setting_key) DO NOTHING",
        "INSERT INTO settings (setting_key, setting_value, description) VALUES ('recurring_cleanup_days', '90', '重复任务历史记录保留天数') ON CONFLICT (setting_key) DO NOTHING",
        
        // 默认重复规则模板
        "INSERT INTO recurring_templates (template_name, rule_pattern, rule_type, description) VALUES ('每日提醒', '每1日', 'daily', '每天重复执行') ON CONFLICT (template_name) DO NOTHING",
        "INSERT INTO recurring_templates (template_name, rule_pattern, rule_type, description) VALUES ('工作日提醒', '每1周周一,周二,周三,周四,周五', 'weekly', '每个工作日重复执行') ON CONFLICT (template_name) DO NOTHING",
        "INSERT INTO recurring_templates (template_name, rule_pattern, rule_type, description) VALUES ('每周提醒', '每1周{星期}', 'weekly', '每周指定日期重复执行') ON CONFLICT (template_name) DO NOTHING",
        "INSERT INTO recurring_templates (template_name, rule_pattern, rule_type, description) VALUES ('每月提醒', '每1个月{日}日', 'monthly', '每月指定日期重复执行') ON CONFLICT (template_name) DO NOTHING",
        "INSERT INTO recurring_templates (template_name, rule_pattern, rule_type, description) VALUES ('每年生日', '每年{月}月{日}日', 'yearly', '每年指定日期重复执行') ON CONFLICT (template_name) DO NOTHING",
        "INSERT INTO recurring_templates (template_name, rule_pattern, rule_type, description) VALUES ('每季度提醒', '每3个月1日', 'monthly', '每季度重复执行') ON CONFLICT (template_name) DO NOTHING",
        "INSERT INTO recurring_templates (template_name, rule_pattern, rule_type, description) VALUES ('每半年提醒', '每6个月1日', 'monthly', '每半年重复执行') ON CONFLICT (template_name) DO NOTHING"
    ];
    
    // 创建表
    for (let i = 0; i < tables.length; i++) {
        try {
            const client = await pool.connect();
            await client.query(tables[i]);
            client.release();
            console.log(`✅ 创建表成功: ${i + 1}/${tables.length}`);
        } catch (error) {
            if (error.code === '42P07') {
                console.log(`⚠️  表已存在: ${i + 1}/${tables.length}`);
            } else {
                console.error(`❌ 创建表失败: ${i + 1}/${tables.length}`, error.message);
            }
        }
    }
    
    // 插入初始数据
    for (let i = 0; i < initialData.length; i++) {
        try {
            const client = await pool.connect();
            await client.query(initialData[i]);
            client.release();
            console.log(`✅ 插入初始数据: ${i + 1}/${initialData.length}`);
        } catch (error) {
            if (error.code === '23505') {
                console.log(`⚠️  数据已存在: ${i + 1}/${initialData.length}`);
            } else {
                console.error(`❌ 插入数据失败: ${i + 1}/${initialData.length}`, error.message);
            }
        }
    }
}

/**
 * 检查缺失的关键表
 */
async function checkMissingTables() {
    const requiredTables = ['users', 'groups', 'reminders', 'settings', 'send_logs', 'files'];
    const missingTables = [];
    
    for (const tableName of requiredTables) {
        try {
            const client = await pool.connect();
            const result = await client.query(
                `SELECT 1 FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = $1`,
                [tableName]
            );
            client.release();
            const rows = result.rows;
            
            if (rows.length === 0) {
                missingTables.push(tableName);
            }
        } catch (error) {
            console.error(`❌ 检查表 ${tableName} 失败:`, error.message);
            missingTables.push(tableName);
        }
    }
    
    return missingTables;
}

/**
 * 验证关键表是否存在
 */
async function verifyTables() {
    const requiredTables = ['users', 'groups', 'reminders', 'settings', 'send_logs', 'files'];
    
    for (const tableName of requiredTables) {
        try {
            const client = await pool.connect();
            const result = await client.query(
                `SELECT 1 FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = $1`,
                [tableName]
            );
            client.release();
            const rows = result.rows;
            
            if (rows.length > 0) {
                console.log(`✅ 表 ${tableName} 已存在`);
            } else {
                console.log(`⚠️  表 ${tableName} 不存在`);
            }
        } catch (error) {
            console.error(`❌ 检查表 ${tableName} 失败:`, error.message);
        }
    }
}

/**
 * 等待数据库连接就绪
 */
async function waitForDatabase(maxRetries = 30, retryInterval = 2000) {
    console.log('🔄 等待数据库连接...');
    
    for (let i = 0; i < maxRetries; i++) {
        try {
            const client = await pool.connect();
            await client.query('SELECT 1');
            client.release();
            console.log('✅ 数据库连接成功');
            return true;
        } catch (error) {
            console.log(`⏳ 等待数据库连接... (${i + 1}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, retryInterval));
        }
    }
    
    throw new Error('数据库连接超时');
}

module.exports = {
    initDatabase,
    waitForDatabase,
    verifyTables
};