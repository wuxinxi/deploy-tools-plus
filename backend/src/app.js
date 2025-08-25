const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
const WebSocket = require('ws');
const Database = require('./config/database');

// 导入路由
const projectRoutes = require('./controllers/projectController');
const serverRoutes = require('./controllers/serverController');
const gitRoutes = require('./controllers/gitController');
const buildRoutes = require('./controllers/buildController');
const deployRoutes = require('./controllers/deployController');
const historyRoutes = require('./controllers/historyController');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3001;

// WebSocket服务器
const wss = new WebSocket.Server({ server });
const deployClients = new Map(); // 存储部署相关的WebSocket连接

// WebSocket连接处理
wss.on('connection', (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathParts = url.pathname.split('/');
  
  if (pathParts[1] === 'ws' && pathParts[2] === 'deploy' && pathParts[3]) {
    const deployId = pathParts[3];
    deployClients.set(deployId, ws);
    console.log(`部署WebSocket连接建立: deployId=${deployId}`);
    
    ws.on('close', () => {
      deployClients.delete(deployId);
      console.log(`部署WebSocket连接断开: deployId=${deployId}`);
    });
    
    ws.on('error', (error) => {
      console.error(`部署WebSocket错误: deployId=${deployId}`, error);
      deployClients.delete(deployId);
    });
    
    // 发送连接成功消息
    ws.send(JSON.stringify({
      type: 'connected',
      deployId,
      message: 'WebSocket连接已建立',
      timestamp: new Date().toISOString()
    }));
  }
});

// 导出WebSocket客户端映射，供其他模块使用
app.locals.deployClients = deployClients;

// 中间件配置
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// 静态文件服务
app.use(express.static(path.join(__dirname, '../../frontend/dist')));

// 日志中间件
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// API路由
app.use('/api/projects', projectRoutes);
app.use('/api/servers', serverRoutes);
app.use('/api/git', gitRoutes);
app.use('/api/build', buildRoutes);
app.use('/api/deploy', deployRoutes);
app.use('/api/history', historyRoutes);

// 健康检查接口
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: require('../../package.json').version
  });
});

// 系统信息接口
app.get('/api/system/info', async (req, res) => {
  try {
    const GitService = require('./services/GitService');
    const BuildService = require('./services/BuildService');
    
    const gitService = new GitService();
    const buildService = new BuildService();
    
    // 检查构建工具
    const buildTools = await buildService.checkBuildTools();
    
    res.json({
      success: true,
      data: {
        platform: process.platform,
        nodeVersion: process.version,
        buildTools,
        databasePath: Database.getInstance().dbPath
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 前端路由处理（SPA）
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  res.sendFile(path.join(__dirname, '../../frontend/dist/index.html'));
});

// 错误处理中间件
app.use((error, req, res, next) => {
  console.error('服务器错误:', error);
  res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' ? '服务器内部错误' : error.message
  });
});

// 404处理
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: '接口不存在'
  });
});

// 初始化数据库并启动服务器
async function startServer() {
  try {
    // 初始化数据库
    const db = Database.getInstance();
    await db.connect();
    await db.initTables();
    console.log('数据库初始化成功');

    // 启动服务器
    server.listen(PORT, () => {
      console.log(`服务器启动成功: http://localhost:${PORT}`);
      console.log(`API接口地址: http://localhost:${PORT}/api`);
      console.log(`WebSocket地址: ws://localhost:${PORT}/ws/deploy/{deployId}`);
      
      // 定期清理SSH连接
      const SSHService = require('./services/SSHService');
      const sshService = new SSHService();
      setInterval(() => {
        sshService.cleanupConnections();
      }, 60000); // 每分钟清理一次
    });

  } catch (error) {
    console.error('服务器启动失败:', error);
    process.exit(1);
  }
}

// 优雅关闭
process.on('SIGTERM', async () => {
  console.log('收到SIGTERM信号，开始优雅关闭...');
  
  try {
    const db = Database.getInstance();
    await db.close();
    console.log('数据库连接已关闭');
    
    const SSHService = require('./services/SSHService');
    const sshService = new SSHService();
    await sshService.closeAllConnections();
    console.log('SSH连接已关闭');
    
    process.exit(0);
  } catch (error) {
    console.error('关闭过程中出错:', error);
    process.exit(1);
  }
});

process.on('SIGINT', async () => {
  console.log('收到SIGINT信号，开始优雅关闭...');
  
  try {
    const db = Database.getInstance();
    await db.close();
    console.log('数据库连接已关闭');
    
    const SSHService = require('./services/SSHService');
    const sshService = new SSHService();
    await sshService.closeAllConnections();
    console.log('SSH连接已关闭');
    
    process.exit(0);
  } catch (error) {
    console.error('关闭过程中出错:', error);
    process.exit(1);
  }
});

// 启动服务器
if (require.main === module) {
  startServer();
}

module.exports = app;