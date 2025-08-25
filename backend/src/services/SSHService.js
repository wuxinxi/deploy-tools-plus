const { NodeSSH } = require('node-ssh');
const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');

class SSHService extends EventEmitter {
  constructor() {
    super();
    this.connections = new Map(); // 缓存SSH连接
    this.timeout = 30000; // 30秒超时
  }

  // 创建SSH连接
  async createConnection(config) {
    const ssh = new NodeSSH();
    const connectionKey = `${config.server_ip}:${config.ssh_port}:${config.username}`;

    try {
      const connectConfig = {
        host: config.server_ip,
        port: config.ssh_port || 22,
        username: config.username,
        readyTimeout: this.timeout
      };

      // 根据认证方式配置连接
      if (config.private_key_path) {
        // 私钥认证
        if (!fs.existsSync(config.private_key_path)) {
          throw new Error(`私钥文件不存在: ${config.private_key_path}`);
        }
        connectConfig.privateKey = fs.readFileSync(config.private_key_path, 'utf8');
      } else if (config.password) {
        // 密码认证
        connectConfig.password = config.password;
      } else {
        throw new Error('必须提供密码或私钥进行认证');
      }

      await ssh.connect(connectConfig);
      
      // 缓存连接
      this.connections.set(connectionKey, {
        ssh,
        config,
        lastUsed: Date.now()
      });

      console.log(`SSH连接成功: ${connectionKey}`);
      return ssh;

    } catch (error) {
      throw new Error(`SSH连接失败: ${error.message}`);
    }
  }

  // 获取SSH连接
  async getConnection(config) {
    const connectionKey = `${config.server_ip}:${config.ssh_port}:${config.username}`;
    const cached = this.connections.get(connectionKey);

    if (cached) {
      // 检查连接是否仍然有效
      try {
        await cached.ssh.execCommand('echo test');
        cached.lastUsed = Date.now();
        return cached.ssh;
      } catch (error) {
        // 连接已断开，删除缓存
        this.connections.delete(connectionKey);
      }
    }

    // 创建新连接
    return await this.createConnection(config);
  }

  // 测试SSH连接
  async testConnection(config) {
    try {
      const ssh = await this.createConnection(config);
      
      // 执行简单命令测试连接
      const result = await ssh.execCommand('whoami');
      
      if (result.code === 0) {
        return {
          success: true,
          message: '连接测试成功',
          username: result.stdout.trim(),
          server: `${config.server_ip}:${config.ssh_port}`
        };
      } else {
        throw new Error(`命令执行失败: ${result.stderr}`);
      }

    } catch (error) {
      return {
        success: false,
        error: `连接测试失败: ${error.message}`
      };
    }
  }

  // 执行远程命令
  async executeCommand(config, command, options = {}) {
    try {
      const ssh = await this.getConnection(config);
      
      this.emit('commandStart', { command, server: config.server_ip });
      
      const result = await ssh.execCommand(command, {
        cwd: options.cwd,
        stream: 'both'
      });

      const commandResult = {
        success: result.code === 0,
        exitCode: result.code,
        stdout: result.stdout,
        stderr: result.stderr,
        command,
        server: config.server_ip
      };

      this.emit('commandComplete', commandResult);
      
      return commandResult;

    } catch (error) {
      const errorResult = {
        success: false,
        error: error.message,
        command,
        server: config.server_ip
      };

      this.emit('commandError', errorResult);
      return errorResult;
    }
  }

  // 检查远程路径是否存在
  async pathExists(config, remotePath) {
    try {
      const result = await this.executeCommand(config, `test -e "${remotePath}" && echo "exists" || echo "not_exists"`);
      
      if (result.success) {
        return result.stdout.trim() === 'exists';
      } else {
        throw new Error(result.stderr || result.error);
      }
    } catch (error) {
      throw new Error(`检查远程路径失败: ${error.message}`);
    }
  }

  // 创建远程目录
  async createDirectory(config, remotePath) {
    try {
      const result = await this.executeCommand(config, `mkdir -p "${remotePath}"`);
      
      if (!result.success) {
        throw new Error(result.stderr || result.error);
      }

      return {
        success: true,
        message: `目录创建成功: ${remotePath}`
      };

    } catch (error) {
      return {
        success: false,
        error: `创建目录失败: ${error.message}`
      };
    }
  }

  // 备份远程文件
  async backupFile(config, filePath) {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = `${filePath}.bak.${timestamp}`;

      const exists = await this.pathExists(config, filePath);
      if (!exists) {
        return {
          success: true,
          message: '文件不存在，无需备份',
          backupPath: null
        };
      }

      const result = await this.executeCommand(config, `cp "${filePath}" "${backupPath}"`);
      
      if (!result.success) {
        throw new Error(result.stderr || result.error);
      }

      return {
        success: true,
        message: `文件备份成功: ${backupPath}`,
        backupPath
      };

    } catch (error) {
      return {
        success: false,
        error: `文件备份失败: ${error.message}`
      };
    }
  }

  // 备份远程目录
  async backupDirectory(config, dirPath) {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = `${dirPath}.bak.${timestamp}`;

      const exists = await this.pathExists(config, dirPath);
      if (!exists) {
        return {
          success: true,
          message: '目录不存在，无需备份',
          backupPath: null
        };
      }

      const result = await this.executeCommand(config, `cp -r "${dirPath}" "${backupPath}"`);
      
      if (!result.success) {
        throw new Error(result.stderr || result.error);
      }

      return {
        success: true,
        message: `目录备份成功: ${backupPath}`,
        backupPath
      };

    } catch (error) {
      return {
        success: false,
        error: `目录备份失败: ${error.message}`
      };
    }
  }

  // 上传单个文件
  async uploadFile(config, localPath, remotePath, options = {}) {
    try {
      if (!fs.existsSync(localPath)) {
        throw new Error(`本地文件不存在: ${localPath}`);
      }

      const ssh = await this.getConnection(config);
      
      // 确保远程目录存在
      const remoteDir = path.dirname(remotePath);
      const dirExists = await this.pathExists(config, remoteDir);
      if (!dirExists) {
        await this.createDirectory(config, remoteDir);
      }

      // 如果需要备份，先备份原文件
      if (options.backup) {
        await this.backupFile(config, remotePath);
      }

      this.emit('uploadStart', { 
        localPath, 
        remotePath, 
        server: config.server_ip 
      });

      // 执行文件上传
      await ssh.putFile(localPath, remotePath);

      const uploadResult = {
        success: true,
        localPath,
        remotePath,
        server: config.server_ip,
        message: '文件上传成功'
      };

      this.emit('uploadComplete', uploadResult);
      return uploadResult;

    } catch (error) {
      const errorResult = {
        success: false,
        localPath,
        remotePath,
        server: config.server_ip,
        error: `文件上传失败: ${error.message}`
      };

      this.emit('uploadError', errorResult);
      return errorResult;
    }
  }

  // 上传目录
  async uploadDirectory(config, localDir, remoteDir, options = {}) {
    try {
      if (!fs.existsSync(localDir)) {
        throw new Error(`本地目录不存在: ${localDir}`);
      }

      const ssh = await this.getConnection(config);

      // 如果需要备份，先备份原目录
      if (options.backup) {
        await this.backupDirectory(config, remoteDir);
      }

      // 如果设置了keepDirectoryStructure，需要在远程创建与本地目录同名的目录
      let actualRemoteDir = remoteDir;
      if (options.keepDirectoryStructure) {
        const localDirName = path.basename(localDir);
        actualRemoteDir = path.join(remoteDir, localDirName);
        
        // 确保远程目录存在
        await this.createDirectory(config, actualRemoteDir);
        
        // 计算总文件数和总大小用于进度显示
        const fileStats = await this.calculateDirectoryStats(localDir);
        console.log(`准备上传 ${fileStats.totalFiles} 个文件，总大小: ${this.formatFileSize(fileStats.totalSize)}`);
        
        // 使用自定义的递归上传方法
        await this.uploadDirectoryRecursive(ssh, localDir, actualRemoteDir, { 
          ...options, 
          config,
          totalFiles: fileStats.totalFiles,
          totalSize: fileStats.totalSize,
          uploadedFiles: 0,
          uploadedSize: 0
        });
      } else {
        // 确保远程父目录存在
        const remoteParentDir = path.dirname(remoteDir);
        const parentExists = await this.pathExists(config, remoteParentDir);
        if (!parentExists) {
          await this.createDirectory(config, remoteParentDir);
        }
        
        // 使用node-ssh的putDirectory方法
        await ssh.putDirectory(localDir, actualRemoteDir, {
          recursive: true,
          concurrency: options.concurrency || 3,
          validate: (itemPath) => {
            // 过滤掉不需要上传的文件
            const relativePath = path.relative(localDir, itemPath);
            return !relativePath.includes('node_modules') && 
                   !relativePath.includes('.git') && 
                   !relativePath.startsWith('.');
          },
          tick: (localPath, remotePath, error) => {
            if (error) {
              this.emit('uploadError', { localPath, remotePath, error: error.message });
            } else {
              // 发送进度信息
              const stats = fs.statSync(localPath);
              this.emit('uploadProgress', { 
                localPath, 
                remotePath,
                fileSize: stats.size,
                fileName: path.basename(localPath)
              });
            }
          }
        });
      }

      this.emit('uploadStart', { 
        localPath: localDir, 
        remotePath: actualRemoteDir, 
        server: config.server_ip,
        type: 'directory'
      });

      const uploadResult = {
        success: true,
        localPath: localDir,
        remotePath: actualRemoteDir,
        server: config.server_ip,
        type: 'directory',
        message: '目录上传成功'
      };

      this.emit('uploadComplete', uploadResult);
      return uploadResult;

    } catch (error) {
      const errorResult = {
        success: false,
        localPath: localDir,
        remotePath: remoteDir,
        server: config.server_ip,
        type: 'directory',
        error: `目录上传失败: ${error.message}`
      };

      this.emit('uploadError', errorResult);
      return errorResult;
    }
  }

  // 递归上传目录内容
  async uploadDirectoryRecursive(ssh, localDir, remoteDir, options = {}) {
    const items = fs.readdirSync(localDir);
    
    for (const item of items) {
      const localPath = path.join(localDir, item);
      const remotePath = path.join(remoteDir, item);
      const stats = fs.statSync(localPath);
      
      // 过滤不需要上传的文件
      const relativePath = path.relative(localDir, localPath);
      if (relativePath.includes('node_modules') || 
          relativePath.includes('.git') || 
          relativePath.startsWith('.')) {
        continue;
      }
      
      if (stats.isDirectory()) {
        // 创建远程目录
        await this.executeCommand(options.config, `mkdir -p "${remotePath}"`);
        // 递归上传子目录
        await this.uploadDirectoryRecursive(ssh, localPath, remotePath, options);
      } else if (stats.isFile()) {
        // 上传文件前的进度信息
        const fileName = path.basename(localPath);
        const fileSize = stats.size;
        
        // 更新进度计数器
        options.uploadedFiles = (options.uploadedFiles || 0) + 1;
        options.uploadedSize = (options.uploadedSize || 0) + fileSize;
        
        // 计算进度百分比
        const fileProgress = options.totalFiles ? Math.round((options.uploadedFiles / options.totalFiles) * 100) : 0;
        const sizeProgress = options.totalSize ? Math.round((options.uploadedSize / options.totalSize) * 100) : 0;
        
        // 发送详细进度信息
        this.emit('uploadProgress', { 
          localPath, 
          remotePath,
          fileName,
          fileSize,
          uploadedFiles: options.uploadedFiles,
          totalFiles: options.totalFiles,
          uploadedSize: options.uploadedSize,
          totalSize: options.totalSize,
          fileProgress,
          sizeProgress,
          message: `正在上传: ${fileName} (${options.uploadedFiles}/${options.totalFiles}) ${fileProgress}%`
        });
        
        // 上传文件
        await ssh.putFile(localPath, remotePath);
        
        // 上传完成后的信息
        this.emit('uploadFileComplete', {
          localPath,
          remotePath,
          fileName,
          fileSize,
          uploadedFiles: options.uploadedFiles,
          totalFiles: options.totalFiles,
          message: `✓ ${fileName} 上传完成`
        });
      }
    }
  }

  // 计算目录统计信息
  async calculateDirectoryStats(dirPath) {
    let totalFiles = 0;
    let totalSize = 0;
    
    const calculateRecursive = (currentPath) => {
      const items = fs.readdirSync(currentPath);
      
      for (const item of items) {
        const itemPath = path.join(currentPath, item);
        const stats = fs.statSync(itemPath);
        
        // 过滤不需要上传的文件
        const relativePath = path.relative(dirPath, itemPath);
        if (relativePath.includes('node_modules') || 
            relativePath.includes('.git') || 
            relativePath.startsWith('.')) {
          continue;
        }
        
        if (stats.isDirectory()) {
          calculateRecursive(itemPath);
        } else if (stats.isFile()) {
          totalFiles++;
          totalSize += stats.size;
        }
      }
    };
    
    calculateRecursive(dirPath);
    
    return {
      totalFiles,
      totalSize
    };
  }

  // 格式化文件大小
  formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // 重启应用服务
  async restartService(config, scriptPath) {
    try {
      // 检查脚本是否存在
      const scriptExists = await this.pathExists(config, scriptPath);
      if (!scriptExists) {
        throw new Error(`重启脚本不存在: ${scriptPath}`);
      }

      this.emit('restartStart', { 
        scriptPath, 
        server: config.server_ip 
      });

      // 执行重启脚本
      const result = await this.executeCommand(config, `bash "${scriptPath}"`);

      if (!result.success) {
        throw new Error(result.stderr || result.error || '脚本执行失败');
      }

      const restartResult = {
        success: true,
        scriptPath,
        server: config.server_ip,
        output: result.stdout,
        message: '服务重启成功'
      };

      this.emit('restartComplete', restartResult);
      return restartResult;

    } catch (error) {
      const errorResult = {
        success: false,
        scriptPath,
        server: config.server_ip,
        error: `服务重启失败: ${error.message}`
      };

      this.emit('restartError', errorResult);
      return errorResult;
    }
  }

  // 重载Nginx
  async reloadNginx(config) {
    try {
      this.emit('nginxReloadStart', { server: config.server_ip });

      // 首先测试Nginx配置
      const testResult = await this.executeCommand(config, 'nginx -t');
      if (!testResult.success) {
        throw new Error(`Nginx配置测试失败: ${testResult.stderr}`);
      }

      // 重载Nginx
      const reloadResult = await this.executeCommand(config, 'nginx -s reload');
      if (!reloadResult.success) {
        throw new Error(`Nginx重载失败: ${reloadResult.stderr}`);
      }

      const result = {
        success: true,
        server: config.server_ip,
        message: 'Nginx重载成功'
      };

      this.emit('nginxReloadComplete', result);
      return result;

    } catch (error) {
      const errorResult = {
        success: false,
        server: config.server_ip,
        error: `Nginx重载失败: ${error.message}`
      };

      this.emit('nginxReloadError', errorResult);
      return errorResult;
    }
  }

  // 获取远程文件列表
  async listRemoteFiles(config, remotePath) {
    try {
      const result = await this.executeCommand(config, `ls -la "${remotePath}"`);
      
      if (!result.success) {
        throw new Error(result.stderr || result.error);
      }

      const files = result.stdout
        .split('\n')
        .slice(1) // 跳过第一行的总计信息
        .filter(line => line.trim())
        .map(line => {
          const parts = line.split(/\s+/);
          if (parts.length >= 9) {
            return {
              permissions: parts[0],
              size: parts[4],
              date: `${parts[5]} ${parts[6]} ${parts[7]}`,
              name: parts.slice(8).join(' ')
            };
          }
          return null;
        })
        .filter(file => file !== null);

      return {
        success: true,
        files,
        path: remotePath
      };

    } catch (error) {
      return {
        success: false,
        error: `获取文件列表失败: ${error.message}`
      };
    }
  }

  // 清理连接缓存
  cleanupConnections() {
    const now = Date.now();
    const maxAge = 300000; // 5分钟

    this.connections.forEach((connection, key) => {
      if (now - connection.lastUsed > maxAge) {
        connection.ssh.dispose();
        this.connections.delete(key);
        console.log(`已清理过期SSH连接: ${key}`);
      }
    });
  }

  // 关闭所有连接
  async closeAllConnections() {
    for (const [key, connection] of this.connections) {
      try {
        await connection.ssh.dispose();
        console.log(`已关闭SSH连接: ${key}`);
      } catch (error) {
        console.error(`关闭SSH连接失败: ${key}`, error);
      }
    }
    this.connections.clear();
  }
}

module.exports = SSHService;