const fs = require('fs');
const path = require('path');
const util = require('util');
const { exec, spawn } = require('child_process');
const { EventEmitter } = require('events');

const execAsync = util.promisify(exec);

class BuildService extends EventEmitter {
  constructor() {
    super();
    this.timeout = 300000; // 5分钟超时
    this.activeBuilds = new Map(); // 存储正在进行的构建进程
  }

  // 检查构建工具是否可用
  async checkBuildTools() {
    const tools = {};
    
    try {
      await execAsync('mvn --version');
      tools.maven = true;
    } catch (error) {
      tools.maven = false;
    }

    try {
      await execAsync('gradle --version');
      tools.gradle = true;
    } catch (error) {
      tools.gradle = false;
    }

    try {
      await execAsync('npm --version');
      tools.npm = true;
    } catch (error) {
      tools.npm = false;
    }

    try {
      await execAsync('node --version');
      tools.node = true;
    } catch (error) {
      tools.node = false;
    }

    return tools;
  }

  // 检测项目构建类型
  async detectBuildType(projectPath) {
    if (!fs.existsSync(projectPath)) {
      throw new Error('项目路径不存在');
    }

    const pomPath = path.join(projectPath, 'pom.xml');
    const gradlePath = path.join(projectPath, 'build.gradle');
    const packageJsonPath = path.join(projectPath, 'package.json');

    if (fs.existsSync(pomPath)) {
      return {
        type: 'maven',
        projectType: 'backend',
        configFile: 'pom.xml',
        buildCommand: 'mvn clean package -Dmaven.test.skip=true'
      };
    }

    if (fs.existsSync(gradlePath)) {
      // 检查是否有gradle wrapper
      const gradlewPath = path.join(projectPath, 'gradlew');
      const command = fs.existsSync(gradlewPath) ? './gradlew' : 'gradle';
      
      return {
        type: 'gradle',
        projectType: 'backend',
        configFile: 'build.gradle',
        buildCommand: `${command} clean build -x test`
      };
    }

    if (fs.existsSync(packageJsonPath)) {
      try {
        const packageContent = fs.readFileSync(packageJsonPath, 'utf8');
        const packageJson = JSON.parse(packageContent);
        
        // 检查是否为Vue项目
        const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
        const vueVersion = deps.vue;
        
        if (vueVersion) {
          // 检查Vue版本 - 支持多种版本格式
          const isVue3 = vueVersion.includes('3.') || 
                        vueVersion.startsWith('^3.') || 
                        vueVersion.startsWith('~3.') ||
                        vueVersion.startsWith('>=3.');
          
          if (isVue3) {
            // 检查package.json中的构建脚本
            const scripts = packageJson.scripts || {};
            let buildCommand = 'npm run build';
            
            // 优先使用build:prod，然后是build
            if (scripts['build:prod']) {
              buildCommand = 'npm run build:prod';
            } else if (scripts['build']) {
              buildCommand = 'npm run build';
            } else {
              console.warn('未找到构建脚本，使用默认命令');
            }
            
            return {
              type: 'npm',
              projectType: 'frontend',
              framework: 'vue3',
              configFile: 'package.json',
              buildCommand,
              installCommand: 'npm install',
              vueVersion
            };
          }
        }
        
        // 检查是否为React项目
        if (deps.react) {
          const scripts = packageJson.scripts || {};
          let buildCommand = 'npm run build';
          
          if (scripts['build']) {
            buildCommand = 'npm run build';
          }
          
          return {
            type: 'npm',
            projectType: 'frontend', 
            framework: 'react',
            configFile: 'package.json',
            buildCommand,
            installCommand: 'npm install'
          };
        }
        
        // 通用Node.js项目
        if (packageJson.scripts && (packageJson.scripts.build || packageJson.scripts.start)) {
          return {
            type: 'npm',
            projectType: 'frontend',
            framework: 'nodejs',
            configFile: 'package.json',
            buildCommand: packageJson.scripts.build ? 'npm run build' : 'npm run start',
            installCommand: 'npm install'
          };
        }
        
      } catch (error) {
        console.warn('package.json解析失败:', error.message);
      }
    }

    throw new Error('无法识别项目构建类型');
  }

  // 查找构建产物
  async findBuildArtifacts(projectPath, buildType) {
    const artifacts = [];

    try {
      if (buildType.projectType === 'backend') {
        // 查找JAR文件
        const targetDir = path.join(projectPath, 'target');
        const buildDir = path.join(projectPath, 'build', 'libs');
        
        let searchDir = null;
        if (buildType.type === 'maven' && fs.existsSync(targetDir)) {
          searchDir = targetDir;
        } else if (buildType.type === 'gradle' && fs.existsSync(buildDir)) {
          searchDir = buildDir;
        }

        if (searchDir) {
          const files = fs.readdirSync(searchDir);
          const jarFiles = files.filter(file => 
            file.endsWith('.jar') && 
            !file.includes('sources') && 
            !file.includes('javadoc')
          );

          jarFiles.forEach(file => {
            const filePath = path.join(searchDir, file);
            const stats = fs.statSync(filePath);
            artifacts.push({
              name: file,
              path: filePath,
              size: stats.size,
              type: 'jar',
              created: stats.mtime
            });
          });
        }
      } else if (buildType.projectType === 'frontend') {
        // 查找dist目录
        const distDir = path.join(projectPath, 'dist');
        if (fs.existsSync(distDir)) {
          const stats = fs.statSync(distDir);
          artifacts.push({
            name: 'dist',
            path: distDir,
            size: this.getDirectorySize(distDir),
            type: 'directory',
            created: stats.mtime
          });
        }
      }

      return artifacts;
    } catch (error) {
      console.error('查找构建产物失败:', error);
      return [];
    }
  }

  // 计算目录大小
  getDirectorySize(dirPath) {
    let totalSize = 0;
    
    try {
      const files = fs.readdirSync(dirPath);
      
      files.forEach(file => {
        const filePath = path.join(dirPath, file);
        const stats = fs.statSync(filePath);
        
        if (stats.isFile()) {
          totalSize += stats.size;
        } else if (stats.isDirectory()) {
          totalSize += this.getDirectorySize(filePath);
        }
      });
    } catch (error) {
      console.error('计算目录大小失败:', error);
    }
    
    return totalSize;
  }

  // 执行构建
  async build(projectPath, options = {}) {
    const buildId = Date.now().toString();
    
    try {
      // 检测构建类型
      const buildType = await this.detectBuildType(projectPath);
      
      // 如果用户指定了构建命令，优先使用用户的选择
      if (options.buildCommand) {
        buildType.buildCommand = `npm run ${options.buildCommand}`;
        console.log(`使用用户指定的构建命令: ${buildType.buildCommand}`);
      }
      
      this.emit('buildStart', { buildId, buildType, projectPath });

      let buildResult;

      if (buildType.projectType === 'frontend') {
        // 前端项目构建
        buildResult = await this.buildFrontend(projectPath, buildType, buildId, options);
      } else {
        // 后端项目构建
        buildResult = await this.buildBackend(projectPath, buildType, buildId, options);
      }

      // 查找构建产物
      const artifacts = await this.findBuildArtifacts(projectPath, buildType);
      
      const result = {
        success: true,
        buildId,
        buildType,
        artifacts,
        logs: buildResult.logs,
        duration: buildResult.duration
      };

      this.emit('buildComplete', result);
      return result;

    } catch (error) {
      const result = {
        success: false,
        buildId,
        error: error.message,
        logs: error.logs || [],
        duration: error.duration || 0
      };

      this.emit('buildError', result);
      return result;
    } finally {
      this.activeBuilds.delete(buildId);
    }
  }

  // 构建前端项目
  async buildFrontend(projectPath, buildType, buildId, options = {}) {
    const logs = [];
    const startTime = Date.now();

    try {
      // 检查是否需要安装依赖
      const nodeModulesPath = path.join(projectPath, 'node_modules');
      const shouldInstall = options.forceInstall || !fs.existsSync(nodeModulesPath);

      if (shouldInstall) {
        logs.push('开始安装依赖...');
        this.emit('buildLog', { buildId, message: '开始安装依赖...' });

        const installResult = await this.runCommand(
          buildType.installCommand,
          projectPath,
          buildId,
          'install'
        );

        logs.push(...installResult.logs);
        
        if (!installResult.success) {
          throw new Error('依赖安装失败');
        }
      }

      // 执行构建
      logs.push('开始前端构建...');
      this.emit('buildLog', { buildId, message: '开始前端构建...' });

      const buildResult = await this.runCommand(
        buildType.buildCommand,
        projectPath,
        buildId,
        'build'
      );

      logs.push(...buildResult.logs);

      if (!buildResult.success) {
        throw new Error('前端构建失败');
      }

      const duration = Date.now() - startTime;
      logs.push(`构建完成，耗时: ${Math.round(duration / 1000)}秒`);

      return {
        success: true,
        logs,
        duration
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      error.logs = logs;
      error.duration = duration;
      throw error;
    }
  }

  // 构建后端项目
  async buildBackend(projectPath, buildType, buildId, options = {}) {
    const logs = [];
    const startTime = Date.now();

    try {
      logs.push('开始后端构建...');
      this.emit('buildLog', { buildId, message: '开始后端构建...' });

      const buildResult = await this.runCommand(
        buildType.buildCommand,
        projectPath,
        buildId,
        'build'
      );

      logs.push(...buildResult.logs);

      if (!buildResult.success) {
        throw new Error('后端构建失败');
      }

      const duration = Date.now() - startTime;
      logs.push(`构建完成，耗时: ${Math.round(duration / 1000)}秒`);

      return {
        success: true,
        logs,
        duration
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      error.logs = logs;
      error.duration = duration;
      throw error;
    }
  }

  // 运行命令
  async runCommand(command, cwd, buildId, phase) {
    return new Promise((resolve, reject) => {
      const logs = [];
      const startTime = Date.now();

      // 分解命令
      const [cmd, ...args] = command.split(' ');
      
      // 创建子进程
      const child = spawn(cmd, args, {
        cwd,
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: true
      });

      // 保存进程引用
      this.activeBuilds.set(buildId, { process: child, phase });

      // 处理标准输出
      child.stdout.on('data', (data) => {
        const message = data.toString();
        logs.push(message);
        this.emit('buildLog', { buildId, message, phase });
      });

      // 处理错误输出
      child.stderr.on('data', (data) => {
        const message = data.toString();
        logs.push(message);
        this.emit('buildLog', { buildId, message, phase, isError: true });
      });

      // 处理进程退出
      child.on('close', (code) => {
        const duration = Date.now() - startTime;
        
        if (code === 0) {
          resolve({
            success: true,
            logs,
            duration,
            exitCode: code
          });
        } else {
          reject({
            success: false,
            error: `命令执行失败，退出码: ${code}`,
            logs,
            duration,
            exitCode: code
          });
        }
      });

      // 处理进程错误
      child.on('error', (error) => {
        const duration = Date.now() - startTime;
        reject({
          success: false,
          error: `进程启动失败: ${error.message}`,
          logs,
          duration
        });
      });

      // 设置超时
      const timeoutId = setTimeout(() => {
        child.kill('SIGTERM');
        reject({
          success: false,
          error: '构建超时',
          logs,
          duration: this.timeout
        });
      }, this.timeout);

      child.on('close', () => {
        clearTimeout(timeoutId);
      });
    });
  }

  // 停止构建
  async stopBuild(buildId) {
    const build = this.activeBuilds.get(buildId);
    
    if (build && build.process) {
      try {
        build.process.kill('SIGTERM');
        
        // 等待进程优雅退出
        setTimeout(() => {
          if (!build.process.killed) {
            build.process.kill('SIGKILL');
          }
        }, 5000);

        this.activeBuilds.delete(buildId);
        this.emit('buildStopped', { buildId });
        
        return { success: true, message: '构建已停止' };
      } catch (error) {
        return { success: false, error: `停止构建失败: ${error.message}` };
      }
    }

    return { success: false, error: '未找到指定的构建任务' };
  }

  // 清理构建产物
  async cleanBuild(projectPath) {
    try {
      const buildType = await this.detectBuildType(projectPath);
      const logs = [];

      if (buildType.projectType === 'backend') {
        // 清理后端构建产物
        if (buildType.type === 'maven') {
          const { stdout } = await execAsync('mvn clean', { cwd: projectPath });
          logs.push(stdout);
        } else if (buildType.type === 'gradle') {
          const gradlewPath = path.join(projectPath, 'gradlew');
          const command = fs.existsSync(gradlewPath) ? './gradlew clean' : 'gradle clean';
          const { stdout } = await execAsync(command, { cwd: projectPath });
          logs.push(stdout);
        }
      } else {
        // 清理前端构建产物
        const distPath = path.join(projectPath, 'dist');
        if (fs.existsSync(distPath)) {
          fs.rmSync(distPath, { recursive: true, force: true });
          logs.push('已删除 dist 目录');
        }
      }

      return {
        success: true,
        message: '构建产物清理完成',
        logs
      };

    } catch (error) {
      return {
        success: false,
        error: `清理构建产物失败: ${error.message}`
      };
    }
  }

  // 获取活动构建列表
  getActiveBuilds() {
    const builds = [];
    
    this.activeBuilds.forEach((build, buildId) => {
      builds.push({
        buildId,
        phase: build.phase,
        pid: build.process.pid
      });
    });

    return builds;
  }
}

module.exports = BuildService;