const express = require('express');
const router = express.Router();
const ProjectConfig = require('../models/ProjectConfig');
const GitService = require('../services/GitService');
const fs = require('fs');
const path = require('path');

const projectConfig = new ProjectConfig();
const gitService = new GitService();

// 获取所有项目配置
router.get('/', async (req, res) => {
  try {
    const projects = await projectConfig.getAll();
    res.json({
      success: true,
      data: projects
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 根据类型获取项目配置
router.get('/type/:type', async (req, res) => {
  try {
    const { type } = req.params;
    
    if (!['backend', 'frontend'].includes(type)) {
      return res.status(400).json({
        success: false,
        error: '项目类型必须是 backend 或 frontend'
      });
    }

    const projects = await projectConfig.getByType(type);
    res.json({
      success: true,
      data: projects
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 获取单个项目配置
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const project = await projectConfig.getById(id);
    
    if (!project) {
      return res.status(404).json({
        success: false,
        error: '项目配置不存在'
      });
    }

    res.json({
      success: true,
      data: project
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 获取项目的构建脚本列表
router.get('/:id/build-scripts', async (req, res) => {
  try {
    const { id } = req.params;
    
    // 获取项目配置
    const project = await projectConfig.getById(id);
    if (!project) {
      return res.status(404).json({
        success: false,
        error: '项目配置不存在'
      });
    }

    // 检查项目路径
    if (!fs.existsSync(project.project_path)) {
      return res.status(404).json({
        success: false,
        error: '项目路径不存在'
      });
    }

    // 读取package.json
    const packageJsonPath = path.join(project.project_path, 'package.json');
    if (!fs.existsSync(packageJsonPath)) {
      return res.status(404).json({
        success: false,
        error: '项目中未找到package.json文件'
      });
    }

    try {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      const scripts = packageJson.scripts || {};
      
      // 过滤出构建相关的脚本
      const buildScripts = [];
      Object.keys(scripts).forEach(scriptName => {
        const scriptCommand = scripts[scriptName];
        // 识别构建相关的脚本名称
        if (scriptName.includes('build') || 
            scriptName.includes('compile') || 
            scriptName.includes('package') ||
            scriptCommand.includes('build') ||
            scriptCommand.includes('webpack') ||
            scriptCommand.includes('vite') ||
            scriptCommand.includes('rollup')) {
          buildScripts.push({
            name: scriptName,
            command: scriptCommand,
            fullCommand: `npm run ${scriptName}`
          });
        }
      });

      // 如果没有找到构建脚本，返回所有scripts让用户选择
      const result = buildScripts.length > 0 ? buildScripts : Object.keys(scripts).map(scriptName => ({
        name: scriptName,
        command: scripts[scriptName],
        fullCommand: `npm run ${scriptName}`
      }));

      res.json({
        success: true,
        data: {
          scripts: result,
          total: result.length,
          projectPath: project.project_path,
          projectName: project.project_name
        }
      });

    } catch (parseError) {
      return res.status(400).json({
        success: false,
        error: 'package.json文件格式错误: ' + parseError.message
      });
    }

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 验证项目路径
router.post('/validate', async (req, res) => {
  try {
    const { project_path } = req.body;
    
    if (!project_path) {
      return res.status(400).json({
        success: false,
        error: '项目路径不能为空'
      });
    }

    // 验证项目类型
    const validation = await gitService.validateProjectType(project_path);
    
    if (!validation.valid) {
      return res.json({
        success: false,
        error: validation.error
      });
    }

    // 检查Git仓库
    const gitCheck = await gitService.isGitRepository(project_path);
    
    // 获取当前分支
    let currentBranch = null;
    if (gitCheck.isGit) {
      const branchResult = await gitService.getCurrentBranch(project_path);
      if (branchResult.success) {
        currentBranch = branchResult.branch;
      }
    }

    res.json({
      success: true,
      data: {
        project_path,
        project_type: validation.projectType,
        build_tool: validation.buildTool || validation.framework,
        is_git: gitCheck.isGit,
        current_branch: currentBranch,
        validation_info: {
          buildTool: validation.buildTool,
          framework: validation.framework,
          version: validation.version,
          configFile: validation.configFile
        }
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 创建项目配置
router.post('/', async (req, res) => {
  try {
    const { project_type, project_name, project_path, git_branch } = req.body;

    // 验证必填字段
    if (!project_type || !project_name || !project_path) {
      return res.status(400).json({
        success: false,
        error: '项目类型、项目名称和项目路径为必填字段'
      });
    }

    // 验证项目类型
    if (!['backend', 'frontend'].includes(project_type)) {
      return res.status(400).json({
        success: false,
        error: '项目类型必须是 backend 或 frontend'
      });
    }

    // 检查路径是否已存在
    const pathExists = await projectConfig.pathExists(project_path);
    if (pathExists) {
      return res.status(400).json({
        success: false,
        error: '该项目路径已存在'
      });
    }

    // 验证项目路径
    const validation = await gitService.validateProjectType(project_path);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: validation.error
      });
    }

    // 验证项目类型是否匹配
    if (validation.projectType !== project_type) {
      return res.status(400).json({
        success: false,
        error: `项目类型不匹配，检测到的类型为: ${validation.projectType}`
      });
    }

    // 创建项目配置
    const project = await projectConfig.create({
      project_type,
      project_name,
      project_path,
      git_branch
    });

    res.status(201).json({
      success: true,
      data: project,
      message: '项目配置创建成功'
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 更新项目配置
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // 检查项目是否存在
    const existingProject = await projectConfig.getById(id);
    if (!existingProject) {
      return res.status(404).json({
        success: false,
        error: '项目配置不存在'
      });
    }

    // 如果更新了项目路径，需要验证
    if (updateData.project_path && updateData.project_path !== existingProject.project_path) {
      // 检查新路径是否已被其他项目使用
      const pathExists = await projectConfig.pathExists(updateData.project_path, id);
      if (pathExists) {
        return res.status(400).json({
          success: false,
          error: '该项目路径已被其他项目使用'
        });
      }

      // 验证新项目路径
      const validation = await gitService.validateProjectType(updateData.project_path);
      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          error: validation.error
        });
      }

      // 验证项目类型是否匹配
      if (validation.projectType !== existingProject.project_type) {
        return res.status(400).json({
          success: false,
          error: `项目类型不匹配，检测到的类型为: ${validation.projectType}`
        });
      }
    }

    // 更新项目配置
    const updatedProject = await projectConfig.update(id, updateData);

    res.json({
      success: true,
      data: updatedProject,
      message: '项目配置更新成功'
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 更新Git分支
router.put('/:id/branch', async (req, res) => {
  try {
    const { id } = req.params;
    const { git_branch } = req.body;

    if (!git_branch) {
      return res.status(400).json({
        success: false,
        error: 'Git分支不能为空'
      });
    }

    // 检查项目是否存在
    const project = await projectConfig.getById(id);
    if (!project) {
      return res.status(404).json({
        success: false,
        error: '项目配置不存在'
      });
    }

    // 验证分支是否存在
    const branchCheck = await gitService.branchExists(project.project_path, git_branch);
    if (!branchCheck.exists) {
      return res.status(400).json({
        success: false,
        error: branchCheck.error || '分支不存在'
      });
    }

    // 更新分支
    const updatedProject = await projectConfig.updateBranch(id, git_branch);

    res.json({
      success: true,
      data: updatedProject,
      message: 'Git分支更新成功'
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 删除项目配置
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // 检查项目是否存在
    const project = await projectConfig.getById(id);
    if (!project) {
      return res.status(404).json({
        success: false,
        error: '项目配置不存在'
      });
    }

    // 删除项目配置
    const deleted = await projectConfig.delete(id);

    if (deleted) {
      res.json({
        success: true,
        message: '项目配置删除成功'
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

module.exports = router;