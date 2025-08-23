/**
 * MongoDB文件管理路由
 * 处理文件上传、下载、删除等操作
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { File } = require('../models/mongodb');
const logger = require('../utils/logger');
const { checkMongoConnection } = require('../middleware/mongoConnection');

// 配置Multer上传
const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../../uploads');
        const tempDir = path.join(__dirname, '../../uploads/temp');
        
        // 确保目录存在
        try {
            await fs.mkdir(uploadDir, { recursive: true });
            await fs.mkdir(tempDir, { recursive: true });
        } catch (err) {
            // 忽略目录已存在的错误
        }
        
        // 根据上传类型决定存储位置
        const isTemp = req.body.isTemporary === 'true';
        cb(null, isTemp ? tempDir : uploadDir);
    },
    filename: (req, file, cb) => {
        // 生成唯一文件名
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 50 * 1024 * 1024 // 50MB
    },
    fileFilter: (req, file, cb) => {
        // 只允许Excel文件
        const allowedExtensions = ['.xlsx', '.xls'];
        const ext = path.extname(file.originalname).toLowerCase();
        
        if (allowedExtensions.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error('只支持上传Excel文件（.xlsx, .xls）'));
        }
    }
});

/**
 * 获取文件列表
 */
router.get('/', checkMongoConnection, async (req, res) => {
    try {
        const { page = 1, limit = 20, search, type, groupId } = req.query;
        const skip = (page - 1) * limit;
        
        // 构建查询条件
        const query = {};
        
        // 如果不是管理员，只能查看自己上传的文件
        if (req.user && req.user.role !== 'admin') {
            query.uploadedBy = req.user.mongoId || req.user.id;
        }
        
        if (search) {
            query.originalName = new RegExp(search, 'i');
        }
        
        if (type) {
            query.type = type;
        }
        
        if (groupId) {
            query.groupId = groupId;
        }
        
        // 查询文件
        const files = await File.find(query)
            .populate('uploadBy', 'username')  // 使用uploadBy而不是uploadedBy
            .populate('groupId', 'name')
            .sort({ createdAt: -1 })  // 使用createdAt而不是uploadedAt
            .skip(skip)
            .limit(parseInt(limit));
            
        const total = await File.countDocuments(query);
        
        res.json({
            success: true,
            files: files.map(file => ({
                id: file._id.toString(),
                originalName: file.originalName,
                fileName: file.storedName,
                filePath: file.filePath,
                type: file.fileType,
                size: file.fileSize,
                groupId: file.groupId?._id?.toString(),
                groupName: file.groupId?.name,
                uploadedBy: file.uploadBy?.username,
                uploadedAt: file.createdAt,
                isTemporary: file.fileType === 'temp',
                worksheetCount: file.worksheetCount || 0,
                worksheets: file.worksheets || []
            })),
            total,
            page: parseInt(page),
            totalPages: Math.ceil(total / limit)
        });
    } catch (error) {
        logger.error('获取文件列表失败:', error);
        res.status(500).json({
            success: false,
            message: '获取文件列表失败',
            error: error.message
        });
    }
});

/**
 * 上传文件
 */
router.post('/upload', checkMongoConnection, upload.array('files', 10), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({
                success: false,
                message: '请选择要上传的文件'
            });
        }
        
        const { groupId, isTemporary, description } = req.body;
        const results = [];
        const errors = [];
        
        // 处理每个上传的文件
        for (const uploadedFile of req.files) {
            try {
                // 创建文件记录
                const file = new File({
                    originalName: uploadedFile.originalname,
                    storedName: uploadedFile.filename,
                    filePath: uploadedFile.path,
                    fileSize: uploadedFile.size,
                    fileType: isTemporary === 'true' ? 'temp' : 'regular',
                    groupId: groupId || null,
                    uploadBy: req.user?.mongoId || req.user?.id,
                    status: 'active'
                });
                
                // 解析Excel文件获取工作表信息
                try {
                    const excelParser = require('../services/excelParser');
                    const worksheets = await excelParser.getWorksheets(uploadedFile.path);
                    
                    file.worksheetCount = worksheets.length;
                    file.worksheets = worksheets.map(ws => ({
                        name: ws.name,
                        rowCount: ws.rowCount
                    }));
                } catch (parseError) {
                    logger.warn('解析Excel文件失败，但文件已上传:', parseError);
                }
                
                await file.save();
                
                results.push({
                    id: file._id.toString(),
                    originalName: file.originalName,
                    fileName: file.storedName,
                    filePath: file.filePath,
                    size: file.fileSize,
                    worksheetCount: file.worksheetCount || 0,
                    worksheets: file.worksheets || []
                });
            } catch (error) {
                logger.error(`文件 ${uploadedFile.originalname} 处理失败:`, error);
                errors.push({
                    fileName: uploadedFile.originalname,
                    error: error.message
                });
                
                // 删除失败的文件
                try {
                    await fs.unlink(uploadedFile.path);
                } catch (err) {
                    logger.error('删除失败的上传文件失败:', err);
                }
            }
        }
        
        // 返回批量上传结果
        if (results.length === 1 && errors.length === 0) {
            // 单文件成功上传
            res.json({
                success: true,
                message: '文件上传成功',
                data: results[0]
            });
        } else {
            // 批量上传结果
            res.json({
                success: results.length > 0,
                message: `成功上传 ${results.length} 个文件，失败 ${errors.length} 个`,
                data: {
                    summary: {
                        total: req.files.length,
                        success: results.length,
                        failed: errors.length
                    },
                    results,
                    errors
                }
            });
        }
        
    } catch (error) {
        // 删除所有已上传的文件
        if (req.files) {
            for (const file of req.files) {
                try {
                    await fs.unlink(file.path);
                } catch (err) {
                    logger.error('删除失败的上传文件失败:', err);
                }
            }
        }
        
        logger.error('文件上传失败:', error);
        res.status(500).json({
            success: false,
            message: '文件上传失败',
            error: error.message
        });
    }
});

/**
 * 获取文件详情
 */
router.get('/:id', checkMongoConnection, async (req, res) => {
    try {
        const file = await File.findById(req.params.id)
            .populate('uploadBy', 'username')
            .populate('groupId', 'name');
            
        if (!file) {
            return res.status(404).json({
                success: false,
                message: '文件不存在'
            });
        }
        
        res.json({
            success: true,
            data: {
                id: file._id.toString(),
                originalName: file.originalName,
                fileName: file.fileName,
                filePath: file.filePath,
                type: file.type,
                size: file.size,
                groupId: file.groupId?._id?.toString(),
                groupName: file.groupId?.name,
                uploadedBy: file.uploadedBy?.username,
                uploadedAt: file.uploadedAt,
                isTemporary: file.isTemporary,
                description: file.description,
                worksheetCount: file.worksheetCount,
                worksheets: file.worksheets
            }
        });
    } catch (error) {
        logger.error('获取文件详情失败:', error);
        res.status(500).json({
            success: false,
            message: '获取文件详情失败',
            error: error.message
        });
    }
});

/**
 * 删除文件
 */
router.delete('/:id', checkMongoConnection, async (req, res) => {
    try {
        const file = await File.findById(req.params.id);
        
        if (!file) {
            return res.status(404).json({
                success: false,
                message: '文件不存在'
            });
        }
        
        // 删除物理文件
        try {
            await fs.unlink(file.filePath);
        } catch (err) {
            logger.warn('删除物理文件失败:', err);
        }
        
        // 删除数据库记录
        await file.deleteOne();
        
        res.json({
            success: true,
            message: '文件删除成功'
        });
    } catch (error) {
        logger.error('删除文件失败:', error);
        res.status(500).json({
            success: false,
            message: '删除文件失败',
            error: error.message
        });
    }
});

/**
 * 更新文件信息
 */
router.put('/:id', checkMongoConnection, async (req, res) => {
    try {
        const { groupId, description, isTemporary } = req.body;
        
        const file = await File.findById(req.params.id);
        
        if (!file) {
            return res.status(404).json({
                success: false,
                message: '文件不存在'
            });
        }
        
        // 更新文件信息
        if (groupId !== undefined) file.groupId = groupId;
        if (description !== undefined) file.description = description;
        if (isTemporary !== undefined) file.isTemporary = isTemporary;
        
        await file.save();
        
        res.json({
            success: true,
            message: '文件信息更新成功',
            data: {
                id: file._id.toString(),
                groupId: file.groupId,
                description: file.description,
                isTemporary: file.isTemporary
            }
        });
    } catch (error) {
        logger.error('更新文件信息失败:', error);
        res.status(500).json({
            success: false,
            message: '更新文件信息失败',
            error: error.message
        });
    }
});

/**
 * 获取文件的工作表列表
 */
router.get('/:id/worksheets', checkMongoConnection, async (req, res) => {
    try {
        const file = await File.findById(req.params.id);
        
        if (!file) {
            return res.status(404).json({
                success: false,
                message: '文件不存在'
            });
        }
        
        // 检查文件是否存在
        try {
            await fs.access(file.filePath);
        } catch (err) {
            return res.status(404).json({
                success: false,
                message: '文件已被删除或移动'
            });
        }
        
        // 解析Excel文件获取工作表列表
        const excelParser = require('../services/excelParser');
        const XLSX = require('xlsx');
        const workbook = XLSX.readFile(file.filePath);
        const worksheetNames = workbook.SheetNames;
        
        logger.info(`文件 ${file.originalName} 包含工作表:`, worksheetNames);
        
        res.json({
            success: true,
            worksheets: worksheetNames,
            data: {
                worksheets: worksheetNames.map(name => ({
                    name: name,
                    label: name
                }))
            }
        });
        
    } catch (error) {
        logger.error('获取工作表列表失败:', error);
        res.status(500).json({
            success: false,
            message: '获取工作表列表失败',
            error: error.message
        });
    }
});

/**
 * 预览文件内容
 */
router.get('/:id/preview', checkMongoConnection, async (req, res) => {
    try {
        const { worksheet } = req.query;
        const file = await File.findById(req.params.id)
            .populate('groupId', 'name');
            
        if (!file) {
            return res.status(404).json({
                success: false,
                message: '文件不存在'
            });
        }
        
        // 检查文件是否存在
        try {
            await fs.access(file.filePath);
        } catch (err) {
            return res.status(404).json({
                success: false,
                message: '文件已被删除或移动'
            });
        }
        
        // 解析Excel文件
        const excelParser = require('../services/excelParser');
        
        // 如果指定了工作表，只返回该工作表的数据
        if (worksheet) {
            const XLSX = require('xlsx');
            const workbook = XLSX.readFile(file.filePath);
            
            if (!workbook.Sheets[worksheet]) {
                return res.status(404).json({
                    success: false,
                    message: `工作表 "${worksheet}" 不存在`
                });
            }
            
            // 解析指定工作表
            const sheet = workbook.Sheets[worksheet];
            // 使用 raw: false 让 XLSX 自动格式化时间值
            const data = XLSX.utils.sheet_to_json(sheet, { raw: false, dateNF: 'HH:mm' });
            
            // 格式化数据为提醒格式
            const reminders = data.map(row => {
                // 尝试不同的字段名
                let time = row['时间'] || row['Time'] || row['time'] || '';
                const message = row['消息内容'] || row['内容'] || row['Message'] || row['Content'] || row['content'] || '';
                
                // 时间应该已经被格式化为字符串了
                time = String(time).trim();
                
                return {
                    time: time,
                    message: String(message).trim(),
                    content: String(message).trim() // 同时提供content字段保证兼容性
                };
            }).filter(item => item.time && item.message); // 过滤掉无效数据
            
            logger.info(`工作表 "${worksheet}" 解析完成，共 ${reminders.length} 条有效数据`);
            
            res.json({
                success: true,
                data: {
                    id: file._id,
                    filename: file.originalName,
                    worksheet: worksheet,
                    reminders: reminders,
                    totalReminders: reminders.length
                },
                reminders: reminders // 直接返回reminders字段供前端使用
            });
        } else {
            // 没有指定工作表，返回所有工作表的预览
            const result = await excelParser.parseExcelForPreview(file.filePath);
            
            res.json({
                success: true,
                data: {
                    id: file._id,
                    filename: file.originalName,
                    worksheets: result.worksheets,
                    data: result.data,
                    totalReminders: result.totalReminders,
                    errors: result.errors || []
                }
            });
        }
        
    } catch (error) {
        logger.error('预览文件失败:', error);
        res.status(500).json({
            success: false,
            message: '预览文件失败',
            error: error.message
        });
    }
});

/**
 * 下载文件
 */
router.get('/:id/download', checkMongoConnection, async (req, res) => {
    try {
        const file = await File.findById(req.params.id);
        
        if (!file) {
            return res.status(404).json({
                success: false,
                message: '文件不存在'
            });
        }
        
        // 检查文件是否存在
        try {
            await fs.access(file.filePath);
        } catch (err) {
            return res.status(404).json({
                success: false,
                message: '文件已被删除或移动'
            });
        }
        
        // 设置下载响应头
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.originalName)}"`);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        
        // 发送文件
        res.sendFile(path.resolve(file.filePath));
        
    } catch (error) {
        logger.error('下载文件失败:', error);
        res.status(500).json({
            success: false,
            message: '下载文件失败',
            error: error.message
        });
    }
});

/**
 * 清理临时文件
 */
router.post('/cleanup-temp', checkMongoConnection, async (req, res) => {
    try {
        // 查找所有临时文件
        const tempFiles = await File.find({ isTemporary: true });
        
        let deletedCount = 0;
        let failedCount = 0;
        
        for (const file of tempFiles) {
            try {
                // 删除物理文件
                await fs.unlink(file.filePath);
                // 删除数据库记录
                await file.deleteOne();
                deletedCount++;
            } catch (err) {
                logger.warn(`清理临时文件失败: ${file.fileName}`, err);
                failedCount++;
            }
        }
        
        res.json({
            success: true,
            message: `清理完成，删除 ${deletedCount} 个文件，失败 ${failedCount} 个`,
            data: {
                deletedCount,
                failedCount
            }
        });
    } catch (error) {
        logger.error('清理临时文件失败:', error);
        res.status(500).json({
            success: false,
            message: '清理临时文件失败',
            error: error.message
        });
    }
});

module.exports = router;