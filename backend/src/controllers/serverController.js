const express = require('express');
const router = express.Router();
const ServerConfig = require('../models/ServerConfig');
const SSHService = require('../services/SSHService');

const serverConfig = new ServerConfig();
const sshService = new SSHService();

// 获取所有服务器配置
router.get('/', async (req, res) => {
  try {
    const servers = await serverConfig.getAll();
    
    // 本地使用，直接返回原始数据
    res.json({
      success: true,
      data: servers
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 获取单个服务器配置
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const server = await serverConfig.getById(id);
    
    if (!server) {
      return res.status(404).json({
        success: false,
        error: '服务器配置不存在'
      });
    }

    // 本地使用，直接返回原始数据
    res.json({
      success: true,
      data: server
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 获取默认服务器配置
router.get('/default/config', async (req, res) => {
  try {
    const defaultServer = await serverConfig.getDefault();
    
    if (!defaultServer) {
      return res.json({
        success: true,
        data: null,
        message: '未设置默认服务器配置'
      });
    }

    // 本地使用，直接返回原始数据
    res.json({
      success: true,
      data: defaultServer
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 测试服务器连接
router.post('/test', async (req, res) => {
  try {
    const {
      server_ip,
      ssh_port = 22,
      username,
      password,
      private_key_path
    } = req.body;

    // 验证必填字段
    if (!server_ip || !username) {
      return res.status(400).json({
        success: false,
        error: '服务器IP和用户名为必填字段'
      });
    }

    if (!password && !private_key_path) {
      return res.status(400).json({
        success: false,
        error: '必须提供密码或私钥文件路径'
      });
    }

    // 测试连接
    const testResult = await sshService.testConnection({
      server_ip,
      ssh_port,
      username,
      password,
      private_key_path
    });

    res.json(testResult);

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 创建服务器配置
router.post('/', async (req, res) => {
  try {
    const {
      config_name,
      server_ip,
      ssh_port = 22,
      username,
      password,
      private_key_path,
      backend_upload_path,
      frontend_upload_path,
      restart_script_path,
      nginx_reload = false,
      is_default = false
    } = req.body;

    // 验证必填字段
    if (!config_name || !server_ip || !username) {
      return res.status(400).json({
        success: false,
        error: '配置名称、服务器IP和用户名为必填字段'
      });
    }

    if (!password && !private_key_path) {
      return res.status(400).json({
        success: false,
        error: '必须提供密码或私钥文件路径'
      });
    }

    // 检查配置名称是否已存在
    const nameExists = await serverConfig.nameExists(config_name);
    if (nameExists) {
      return res.status(400).json({
        success: false,
        error: '配置名称已存在'
      });
    }

    // 创建服务器配置
    const server = await serverConfig.create({
      config_name,
      server_ip,
      ssh_port,
      username,
      password,
      private_key_path,
      backend_upload_path,
      frontend_upload_path,
      restart_script_path,
      nginx_reload,
      is_default
    });

    // 本地使用，直接返回原始数据
    res.status(201).json({
      success: true,
      data: server,
      message: '服务器配置创建成功'
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 更新服务器配置
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // 检查服务器配置是否存在
    const existingServer = await serverConfig.getById(id);
    if (!existingServer) {
      return res.status(404).json({
        success: false,
        error: '服务器配置不存在'
      });
    }

    // 如果更新了配置名称，检查是否重复
    if (updateData.config_name && updateData.config_name !== existingServer.config_name) {
      const nameExists = await serverConfig.nameExists(updateData.config_name, id);
      if (nameExists) {
        return res.status(400).json({
          success: false,
          error: '配置名称已存在'
        });
      }
    }

    // 直接更新所有字段
    const updatedServer = await serverConfig.update(id, updateData);

    // 本地使用，直接返回原始数据
    res.json({
      success: true,
      data: updatedServer,
      message: '服务器配置更新成功'
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 设置默认服务器配置
router.put('/:id/default', async (req, res) => {
  try {
    const { id } = req.params;

    // 检查服务器配置是否存在
    const server = await serverConfig.getById(id);
    if (!server) {
      return res.status(404).json({
        success: false,
        error: '服务器配置不存在'
      });
    }

    // 设置为默认配置
    const updatedServer = await serverConfig.update(id, { is_default: true });

    // 本地使用，直接返回原始数据
    res.json({
      success: true,
      data: updatedServer,
      message: '默认服务器配置设置成功'
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 删除服务器配置
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // 检查服务器配置是否存在
    const server = await serverConfig.getById(id);
    if (!server) {
      return res.status(404).json({
        success: false,
        error: '服务器配置不存在'
      });
    }

    // 删除服务器配置
    const deleted = await serverConfig.delete(id);

    if (deleted) {
      res.json({
        success: true,
        message: '服务器配置删除成功'
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

// 检查远程路径
router.post('/:id/check-path', async (req, res) => {
  try {
    const { id } = req.params;
    const { remote_path } = req.body;

    if (!remote_path) {
      return res.status(400).json({
        success: false,
        error: '远程路径不能为空'
      });
    }

    // 获取服务器配置
    const server = await serverConfig.getById(id);
    if (!server) {
      return res.status(404).json({
        success: false,
        error: '服务器配置不存在'
      });
    }

    // 检查路径是否存在
    const pathExists = await sshService.pathExists(server, remote_path);

    res.json({
      success: true,
      data: {
        path: remote_path,
        exists: pathExists
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 获取远程目录文件列表
router.post('/:id/list-files', async (req, res) => {
  try {
    const { id } = req.params;
    const { remote_path } = req.body;

    if (!remote_path) {
      return res.status(400).json({
        success: false,
        error: '远程路径不能为空'
      });
    }

    // 获取服务器配置
    const server = await serverConfig.getById(id);
    if (!server) {
      return res.status(404).json({
        success: false,
        error: '服务器配置不存在'
      });
    }

    // 获取文件列表
    const listResult = await sshService.listRemoteFiles(server, remote_path);

    res.json(listResult);

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;