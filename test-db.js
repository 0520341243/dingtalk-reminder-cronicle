const mongoose = require('mongoose');

// MongoDB URL - 使用端口27018
const mongoUrl = 'mongodb://admin:admin123456@localhost:27018/dingtalk-scheduler?authSource=admin';

async function checkTasks() {
  try {
    await mongoose.connect(mongoUrl);
    console.log('Connected to MongoDB');
    
    const db = mongoose.connection.db;
    const tasks = await db.collection('tasks').find({}).toArray();
    
    console.log('\n=== All Tasks ===');
    tasks.forEach(task => {
      console.log(`Task: ${task.name}`);
      console.log(`  lastExecutedAt: ${task.lastExecutedAt}`);
      console.log(`  lastExecutionStatus: ${task.lastExecutionStatus}`);
      console.log(`  executionCount: ${task.executionCount}`);
      console.log('---');
    });
    
    const tasksWithExecution = await db.collection('tasks').find({ 
      lastExecutedAt: { $exists: true, $ne: null } 
    }).toArray();
    
    console.log(`\n=== Tasks with lastExecutedAt (${tasksWithExecution.length}) ===`);
    tasksWithExecution.forEach(task => {
      console.log(`${task.name}: ${task.lastExecutedAt}`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

checkTasks();
