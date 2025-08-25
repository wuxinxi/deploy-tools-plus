const express = require('express');
const router = express.Router();
const BuildService = require('../services/BuildService');
const ProjectConfig = require('../models/ProjectConfig');

const buildService = new BuildService();
const projectConfig = new ProjectConfig();

// 存储WebSocket连接，用于实时日志推送
const WebSocket = require('ws');
const clients = new Map();

// 检查构建工具
router.get('/tools', async (req, res) => {
  try {
    const tools = await buildService.checkBuildTools();
    
    res.json({
      success: true,
      data: tools
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 检测项目构建类型
router.get('/detect/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;

    // 获取项目配置
    const project = await projectConfig.getById(projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        error: '项目配置不存在'
      });
    }

    // 检测构建类型
    const buildType = await buildService.detectBuildType(project.project_path);

    res.json({
      success: true,
      data: buildType
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 开始构建
router.post('/start/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const options = req.body || {};

    // 获取项目配置
    const project = await projectConfig.getById(projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        error: '项目配置不存在'
      });
    }

    // 设置构建事件监听器
    const buildId = Date.now().toString();
    
    buildService.on('buildStart', (data) => {
      console.log('构建开始:', data);
    });

    buildService.on('buildLog', (data) => {
      // 推送日志到WebSocket客户端
      const message = JSON.stringify({
        type: 'buildLog',
        buildId: data.buildId,
        message: data.message,
        phase: data.phase,
        isError: data.isError || false,
        timestamp: new Date().toISOString()
      });

      clients.forEach((ws, clientId) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(message);
        } else {
          clients.delete(clientId);
        }
      });
    });

    buildService.on('buildComplete', (data) => {
      console.log('构建完成:', data);
    });

    buildService.on('buildError', (data) => {
      console.log('构建失败:', data);
    });

    // 异步执行构建
    buildService.build(project.project_path, options)
      .then(result => {
        // 构建完成后，通过WebSocket推送结果
        const message = JSON.stringify({
          type: 'buildResult',
          buildId: result.buildId,
          success: result.success,
          data: result,
          timestamp: new Date().toISOString()
        });

        clients.forEach((ws, clientId) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(message);
          } else {
            clients.delete(clientId);
          }
        });
      })
      .catch(error => {
        console.error('构建过程出错:', error);
      });

    // 立即返回构建ID
    res.json({
      success: true,
      data: {
        buildId,
        message: '构建已开始',
        projectPath: project.project_path
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 停止构建
router.post('/stop/:buildId', async (req, res) => {
  try {
    const { buildId } = req.params;

    const result = await buildService.stopBuild(buildId);

    res.json(result);

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 获取构建产物
router.get('/artifacts/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;

    // 获取项目配置
    const project = await projectConfig.getById(projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        error: '项目配置不存在'
      });
    }

    // 检测构建类型
    const buildType = await buildService.detectBuildType(project.project_path);
    
    // 查找构建产物
    const artifacts = await buildService.findBuildArtifacts(project.project_path, buildType);

    res.json({
      success: true,
      data: {
        artifacts,
        buildType,
        projectPath: project.project_path
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 清理构建产物
router.post('/clean/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;

    // 获取项目配置
    const project = await projectConfig.getById(projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        error: '项目配置不存在'
      });
    }

    // 清理构建产物
    const cleanResult = await buildService.cleanBuild(project.project_path);

    res.json(cleanResult);

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 获取活动构建列表
router.get('/active', async (req, res) => {
  try {
    const activeBuilds = buildService.getActiveBuilds();

    res.json({
      success: true,
      data: activeBuilds
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// WebSocket连接处理
function handleWebSocketConnection(ws, req) {
  const clientId = Date.now().toString();
  clients.set(clientId, ws);

  console.log(`WebSocket客户端连接: ${clientId}`);

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      console.log('收到WebSocket消息:', data);
      
      // 处理客户端消息
      if (data.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
      }
    } catch (error) {
      console.error('WebSocket消息处理错误:', error);
    }
  });

  ws.on('close', () => {
    clients.delete(clientId);
    console.log(`WebSocket客户端断开: ${clientId}`);
  });

  ws.on('error', (error) => {
    console.error(`WebSocket错误 ${clientId}:`, error);
    clients.delete(clientId);
  });

  // 发送连接成功消息
  ws.send(JSON.stringify({
    type: 'connected',
    clientId,
    timestamp: new Date().toISOString()
  }));
}

module.exports = router;