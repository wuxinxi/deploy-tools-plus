const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const util = require('util');

const execAsync = util.promisify(exec);

class GitService {
  constructor() {
    this.timeout = 30000; // 30秒超时
  }

  // 检查路径是否为Git仓库
  async isGitRepository(projectPath) {
    try {
      if (!fs.existsSync(projectPath)) {
        return { isGit: false, error: '项目路径不存在' };
      }

      const gitPath = path.join(projectPath, '.git');
      const isGit = fs.existsSync(gitPath);
      
      if (!isGit) {
        return { isGit: false, error: '该路径不是Git仓库' };
      }

      // 尝试执行git命令验证
      const { stdout } = await execAsync('git rev-parse --git-dir', {
        cwd: projectPath,
        timeout: this.timeout
      });

      return { isGit: true, gitDir: stdout.trim() };
    } catch (error) {
      return { isGit: false, error: `Git仓库检查失败: ${error.message}` };
    }
  }

  // 获取远程分支列表
  async getRemoteBranches(projectPath) {
    try {
      // 首先检查是否为Git仓库
      const gitCheck = await this.isGitRepository(projectPath);
      if (!gitCheck.isGit) {
        return {
          success: false,
          error: gitCheck.error,
          branches: []
        };
      }

      // 检查是否有远程仓库配置
      try {
        const { stdout: remotesOutput } = await execAsync('git remote', {
          cwd: projectPath,
          timeout: this.timeout
        });
        
        if (!remotesOutput.trim()) {
          return {
            success: false,
            error: '项目未配置远程仓库，请先添加远程仓库地址',
            branches: []
          };
        }
      } catch (remoteCheckError) {
        return {
          success: false,
          error: '检查远程仓库配置失败',
          branches: []
        };
      }

      // 执行git fetch获取最新的远程分支信息
      try {
        await execAsync('git fetch --all', {
          cwd: projectPath,
          timeout: this.timeout
        });
      } catch (fetchError) {
        console.warn('Git fetch 警告:', fetchError.message);
        // 如果fetch失败，可能是网络问题或权限问题，但不阻止获取已有的分支列表
        if (fetchError.message.includes('Could not resolve host') || 
            fetchError.message.includes('Network is unreachable')) {
          console.warn('网络连接问题，尝试使用本地缓存的远程分支信息');
        } else if (fetchError.message.includes('Permission denied') || 
                   fetchError.message.includes('Authentication failed')) {
          return {
            success: false,
            error: '远程仓库访问被拒绝，请检查访问权限和身份验证',
            branches: []
          };
        }
      }

      // 获取远程分支列表
      const { stdout } = await execAsync('git branch -r', {
        cwd: projectPath,
        timeout: this.timeout
      });

      const branches = stdout
        .split('\n')
        .map(branch => branch.trim())
        .filter(branch => {
          // 过滤空行和HEAD指针
          return branch && 
                 !branch.includes('HEAD') && 
                 !branch.includes('->') &&
                 branch.startsWith('origin/');
        })
        .map(branch => {
          // 提取分支名（移除origin/前缀）
          const branchName = branch.replace('origin/', '');
          return {
            name: branchName,
            fullName: branch,
            displayName: branchName
          };
        });

      if (branches.length === 0) {
        return {
          success: false,
          error: '未找到远程分支，可能是因为：\n1. 远程仓库为空\n2. 未推送代码到远程仓库\n3. 网络连接问题',
          branches: []
        };
      }

      return {
        success: true,
        branches,
        total: branches.length
      };
    } catch (error) {
      let errorMessage = '获取远程分支失败';
      
      if (error.message.includes('not a git repository')) {
        errorMessage = '所选路径不是一个Git仓库';
      } else if (error.message.includes('No such file or directory')) {
        errorMessage = '项目路径不存在';
      } else if (error.message.includes('timeout')) {
        errorMessage = '操作超时，请检查网络连接';
      } else {
        errorMessage = `获取远程分支失败: ${error.message}`;
      }
      
      return {
        success: false,
        error: errorMessage,
        branches: []
      };
    }
  }

  // 获取本地分支列表
  async getLocalBranches(projectPath) {
    try {
      const gitCheck = await this.isGitRepository(projectPath);
      if (!gitCheck.isGit) {
        throw new Error(gitCheck.error);
      }

      const { stdout } = await execAsync('git branch', {
        cwd: projectPath,
        timeout: this.timeout
      });

      const branches = stdout
        .split('\n')
        .map(branch => branch.trim())
        .filter(branch => branch)
        .map(branch => {
          const isCurrentBranch = branch.startsWith('*');
          const branchName = branch.replace('*', '').trim();
          
          return {
            name: branchName,
            fullName: branchName,
            displayName: branchName,
            isCurrent: isCurrentBranch
          };
        });

      return {
        success: true,
        branches,
        total: branches.length
      };
    } catch (error) {
      return {
        success: false,
        error: `获取本地分支失败: ${error.message}`,
        branches: []
      };
    }
  }

  // 获取当前分支
  async getCurrentBranch(projectPath) {
    try {
      const gitCheck = await this.isGitRepository(projectPath);
      if (!gitCheck.isGit) {
        throw new Error(gitCheck.error);
      }

      const { stdout } = await execAsync('git branch --show-current', {
        cwd: projectPath,
        timeout: this.timeout
      });

      const currentBranch = stdout.trim();
      
      return {
        success: true,
        branch: currentBranch || 'HEAD'
      };
    } catch (error) {
      return {
        success: false,
        error: `获取当前分支失败: ${error.message}`,
        branch: null
      };
    }
  }

  // 检查分支是否存在
  async branchExists(projectPath, branchName) {
    try {
      const gitCheck = await this.isGitRepository(projectPath);
      if (!gitCheck.isGit) {
        throw new Error(gitCheck.error);
      }

      // 检查远程分支
      try {
        await execAsync(`git show-ref --verify --quiet refs/remotes/origin/${branchName}`, {
          cwd: projectPath,
          timeout: this.timeout
        });
        return { exists: true, type: 'remote' };
      } catch (remoteError) {
        // 检查本地分支
        try {
          await execAsync(`git show-ref --verify --quiet refs/heads/${branchName}`, {
            cwd: projectPath,
            timeout: this.timeout
          });
          return { exists: true, type: 'local' };
        } catch (localError) {
          return { exists: false, error: '分支不存在' };
        }
      }
    } catch (error) {
      return { exists: false, error: `检查分支失败: ${error.message}` };
    }
  }

  // 拉取最新代码
  async pullLatest(projectPath, branchName = null) {
    try {
      const gitCheck = await this.isGitRepository(projectPath);
      if (!gitCheck.isGit) {
        throw new Error(gitCheck.error);
      }

      // 获取当前分支
      let currentBranch = branchName;
      if (!currentBranch) {
        const branchResult = await this.getCurrentBranch(projectPath);
        if (!branchResult.success) {
          throw new Error('获取当前分支失败');
        }
        currentBranch = branchResult.branch;
      }

      // 执行git pull
      const { stdout, stderr } = await execAsync(`git pull origin ${currentBranch}`, {
        cwd: projectPath,
        timeout: this.timeout
      });

      return {
        success: true,
        branch: currentBranch,
        output: stdout,
        message: '代码拉取成功'
      };
    } catch (error) {
      let errorMessage = '拉取最新代码失败';
      
      if (error.message.includes('Your local changes to the following files would be overwritten')) {
        errorMessage = '本地有未提交的修改，请先提交或删除本地修改';
      } else if (error.message.includes('There is no tracking information')) {
        errorMessage = '当前分支没有设置上游分支';
      } else if (error.message.includes('Could not resolve host')) {
        errorMessage = '网络连接失败，请检查网络连接';
      } else {
        errorMessage = `拉取最新代码失败: ${error.message}`;
      }
      
      return {
        success: false,
        error: errorMessage
      };
    }
  }
  async checkoutBranch(projectPath, branchName) {
    try {
      const gitCheck = await this.isGitRepository(projectPath);
      if (!gitCheck.isGit) {
        throw new Error(gitCheck.error);
      }

      // 检查工作区状态
      const statusCheck = await this.getWorkingTreeStatus(projectPath);
      if (!statusCheck.success) {
        return statusCheck;
      }

      if (!statusCheck.isClean) {
        return {
          success: false,
          error: '工作区有未提交的更改，请先提交或暂存更改',
          hasUncommittedChanges: true,
          changes: statusCheck.changes
        };
      }

      // 尝试切换分支
      const { stdout, stderr } = await execAsync(`git checkout ${branchName}`, {
        cwd: projectPath,
        timeout: this.timeout
      });

      return {
        success: true,
        message: `成功切换到分支: ${branchName}`,
        output: stdout || stderr
      };
    } catch (error) {
      return {
        success: false,
        error: `切换分支失败: ${error.message}`
      };
    }
  }

  // 获取工作区状态
  async getWorkingTreeStatus(projectPath) {
    try {
      const gitCheck = await this.isGitRepository(projectPath);
      if (!gitCheck.isGit) {
        throw new Error(gitCheck.error);
      }

      const { stdout } = await execAsync('git status --porcelain', {
        cwd: projectPath,
        timeout: this.timeout
      });

      const changes = stdout
        .split('\n')
        .filter(line => line.trim())
        .map(line => {
          const status = line.substring(0, 2);
          const filePath = line.substring(3);
          
          let changeType = '未知';
          if (status.includes('M')) changeType = '修改';
          else if (status.includes('A')) changeType = '新增';
          else if (status.includes('D')) changeType = '删除';
          else if (status.includes('R')) changeType = '重命名';
          else if (status.includes('??')) changeType = '未跟踪';
          
          return {
            file: filePath,
            status: status.trim(),
            type: changeType
          };
        });

      return {
        success: true,
        isClean: changes.length === 0,
        changes,
        totalChanges: changes.length
      };
    } catch (error) {
      return {
        success: false,
        error: `获取工作区状态失败: ${error.message}`,
        isClean: false,
        changes: []
      };
    }
  }

  // 拉取最新代码
  async pullLatest(projectPath, branchName = null) {
    try {
      const gitCheck = await this.isGitRepository(projectPath);
      if (!gitCheck.isGit) {
        throw new Error(gitCheck.error);
      }

      // 如果指定了分支，先切换分支
      if (branchName) {
        const checkoutResult = await this.checkoutBranch(projectPath, branchName);
        if (!checkoutResult.success) {
          return checkoutResult;
        }
      }

      // 执行git pull
      const { stdout, stderr } = await execAsync('git pull', {
        cwd: projectPath,
        timeout: this.timeout
      });

      return {
        success: true,
        message: '代码拉取成功',
        output: stdout || stderr
      };
    } catch (error) {
      return {
        success: false,
        error: `拉取代码失败: ${error.message}`
      };
    }
  }

  // 获取提交历史
  async getCommitHistory(projectPath, limit = 10) {
    try {
      const gitCheck = await this.isGitRepository(projectPath);
      if (!gitCheck.isGit) {
        throw new Error(gitCheck.error);
      }

      const { stdout } = await execAsync(
        `git log --oneline --graph --decorate -${limit}`,
        {
          cwd: projectPath,
          timeout: this.timeout
        }
      );

      const commits = stdout
        .split('\n')
        .filter(line => line.trim())
        .map(line => {
          const match = line.match(/^[*|\\\s]*([a-f0-9]+)\s+(.+)$/);
          if (match) {
            return {
              hash: match[1],
              message: match[2],
              fullLine: line
            };
          }
          return { fullLine: line };
        });

      return {
        success: true,
        commits,
        total: commits.length
      };
    } catch (error) {
      return {
        success: false,
        error: `获取提交历史失败: ${error.message}`,
        commits: []
      };
    }
  }

  // 验证项目类型（SpringBoot或Vue3）
  async validateProjectType(projectPath) {
    try {
      if (!fs.existsSync(projectPath)) {
        return { valid: false, error: '项目路径不存在' };
      }

      let projectType = null;
      let validationInfo = {};

      // 检查是否为SpringBoot项目
      const pomPath = path.join(projectPath, 'pom.xml');
      const gradlePath = path.join(projectPath, 'build.gradle');
      
      if (fs.existsSync(pomPath) || fs.existsSync(gradlePath)) {
        projectType = 'backend';
        validationInfo = {
          buildTool: fs.existsSync(pomPath) ? 'maven' : 'gradle',
          configFile: fs.existsSync(pomPath) ? 'pom.xml' : 'build.gradle'
        };
      }

      // 检查是否为Vue3项目
      const packageJsonPath = path.join(projectPath, 'package.json');
      if (fs.existsSync(packageJsonPath)) {
        try {
          const packageContent = fs.readFileSync(packageJsonPath, 'utf8');
          const packageJson = JSON.parse(packageContent);
          
          
          // 检查是否包含Vue3相关依赖
          const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
          console.log(deps);
          
          if (deps.vue && (deps.vue.includes('^3.') || deps.vue.includes('3.'))) {
            projectType = 'frontend';
            validationInfo = {
              framework: 'vue3',
              version: deps.vue,
              buildTool: 'npm'
            };
          }
        } catch (parseError) {
          console.warn('package.json解析失败:', parseError.message);
        }
      }

      if (!projectType) {
        return {
          valid: false,
          error: '无法识别项目类型，请确保是标准的SpringBoot或Vue3项目'
        };
      }

      return {
        valid: true,
        projectType,
        ...validationInfo
      };
    } catch (error) {
      return {
        valid: false,
        error: `项目类型验证失败: ${error.message}`
      };
    }
  }
}

module.exports = GitService;