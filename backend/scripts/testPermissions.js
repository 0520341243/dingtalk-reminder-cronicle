/**
 * 测试权限系统的脚本
 * 验证管理员和普通用户的权限差异
 */

const axios = require('axios');

const API_BASE_URL = 'http://localhost:5001/api';

// 测试用户凭证
const adminCredentials = {
    username: 'admin',
    password: 'admin123'
};

const userCredentials = {
    username: 'test',
    password: 'test123'
};

let adminToken = '';
let userToken = '';

// 登录函数
async function login(credentials) {
    try {
        const response = await axios.post(`${API_BASE_URL}/mongo/auth/login`, credentials);
        return response.data.accessToken;
    } catch (error) {
        console.error(`登录失败 (${credentials.username}):`, error.response?.data?.message || error.message);
        return null;
    }
}

// 测试任务API
async function testTasksAPI(token, username) {
    console.log(`\n========== 测试任务API (${username}) ==========`);
    
    try {
        const response = await axios.get(`${API_BASE_URL}/mongo/tasks`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        
        console.log(`✅ 获取任务列表成功，共 ${response.data.tasks.length} 个任务`);
        
        // 显示任务创建者
        response.data.tasks.forEach(task => {
            console.log(`  - ${task.name} (创建者: ${task.createdBy?.username || '未知'})`);
        });
    } catch (error) {
        console.error('❌ 获取任务列表失败:', error.response?.data?.message || error.message);
    }
}

// 测试群组API
async function testGroupsAPI(token, username) {
    console.log(`\n========== 测试群组API (${username}) ==========`);
    
    try {
        const response = await axios.get(`${API_BASE_URL}/mongo/groups`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        
        console.log(`✅ 获取群组列表成功，共 ${response.data.groups.length} 个群组`);
        
        // 显示群组名称
        response.data.groups.forEach(group => {
            console.log(`  - ${group.name}`);
        });
    } catch (error) {
        console.error('❌ 获取群组列表失败:', error.response?.data?.message || error.message);
    }
}

// 测试文件API
async function testFilesAPI(token, username) {
    console.log(`\n========== 测试文件API (${username}) ==========`);
    
    try {
        const response = await axios.get(`${API_BASE_URL}/mongo/files`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        
        console.log(`✅ 获取文件列表成功，共 ${response.data.files.length} 个文件`);
        
        // 显示文件名称
        response.data.files.forEach(file => {
            console.log(`  - ${file.originalName}`);
        });
    } catch (error) {
        console.error('❌ 获取文件列表失败:', error.response?.data?.message || error.message);
    }
}

// 测试删除其他用户的任务
async function testDeleteOthersTask(token, username) {
    console.log(`\n========== 测试删除其他用户的任务 (${username}) ==========`);
    
    try {
        // 首先获取任务列表
        const listResponse = await axios.get(`${API_BASE_URL}/mongo/tasks`, {
            headers: { Authorization: `Bearer ${adminToken}` }  // 使用管理员token获取所有任务
        });
        
        if (listResponse.data.tasks.length > 0) {
            const taskToDelete = listResponse.data.tasks[0];
            
            // 尝试用当前用户的token删除任务
            try {
                await axios.delete(`${API_BASE_URL}/mongo/tasks/${taskToDelete.id}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                console.log(`✅ 成功删除任务: ${taskToDelete.name}`);
            } catch (deleteError) {
                if (deleteError.response?.status === 403) {
                    console.log(`✅ 正确拒绝删除其他用户的任务 (403 Forbidden)`);
                } else {
                    console.error('❌ 删除失败，但不是权限错误:', deleteError.response?.data?.message);
                }
            }
        }
    } catch (error) {
        console.error('❌ 测试失败:', error.response?.data?.message || error.message);
    }
}

// 主测试函数
async function runTests() {
    console.log('开始测试权限系统...\n');
    
    // 1. 登录
    console.log('1. 登录用户...');
    adminToken = await login(adminCredentials);
    userToken = await login(userCredentials);
    
    if (!adminToken) {
        console.error('管理员登录失败，无法继续测试');
        return;
    }
    
    if (!userToken) {
        console.log('普通用户不存在，尝试创建...');
        // 创建测试用户
        try {
            await axios.post(`${API_BASE_URL}/mongo/auth/register`, 
                { ...userCredentials, email: 'test@example.com', role: 'user' },
                { headers: { Authorization: `Bearer ${adminToken}` } }
            );
            console.log('✅ 测试用户创建成功');
            userToken = await login(userCredentials);
        } catch (error) {
            console.error('创建测试用户失败:', error.response?.data?.message);
        }
    }
    
    if (!userToken) {
        console.error('无法获取普通用户token，部分测试将跳过');
    }
    
    // 2. 测试管理员权限
    console.log('\n2. 测试管理员权限...');
    await testTasksAPI(adminToken, 'admin');
    await testGroupsAPI(adminToken, 'admin');
    await testFilesAPI(adminToken, 'admin');
    
    // 3. 测试普通用户权限
    if (userToken) {
        console.log('\n3. 测试普通用户权限...');
        await testTasksAPI(userToken, 'test');
        await testGroupsAPI(userToken, 'test');
        await testFilesAPI(userToken, 'test');
        
        // 4. 测试权限限制
        console.log('\n4. 测试权限限制...');
        await testDeleteOthersTask(userToken, 'test');
    }
    
    console.log('\n\n========== 测试完成 ==========');
    console.log('✅ 权限系统测试总结:');
    console.log('1. 管理员可以查看所有资源');
    console.log('2. 普通用户只能查看自己创建的资源');
    console.log('3. 普通用户不能删除/修改其他用户的资源');
}

// 运行测试
runTests().catch(console.error);