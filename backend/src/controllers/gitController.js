const express = require('express');
const router = express.Router();
const GitService = require('../services/GitService');
const ProjectConfig = require('../models/ProjectConfig');

const gitService = new GitService();
const projectConfig = new ProjectConfig();

// 获取项目的远程分支列表
router.get('/branches/remote/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;

    // 获取项目配置
    const project = await projectConfig.getById(projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        error: '项目配置不存在',
        branches: [],
        project_path: null
      });
    }

    console.log(`正在获取项目 ${project.project_name} (${project.project_path}) 的远程分支`);

    // 获取远程分支列表
    const branchesResult = await gitService.getRemoteBranches(project.project_path);

    if (branchesResult.success) {
      console.log(`成功获取 ${branchesResult.branches.length} 个远程分支`);
      res.json({
        success: true,
        branches: branchesResult.branches || [],
        total: branchesResult.total || 0,
        project_path: project.project_path,
        project_name: project.project_name
      });
    } else {
      console.error('获取远程分支失败:', branchesResult.error);
      res.status(400).json({
        success: false,
        error: branchesResult.error,
        branches: [],
        project_path: project.project_path,
        project_name: project.project_name
      });
    }

  } catch (error) {
    console.error('Git控制器错误:', error.message);
    res.status(500).json({
      success: false,
      error: `服务器内部错误: ${error.message}`,
      branches: []
    });
  }
});

// 获取项目的本地分支列表
router.get('/branches/local/:projectId', async (req, res) => {
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

    // 获取本地分支列表
    const branchesResult = await gitService.getLocalBranches(project.project_path);

    res.json(branchesResult);

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 获取项目当前分支
router.get('/current-branch/:projectId', async (req, res) => {
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

    // 获取当前分支
    const branchResult = await gitService.getCurrentBranch(project.project_path);

    res.json(branchResult);

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 检查分支是否存在
router.post('/check-branch/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { branch_name } = req.body;

    if (!branch_name) {
      return res.status(400).json({
        success: false,
        error: '分支名称不能为空'
      });
    }

    // 获取项目配置
    const project = await projectConfig.getById(projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        error: '项目配置不存在'
      });
    }

    // 检查分支是否存在
    const branchCheck = await gitService.branchExists(project.project_path, branch_name);

    res.json({
      success: true,
      data: {
        branch_name,
        exists: branchCheck.exists,
        type: branchCheck.type,
        error: branchCheck.error
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 切换分支
router.post('/checkout/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { branch_name } = req.body;

    if (!branch_name) {
      return res.status(400).json({
        success: false,
        error: '分支名称不能为空'
      });
    }

    // 获取项目配置
    const project = await projectConfig.getById(projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        error: '项目配置不存在'
      });
    }

    // 切换分支
    const checkoutResult = await gitService.checkoutBranch(project.project_path, branch_name);

    if (checkoutResult.success) {
      // 更新项目配置中的分支信息
      await projectConfig.updateBranch(projectId, branch_name);
    }

    res.json(checkoutResult);

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 获取工作区状态
router.get('/status/:projectId', async (req, res) => {
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

    // 获取工作区状态
    const statusResult = await gitService.getWorkingTreeStatus(project.project_path);

    res.json(statusResult);

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 拉取最新代码
router.post('/pull/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { branch_name } = req.body;

    // 获取项目配置
    const project = await projectConfig.getById(projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        error: '项目配置不存在'
      });
    }

    // 拉取代码
    const pullResult = await gitService.pullLatest(project.project_path, branch_name);

    res.json(pullResult);

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 获取提交历史
router.get('/history/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { limit = 10 } = req.query;

    // 获取项目配置
    const project = await projectConfig.getById(projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        error: '项目配置不存在'
      });
    }

    // 获取提交历史
    const historyResult = await gitService.getCommitHistory(project.project_path, parseInt(limit));

    res.json(historyResult);

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 检查Git仓库状态
router.get('/repository/:projectId', async (req, res) => {
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

    // 检查Git仓库
    const gitCheck = await gitService.isGitRepository(project.project_path);
    
    let currentBranch = null;
    let workingTreeStatus = null;

    if (gitCheck.isGit) {
      // 获取当前分支
      const branchResult = await gitService.getCurrentBranch(project.project_path);
      if (branchResult.success) {
        currentBranch = branchResult.branch;
      }

      // 获取工作区状态
      const statusResult = await gitService.getWorkingTreeStatus(project.project_path);
      if (statusResult.success) {
        workingTreeStatus = statusResult;
      }
    }

    res.json({
      success: true,
      data: {
        is_git: gitCheck.isGit,
        git_dir: gitCheck.gitDir,
        current_branch: currentBranch,
        working_tree_status: workingTreeStatus,
        error: gitCheck.error
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 验证项目类型和Git状态
router.get('/validate/:projectId', async (req, res) => {
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

    // 验证项目类型
    const validation = await gitService.validateProjectType(project.project_path);
    
    // 检查Git仓库
    const gitCheck = await gitService.isGitRepository(project.project_path);

    res.json({
      success: true,
      data: {
        project_validation: validation,
        git_validation: gitCheck,
        project_path: project.project_path,
        project_type: project.project_type
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;