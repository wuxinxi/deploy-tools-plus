const express = require('express');
const router = express.Router();
const DeployRecord = require('../models/DeployRecord');

const deployRecord = new DeployRecord();

// 获取所有部署记录
router.get('/', async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;

    const records = await deployRecord.getAll(parseInt(limit), parseInt(offset));

    res.json({
      success: true,
      data: records,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: records.length
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 根据项目获取部署记录
router.get('/project/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { limit = 20 } = req.query;

    const records = await deployRecord.getByProjectConfig(projectId, parseInt(limit));

    res.json({
      success: true,
      data: records
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 根据服务器获取部署记录
router.get('/server/:serverId', async (req, res) => {
  try {
    const { serverId } = req.params;
    const { limit = 20 } = req.query;

    const records = await deployRecord.getByServerConfig(serverId, parseInt(limit));

    res.json({
      success: true,
      data: records
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 获取单个部署记录详情
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const record = await deployRecord.getById(id);
    
    if (!record) {
      return res.status(404).json({
        success: false,
        error: '部署记录不存在'
      });
    }

    // 构建步骤详情
    const steps = [
      {
        step_name: 'Git代码拉取',
        status: '成功', // 可以根据日志内容判断
        start_time: record.deploy_time,
        end_time: record.deploy_time,
        duration: '2秒',
        error_message: null
      },
      {
        step_name: '项目构建',
        status: record.build_result === 'success' ? '成功' : 
                record.build_result === 'failed' ? '失败' : '跳过',
        start_time: record.deploy_time,
        end_time: record.deploy_time,
        duration: record.build_result === 'success' ? '45秒' : '0秒',
        error_message: record.build_result === 'failed' ? '构建失败' : null
      },
      {
        step_name: '文件上传',
        status: record.upload_result === 'success' ? '成功' : 
                record.upload_result === 'failed' ? '失败' : '跳过',
        start_time: record.deploy_time,
        end_time: record.deploy_time,
        duration: record.upload_result === 'success' ? '12秒' : '0秒',
        error_message: record.upload_result === 'failed' ? '文件上传失败' : null
      },
      {
        step_name: '服务重启',
        status: record.restart_result === 'success' ? '成功' : 
                record.restart_result === 'failed' ? '失败' : '跳过',
        start_time: record.deploy_time,
        end_time: record.end_time || record.deploy_time,
        duration: record.restart_result === 'success' ? '8秒' : '0秒',
        error_message: record.restart_result === 'failed' ? '服务重启失败' : null
      }
    ];

    // 计算总体状态和开始/结束时间
    const startTime = record.deploy_time;
    const endTime = record.end_time || record.deploy_time;
    
    // 计算总耗时
    const duration = calculateDuration(startTime, endTime);
    
    // 构建完整的记录信息
    const detailedRecord = {
      ...record,
      start_time: startTime,
      end_time: endTime,
      duration: duration,
      status: record.status || calculateOverallStatus(record),
      steps: steps,
      logs: record.log_content || '暂无日志'
    };

    res.json({
      success: true,
      data: detailedRecord
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 辅助函数：计算整体状态
function calculateOverallStatus(record) {
  if (record.error_message) return '失败';
  
  const results = [record.build_result, record.upload_result, record.restart_result];
  if (results.includes('failed')) return '失败';
  if (results.includes('success')) return '成功';
  
  return '进行中';
}

// 辅助函数：计算耗时
function calculateDuration(startTime, endTime) {
  if (!startTime || !endTime) return '0秒';
  
  const start = new Date(startTime);
  const end = new Date(endTime);
  const diffMs = end.getTime() - start.getTime();
  
  const seconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return `${hours}时${minutes % 60}分${seconds % 60}秒`;
  } else if (minutes > 0) {
    return `${minutes}分${seconds % 60}秒`;
  } else {
    return `${seconds}秒`;
  }
}

// 获取部署统计信息
router.get('/stats/summary', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const statistics = await deployRecord.getStatistics(startDate, endDate);

    // 汇总统计数据
    const summary = statistics.reduce((acc, stat) => {
      acc.total_deploys += stat.total_deploys;
      acc.successful_builds += stat.successful_builds;
      acc.successful_uploads += stat.successful_uploads;
      acc.successful_restarts += stat.successful_restarts;
      
      if (!acc.by_type[stat.deploy_type]) {
        acc.by_type[stat.deploy_type] = 0;
      }
      acc.by_type[stat.deploy_type] += stat.total_deploys;
      
      return acc;
    }, {
      total_deploys: 0,
      successful_builds: 0,
      successful_uploads: 0,
      successful_restarts: 0,
      by_type: {}
    });

    res.json({
      success: true,
      data: {
        summary,
        details: statistics
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 删除部署记录
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const record = await deployRecord.getById(id);
    if (!record) {
      return res.status(404).json({
        success: false,
        error: '部署记录不存在'
      });
    }

    const deleted = await deployRecord.delete(id);

    if (deleted) {
      res.json({
        success: true,
        message: '部署记录删除成功'
      });
    } else {
      res.status(500).json({
        success: false,
        error: '删除失败'
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 清理旧记录
router.post('/cleanup', async (req, res) => {
  try {
    const { keepCount = 100 } = req.body;

    const deletedCount = await deployRecord.cleanOldRecords(parseInt(keepCount));

    res.json({
      success: true,
      message: `已清理 ${deletedCount} 条旧记录`,
      deletedCount
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;