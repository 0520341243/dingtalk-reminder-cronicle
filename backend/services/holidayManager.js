/**
 * Holiday Manager - 节假日管理模块
 * 支持中国法定节假日和自定义节假日
 * 可集成第三方节假日API
 */

const axios = require('axios');
// const { query } = require('../config/database'); // PostgreSQL已删除，使用MongoDB
const logger = require('../utils/logger');
const { beijingTime } = require('../utils/timeUtils');

class HolidayManager {
    constructor() {
        // 2025年中国法定节假日（静态配置）
        this.staticHolidays = {
            2025: [
                // 元旦
                '2025-01-01',
                // 春节
                '2025-01-28', '2025-01-29', '2025-01-30', '2025-01-31',
                '2025-02-01', '2025-02-02', '2025-02-03', '2025-02-04',
                // 清明节
                '2025-04-04', '2025-04-05', '2025-04-06',
                // 劳动节
                '2025-05-01', '2025-05-02', '2025-05-03', '2025-05-04', '2025-05-05',
                // 端午节
                '2025-05-31', '2025-06-01', '2025-06-02',
                // 中秋节、国庆节
                '2025-10-01', '2025-10-02', '2025-10-03', '2025-10-04',
                '2025-10-05', '2025-10-06', '2025-10-07', '2025-10-08'
            ],
            2024: [
                // 2024年节假日配置
                '2024-01-01', // 元旦
                '2024-02-10', '2024-02-11', '2024-02-12', '2024-02-13', '2024-02-14',
                '2024-02-15', '2024-02-16', '2024-02-17', // 春节
                '2024-04-04', '2024-04-05', '2024-04-06', // 清明节
                '2024-05-01', '2024-05-02', '2024-05-03', '2024-05-04', '2024-05-05', // 劳动节
                '2024-06-08', '2024-06-09', '2024-06-10', // 端午节
                '2024-09-15', '2024-09-16', '2024-09-17', // 中秋节
                '2024-10-01', '2024-10-02', '2024-10-03', '2024-10-04',
                '2024-10-05', '2024-10-06', '2024-10-07' // 国庆节
            ]
        };
        
        // 缓存的节假日数据
        this.cachedHolidays = new Map();
        
        // 第三方API配置
        this.apiConfig = {
            // 可以使用免费的节假日API
            url: 'https://timor.tech/api/holiday',
            timeout: 5000
        };
        
        // 自定义节假日（从数据库加载）
        this.customHolidays = new Set();
        
        // 初始化时加载自定义节假日
        this.loadCustomHolidays();
    }
    
    /**
     * 判断指定日期是否为节假日
     * @param {Date} date - 要检查的日期
     * @param {Object} options - 选项
     * @returns {Promise<boolean>}
     */
    async isHoliday(date, options = {}) {
        const {
            includeWeekends = false,  // 是否将周末视为节假日
            useApi = false,            // 是否使用API查询
            useCustom = true           // 是否包含自定义节假日
        } = options;
        
        const dateStr = this.formatDate(date);
        
        // 1. 检查周末
        if (includeWeekends) {
            const dayOfWeek = date.getDay();
            if (dayOfWeek === 0 || dayOfWeek === 6) {
                logger.debug(`${dateStr} 是周末`);
                return true;
            }
        }
        
        // 2. 检查缓存
        if (this.cachedHolidays.has(dateStr)) {
            return this.cachedHolidays.get(dateStr);
        }
        
        // 3. 检查静态配置
        const year = date.getFullYear();
        if (this.staticHolidays[year] && this.staticHolidays[year].includes(dateStr)) {
            logger.debug(`${dateStr} 是法定节假日（静态配置）`);
            this.cachedHolidays.set(dateStr, true);
            return true;
        }
        
        // 4. 检查自定义节假日
        if (useCustom && this.customHolidays.has(dateStr)) {
            logger.debug(`${dateStr} 是自定义节假日`);
            return true;
        }
        
        // 5. 使用API查询（如果启用）
        if (useApi) {
            try {
                const isApiHoliday = await this.checkHolidayFromApi(date);
                this.cachedHolidays.set(dateStr, isApiHoliday);
                return isApiHoliday;
            } catch (error) {
                logger.warn('节假日API查询失败，使用本地配置', error.message);
            }
        }
        
        // 不是节假日
        this.cachedHolidays.set(dateStr, false);
        return false;
    }
    
    /**
     * 从API查询节假日信息
     */
    async checkHolidayFromApi(date) {
        try {
            const dateStr = this.formatDate(date);
            const url = `${this.apiConfig.url}/info/${dateStr}`;
            
            const response = await axios.get(url, {
                timeout: this.apiConfig.timeout
            });
            
            if (response.data && response.data.type) {
                // type: 0 工作日, 1 周末, 2 节假日, 3 调休
                const isHoliday = response.data.type.type === 2;
                
                if (isHoliday) {
                    logger.info(`${dateStr} 是节假日: ${response.data.type.name}`);
                }
                
                return isHoliday;
            }
            
            return false;
            
        } catch (error) {
            logger.error('查询节假日API失败:', error);
            throw error;
        }
    }
    
    /**
     * 批量更新某年的节假日数据
     */
    async updateYearHolidays(year) {
        try {
            logger.info(`开始更新 ${year} 年节假日数据...`);
            
            const url = `${this.apiConfig.url}/year/${year}`;
            const response = await axios.get(url, {
                timeout: this.apiConfig.timeout * 2 // 批量查询给更多时间
            });
            
            if (response.data && response.data.holiday) {
                const holidays = [];
                
                // 解析API返回的节假日数据
                for (const [date, info] of Object.entries(response.data.holiday)) {
                    if (info.holiday === true) {
                        const formattedDate = `${year}-${date}`;
                        holidays.push(formattedDate);
                        this.cachedHolidays.set(formattedDate, true);
                    }
                }
                
                // 更新静态配置
                this.staticHolidays[year] = holidays;
                
                logger.info(`成功更新 ${year} 年节假日数据，共 ${holidays.length} 天`);
                
                // 可选：持久化到数据库
                await this.saveHolidaysToDB(year, holidays);
                
                return holidays;
            }
            
            return [];
            
        } catch (error) {
            logger.error(`更新 ${year} 年节假日数据失败:`, error);
            throw error;
        }
    }
    
    /**
     * 加载自定义节假日
     */
    async loadCustomHolidays() {
        try {
            // PostgreSQL代码已删除，使用MongoDB
            return [];
            /*
            // 先创建表（如果不存在）
            await query(`
                CREATE TABLE IF NOT EXISTS custom_holidays (
                    id SERIAL PRIMARY KEY,
                    date DATE UNIQUE NOT NULL,
                    name VARCHAR(100),
                    type VARCHAR(50) DEFAULT 'custom',
                    created_by INTEGER,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);
            
            // 加载自定义节假日
            const result = await query('SELECT date FROM custom_holidays');
            
            for (const row of result.rows) {
                const dateStr = this.formatDate(new Date(row.date));
                this.customHolidays.add(dateStr);
            }
            
            logger.info(`加载了 ${this.customHolidays.size} 个自定义节假日`);
            
        */ // PostgreSQL代码结束
        } catch (error) {
            logger.error('加载自定义节假日失败:', error);
        }
    }
    
    /**
     * 添加自定义节假日
     */
    async addCustomHoliday(date, name = '', userId = null) {
        try {
            const dateStr = this.formatDate(date);
            
            // PostgreSQL代码已删除，使用MongoDB
            // 暂时只在内存中维护
            this.customHolidays.add(dateStr);
            this.cachedHolidays.set(dateStr, true);
            
            logger.info(`添加自定义节假日: ${dateStr} - ${name}`);
            
            return true;
            
        } catch (error) {
            logger.error('添加自定义节假日失败:', error);
            return false;
        }
    }
    
    /**
     * 删除自定义节假日
     */
    async removeCustomHoliday(date) {
        try {
            const dateStr = this.formatDate(date);
            
            // PostgreSQL代码已删除，使用MongoDB
            // 暂时只在内存中维护
            this.customHolidays.delete(dateStr);
            this.cachedHolidays.delete(dateStr);
            
            logger.info(`删除自定义节假日: ${dateStr}`);
            
            return true;
            
        } catch (error) {
            logger.error('删除自定义节假日失败:', error);
            return false;
        }
    }
    
    /**
     * 获取指定年月的所有节假日
     */
    async getMonthHolidays(year, month) {
        const holidays = [];
        const daysInMonth = new Date(year, month, 0).getDate();
        
        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(year, month - 1, day);
            const dateStr = this.formatDate(date);
            
            if (await this.isHoliday(date)) {
                holidays.push({
                    date: dateStr,
                    dayOfWeek: date.getDay(),
                    isCustom: this.customHolidays.has(dateStr)
                });
            }
        }
        
        return holidays;
    }
    
    /**
     * 获取下一个工作日
     */
    async getNextWorkday(fromDate = new Date()) {
        let date = new Date(fromDate);
        date.setDate(date.getDate() + 1); // 从明天开始
        
        // 最多查找30天
        for (let i = 0; i < 30; i++) {
            if (!(await this.isHoliday(date, { includeWeekends: true }))) {
                return date;
            }
            date.setDate(date.getDate() + 1);
        }
        
        return null;
    }
    
    /**
     * 获取指定范围内的工作日数量
     */
    async countWorkdays(startDate, endDate) {
        let count = 0;
        const current = new Date(startDate);
        
        while (current <= endDate) {
            if (!(await this.isHoliday(current, { includeWeekends: true }))) {
                count++;
            }
            current.setDate(current.getDate() + 1);
        }
        
        return count;
    }
    
    /**
     * 保存节假日到数据库
     */
    async saveHolidaysToDB(year, holidays) {
        try {
            // PostgreSQL代码已删除，使用MongoDB
            // 暂时只在内存中维护
            logger.info(`节假日数据已保存到内存: ${year}年`);
            
        } catch (error) {
            logger.error('保存节假日到数据库失败:', error);
        }
    }
    
    /**
     * 从数据库加载节假日
     */
    async loadHolidaysFromDB(year) {
        try {
            // PostgreSQL代码已删除，使用MongoDB
            // 暂时使用静态配置
            if (this.staticHolidays[year]) {
                return this.staticHolidays[year];
            }
            
            return null;
            
        } catch (error) {
            logger.error('从数据库加载节假日失败:', error);
            return null;
        }
    }
    
    /**
     * 格式化日期
     */
    formatDate(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
    
    /**
     * 清除缓存
     */
    clearCache() {
        this.cachedHolidays.clear();
        logger.info('节假日缓存已清除');
    }
    
    /**
     * 获取统计信息
     */
    getStats() {
        const stats = {
            cachedDates: this.cachedHolidays.size,
            customHolidays: this.customHolidays.size,
            yearsLoaded: Object.keys(this.staticHolidays).length,
            years: Object.keys(this.staticHolidays)
        };
        
        return stats;
    }
}

// 导出单例
module.exports = new HolidayManager();