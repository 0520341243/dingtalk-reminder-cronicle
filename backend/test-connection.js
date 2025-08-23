const mongoose = require('mongoose');

const mongoUrl = process.env.MONGODB_URL || 'mongodb://admin:admin123456@mongodb:27017/dingtalk-scheduler?authSource=admin';

console.log('Testing MongoDB connection...');
console.log('URL:', mongoUrl);

mongoose.connect(mongoUrl, {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
})
.then(() => {
    console.log('✅ MongoDB connected successfully!');
    process.exit(0);
})
.catch(err => {
    console.error('❌ MongoDB connection failed:', err.message);
    process.exit(1);
});