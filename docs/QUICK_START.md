# 快速启动指南

## 5分钟快速上手

### 1. 安装依赖
```bash
# 进入项目目录
cd deploy-tools

# 安装根目录依赖
npm install

# 安装后端依赖
cd backend && npm install

# 安装前端依赖  
cd ../frontend && npm install
```

### 2. 初始化数据库
```bash
cd backend
npm run init-db
```

### 3. 启动服务
```bash
# 回到根目录
cd ..

# 开发环境启动（同时启动前后端）
npm run dev

# 或者分别启动
npm run backend  # 启动后端
npm run frontend # 启动前端
```

### 4. 访问应用
打开浏览器访问: http://localhost:3001

## API测试

### 健康检查
```bash
curl http://localhost:3001/api/health
```

### 系统信息
```bash
curl http://localhost:3001/api/system/info
```

## 基本配置流程

### 1. 添加项目配置
1. 进入"项目配置"页面
2. 点击"添加项目"
3. 选择项目类型 (backend/frontend)
4. 输入项目路径 (系统会自动验证)
5. 保存配置

### 2. 配置服务器
1. 进入"服务器配置"页面  
2. 点击"添加服务器"
3. 填写服务器信息 (IP、用户名、密码等)
4. 测试连接
5. 保存配置

### 3. 执行部署
1. 进入"部署执行"页面
2. 选择项目和服务器
3. 选择部署类型
4. 点击"开始部署"

## 目录结构

```
deploy-tools/
├── backend/              # Node.js后端
│   ├── src/
│   │   ├── controllers/  # API控制器
│   │   ├── services/     # 业务服务
│   │   ├── models/       # 数据模型
│   │   ├── config/       # 配置文件
│   │   └── app.js       # 应用入口
│   └── package.json
├── frontend/             # Vue3前端
│   ├── src/
│   │   ├── components/   # Vue组件
│   │   ├── views/       # 页面视图
│   │   └── main.js      # 应用入口
│   └── package.json
├── docs/                # 文档
└── package.json         # 根配置
```

## 重要说明

1. **Node.js版本**: 建议使用 Node.js 20.19+ 
2. **构建工具**: 根据需要安装 Maven、Gradle
3. **SSH连接**: 确保能够SSH连接到目标服务器
4. **Git仓库**: 项目需要是有效的Git仓库

## 故障排除

### 端口冲突
如果3001端口被占用，可以修改:
```bash
# 设置环境变量
export PORT=3002
npm start
```

### 数据库问题
如果数据库初始化失败:
```bash
cd backend
rm -rf src/database/
npm run init-db
```

### 前端构建问题
如果前端构建失败，可以跳过类型检查:
```bash
cd frontend
npm run build-only
```

## 下一步

- 查看完整使用文档: [docs/README.md](./README.md)
- 了解API接口: 访问 http://localhost:3001/api/
- 配置你的第一个部署项目

需要帮助？请查看详细文档或提交Issue。