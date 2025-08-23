#!/usr/bin/env node

/**
 * 手动生成执行计划脚本
 * 用于修复没有执行计划的任务
 */

const { query } = require('../config/database');
const { formatDate, formatDateTime, beijingTime } = require('../utils/timeUtils');
const logger = require('../utils/logger');

async function generateExecutionPlans() {
    try {
        console.log('🚀 开始生成执行计划...');
        
        // 获取所有活跃任务
        const tasks = await query(`
            SELECT 
                t.*,
                sr.id as rule_id,
                sr.rule_type,
                sr.execution_times,
                sr.day_mode,
                sr.months,
                sr.interval_config
            FROM tasks t
            LEFT JOIN schedule_rules sr ON sr.task_id = t.id
            WHERE t.status = 'active'
        `);
        
        console.log(`找到 ${tasks.length} 个活跃任务`);
        
        const today = new Date();
        let totalPlans = 0;
        
        for (const task of tasks) {
            if (!task.rule_id) {
                console.log(`任务 ${task.name} (ID:${task.id}) 没有调度规则，跳过`);
                continue;
            }
            
            // 为接下来的7天生成执行计划
            for (let i = 0; i < 7; i++) {
                const targetDate = new Date(today);
                targetDate.setDate(today.getDate() + i);
                const dateStr = formatDate(targetDate);
                
                // 检查是否应该在这一天执行
                const shouldExecute = checkScheduleRule(task, targetDate);
                
                if (shouldExecute) {
                    // 为每个执行时间创建计划
                    const executionTimes = task.execution_times || ['09:00:00'];
                    
                    for (const time of executionTimes) {
                        // 检查是否已存在
                        const existing = await query(`
                            SELECT id FROM execution_plans 
                            WHERE task_id = ? AND scheduled_date = ? AND scheduled_time = ?
                        `, [task.id, dateStr, time]);
                        
                        if (existing.length === 0) {
                            await query(`
                                INSERT INTO execution_plans (
                                    task_id, schedule_rule_id, scheduled_date, scheduled_time,
                                    message_content, message_format, status
                                ) VALUES (?, ?, ?, ?, ?, ?, ?)
                            `, [
                                task.id,
                                task.rule_id,
                                dateStr,
                                time,
                                task.message_content || `任务提醒: ${task.name}`,
                                'text',
                                'pending'
                            ]);
                            
                            totalPlans++;
                            console.log(`  ✅ 为任务 ${task.name} 创建执行计划: ${dateStr} ${time}`);
                        }
                    }
                }
            }
        }
        
        console.log(`\n✅ 完成！共生成 ${totalPlans} 个执行计划`);
        
    } catch (error) {
        console.error('❌ 生成执行计划失败:', error);
    }
}

function checkScheduleRule(task, date) {
    const dayOfWeek = date.getDay();
    const dayOfMonth = date.getDate();
    const month = date.getMonth() + 1;
    
    switch (task.rule_type) {
        case 'daily':
        case 'monthly':
            return true;
            
        case 'weekly':
            if (task.day_mode) {
                const dayMode = typeof task.day_mode === 'string' ? 
                    JSON.parse(task.day_mode) : task.day_mode;
                if (dayMode.weekdays) {
                    return dayMode.weekdays.includes(dayOfWeek);
                }
            }
            return true;
            
        case 'by_day':
            if (task.months && task.months.length > 0) {
                if (!task.months.includes(month)) {
                    return false;
                }
            }
            return true;
            
        case 'by_week':
            if (task.day_mode) {
                const dayMode = typeof task.day_mode === 'string' ? 
                    JSON.parse(task.day_mode) : task.day_mode;
                if (dayMode.weekdays) {
                    return dayMode.weekdays.includes(dayOfWeek);
                }
            }
            return false;
            
        default:
            return true;
    }
}

// 执行脚本
generateExecutionPlans().then(() => {
    process.exit(0);
}).catch(error => {
    console.error(error);
    process.exit(1);
});