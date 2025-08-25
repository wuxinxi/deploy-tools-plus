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

    res.json({
      success: true,
      data: record
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

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