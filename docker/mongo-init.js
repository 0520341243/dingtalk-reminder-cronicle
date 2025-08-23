/**
 * MongoDB Docker容器初始化脚本
 * 在MongoDB容器启动时自动执行
 * 创建应用数据库和用户
 */

// 切换到admin数据库进行认证
db = db.getSiblingDB('admin');

// 创建应用数据库
db = db.getSiblingDB('dingtalk-scheduler');

// 创建应用用户（如果不存在）
try {
  db.createUser({
    user: 'admin',
    pwd: 'admin123456',
    roles: [
      { role: 'readWrite', db: 'dingtalk-scheduler' },
      { role: 'dbAdmin', db: 'dingtalk-scheduler' }
    ]
  });
  print('✅ 应用用户创建成功');
} catch (error) {
  print('ℹ️  应用用户已存在或创建失败: ' + error);
}

// 创建集合和索引
print('📋 初始化数据库集合...');

// Users集合
db.createCollection('users');
db.users.createIndex({ username: 1 }, { unique: true });
db.users.createIndex({ email: 1 }, { unique: true });
print('   ✓ users集合创建完成');

// Groups集合
db.createCollection('groups');
db.groups.createIndex({ name: 1 });
db.groups.createIndex({ status: 1 });
db.groups.createIndex({ createdAt: -1 });
print('   ✓ groups集合创建完成');

// Tasks集合
db.createCollection('tasks');
db.tasks.createIndex({ status: 1 });
db.tasks.createIndex({ groupId: 1 });
db.tasks.createIndex({ nextRunAt: 1 });
db.tasks.createIndex({ createdAt: -1 });
db.tasks.createIndex({ userId: 1 });
print('   ✓ tasks集合创建完成');

// Files集合
db.createCollection('files');
db.files.createIndex({ status: 1 });
db.files.createIndex({ uploadedBy: 1 });
db.files.createIndex({ createdAt: -1 });
print('   ✓ files集合创建完成');

// Settings集合
db.createCollection('settings');
db.settings.createIndex({ key: 1 }, { unique: true });
print('   ✓ settings集合创建完成');

// TaskExecutionHistory集合
db.createCollection('taskexecutionhistories');
db.taskexecutionhistories.createIndex({ taskId: 1 });
db.taskexecutionhistories.createIndex({ executedAt: -1 });
db.taskexecutionhistories.createIndex({ status: 1 });
print('   ✓ taskexecutionhistories集合创建完成');

// TaskAssociations集合
db.createCollection('taskassociations');
db.taskassociations.createIndex({ primaryTaskId: 1 });
db.taskassociations.createIndex({ associatedTaskId: 1 });
db.taskassociations.createIndex({ associationType: 1 });
print('   ✓ taskassociations集合创建完成');

// Notifications集合
db.createCollection('notifications');
db.notifications.createIndex({ userId: 1 });
db.notifications.createIndex({ read: 1 });
db.notifications.createIndex({ createdAt: -1 });
print('   ✓ notifications集合创建完成');

// AuditLogs集合
db.createCollection('auditlogs');
db.auditlogs.createIndex({ userId: 1 });
db.auditlogs.createIndex({ action: 1 });
db.auditlogs.createIndex({ createdAt: -1 });
print('   ✓ auditlogs集合创建完成');

print('🎉 MongoDB数据库初始化完成！');
print('📊 数据库名称: dingtalk-scheduler');
print('👤 应用用户: admin');
print('🔐 用户权限: readWrite, dbAdmin');