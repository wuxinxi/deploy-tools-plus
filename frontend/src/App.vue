<template>
  <div id="app">
    <el-container direction="vertical">
      <!-- 头部 -->
      <el-header class="header">
        <div class="logo">
          <el-icon class="logo-icon"><Ship /></el-icon>
          <span class="logo-text">自动化部署工具</span>
        </div>
        <div class="header-actions">
          <el-button type="primary" :icon="Plus" @click="showCreateDialog = true">
            新建部署
          </el-button>
          <el-button :icon="Setting" @click="showSettingsDialog = true">
            设置
          </el-button>
        </div>
      </el-header>

      <el-container>
        <!-- 侧边栏 -->
        <el-aside width="250px" class="sidebar">
          <el-menu
            :default-active="activeMenu"
            class="sidebar-menu"
            @select="handleMenuSelect"
          >
            <el-menu-item index="dashboard">
              <el-icon><Monitor /></el-icon>
              <span>仪表盘</span>
            </el-menu-item>
            <el-menu-item index="projects">
              <el-icon><Folder /></el-icon>
              <span>项目配置</span>
            </el-menu-item>
            <el-menu-item index="servers">
              <el-icon><Server /></el-icon>
              <span>服务器配置</span>
            </el-menu-item>
            <el-menu-item index="deploy">
              <el-icon><Upload /></el-icon>
              <span>部署执行</span>
            </el-menu-item>
            <el-menu-item index="history">
              <el-icon><Document /></el-icon>
              <span>部署历史</span>
            </el-menu-item>
          </el-menu>
        </el-aside>

        <!-- 主内容区域 -->
        <el-main class="main-content">
          <!-- 仪表盘 -->
          <div v-if="activeMenu === 'dashboard'" class="dashboard">
            <h2>欢迎使用自动化部署工具</h2>
            <el-row :gutter="20">
              <el-col :span="6">
                <el-card class="stat-card">
                  <div class="stat-number">{{ stats.totalProjects }}</div>
                  <div class="stat-label">项目数量</div>
                </el-card>
              </el-col>
              <el-col :span="6">
                <el-card class="stat-card">
                  <div class="stat-number">{{ stats.totalServers }}</div>
                  <div class="stat-label">服务器数量</div>
                </el-card>
              </el-col>
              <el-col :span="6">
                <el-card class="stat-card">
                  <div class="stat-number">{{ stats.totalDeploys }}</div>
                  <div class="stat-label">部署次数</div>
                </el-card>
              </el-col>
              <el-col :span="6">
                <el-card class="stat-card">
                  <div class="stat-number">{{ stats.successRate }}%</div>
                  <div class="stat-label">成功率</div>
                </el-card>
              </el-col>
            </el-row>
            
            <div class="quick-actions">
              <h3>快速操作</h3>
              <el-button-group>
                <el-button type="primary" :icon="Plus" @click="activeMenu = 'projects'">
                  添加项目
                </el-button>
                <el-button type="success" :icon="Platform" @click="activeMenu = 'servers'">
                  配置服务器
                </el-button>
                <el-button type="warning" :icon="Upload" @click="activeMenu = 'deploy'">
                  开始部署
                </el-button>
              </el-button-group>
            </div>

            <!-- 最近部署记录 -->
            <el-card class="recent-deploys">
              <template #header>
                <div class="card-header">
                  <span>最近部署</span>
                  <el-button text @click="activeMenu = 'history'">
                    查看全部
                  </el-button>
                </div>
              </template>
              <el-table :data="recentDeploys" stripe>
                <el-table-column prop="project_name" label="项目" width="150" />
                <el-table-column prop="server_name" label="服务器" width="150" />
                <el-table-column prop="deploy_type" label="类型" width="80" />
                <el-table-column prop="deploy_time" label="时间" width="160" />
                <el-table-column label="状态" width="80">
                  <template #default="{ row }">
                    <el-tag :type="getDeployStatusType(row)">
                      {{ getDeployStatusText(row) }}
                    </el-tag>
                  </template>
                </el-table-column>
              </el-table>
            </el-card>
          </div>

          <!-- 项目配置页面 -->
          <ProjectConfig v-else-if="activeMenu === 'projects'" />

          <!-- 服务器配置页面 -->
          <ServerConfig v-else-if="activeMenu === 'servers'" />

          <!-- 部署执行页面 -->
          <DeployExecute v-else-if="activeMenu === 'deploy'" @navigate="handleMenuSelect" />

          <!-- 部署历史页面 -->
          <DeployHistory v-else-if="activeMenu === 'history'" @repeat-deploy="handleRepeatDeploy" />

          <!-- 其他页面内容 -->
          <div v-else class="page-content">
            <h2>{{ getPageTitle() }}</h2>
            <p>该功能正在开发中...</p>
          </div>
        </el-main>
      </el-container>
    </el-container>

    <!-- 新建部署对话框 -->
    <el-dialog v-model="showCreateDialog" title="新建部署" width="600px">
      <p>部署向导将帮助您完成部署设置...</p>
      <template #footer>
        <el-button @click="showCreateDialog = false">取消</el-button>
        <el-button type="primary">开始</el-button>
      </template>
    </el-dialog>

    <!-- 设置对话框 -->
    <el-dialog v-model="showSettingsDialog" title="系统设置" width="500px">
      <div class="system-info">
        <h4>系统信息</h4>
        <p><strong>平台:</strong> {{ systemInfo.platform }}</p>
        <p><strong>Node.js 版本:</strong> {{ systemInfo.nodeVersion }}</p>
        <p><strong>数据库路径:</strong> {{ systemInfo.databasePath }}</p>
        
        <h4>构建工具</h4>
        <p><strong>Maven:</strong> {{ systemInfo.buildTools?.maven ? '✓ 已安装' : '✗ 未安装' }}</p>
        <p><strong>Gradle:</strong> {{ systemInfo.buildTools?.gradle ? '✓ 已安装' : '✗ 未安装' }}</p>
        <p><strong>NPM:</strong> {{ systemInfo.buildTools?.npm ? '✓ 已安装' : '✗ 未安装' }}</p>
      </div>
      <template #footer>
        <el-button @click="showSettingsDialog = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import {
  Document,
  Folder,
  Monitor,
  Platform,
  Plus,
  Setting,
  Ship,
  Upload
} from '@element-plus/icons-vue'
import axios from 'axios'
import { onMounted, ref } from 'vue'
import DeployExecute from './components/DeployExecute.vue'
import DeployHistory from './components/DeployHistory.vue'
import ProjectConfig from './components/ProjectConfig.vue'
import ServerConfig from './components/ServerConfig.vue'

const activeMenu = ref('dashboard')
const showCreateDialog = ref(false)
const showSettingsDialog = ref(false)

const stats = ref({
  totalProjects: 0,
  totalServers: 0,
  totalDeploys: 0,
  successRate: 0
})

const systemInfo = ref({
  platform: '',
  nodeVersion: '',
  databasePath: '',
  buildTools: {}
})

const recentDeploys = ref([])

const handleMenuSelect = (index) => {
  activeMenu.value = index
}

const handleRepeatDeploy = (deployRecord) => {
  // 切换到部署页面并传递部署记录
  activeMenu.value = 'deploy'
  // 这里可以通过事件或状态管理传递数据
  console.log('重新部署:', deployRecord)
}

const getPageTitle = () => {
  const titles = {
    'projects': '项目配置',
    'servers': '服务器配置',
    'deploy': '部署执行',
    'history': '部署历史'
  }
  return titles[activeMenu.value] || '仪表盘'
}

const loadSystemInfo = async () => {
  try {
    const response = await axios.get('/api/system/info')
    if (response.data.success) {
      systemInfo.value = response.data.data
    }
  } catch (error) {
    console.error('获取系统信息失败:', error)
  }
}

const loadStats = async () => {
  try {
    // 这里可以加载真实统计数据
    // 现在使用模拟数据
    stats.value = {
      totalProjects: 5,
      totalServers: 3,
      totalDeploys: 28,
      successRate: 96
    }
  } catch (error) {
    console.error('获取统计数据失败:', error)
  }
}

const loadRecentDeploys = async () => {
  try {
    const response = await axios.get('/api/history?limit=5&offset=0')
    if (response.data.success) {
      recentDeploys.value = response.data.data
    }
  } catch (error) {
    console.error('获取最近部署记录失败:', error)
  }
}

const getStatusType = (status) => {
  switch (status) {
    case '成功':
      return 'success'
    case '失败':
      return 'danger'
    case '进行中':
      return 'warning'
    default:
      return ''
  }
}

const getDeployStatusType = (record) => {
  // 根据部署结果计算状态
  if (record.error_message) {
    return 'danger'
  }
  
  const results = [record.build_result, record.upload_result, record.restart_result]
  if (results.includes('failed')) {
    return 'danger'
  }
  
  if (results.includes('success')) {
    return 'success'
  }
  
  return 'info'
}

const getDeployStatusText = (record) => {
  // 根据部署结果计算状态文本
  if (record.error_message) {
    return '失败'
  }
  
  const results = [record.build_result, record.upload_result, record.restart_result]
  if (results.includes('failed')) {
    return '失败'
  }
  
  if (results.every(r => r === 'skipped')) {
    return '已跳过'
  }
  
  if (results.includes('success')) {
    return '成功'
  }
  
  return '未知'
}

onMounted(() => {
  loadSystemInfo()
  loadStats()
  loadRecentDeploys()
})
</script>

<style scoped>
#app {
  height: 100vh;
  margin: 0;
  padding: 0;
}

.el-container {
  height: 100%;
}

.header {
  background: #409eff;
  color: white;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 20px;
  height: 60px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.logo {
  display: flex;
  align-items: center;
  font-size: 20px;
  font-weight: bold;
}

.logo-icon {
  margin-right: 10px;
  font-size: 24px;
}

.logo-text {
  color: white;
}

.header-actions {
  display: flex;
  gap: 10px;
}

.sidebar {
  background: #f5f7fa;
  border-right: 1px solid #e4e7ed;
  height: calc(100vh - 60px);
  overflow-y: auto;
}

.sidebar-menu {
  border: none;
  background: transparent;
  width: 100%;
}

.sidebar-menu .el-menu-item {
  height: 50px;
  line-height: 50px;
}

.sidebar-menu .el-menu-item.is-active {
  background-color: #ecf5ff;
  color: #409eff;
}

.main-content {
  background: #f0f2f5;
  padding: 20px;
  height: calc(100vh - 60px);
  overflow-y: auto;
}

.dashboard {
  max-width: 1200px;
  margin: 0 auto;
}

.dashboard h2 {
  margin-bottom: 30px;
  color: #303133;
  font-size: 24px;
  font-weight: 600;
}

.stat-card {
  text-align: center;
  margin-bottom: 20px;
  border-radius: 8px;
  transition: all 0.3s;
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
}

.stat-number {
  font-size: 36px;
  font-weight: bold;
  color: #409eff;
  margin-bottom: 10px;
  line-height: 1;
}

.stat-label {
  color: #909399;
  font-size: 14px;
  font-weight: 500;
}

.quick-actions {
  margin: 40px 0;
  background: white;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.quick-actions h3 {
  margin-bottom: 20px;
  color: #303133;
  font-size: 18px;
  font-weight: 600;
}

.recent-deploys {
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 600;
  color: #303133;
}

.page-content {
  text-align: center;
  padding: 60px 20px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.page-content h2 {
  color: #303133;
  margin-bottom: 20px;
}

.page-content p {
  color: #909399;
  font-size: 16px;
}

.system-info p {
  margin: 8px 0;
  color: #606266;
}

.system-info h4 {
  margin: 20px 0 10px 0;
  color: #409eff;
  font-size: 16px;
  font-weight: 600;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .sidebar {
    width: 200px !important;
  }
  
  .stat-card {
    margin-bottom: 15px;
  }
  
  .main-content {
    padding: 15px;
  }
  
  .dashboard h2 {
    font-size: 20px;
  }
}

/* 全局重置 */
* {
  box-sizing: border-box;
}

body {
  margin: 0;
  padding: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}

/* Element Plus 样式覆盖 */
:deep(.el-card__body) {
  padding: 20px;
}

:deep(.el-table) {
  font-size: 14px;
}

:deep(.el-button-group .el-button) {
  margin-left: 0;
}
</style>
