/**
 * NotificationConfig Domain Model - DDD Value Object
 * Represents DingTalk webhook configuration and message formatting
 * Handles webhook security, message templates, and notification settings
 */

const crypto = require('crypto');
const logger = require('../utils/logger');

class NotificationConfig {
    constructor(data = {}) {
        this.id = data.id || null;
        this.taskId = data.task_id || null;
        
        // DingTalk webhook configuration
        this.webhookUrl = data.webhook_url || '';
        this.webhookSecret = data.webhook_secret || null;
        
        // Message formatting
        this.messageFormat = data.message_format || 'text'; // text | markdown
        this.messageTemplate = data.message_template || '';
        
        // Notification settings
        this.atPersons = Array.isArray(data.at_persons) ? data.at_persons : [];
        this.atAll = Boolean(data.at_all);
        
        // Metadata
        this.createdAt = data.created_at ? new Date(data.created_at) : new Date();
        this.updatedAt = data.updated_at ? new Date(data.updated_at) : new Date();
    }

    /**
     * Validation methods
     */
    validate() {
        const errors = [];
        
        // Webhook URL validation
        if (!this.webhookUrl || this.webhookUrl.trim().length === 0) {
            errors.push('Webhook URL is required');
        } else if (!this.isValidWebhookUrl(this.webhookUrl)) {
            errors.push('Invalid DingTalk webhook URL format');
        }
        
        // Message format validation
        const validFormats = ['text', 'markdown'];
        if (!validFormats.includes(this.messageFormat)) {
            errors.push(`Message format must be one of: ${validFormats.join(', ')}`);
        }
        
        // At persons validation (should be phone numbers or DingTalk IDs)
        if (this.atPersons && this.atPersons.length > 0) {
            const invalidPersons = this.atPersons.filter(person => 
                typeof person !== 'string' || person.trim().length === 0
            );
            
            if (invalidPersons.length > 0) {
                errors.push('At persons must be non-empty strings');
            }
        }
        
        // Message template validation
        if (this.messageTemplate && this.messageTemplate.length > 5000) {
            errors.push('Message template must be less than 5000 characters');
        }
        
        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * Validate DingTalk webhook URL format
     */
    isValidWebhookUrl(url) {
        try {
            const urlObj = new URL(url);
            return urlObj.hostname === 'oapi.dingtalk.com' && 
                   urlObj.pathname.includes('/robot/send');
        } catch (error) {
            return false;
        }
    }

    /**
     * Generate DingTalk signature for webhook security
     */
    generateSignature(timestamp) {
        if (!this.webhookSecret) {
            return null;
        }
        
        const stringToSign = `${timestamp}\n${this.webhookSecret}`;
        const signature = crypto
            .createHmac('sha256', this.webhookSecret)
            .update(stringToSign, 'utf8')
            .digest('base64');
            
        return encodeURIComponent(signature);
    }

    /**
     * Build webhook URL with signature
     */
    buildWebhookUrl() {
        if (!this.webhookSecret) {
            return this.webhookUrl;
        }
        
        const timestamp = Date.now();
        const signature = this.generateSignature(timestamp);
        
        const url = new URL(this.webhookUrl);
        url.searchParams.append('timestamp', timestamp);
        url.searchParams.append('sign', signature);
        
        return url.toString();
    }

    /**
     * Format message content according to configuration
     */
    formatMessage(content, variables = {}) {
        let formattedContent = content;
        
        // Apply message template if configured
        if (this.messageTemplate) {
            formattedContent = this.renderTemplate(this.messageTemplate, {
                ...variables,
                content: content
            });
        }
        
        // Build DingTalk message payload
        const payload = {
            msgtype: this.messageFormat
        };
        
        if (this.messageFormat === 'text') {
            payload.text = {
                content: formattedContent
            };
        } else if (this.messageFormat === 'markdown') {
            payload.markdown = {
                title: variables.title || 'Reminder',
                text: formattedContent
            };
        }
        
        // Add @ mentions if configured
        if (this.atPersons.length > 0 || this.atAll) {
            payload.at = {
                atMobiles: this.atPersons,
                isAtAll: this.atAll
            };
        }
        
        return payload;
    }

    /**
     * Render message template with variables
     */
    renderTemplate(template, variables) {
        let rendered = template;
        
        // Replace variables using {{variable}} syntax
        Object.entries(variables).forEach(([key, value]) => {
            const placeholder = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
            rendered = rendered.replace(placeholder, String(value));
        });
        
        // Add timestamp if not provided
        if (!variables.timestamp) {
            const timestamp = new Date().toLocaleString('zh-CN', {
                timeZone: 'Asia/Shanghai'
            });
            rendered = rendered.replace(/\{\{\s*timestamp\s*\}\}/g, timestamp);
        }
        
        return rendered;
    }

    /**
     * Test webhook connectivity
     */
    async testWebhook() {
        try {
            const testMessage = this.formatMessage('测试消息：DingTalk提醒系统连接正常', {
                timestamp: new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })
            });
            
            const webhookUrl = this.buildWebhookUrl();
            
            const response = await fetch(webhookUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(testMessage)
            });
            
            const result = await response.json();
            
            if (result.errcode === 0) {
                logger.info('Webhook test successful', { taskId: this.taskId });
                return {
                    success: true,
                    message: 'Test message sent successfully'
                };
            } else {
                logger.warn('Webhook test failed', { 
                    taskId: this.taskId, 
                    errcode: result.errcode, 
                    errmsg: result.errmsg 
                });
                return {
                    success: false,
                    message: result.errmsg || 'Unknown error'
                };
            }
            
        } catch (error) {
            logger.error('Webhook test error', { 
                taskId: this.taskId, 
                error: error.message 
            });
            return {
                success: false,
                message: error.message
            };
        }
    }

    /**
     * Send notification message
     */
    async sendNotification(content, variables = {}) {
        try {
            const message = this.formatMessage(content, variables);
            const webhookUrl = this.buildWebhookUrl();
            
            logger.debug('Sending notification', {
                taskId: this.taskId,
                messageType: this.messageFormat,
                hasAtPersons: this.atPersons.length > 0,
                atAll: this.atAll
            });
            
            const response = await fetch(webhookUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(message)
            });
            
            const result = await response.json();
            
            if (result.errcode === 0) {
                logger.info('Notification sent successfully', { taskId: this.taskId });
                return {
                    success: true,
                    messageId: result.message_id || null
                };
            } else {
                logger.error('Notification send failed', {
                    taskId: this.taskId,
                    errcode: result.errcode,
                    errmsg: result.errmsg
                });
                return {
                    success: false,
                    error: result.errmsg || 'Unknown error',
                    errcode: result.errcode
                };
            }
            
        } catch (error) {
            logger.error('Notification send error', {
                taskId: this.taskId,
                error: error.message
            });
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get available template variables
     */
    getAvailableVariables() {
        return [
            { name: 'content', description: 'Message content' },
            { name: 'timestamp', description: 'Current timestamp' },
            { name: 'task_name', description: 'Task name' },
            { name: 'task_description', description: 'Task description' },
            { name: 'task_priority', description: 'Task priority' },
            { name: 'execution_time', description: 'Scheduled execution time' },
            { name: 'group_name', description: 'Group name' }
        ];
    }

    /**
     * Validate template syntax
     */
    validateTemplate(template) {
        const errors = [];
        
        if (!template) {
            return { isValid: true, errors: [] };
        }
        
        // Check for unmatched braces
        const openBraces = (template.match(/\{\{/g) || []).length;
        const closeBraces = (template.match(/\}\}/g) || []).length;
        
        if (openBraces !== closeBraces) {
            errors.push('Unmatched template braces {{ }}');
        }
        
        // Extract variable names and check for valid syntax
        const variableMatches = template.match(/\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g);
        if (variableMatches) {
            variableMatches.forEach(match => {
                const variableName = match.replace(/\{\{\s*|\s*\}\}/g, '');
                if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(variableName)) {
                    errors.push(`Invalid variable name: ${variableName}`);
                }
            });
        }
        
        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * Clone notification config
     */
    clone() {
        return NotificationConfig.fromPlainObject(this.toPlainObject());
    }

    /**
     * Update configuration
     */
    update(updateData) {
        const allowedFields = [
            'webhook_url', 'webhook_secret', 'message_format', 
            'message_template', 'at_persons', 'at_all'
        ];
        
        allowedFields.forEach(field => {
            if (updateData.hasOwnProperty(field) && updateData[field] !== undefined) {
                const propName = field.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
                
                if (field === 'at_persons') {
                    this.atPersons = Array.isArray(updateData[field]) ? updateData[field] : [];
                } else if (field === 'at_all') {
                    this.atAll = Boolean(updateData[field]);
                } else {
                    this[propName] = updateData[field];
                }
            }
        });
        
        this.updatedAt = new Date();
        
        // Validate after update
        const validation = this.validate();
        if (!validation.isValid) {
            throw new Error(`Invalid notification config: ${validation.errors.join(', ')}`);
        }
        
        logger.debug('Notification config updated', {
            taskId: this.taskId,
            updatedFields: Object.keys(updateData).filter(key => allowedFields.includes(key))
        });
    }

    /**
     * Convert to plain object for storage
     */
    toPlainObject() {
        return {
            id: this.id,
            task_id: this.taskId,
            webhook_url: this.webhookUrl,
            webhook_secret: this.webhookSecret,
            message_format: this.messageFormat,
            message_template: this.messageTemplate,
            at_persons: this.atPersons,
            at_all: this.atAll,
            created_at: this.createdAt,
            updated_at: this.updatedAt
        };
    }

    /**
     * Create from plain object
     */
    static fromPlainObject(data) {
        return new NotificationConfig(data);
    }

    /**
     * Mask sensitive information for logging
     */
    toLogSafeObject() {
        return {
            id: this.id,
            task_id: this.taskId,
            webhook_url: this.webhookUrl ? '***configured***' : null,
            webhook_secret: this.webhookSecret ? '***configured***' : null,
            message_format: this.messageFormat,
            has_template: Boolean(this.messageTemplate),
            at_persons_count: this.atPersons.length,
            at_all: this.atAll
        };
    }
}

module.exports = NotificationConfig;