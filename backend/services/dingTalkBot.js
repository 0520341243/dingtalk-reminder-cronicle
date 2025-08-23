const axios = require('axios');
const crypto = require('crypto');
const logger = require('../utils/logger');
const { Group, SendLog } = require('../models/mongodb');

class DingTalkBot {
    constructor() {
        this.maxRetries = parseInt(process.env.MAX_RETRY_COUNT) || 3;
        this.retryInterval = parseInt(process.env.RETRY_INTERVAL) || 60; // 秒
    }

    /**
     * 发送文本消息到钉钉群
     * @param {string} webhookUrl - 钉钉机器人Webhook URL
     * @param {string} message - 消息内容
     * @param {Object} options - 发送选项
     * @returns {Object} 发送结果
     */
    async sendMessage(webhookUrl, message, options = {}) {
        const { groupId, reminderId, retryCount = 0, secret } = options;
        const startTime = Date.now();
        
        try {
            logger.info(`📤 开始发送钉钉消息 - 群组ID: ${groupId}, 提醒ID: ${reminderId}, 重试次数: ${retryCount}`);
            logger.info(`🔗 Webhook URL: ${webhookUrl ? webhookUrl.substring(0, 80) + '...' : 'null'}`);
            logger.info(`💬 消息内容长度: ${message ? message.length : 0} 字符`);
            logger.info(`💬 消息预览: ${message ? message.substring(0, 200) + (message.length > 200 ? '...' : '') : 'null'}`);
            
            if (!webhookUrl) {
                throw new Error('Webhook URL 不能为空');
            }
            
            if (!message || message.trim().length === 0) {
                throw new Error('消息内容不能为空');
            }
            
            const payload = {
                msgtype: 'text',
                text: {
                    content: message
                }
            };

            // 加签处理：从选项中获取secret或从URL提取
            const urlObj = new URL(webhookUrl);
            const urlSecret = urlObj.searchParams.get('secret');
            const finalSecret = secret || urlSecret;
            
            if (finalSecret) {
                logger.info(`🔐 检测到加签密钥，启用消息签名`);
                logger.info(`🔑 使用的密钥: ${finalSecret}`);
                const { timestamp, sign } = this.generateSign(finalSecret);
                
                logger.info(`⏰ 时间戳: ${timestamp}`);
                logger.info(`✍️ 生成的签名: ${sign}`);
                
                // 重新构建带签名的URL - 注意URLSearchParams.set会自动编码，所以不需要手动encodeURIComponent
                urlObj.searchParams.set('timestamp', timestamp);
                urlObj.searchParams.set('sign', sign);
                webhookUrl = urlObj.toString();
                
                logger.info(`🔗 完整签名后的URL: ${webhookUrl}`);
            }

            logger.info(`🚀 发送HTTP请求到钉钉API...`);
            const response = await axios.post(webhookUrl, payload, {
                timeout: 10000,
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            logger.info(`📡 收到钉钉API响应 - 状态码: ${response.status}, 响应时间: ${Date.now() - startTime}ms`);
            logger.info(`📡 响应数据: ${JSON.stringify(response.data)}`);

            const result = {
                success: response.data.errcode === 0,
                code: response.data.errcode,
                message: response.data.errmsg,
                timestamp: new Date()
            };

            // 记录发送日志
            await this.logSendResult(groupId, reminderId, message, result, retryCount);

            if (result.success) {
                logger.info(`钉钉消息发送成功 - 群组ID: ${groupId}`);
                // 更新群组最后发送时间和成功计数
                if (groupId) {
                    await this.updateGroupSendStats(groupId, true);
                }
            } else {
                logger.error(`钉钉消息发送失败 - 群组ID: ${groupId}, 错误: ${result.message}`);
                
                // 如果需要重试且未达到最大重试次数
                if (retryCount < this.maxRetries && this.shouldRetry(result.code)) {
                    await this.scheduleRetry(webhookUrl, message, {
                        ...options,
                        retryCount: retryCount + 1
                    });
                } else {
                    // 更新群组失败计数
                    if (groupId) {
                        await this.updateGroupSendStats(groupId, false);
                    }
                }
            }

            return result;

        } catch (error) {
            logger.error(`钉钉消息发送异常 - 群组ID: ${groupId}:`, error.message);
            
            const result = {
                success: false,
                code: -1,
                message: error.message,
                timestamp: new Date()
            };

            // 记录发送日志
            await this.logSendResult(groupId, reminderId, message, result, retryCount);

            // 重试逻辑
            if (retryCount < this.maxRetries) {
                await this.scheduleRetry(webhookUrl, message, {
                    ...options,
                    retryCount: retryCount + 1
                });
            } else {
                // 更新群组失败计数
                if (groupId) {
                    await this.updateGroupSendStats(groupId, false);
                }
            }

            return result;
        }
    }

    /**
     * 批量发送消息到多个群组
     * @param {Array} groups - 群组列表
     * @param {string} message - 消息内容
     * @returns {Array} 发送结果列表
     */
    async sendToMultipleGroups(groups, message) {
        const results = [];
        
        for (const group of groups) {
            try {
                const result = await this.sendMessage(group.webhook_url, message, {
                    groupId: group.id,
                    secret: group.secret
                });
                results.push({
                    groupId: group.id,
                    groupName: group.name,
                    ...result
                });
            } catch (error) {
                results.push({
                    groupId: group.id,
                    groupName: group.name,
                    success: false,
                    message: error.message
                });
            }
        }
        
        return results;
    }

    /**
     * 测试钉钉机器人连接
     * @param {string} webhookUrl - Webhook URL
     * @param {string} secret - 加签密钥（可选）
     * @returns {Object} 测试结果
     */
    async testConnection(webhookUrl, secret = null) {
        const testMessage = `🤖 钉钉提醒系统连接测试\n时间: ${new Date().toLocaleString()}`;
        
        try {
            const result = await this.sendMessage(webhookUrl, testMessage, {
                retryCount: 0,  // 测试消息不重试
                secret: secret
            });
            
            return {
                success: result.success,
                message: result.success ? '连接测试成功' : `连接测试失败: ${result.message}`,
                responseTime: new Date() - result.timestamp
            };
        } catch (error) {
            return {
                success: false,
                message: `连接测试异常: ${error.message}`,
                responseTime: 0
            };
        }
    }

    /**
     * 生成钉钉加签
     * @param {string} secret - 加签密钥
     * @returns {Object} 包含timestamp和sign的对象
     */
    generateSign(secret) {
        try {
            const timestamp = Date.now().toString();
            const stringToSign = `${timestamp}\n${secret}`;
            const sign = crypto
                .createHmac('sha256', secret)
                .update(stringToSign)
                .digest('base64');

            logger.info(`🔐 生成签名成功 - 时间戳: ${timestamp}`);
            return { timestamp, sign };
        } catch (error) {
            logger.error('生成签名失败:', error.message);
            throw new Error('签名生成失败: ' + error.message);
        }
    }

    /**
     * 判断是否应该重试
     * @param {number} errorCode - 错误代码
     * @returns {boolean} 是否重试
     */
    shouldRetry(errorCode) {
        // 钉钉错误代码处理
        const retryableCodes = [
            -1,     // 网络错误
            310000, // 系统繁忙
            300001, // 服务器错误
        ];
        
        return retryableCodes.includes(errorCode);
    }

    /**
     * 安排重试发送
     * @param {string} webhookUrl - Webhook URL
     * @param {string} message - 消息内容
     * @param {Object} options - 选项
     */
    async scheduleRetry(webhookUrl, message, options) {
        const delay = Math.min(this.retryInterval * Math.pow(2, options.retryCount) * 1000, 300000); // 指数退避，最大5分钟
        const maxRetryTime = 1800000; // 最大重试时间30分钟
        
        logger.info(`安排 ${delay/1000} 秒后重试发送消息 (重试次数: ${options.retryCount})`);
        
        // 检查是否超过最大重试时间
        const retryStartTime = options.retryStartTime || Date.now();
        if (Date.now() - retryStartTime > maxRetryTime) {
            logger.warn(`重试超时，放弃重试发送消息 - 总重试时间: ${(Date.now() - retryStartTime)/1000}秒`);
            return;
        }
        
        // 使用Promise.delay替代setTimeout，避免内存泄漏
        try {
            await this.delay(delay);
            // 传递重试开始时间
            const retryOptions = {
                ...options,
                retryStartTime: retryStartTime
            };
            await this.sendMessage(webhookUrl, message, retryOptions);
        } catch (error) {
            logger.error('重试发送过程中出错:', error.message);
        }
    }

    /**
     * Promise版本的延迟函数
     * @param {number} ms - 延迟毫秒数
     * @returns {Promise}
     */
    delay(ms) {
        return new Promise(resolve => {
            const timeoutId = setTimeout(() => {
                resolve();
            }, ms);
            
            // 确保在异常情况下也能清理定时器
            process.once('SIGTERM', () => clearTimeout(timeoutId));
            process.once('SIGINT', () => clearTimeout(timeoutId));
        });
    }

    /**
     * 记录发送日志
     * @param {string} groupId - 群组ID
     * @param {string} reminderId - 提醒ID
     * @param {string} message - 消息内容
     * @param {Object} result - 发送结果
     * @param {number} retryCount - 重试次数
     */
    async logSendResult(groupId, reminderId, message, result, retryCount) {
        try {
            // MongoDB不需要严格的外键验证，直接记录
            if (!SendLog) {
                // 如果SendLog模型不存在，只记录日志
                logger.info('发送日志记录:', {
                    groupId,
                    reminderId,
                    success: result.success,
                    code: result.code,
                    message: result.message,
                    retryCount
                });
                return;
            }

            // 创建发送日志记录
            const sendLog = new SendLog({
                groupId: groupId || null,
                reminderId: reminderId || null,
                messageContent: message ? message.substring(0, 1000) : '',
                responseCode: result.code || 0,
                responseMessage: result.message ? result.message.substring(0, 500) : '',
                isSuccess: result.success === true,
                retryCount: retryCount || 0,
                sentAt: new Date()
            });

            await sendLog.save();
            logger.info('已记录发送日志到MongoDB');

        } catch (error) {
            logger.error('记录发送日志失败:', {
                error: error.message,
                groupId: groupId,
                reminderId: reminderId
            });
        }
    }

    /**
     * 更新群组发送统计
     * @param {string} groupId - 群组ID
     * @param {boolean} success - 是否成功
     */
    async updateGroupSendStats(groupId, success) {
        try {
            if (!groupId) return;
            
            const updateData = {
                lastSendTime: new Date()
            };
            
            if (success) {
                updateData.$inc = { sendCount: 1 };
            } else {
                updateData.$inc = { failCount: 1 };
            }
            
            await Group.findByIdAndUpdate(groupId, updateData);
            logger.info(`更新群组统计成功: ${groupId}`);
        } catch (error) {
            logger.error('更新群组统计失败:', error.message);
        }
    }

    /**
     * 获取群组健康度评分
     * @param {string} groupId - 群组ID
     * @returns {Object} 健康度信息
     */
    async getGroupHealth(groupId) {
        try {
            const group = await Group.findById(groupId);
            
            if (!group) {
                return { health: 0, status: 'unknown' };
            }

            const sendCount = group.sendCount || 0;
            const failCount = group.failCount || 0;
            const totalCount = sendCount + failCount;
            const successRate = totalCount === 0 ? 0 : (sendCount / totalCount) * 100;
            
            let health = 100;
            let status = 'healthy';

            if (successRate < 50) {
                health = 20;
                status = 'critical';
            } else if (successRate < 80) {
                health = 60;
                status = 'warning';
            }

            // 考虑最近活跃度
            if (group.lastSendTime) {
                const daysSinceLastSend = (Date.now() - new Date(group.lastSendTime)) / (1000 * 60 * 60 * 24);
                if (daysSinceLastSend > 7) {
                    health *= 0.8; // 降低20%
                }
            }

            return {
                health: Math.round(health),
                status,
                successRate: Math.round(successRate),
                totalSends: sendCount,
                failures: failCount,
                lastSendTime: group.lastSendTime
            };
        } catch (error) {
            logger.error('获取群组健康度失败:', error.message);
            return { health: 0, status: 'error' };
        }
    }
}

module.exports = new DingTalkBot();