# 自动化部署工具使用指南

## 项目概述

本工具是一款本地运行的可视化自动化部署工具，专门用于 SpringBoot 后端项目与 Vue3 前端项目的全流程自动化部署。支持「代码拉取 - 编译打包 - 远程上传 - 服务重启」完整部署流程，具备配置本地化存储与版本回滚保障功能。

## 技术架构

### 前端技术栈
- **Vue3**: 使用 Composition API，提供响应式用户界面
- **Element Plus**: 统一的UI组件库，提供丰富的表单、弹窗、表格等组件
- **Vite**: 现代化的前端构建工具
- **Pinia**: 状态管理
- **Vue Router**: 前端路由管理
- **Axios**: HTTP客户端

### 后端技术栈
- **Node.js + Express**: 提供RESTful API服务
- **SQLite**: 轻量级数据库，存储配置信息
- **SSH2**: 远程服务器连接和操作
- **Child Process**: 执行Git、Maven、NPM等命令
- **Crypto**: 敏感信息加密存储

### 支持的构建工具
- **Maven**: SpringBoot项目构建
- **Gradle**: SpringBoot项目构建
- **NPM**: Vue3项目构建

## 环境要求

### 系统要求
- 操作系统: Windows, macOS, Linux
- Node.js: 版本 20.14+ (推荐 20.19+)
- Git: 用于代码拉取和分支管理

### 构建工具 (可选安装)
- **Maven**: 用于SpringBoot项目构建
- **Gradle**: 用于SpringBoot项目构建
- **NPM**: 用于Vue3项目构建 (Node.js自带)

## 安装和启动

### 1. 克隆项目
```bash
git clone [项目地址]
cd deploy-tools
```

### 2. 安装依赖
```bash
# 安装根目录依赖
npm install

# 安装后端依赖
cd backend && npm install

# 安装前端依赖
cd ../frontend && npm install
```

### 3. 初始化数据库
```bash
cd backend
npm run init-db
```

### 4. 启动服务

#### 开发环境 (同时启动前后端)
```bash
npm run dev
```

#### 生产环境
```bash
# 构建前端
npm run build

# 启动后端服务
npm start
```

### 5. 访问应用
- 应用地址: http://localhost:3001
- API接口: http://localhost:3001/api
- 健康检查: http://localhost:3001/api/health

## 核心功能详解

### 1. 项目路径配置

#### 后端项目配置
- 支持Maven和Gradle构建的SpringBoot项目
- 自动检测项目类型 (通过pom.xml或build.gradle文件)
- 验证项目结构的有效性
- 支持路径历史记录

#### 前端项目配置  
- 支持Vue3项目 (通过package.json中的vue@3.x依赖检测)
- 自动验证项目类型和版本
- 支持NPM构建系统

#### 配置管理
- 所有项目配置自动保存到SQLite数据库
- 支持配置的增删改查
- 提供项目路径有效性校验

### 2. Git分支管理

#### 分支操作
- 自动获取远程分支列表 (`git fetch && git branch -r`)
- 支持手动输入分支名称
- 分支有效性验证
- 当前分支查询
- 工作区状态检查

#### 代码同步
- 支持分支切换 (`git checkout`)
- 代码拉取 (`git pull`)
- 未提交更改检测和警告

### 3. 编译打包

#### 后端打包
- **Maven**: `mvn clean package -Dmaven.test.skip=true`
- **Gradle**: `./gradlew clean build -x test` 或 `gradle clean build -x test`
- 自动定位JAR包 (target/或build/libs/目录)
- 跳过测试用例，提高构建效率

#### 前端打包
- 依赖安装: `npm install` (可选，检测node_modules目录)
- 项目构建: `npm run build`
- 自动定位dist目录
- 支持增量构建

#### 构建监控
- 实时日志输出
- 构建进度跟踪
- 错误信息高亮显示
- 构建时间统计

### 4. 远程服务器管理

#### 服务器配置
- IP地址和SSH端口配置
- 支持密码和私钥两种认证方式
- 上传路径配置 (后端JAR包路径、前端dist路径)
- 重启脚本路径配置
- Nginx重载开关

#### 连接管理
- SSH连接池管理
- 连接有效性检测
- 自动重连机制
- 连接超时处理

#### 安全特性
- 密码加密存储 (AES-192)
- 私钥文件路径验证
- 连接测试功能

### 5. 文件上传与备份

#### 后端部署
- JAR包自动备份 (`app.jar` → `app.jar.bak.时间戳`)
- 远程路径自动创建
- 上传进度监控
- 上传失败重试

#### 前端部署
- dist目录增量上传
- 旧版本自动备份 (`dist` → `dist.bak.时间戳`)
- 文件过滤 (排除.git, node_modules等)
- 并发上传控制

#### 备份策略
- 时间戳命名: `.bak.YYYY-MM-DDTHH-mm-ss`
- 自动备份清理 (保留最近N个版本)
- 回滚支持 (手动恢复备份文件)

### 6. 服务重启与重载

#### 后端服务重启
- 自定义重启脚本执行
- 脚本输出实时监控
- 进程状态检查
- 启动失败告警

#### 前端服务重载
- Nginx配置测试 (`nginx -t`)
- 优雅重载 (`nginx -s reload`)
- 权限检查和错误处理

### 7. 数据库设计

#### 表结构
```sql
-- 项目配置表
CREATE TABLE project_config (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_type TEXT NOT NULL CHECK(project_type IN ('backend', 'frontend')),
  project_name TEXT NOT NULL,
  project_path TEXT NOT NULL,
  git_branch TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 服务器配置表  
CREATE TABLE server_config (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  config_name TEXT NOT NULL UNIQUE,
  server_ip TEXT NOT NULL,
  ssh_port INTEGER DEFAULT 22,
  username TEXT NOT NULL,
  password TEXT,                    -- 加密存储
  private_key_path TEXT,
  backend_upload_path TEXT,
  frontend_upload_path TEXT,
  restart_script_path TEXT,
  nginx_reload BOOLEAN DEFAULT 0,
  is_default BOOLEAN DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 部署记录表
CREATE TABLE deploy_record (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_config_id INTEGER,
  server_config_id INTEGER,
  deploy_type TEXT CHECK(deploy_type IN ('backend', 'frontend', 'both')),
  build_result TEXT CHECK(build_result IN ('success', 'failed', 'skipped')),
  upload_result TEXT CHECK(upload_result IN ('success', 'failed', 'skipped')),
  restart_result TEXT CHECK(restart_result IN ('success', 'failed', 'skipped')),
  deploy_time DATETIME DEFAULT CURRENT_TIMESTAMP,
  log_content TEXT,
  error_message TEXT,
  FOREIGN KEY (project_config_id) REFERENCES project_config (id),
  FOREIGN KEY (server_config_id) REFERENCES server_config (id)
);
```

## API接口文档

### 项目配置接口
- `GET /api/projects` - 获取所有项目配置
- `GET /api/projects/type/:type` - 按类型获取项目配置
- `POST /api/projects/validate` - 验证项目路径
- `POST /api/projects` - 创建项目配置
- `PUT /api/projects/:id` - 更新项目配置
- `DELETE /api/projects/:id` - 删除项目配置

### 服务器配置接口
- `GET /api/servers` - 获取所有服务器配置
- `POST /api/servers/test` - 测试服务器连接
- `POST /api/servers` - 创建服务器配置
- `PUT /api/servers/:id` - 更新服务器配置
- `DELETE /api/servers/:id` - 删除服务器配置

### Git操作接口
- `GET /api/git/branches/remote/:projectId` - 获取远程分支
- `GET /api/git/status/:projectId` - 获取工作区状态
- `POST /api/git/checkout/:projectId` - 切换分支
- `POST /api/git/pull/:projectId` - 拉取代码

### 构建接口
- `GET /api/build/tools` - 检查构建工具
- `POST /api/build/start/:projectId` - 开始构建
- `POST /api/build/stop/:buildId` - 停止构建
- `GET /api/build/artifacts/:projectId` - 获取构建产物

### 部署接口
- `POST /api/deploy/execute` - 执行部署
- `GET /api/deploy/status/:deployId` - 获取部署状态

### 历史记录接口
- `GET /api/history` - 获取部署历史
- `GET /api/history/stats/summary` - 获取部署统计

## 使用流程

### 1. 首次配置

#### 1.1 添加项目配置
1. 打开应用，进入"项目配置"页面
2. 点击"添加项目"按钮
3. 选择项目类型 (backend/frontend)
4. 输入项目名称和项目路径
5. 系统自动验证项目类型和Git状态
6. 保存配置

#### 1.2 配置服务器
1. 进入"服务器配置"页面
2. 点击"添加服务器"按钮
3. 填写服务器信息:
   - 配置名称 (如"测试环境")
   - 服务器IP和SSH端口
   - 用户名和认证方式 (密码/私钥)
   - 上传路径配置
   - 重启脚本路径
4. 点击"测试连接"验证配置
5. 保存配置

### 2. 执行部署

#### 2.1 选择部署项目
1. 进入"部署执行"页面
2. 选择要部署的项目
3. 选择目标服务器
4. 选择部署类型 (后端/前端/全部)

#### 2.2 配置部署选项
- Git分支选择
- 是否跳过构建
- 是否强制重新安装依赖
- 备份设置

#### 2.3 执行部署
1. 点击"开始部署"
2. 实时查看部署日志
3. 监控部署进度
4. 部署完成后查看结果

### 3. 监控与管理

#### 3.1 查看部署历史
- 在"部署历史"页面查看所有部署记录
- 按项目或服务器筛选记录
- 查看详细的部署日志
- 分析部署统计信息

#### 3.2 配置管理
- 编辑项目和服务器配置
- 管理默认配置
- 清理无效配置
- 导出/导入配置

## 故障排除

### 常见问题

#### 1. 构建工具未找到
**问题**: 提示"未检测到Maven/Gradle"
**解决**: 
- 确保已安装相应构建工具
- 检查环境变量PATH配置
- 重启命令行窗口

#### 2. SSH连接失败
**问题**: 无法连接到远程服务器
**解决**:
- 检查服务器IP和端口
- 验证用户名和密码/私钥
- 确认网络连通性
- 检查SSH服务状态

#### 3. 构建失败
**问题**: 项目构建过程出错
**解决**:
- 检查项目代码完整性
- 确认依赖项可用性
- 查看详细构建日志
- 手动执行构建命令验证

#### 4. 文件上传失败
**问题**: 无法上传到远程服务器
**解决**:
- 检查远程路径权限
- 确认磁盘空间充足
- 验证网络稳定性
- 检查SSH连接状态

### 日志分析

#### 后端日志位置
- 应用日志: 控制台输出
- 数据库文件: `backend/src/database/deploy_tools.db`
- 构建日志: 实时输出到WebSocket

#### 前端日志位置
- 浏览器控制台
- 网络请求日志
- 构建过程日志

## 性能优化

### 构建优化
- 启用构建缓存
- 跳过不必要的测试
- 使用增量构建
- 并行化构建任务

### 上传优化
- 启用增量上传
- 调整并发连接数
- 压缩传输数据
- 使用断点续传

### 数据库优化
- 定期清理旧记录
- 建立必要索引
- 优化查询语句
- 备份重要数据

## 扩展开发

### 添加新的构建工具
1. 在`BuildService`中添加检测逻辑
2. 实现相应的构建命令
3. 更新项目类型验证
4. 添加相关测试用例

### 添加新的部署平台
1. 创建新的连接服务类
2. 实现文件上传接口
3. 添加服务重启逻辑
4. 更新服务器配置表结构

### 自定义部署流程
1. 修改`deployController`逻辑
2. 添加自定义步骤配置
3. 实现步骤间依赖管理
4. 提供流程模板功能

## 安全注意事项

### 敏感信息保护
- 密码采用AES加密存储
- 私钥文件路径验证
- API接口访问控制
- 操作日志记录

### 网络安全
- SSH连接加密传输
- 超时时间控制
- 连接池大小限制
- 失败重试机制

### 系统安全
- 文件路径验证
- 命令注入防护
- 权限最小化原则
- 定期安全更新

## 更新日志

### v1.0.0 (当前版本)
- 基础项目和服务器配置管理
- Git分支操作和代码同步
- Maven/Gradle/NPM构建支持
- SSH文件上传和服务重启
- SQLite数据持久化
- 部署历史记录和统计
- 基础Web界面

### 未来版本计划
- Docker容器化部署
- 多环境配置管理
- 自定义部署脚本
- 通知和告警系统
- 性能监控和分析
- 集群部署支持

---

## 联系支持

如果您在使用过程中遇到问题或有改进建议，请通过以下方式联系:

- 提交Issue到项目仓库
- 发送邮件到技术支持
- 查看在线文档和FAQ

感谢您使用自动化部署工具！