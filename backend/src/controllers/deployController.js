const express = require('express');
const path = require('path');
const router = express.Router();
const DeployRecord = require('../models/DeployRecord');
const ProjectConfig = require('../models/ProjectConfig');
const ServerConfig = require('../models/ServerConfig');
const BuildService = require('../services/BuildService');
const SSHService = require('../services/SSHService');
const GitService = require('../services/GitService');

const deployRecord = new DeployRecord();
const projectConfig = new ProjectConfig();
const serverConfig = new ServerConfig();
const buildService = new BuildService();
const sshService = new SSHService();
const gitService = new GitService();

// 执行完整部署
router.post('/execute', async (req, res) => {
  try {
    console.log('收到部署请求:', JSON.stringify(req.body, null, 2));
    
    const {
      project_config_id,
      server_config_id,
      deploy_type, // 'backend', 'frontend', 'both'
      git_branch,
      build_command, // 用户选择的构建命令
      options = {},
      description
    } = req.body;

    // 验证必填字段
    if (!project_config_id || !server_config_id || !deploy_type) {
      console.log('验证失败: 缺少必填字段');
      return res.status(400).json({
        success: false,
        error: '项目配置ID、服务器配置ID和部署类型为必填字段'
      });
    }

    // 获取项目配置
    const project = await projectConfig.getById(project_config_id);
    if (!project) {
      console.log('项目配置不存在:', project_config_id);
      return res.status(404).json({
        success: false,
        error: '项目配置不存在'
      });
    }

    // 获取服务器配置
    const server = await serverConfig.getById(server_config_id);
    if (!server) {
      console.log('服务器配置不存在:', server_config_id);
      return res.status(404).json({
        success: false,
        error: '服务器配置不存在'
      });
    }

    // 验证部署类型
    if (!['backend', 'frontend'].includes(deploy_type)) {
      console.log('无效的部署类型:', deploy_type);
      return res.status(400).json({
        success: false,
        error: '部署类型必须是 backend 或 frontend'
      });
    }

    console.log(`开始创建部署记录: ${project.project_name} -> ${server.config_name}`);

    // 创建部署记录
    const record = await deployRecord.create({
      project_config_id,
      server_config_id,
      deploy_type,
      git_branch: git_branch || 'master',
      description: description || ''
    });

    console.log('部署记录已创建:', record.id);

    // 异步执行部署
    executeDeployment(record.id, project, server, deploy_type, { ...options, build_command }, req.app.locals.deployClients)
      .catch(error => {
        console.error('部署执行错误:', error);
      });

    res.json({
      success: true,
      data: {
        deployId: record.id,
        message: '部署已开始'
      }
    });

  } catch (error) {
    console.error('部署控制器错误:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 获取部署状态
router.get('/status/:deployId', async (req, res) => {
  try {
    const { deployId } = req.params;

    const record = await deployRecord.getById(deployId);
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

// 执行部署流程
async function executeDeployment(deployId, project, server, deployType, options, deployClients) {
  const logs = [];
  const WebSocket = require('ws');
  
  // 发送WebSocket消息的工具函数
  const sendWebSocketMessage = (type, data) => {
    const client = deployClients?.get(deployId.toString());
    if (client && client.readyState === WebSocket.OPEN) {
      const message = {
        type,
        deployId,
        timestamp: new Date().toISOString(),
        ...data
      };
      client.send(JSON.stringify(message));
    }
  };
  
  // 添加日志的工具函数
  const addLog = async (message, isError = false) => {
    console.log(`[部署${deployId}] ${message}`);
    logs.push(message);
    
    // 发送实时日志
    sendWebSocketMessage('log', { message, isError });
    
    // 更新数据库日志
    try {
      await deployRecord.update(deployId, {
        log_content: logs.join('\n')
      });
    } catch (error) {
      console.error('更新日志失败:', error);
    }
  };

  try {
    await addLog(`开始部署: ${project.project_name} -> ${server.config_name}`);
    await addLog(`部署类型: ${deployType}`);
    await addLog(`项目路径: ${project.project_path}`);
    
    // 发送步骤更新
    sendWebSocketMessage('step', { step: 0, status: 'process', message: '开始部署' });

    // 1. Git操作阶段
    if (options.pull) {
      await addLog('开始拉取最新代码...');
      sendWebSocketMessage('step', { step: 0, status: 'process', message: '拉取代码' });
      
      try {
        const gitResult = await gitService.pullLatest(project.project_path);
        if (!gitResult.success) {
          throw new Error(`Git拉取失败: ${gitResult.error}`);
        }
        await addLog('代码拉取完成');
      } catch (error) {
        await addLog(`Git操作失败: ${error.message}`, true);
        throw error;
      }
    } else {
      await addLog('跳过Git拉取阶段');
    }

    // 2. 构建阶段
    if (options.build) {
      await addLog('开始构建项目...');
      sendWebSocketMessage('step', { step: 1, status: 'process', message: '构建项目' });
      
      try {
        const buildResult = await buildService.build(project.project_path, {
          forceInstall: options.forceInstall || false,
          buildCommand: options.build_command // 传递用户选择的构建命令
        });

        if (!buildResult.success) {
          throw new Error(`构建失败: ${buildResult.error}`);
        }

        await addLog('项目构建完成');
        await deployRecord.update(deployId, {
          build_result: 'success'
        });
      } catch (error) {
        await addLog(`构建失败: ${error.message}`, true);
        await deployRecord.update(deployId, {
          build_result: 'failed'
        });
        throw error;
      }
    } else {
      await addLog('跳过构建阶段');
      await deployRecord.update(deployId, {
        build_result: 'skipped'
      });
    }

    // 3. 上传阶段
    if (options.upload) {
      await addLog('开始上传文件...');
      sendWebSocketMessage('step', { step: 2, status: 'process', message: '上传文件' });
      
      try {
        // 根据部署类型直接判断上传逻辑
        if (deployType === 'backend') {
          await uploadBackend(deployId, project, server, addLog);
        } else if (deployType === 'frontend') {
          await uploadFrontend(deployId, project, server, addLog);
        }

        await addLog('文件上传完成');
        await deployRecord.update(deployId, {
          upload_result: 'success'
        });
      } catch (error) {
        await addLog(`文件上传失败: ${error.message}`, true);
        await deployRecord.update(deployId, {
          upload_result: 'failed'
        });
        throw error;
      }
    } else {
      await addLog('跳过上传阶段');
      await deployRecord.update(deployId, {
        upload_result: 'skipped'
      });
    }

    // 4. 重启阶段
    if (options.restart) {
      await addLog('开始重启服务...');
      sendWebSocketMessage('step', { step: 3, status: 'process', message: '重启服务' });
      
      try {
        // 根据部署类型直接判断重启逻辑
        if (deployType === 'backend') {
          if (server.restart_script_path) {
            await addLog('正在重启后端服务...');
            
            const restartResult = await sshService.restartService(server, server.restart_script_path);
            
            if (!restartResult.success) {
              throw new Error(`后端服务重启失败: ${restartResult.error}`);
            }

            await addLog('后端服务重启成功');
          } else {
            await addLog('未配置重启脚本，跳过后端服务重启');
          }
        } else if (deployType === 'frontend') {
          if (server.nginx_reload) {
            await addLog('正在重载Nginx...');
            
            const nginxResult = await sshService.reloadNginx(server);
            
            if (!nginxResult.success) {
              await addLog(`Nginx重载失败: ${nginxResult.error}`, true);
            } else {
              await addLog('Nginx重载成功');
            }
          } else {
            await addLog('未启用Nginx重载');
          }
        }

        await deployRecord.update(deployId, {
          restart_result: 'success'
        });
      } catch (error) {
        await addLog(`服务重启失败: ${error.message}`, true);
        await deployRecord.update(deployId, {
          restart_result: 'failed'
        });
        throw error;
      }
    } else {
      await addLog('跳过重启阶段');
      await deployRecord.update(deployId, {
        restart_result: 'skipped'
      });
    }

    // 部署成功
    await addLog('部署完成✓');
    await deployRecord.update(deployId, {
      status: 'success',
      end_time: new Date().toISOString()
    });
    
    // 发送完成消息
    sendWebSocketMessage('complete', { 
      status: '成功', 
      message: '部署完成' 
    });

  } catch (error) {
    await addLog(`部署失败: ${error.message}`, true);
    
    await deployRecord.update(deployId, {
      status: 'failed',
      end_time: new Date().toISOString(),
      error_message: error.message
    });
    
    // 发送失败消息
    sendWebSocketMessage('complete', { 
      status: '失败', 
      message: `部署失败: ${error.message}` 
    });
  }
}

// 上传后端产物 - 简化版本，直接从项目路径上传构建产物
async function uploadBackend(deployId, project, server, addLog) {
  if (!server.backend_upload_path) {
    throw new Error('未配置后端上传路径');
  }

  await addLog(`开始上传后端文件到: ${server.backend_upload_path}`);

  // 简化实现：直接上传构建产物目录
  // 后续可以根据具体的构建工具（Maven/Gradle）来定制
  const targetPath = path.join(project.project_path, 'target');
  
  try {
    const uploadResult = await sshService.uploadDirectory(
      server,
      targetPath,
      server.backend_upload_path,
      { backup: true }
    );

    if (!uploadResult.success) {
      throw new Error(`后端文件上传失败: ${uploadResult.error}`);
    }

    await addLog('后端文件上传成功');
  } catch (error) {
    await addLog(`后端上传失败: ${error.message}`, true);
    throw error;
  }
}

// 上传前端产物 - 简化版本，直接从项目路径上传构建产物
async function uploadFrontend(deployId, project, server, addLog) {
  if (!server.frontend_upload_path) {
    throw new Error('未配置前端上传路径');
  }

  await addLog(`开始上传前端文件到: ${server.frontend_upload_path}`);

  // 上传整个dist目录（保持目录结构）
  const distPath = path.join(project.project_path, 'dist');
  
  try {
    // 设置进度事件监听
    const progressHandler = (progress) => {
      if (progress.message) {
        addLog(progress.message);
      }
    };
    
    const fileCompleteHandler = (info) => {
      if (info.message) {
        addLog(info.message);
      }
    };
    
    // 添加事件监听器
    sshService.on('uploadProgress', progressHandler);
    sshService.on('uploadFileComplete', fileCompleteHandler);
    
    const uploadResult = await sshService.uploadDirectory(
      server,
      distPath,
      server.frontend_upload_path,
      { 
        backup: true,
        keepDirectoryStructure: true  // 保持dist文件夹结构
      }
    );
    
    // 移除事件监听器
    sshService.off('uploadProgress', progressHandler);
    sshService.off('uploadFileComplete', fileCompleteHandler);

    if (!uploadResult.success) {
      throw new Error(`前端文件上传失败: ${uploadResult.error}`);
    }

    await addLog('前端文件上传成功');
  } catch (error) {
    await addLog(`前端上传失败: ${error.message}`, true);
    throw error;
  }
}

module.exports = router;