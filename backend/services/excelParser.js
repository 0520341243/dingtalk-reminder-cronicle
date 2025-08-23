const XLSX = require('xlsx');
const logger = require('../utils/logger');
const { formatTime } = require('../utils/timeUtils');

class ExcelParser {
    constructor() {
        this.supportedFormats = ['.xlsx', '.xls'];
    }

    /**
     * 解析Excel文件
     * @param {string} filePath - Excel文件路径
     * @param {Object} options - 解析选项
     * @returns {Object} 解析结果
     */
    async parseFile(filePath, options = {}) {
        try {
            logger.info(`开始解析Excel文件: ${filePath}`);
            
            // 读取Excel文件，设置编码支持中文
            const workbook = XLSX.readFile(filePath, {
                cellText: false,
                cellDates: true,
                type: 'buffer',
                codepage: 65001 // UTF-8 支持中文
            });
            const result = {
                fileName: filePath.split('/').pop(),
                worksheets: {},
                totalReminders: 0,
                errors: []
            };

            // 解析每个工作表
            for (const sheetName of workbook.SheetNames) {
                try {
                    const worksheet = workbook.Sheets[sheetName];
                    const reminders = this.parseWorksheet(worksheet, sheetName);
                    
                    if (reminders.length > 0) {
                        result.worksheets[sheetName] = reminders;
                        result.totalReminders += reminders.length;
                        logger.info(`工作表 ${sheetName} 解析完成，提醒数量: ${reminders.length}`);
                    }
                } catch (error) {
                    const errorMsg = `工作表 ${sheetName} 解析失败: ${error.message}`;
                    result.errors.push(errorMsg);
                    logger.error(errorMsg);
                }
            }

            logger.info(`Excel文件解析完成，总提醒数量: ${result.totalReminders}`);
            return result;
            
        } catch (error) {
            logger.error(`Excel文件解析失败: ${error.message}`);
            throw new Error(`Excel文件解析失败: ${error.message}`);
        }
    }

    /**
     * 解析单个工作表
     * @param {Object} worksheet - 工作表对象
     * @param {string} sheetName - 工作表名称
     * @returns {Array} 提醒列表
     */
    parseWorksheet(worksheet, sheetName) {
        logger.info(`📋 开始解析工作表: ${sheetName}`);
        
        const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        const reminders = [];
        
        logger.info(`📊 工作表 ${sheetName} 总行数: ${data.length}`);
        
        if (data.length < 2) {
            throw new Error('工作表数据不足，至少需要标题行和一行数据');
        }

        // 查找时间和消息内容列的索引
        const headerRow = data[0];
        logger.info(`📝 标题行内容: ${JSON.stringify(headerRow)}`);
        
        const timeIndex = this.findColumnIndex(headerRow, ['时间', 'time', '时间点', '提醒时间', '执行时间', '发送时间']);
        const messageIndex = this.findColumnIndex(headerRow, ['消息内容', 'message', '内容', '消息', '提醒内容', '文本', 'content', 'text']);

        logger.info(`🔍 列索引匹配结果: 时间列=${timeIndex}, 消息列=${messageIndex}`);

        if (timeIndex === -1 || messageIndex === -1) {
            throw new Error('未找到必需的列：时间 和 消息内容');
        }

        let validRows = 0;
        let invalidRows = 0;
        let timeParseErrors = 0;

        // 解析数据行
        for (let i = 1; i < data.length; i++) {
            const row = data[i];
            
            if (!row || row.length === 0) {
                logger.debug(`跳过空行: 第 ${i + 1} 行`);
                continue;
            }
            
            try {
                const timeStr = row[timeIndex];
                const messageContent = row[messageIndex];
                
                if (!timeStr || !messageContent) {
                    logger.debug(`跳过缺少数据的行: 第 ${i + 1} 行 - 时间:${timeStr}, 消息:${messageContent}`);
                    invalidRows++;
                    continue;
                }
                
                const parsedTime = this.parseTime(timeStr);
                if (parsedTime) {
                    const cleanMessage = String(messageContent).trim();
                    reminders.push({
                        time: parsedTime,
                        message: cleanMessage,
                        content: cleanMessage, // 兼容旧版前端
                        worksheet: sheetName,
                        row: i + 1
                    });
                    validRows++;
                    logger.debug(`✅ 第 ${i + 1} 行解析成功: 时间=${parsedTime}, 消息长度=${cleanMessage.length}`);
                } else {
                    timeParseErrors++;
                    logger.debug(`❌ 第 ${i + 1} 行时间解析失败: ${timeStr}`);
                }
            } catch (error) {
                invalidRows++;
                logger.warn(`工作表 ${sheetName} 第 ${i + 1} 行解析失败: ${error.message}`);
            }
        }
        
        logger.info(`📈 工作表 ${sheetName} 解析统计: 有效行=${validRows}, 无效行=${invalidRows}, 时间解析错误=${timeParseErrors}`);

        return reminders.sort((a, b) => a.time.localeCompare(b.time));
    }

    /**
     * 查找列索引 - 增强版，支持更灵活的匹配
     * @param {Array} headerRow - 标题行
     * @param {Array} possibleNames - 可能的列名
     * @returns {number} 列索引，未找到返回-1
     */
    findColumnIndex(headerRow, possibleNames) {
        for (let i = 0; i < headerRow.length; i++) {
            if (!headerRow[i]) continue;
            
            // 处理各种可能的值类型并清理
            let cellValue = String(headerRow[i])
                .trim()
                .toLowerCase()
                .replace(/\s+/g, '') // 移除所有空格
                .replace(/[：:]/g, '') // 移除冒号
                .replace(/[()（）]/g, ''); // 移除括号
            
            // 检查是否包含任何可能的列名
            for (const name of possibleNames) {
                const cleanName = name.toLowerCase().replace(/\s+/g, '');
                if (cellValue.includes(cleanName) || cellValue === cleanName) {
                    logger.debug(`列匹配成功: "${headerRow[i]}" -> "${name}" (索引: ${i})`);
                    return i;
                }
            }
        }
        
        logger.warn(`未找到匹配列，候选名称: ${possibleNames.join(', ')}`);
        logger.warn(`标题行内容: ${headerRow.map((h, i) => `[${i}]${h}`).join(', ')}`);
        return -1;
    }

    /**
     * 解析时间字符串
     * @param {*} timeValue - 时间值
     * @returns {string|null} 格式化的时间字符串 HH:mm:ss
     */
    parseTime(timeValue) {
        if (!timeValue && timeValue !== 0) return null;

        let timeStr = String(timeValue).trim();
        
        // 处理Excel日期序列号 - 支持所有数值类型
        if (typeof timeValue === 'number' && timeValue > 0) {
            // 提取小数部分作为时间（整数部分是天数）
            const timePortion = timeValue % 1;
            
            // 如果小数部分为0，可能是整天数，跳过
            if (timePortion === 0) {
                logger.debug(`跳过整数日期序列号: ${timeValue}`);
                return null;
            }
            
            // 将小数部分转换为时间
            const totalSeconds = Math.round(timePortion * 24 * 60 * 60);
            const hours = Math.floor(totalSeconds / 3600);
            const minutes = Math.floor((totalSeconds % 3600) / 60);
            const seconds = totalSeconds % 60;
            
            timeStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            
            logger.debug(`Excel序列号 ${timeValue} 转换为时间: ${timeStr}`);
            return timeStr;
        }
        
        // 处理纯小数的Excel时间（小于1的数值）
        if (typeof timeValue === 'number' && timeValue > 0 && timeValue < 1) {
            const totalSeconds = Math.round(timeValue * 24 * 60 * 60);
            const hours = Math.floor(totalSeconds / 3600);
            const minutes = Math.floor((totalSeconds % 3600) / 60);
            const seconds = totalSeconds % 60;
            
            timeStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            
            logger.debug(`Excel时间小数 ${timeValue} 转换为时间: ${timeStr}`);
            return timeStr;
        }

        // 支持的时间格式
        const timeFormats = [
            'HH:mm:ss',
            'HH:mm',
            'H:mm:ss', 
            'H:mm',
            'HH:MM:SS',
            'HH:MM'
        ];

        for (const format of timeFormats) {
            try {
                // 简单的时间解析，不使用moment
                const timeMatch = timeStr.match(/(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?/);
                if (timeMatch) {
                    const hours = String(parseInt(timeMatch[1])).padStart(2, '0');
                    const minutes = String(parseInt(timeMatch[2])).padStart(2, '0');
                    const seconds = timeMatch[3] ? String(parseInt(timeMatch[3])).padStart(2, '0') : '00';
                    
                    // 验证时间有效性
                    const h = parseInt(hours);
                    const m = parseInt(minutes);
                    const s = parseInt(seconds);
                    
                    if (h >= 0 && h <= 23 && m >= 0 && m <= 59 && s >= 0 && s <= 59) {
                        return `${hours}:${minutes}:${seconds}`;
                    }
                }
            } catch (error) {
                // 继续尝试下一个格式
                continue;
            }
        }

        // 只对非数值类型且无法解析的值记录警告
        if (typeof timeValue !== 'number') {
            logger.warn(`无法解析时间格式: ${timeStr}`);
        }
        
        return null;
    }

    /**
     * 根据当前时间过滤已过期的提醒
     * @param {Array} reminders - 提醒列表
     * @param {Date} currentDate - 当前日期
     * @returns {Array} 过滤后的提醒列表
     */
    filterExpiredReminders(reminders, currentDate = new Date()) {
        const currentTime = formatTime(currentDate);
        
        return reminders.filter(reminder => {
            return reminder.time > currentTime;
        });
    }

    /**
     * 验证Excel文件格式
     * @param {string} fileName - 文件名
     * @returns {boolean} 是否支持的格式
     */
    isValidFormat(fileName) {
        const ext = fileName.toLowerCase().substring(fileName.lastIndexOf('.'));
        return this.supportedFormats.includes(ext);
    }

    /**
     * 获取工作表列表
     * @param {string} filePath - Excel文件路径
     * @returns {Array} 工作表名称列表
     */
    async getWorksheetNames(filePath) {
        try {
            const workbook = XLSX.readFile(filePath);
            return workbook.SheetNames;
        } catch (error) {
            logger.error(`获取工作表列表失败: ${error.message}`);
            throw new Error(`获取工作表列表失败: ${error.message}`);
        }
    }
    /**
     * 解析Excel文件用于预览
     * @param {string} filePath 文件路径
     * @returns {Object} 预览数据
     */
    async parseExcelForPreview(filePath) {
        try {
            const workbook = XLSX.readFile(filePath);
            const worksheets = workbook.SheetNames;
            const data = {};
            let totalReminders = 0;
            const errors = [];

            // 解析每个工作表
            for (const sheetName of worksheets) {
                try {
                    const worksheet = workbook.Sheets[sheetName];
                    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                    
                    if (!jsonData || jsonData.length === 0) {
                        continue;
                    }

                    // 获取标题行
                    const headers = jsonData[0];
                    const timeIndex = headers.findIndex(h => 
                        h && (h.includes('时间') || h.toLowerCase().includes('time'))
                    );
                    const messageIndex = headers.findIndex(h => 
                        h && (h.includes('消息') || h.includes('内容') || h.toLowerCase().includes('message') || h.toLowerCase().includes('content'))
                    );

                    if (timeIndex === -1 || messageIndex === -1) {
                        errors.push(`工作表 "${sheetName}" 缺少必要的列`);
                        continue;
                    }

                    // 解析数据行
                    const sheetData = [];
                    for (let i = 1; i < jsonData.length && i <= 10; i++) { // 预览最多10行
                        const row = jsonData[i];
                        if (!row || row.length === 0) continue;

                        const time = row[timeIndex];
                        const content = row[messageIndex];

                        if (time && content) {
                            sheetData.push({
                                time: this.parseTime(time),
                                message: String(content),  // 前端期望 'message' 字段
                                content: String(content)    // 保留 'content' 字段以兼容
                            });
                        }
                    }

                    if (sheetData.length > 0) {
                        data[sheetName] = sheetData;
                        totalReminders += jsonData.length - 1; // 减去标题行
                    }
                } catch (error) {
                    errors.push(`解析工作表 "${sheetName}" 失败: ${error.message}`);
                }
            }

            return {
                worksheets,
                data,
                totalReminders,
                errors
            };
        } catch (error) {
            logger.error('解析Excel文件预览失败:', error);
            throw error;
        }
    }
}

module.exports = new ExcelParser();