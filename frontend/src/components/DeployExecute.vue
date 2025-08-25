<template>
  <div class="deploy-execute">
    <div class="deploy-header">
      <h2>部署执行</h2>
      <el-button 
        type="primary" 
        :icon="Refresh" 
        @click="refreshData"
        :loading="loading"
      >
        刷新
      </el-button>
    </div>

    <!-- 部署配置选择 -->
    <el-card class="deploy-config">
      <template #header>
        <div class="card-header">
          <span>部署配置</span>
          <el-button 
            type="success" 
            :icon="VideoPlay" 
            @click="startDeploy"
            :disabled="!canDeploy"
            :loading="deploying"
          >
            开始部署
          </el-button>
        </div>
      </template>

      <el-form 
        ref="deployFormRef"
        :model="deployForm" 
        :rules="deployRules"
        label-width="120px"
      >
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="选择项目" prop="projectId">
              <el-select 
                v-model="deployForm.projectId" 
                placeholder="请选择项目"
                style="width: 100%"
                @change="onProjectChange"
              >
                <el-option
                  v-for="project in projects"
                  :key="project.id"
                  :label="`${project.project_name} (${project.project_type})`"
                  :value="project.id"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="选择服务器" prop="serverId">
              <el-select 
                v-model="deployForm.serverId" 
                placeholder="请选择服务器"
                style="width: 100%"
              >
                <el-option
                  v-for="server in servers"
                  :key="server.id"
                  :label="`${server.config_name} (${server.server_ip})`"
                  :value="server.id"
                />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="20" v-if="selectedProject">
          <el-col :span="12">
            <el-form-item label="Git分支" prop="gitBranch">
              <el-select 
                v-model="deployForm.gitBranch" 
                placeholder="请选择分支"
                style="width: 100%"
                :loading="loadingBranches"
              >
                <el-option
                  v-for="branch in branches"
                  :key="branch"
                  :label="branch"
                  :value="branch"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="部署类型" prop="deployType">
              <el-radio-group v-model="deployForm.deployType">
                <el-radio label="both">完整部署</el-radio>
                <el-radio label="backend">仅后端</el-radio>
                <el-radio label="frontend">仅前端</el-radio>
              </el-radio-group>
            </el-form-item>
          </el-col>
        </el-row>

        <!-- 构建命令选择行 -->
        <el-row :gutter="20" v-if="selectedProject && deployForm.options.includes('build')">
          <el-col :span="24">
            <el-form-item label="构建命令" prop="buildCommand">
              <div class="build-command-section">
                <el-select 
                  v-model="deployForm.buildCommand" 
                  placeholder="请选择构建命令"
                  style="width: 300px; margin-right: 12px"
                  :loading="loadingBuildScripts"
                  clearable
                >
                  <el-option
                    v-for="script in buildScripts"
                    :key="script.name"
                    :label="`${script.name} - ${script.command}`"
                    :value="script.name"
                  >
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                      <span>{{ script.name }}</span>
                      <span style="color: #999; font-size: 12px">{{ script.command }}</span>
                    </div>
                  </el-option>
                </el-select>
                <el-button 
                  type="primary" 
                  :icon="Refresh" 
                  @click="() => loadBuildScripts()"
                  :loading="loadingBuildScripts"
                  size="default"
                >
                  刷新脚本
                </el-button>
                <el-text v-if="deployForm.buildCommand" type="info" size="small" style="margin-left: 12px">
                  将执行: npm run {{ deployForm.buildCommand }}
                </el-text>
              </div>
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item label="部署选项">
          <el-checkbox-group v-model="deployForm.options">
            <el-checkbox label="backup">部署前备份</el-checkbox>
            <el-checkbox label="pull">拉取最新代码</el-checkbox>
            <el-checkbox label="build">重新构建</el-checkbox>
            <el-checkbox label="upload">上传文件</el-checkbox>
            <el-checkbox label="restart">重启服务</el-checkbox>
          </el-checkbox-group>
        </el-form-item>

        <el-form-item label="部署说明">
          <el-input
            v-model="deployForm.description"
            type="textarea"
            :rows="2"
            placeholder="请输入部署说明（可选）"
            maxlength="200"
            show-word-limit
          />
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 部署状态 -->
    <el-card class="deploy-status" v-if="currentDeploy">
      <template #header>
        <div class="card-header">
          <span>部署状态</span>
          <el-tag 
            :type="getDeployStatusType(currentDeploy.status)"
            size="large"
          >
            {{ currentDeploy.status }}
          </el-tag>
        </div>
      </template>

      <!-- 进度条 -->
      <el-steps 
        :active="currentStep" 
        :process-status="stepStatus"
        align-center
        class="deploy-steps"
      >
        <el-step title="代码拉取" :status="getStepStatus(0)" />
        <el-step title="项目构建" :status="getStepStatus(1)" />
        <el-step title="文件上传" :status="getStepStatus(2)" />
        <el-step title="服务重启" :status="getStepStatus(3)" />
      </el-steps>

      <!-- 部署信息 -->
      <div class="deploy-info">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="项目名称">
            {{ currentDeploy.projectName }}
          </el-descriptions-item>
          <el-descriptions-item label="部署类型">
            {{ currentDeploy.deployType }}
          </el-descriptions-item>
          <el-descriptions-item label="Git分支">
            {{ currentDeploy.gitBranch }}
          </el-descriptions-item>
          <el-descriptions-item label="目标服务器">
            {{ currentDeploy.serverName }}
          </el-descriptions-item>
          <el-descriptions-item label="开始时间">
            {{ formatTime(currentDeploy.startTime) }}
          </el-descriptions-item>
          <el-descriptions-item label="耗时">
            {{ getDuration(currentDeploy.startTime) }}
          </el-descriptions-item>
        </el-descriptions>
      </div>
    </el-card>

    <!-- 实时日志 -->
    <el-card class="deploy-logs" v-if="currentDeploy">
      <template #header>
        <div class="card-header">
          <span>部署日志</span>
          <div>
            <el-button 
              :icon="Download" 
              size="small" 
              @click="downloadLogs"
            >
              下载日志
            </el-button>
            <el-button 
              :icon="Delete" 
              size="small" 
              @click="clearLogs"
            >
              清空
            </el-button>
          </div>
        </div>
      </template>

      <div class="log-container" ref="logContainer">
        <pre class="log-content">{{ deployLogs }}</pre>
      </div>
    </el-card>

    <!-- 部署历史快速访问 -->
    <el-card class="recent-history">
      <template #header>
        <div class="card-header">
          <span>最近部署</span>
          <el-button text @click="$emit('navigate', 'history')">
            查看全部
          </el-button>
        </div>
      </template>

      <el-table :data="recentDeploys" stripe>
        <el-table-column prop="project_name" label="项目" width="150" />
        <el-table-column prop="deploy_type" label="类型" width="100" />
        <el-table-column prop="git_branch" label="分支" width="120" />
        <el-table-column prop="start_time" label="时间" width="160">
          <template #default="{ row }">
            {{ formatTime(row.start_time) }}
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)">{{ row.status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="120">
          <template #default="{ row }">
            <el-button size="small" @click="repeatDeploy(row)">
              重新部署
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import {
    Delete,
    Download,
    Refresh
} from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useProjectStore } from '../stores/projectStore'
import { useServerStore } from '../stores/serverStore'
import { deployApi, gitApi, historyApi } from '../utils/api'
import { formatDateTime } from '../utils/common'

// 发送事件
const emit = defineEmits(['navigate'])

// Store
const projectStore = useProjectStore()
const serverStore = useServerStore()

// 响应式数据
const loading = ref(false)
const deploying = ref(false)
const loadingBranches = ref(false)
const deployFormRef = ref()
const logContainer = ref()

const deployForm = ref({
  projectId: null,
  serverId: null,
  gitBranch: '',
  buildCommand: '',
  deployType: 'both',
  options: ['backup', 'pull', 'build', 'upload', 'restart'],
  description: ''
})

const deployRules = {
  projectId: [
    { required: true, message: '请选择项目', trigger: 'change' }
  ],
  serverId: [
    { required: true, message: '请选择服务器', trigger: 'change' }
  ],
  gitBranch: [
    { required: true, message: '请选择Git分支', trigger: 'change' }
  ],
  deployType: [
    { required: true, message: '请选择部署类型', trigger: 'change' }
  ]
}

const branches = ref([])
const buildScripts = ref([])
const loadingBuildScripts = ref(false)
const currentDeploy = ref(null)
const currentStep = ref(0)
const stepStatus = ref('process')
const deployLogs = ref('')
const recentDeploys = ref([])
const websocket = ref(null)

// 计算属性
const projects = computed(() => projectStore.projects)
const servers = computed(() => serverStore.servers)
const selectedProject = computed(() => 
  projects.value.find(p => p.id === deployForm.value.projectId)
)
const canDeploy = computed(() => 
  deployForm.value.projectId && 
  deployForm.value.serverId && 
  deployForm.value.gitBranch &&
  !deploying.value
)

// 方法
const refreshData = async () => {
  loading.value = true
  try {
    await Promise.all([
      projectStore.fetchProjects(),
      serverStore.fetchServers(),
      loadRecentDeploys()
    ])
  } catch (error) {
    ElMessage.error('刷新数据失败')
  } finally {
    loading.value = false
  }
}

const onProjectChange = async (projectId) => {
  if (!projectId) return
  
  loadingBranches.value = true
  deployForm.value.gitBranch = ''
  deployForm.value.buildCommand = ''
  branches.value = []
  buildScripts.value = []
  
  try {
    // 先加载分支，然后加载构建脚本
    const branchResponse = await gitApi.getRemoteBranches(projectId)
    
    console.log('获取分支响应:', branchResponse.data)
    
    if (branchResponse.data.success) {
      // 后端返回的数据结构是: { success: true, branches: [{name, fullName, displayName}, ...] }
      const branchList = branchResponse.data.branches || []
      branches.value = branchList.map(branch => branch.name || branch.displayName || branch)
      
      if (branches.value.length === 0) {
        ElMessage.warning({
          message: '未找到远程分支，可能原因：\n1. 项目未配置远程仓库\n2. 项目未提交代码\n3. 网络连接问题',
          duration: 5000,
          showClose: true
        })
      } else {
        // 选择默认分支
        if (branches.value.includes('main')) {
          deployForm.value.gitBranch = 'main'
        } else if (branches.value.includes('master')) {
          deployForm.value.gitBranch = 'master'
        } else if (branches.value.length > 0) {
          deployForm.value.gitBranch = branches.value[0]
        }
        
        ElMessage.success(`成功获取 ${branches.value.length} 个远程分支`)
      }
    } else {
      throw new Error(branchResponse.data.error || '获取分支列表失败')
    }
    
    // 分别加载构建脚本
    await loadBuildScripts(projectId)
    
  } catch (error) {
    console.error('获取分支列表错误:', error)
    const errorMessage = error.response?.data?.error || error.message || '获取分支列表失败'
    
    // 更详细的错误提示
    if (errorMessage.includes('项目路径不存在')) {
      ElMessage.error('项目路径不存在，请检查项目配置中的路径是否正确')
    } else if (errorMessage.includes('不是Git仓库')) {
      ElMessage.error('所选项目不是Git仓库，请选择正确的Git项目')
    } else if (errorMessage.includes('获取远程分支失败')) {
      ElMessage.error({
        message: `获取远程分支失败：${errorMessage}\n\n可能的解决方案：\n1. 确保项目已配置远程仓库\n2. 确保网络连接正常\n3. 检查Git仓库访问权限`,
        duration: 8000,
        showClose: true
      })
    } else {
      ElMessage.error(`获取分支失败：${errorMessage}`)
    }
  } finally {
    loadingBranches.value = false
  }
}

// 加载构建脚本列表
const loadBuildScripts = async (projectId = deployForm.value.projectId) => {
  if (!projectId) return
  
  loadingBuildScripts.value = true
  
  try {
    const response = await fetch(`http://localhost:3001/api/projects/${projectId}/build-scripts`)
    const data = await response.json()
    
    if (data.success) {
      buildScripts.value = data.data.scripts || []
      
      // 自动选择默认构建命令
      if (buildScripts.value.length > 0 && !deployForm.value.buildCommand) {
        // 优先选择build:prod，其次是build
        const prodScript = buildScripts.value.find(script => script.name === 'build:prod')
        const buildScript = buildScripts.value.find(script => script.name === 'build')
        
        if (prodScript) {
          deployForm.value.buildCommand = prodScript.name
        } else if (buildScript) {
          deployForm.value.buildCommand = buildScript.name
        } else {
          deployForm.value.buildCommand = buildScripts.value[0].name
        }
      }
      
      ElMessage.success(`成功获取 ${buildScripts.value.length} 个构建脚本`)
    } else {
      ElMessage.warning(data.error || '获取构建脚本失败')
      buildScripts.value = []
    }
  } catch (error) {
    console.error('获取构建脚本错误:', error)
    ElMessage.error('获取构建脚本失败')
    buildScripts.value = []
  } finally {
    loadingBuildScripts.value = false
  }
}

const startDeploy = async () => {
  if (!deployFormRef.value) return
  
  try {
    await deployFormRef.value.validate()
  } catch {
    return
  }

  try {
    await ElMessageBox.confirm(
      '确定要开始部署吗？部署过程中请勿关闭页面。',
      '确认部署',
      {
        confirmButtonText: '开始部署',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
  } catch {
    return
  }

  deploying.value = true
  currentStep.value = 0
  stepStatus.value = 'process'
  deployLogs.value = ''

  try {
    // 准备部署数据
    const deployData = {
      project_config_id: deployForm.value.projectId,
      server_config_id: deployForm.value.serverId,
      git_branch: deployForm.value.gitBranch,
      deploy_type: deployForm.value.deployType,
      build_command: deployForm.value.buildCommand, // 添加构建命令参数
      options: {
        backup: deployForm.value.options.includes('backup'),
        pull: deployForm.value.options.includes('pull'),
        build: deployForm.value.options.includes('build'),
        upload: deployForm.value.options.includes('upload'),
        restart: deployForm.value.options.includes('restart')
      },
      description: deployForm.value.description
    }

    const response = await deployApi.execute(deployData)
    
    if (response.data.success) {
      currentDeploy.value = {
        id: response.data.data.deployId,
        projectName: selectedProject.value?.project_name,
        deployType: deployForm.value.deployType,
        gitBranch: deployForm.value.gitBranch,
        serverName: servers.value.find(s => s.id === deployForm.value.serverId)?.config_name,
        startTime: new Date(),
        status: '进行中'
      }

      // 建立WebSocket连接接收实时日志
      connectWebSocket(response.data.data.deployId)
      
      ElMessage.success('部署已开始')
    } else {
      throw new Error(response.data.error)
    }
  } catch (error) {
    ElMessage.error('启动部署失败: ' + error.message)
    deploying.value = false
    stepStatus.value = 'error'
  }
}

const connectWebSocket = (deployId) => {
  const wsUrl = `ws://localhost:3001/ws/deploy/${deployId}`
  websocket.value = new WebSocket(wsUrl)

  websocket.value.onopen = () => {
    console.log('WebSocket连接已建立')
  }

  websocket.value.onmessage = (event) => {
    const data = JSON.parse(event.data)
    
    if (data.type === 'log') {
      deployLogs.value += data.message + '\n'
      scrollToBottom()
    } else if (data.type === 'step') {
      currentStep.value = data.step
      if (data.status === 'error') {
        stepStatus.value = 'error'
      }
    } else if (data.type === 'complete') {
      deploying.value = false
      currentDeploy.value.status = data.status
      stepStatus.value = data.status === '成功' ? 'finish' : 'error'
      
      if (data.status === '成功') {
        ElMessage.success('部署成功！')
        currentStep.value = 4
      } else {
        ElMessage.error('部署失败！')
      }
      
      loadRecentDeploys()
      websocket.value.close()
    }
  }

  websocket.value.onerror = (error) => {
    console.error('WebSocket错误:', error)
    ElMessage.error('实时日志连接失败')
  }

  websocket.value.onclose = () => {
    console.log('WebSocket连接已关闭')
  }
}

const scrollToBottom = () => {
  nextTick(() => {
    if (logContainer.value) {
      logContainer.value.scrollTop = logContainer.value.scrollHeight
    }
  })
}

const loadRecentDeploys = async () => {
  try {
    const response = await historyApi.getAll(5, 0)
    if (response.data.success) {
      recentDeploys.value = response.data.data
    }
  } catch (error) {
    console.error('获取最近部署记录失败:', error)
  }
}

const repeatDeploy = (deploy) => {
  // 重置表单为历史记录的配置
  deployForm.value = {
    projectId: deploy.project_config_id,
    serverId: deploy.server_config_id,
    gitBranch: deploy.git_branch,
    deployType: deploy.deploy_type,
    options: ['backup', 'pull', 'build', 'upload', 'restart'],
    description: `重新部署 - ${deploy.description || ''}`
  }
  
  // 重新加载分支信息
  if (deploy.project_config_id) {
    onProjectChange(deploy.project_config_id)
  }
}

const downloadLogs = () => {
  if (!deployLogs.value) {
    ElMessage.warning('暂无日志内容')
    return
  }

  const blob = new Blob([deployLogs.value], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `deploy-logs-${new Date().getTime()}.txt`
  a.click()
  URL.revokeObjectURL(url)
}

const clearLogs = () => {
  deployLogs.value = ''
}

const getStepStatus = (step) => {
  if (currentStep.value > step) {
    return stepStatus.value === 'error' && currentStep.value === step + 1 ? 'error' : 'finish'
  } else if (currentStep.value === step) {
    return stepStatus.value
  } else {
    return 'wait'
  }
}

const getDeployStatusType = (status) => {
  switch (status) {
    case '进行中':
      return 'warning'
    case '成功':
      return 'success'
    case '失败':
      return 'danger'
    default:
      return ''
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

const formatTime = (time) => {
  if (!time) return ''
  return formatDateTime(new Date(time))
}

const getDuration = (startTime) => {
  if (!startTime) return ''
  const duration = Date.now() - new Date(startTime).getTime()
  const seconds = Math.floor(duration / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  
  if (hours > 0) {
    return `${hours}时${minutes % 60}分${seconds % 60}秒`
  } else if (minutes > 0) {
    return `${minutes}分${seconds % 60}秒`
  } else {
    return `${seconds}秒`
  }
}

// 生命周期
onMounted(() => {
  refreshData()
})

onUnmounted(() => {
  if (websocket.value) {
    websocket.value.close()
  }
})

// 监听表单变化
watch(() => deployForm.value.deployType, (newType) => {
  // 根据部署类型调整默认选项
  if (newType === 'code-only') {
    deployForm.value.options = ['pull', 'build', 'upload']
  } else if (newType === 'restart-only') {
    deployForm.value.options = ['restart']
  } else {
    deployForm.value.options = ['backup', 'pull', 'build', 'upload', 'restart']
  }
})
</script>

<style scoped>
.deploy-execute {
  padding: 20px;
}

.deploy-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.deploy-header h2 {
  margin: 0;
  color: #333;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.deploy-config,
.deploy-status,
.deploy-logs,
.recent-history {
  margin-bottom: 20px;
}

.build-command-section {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.build-command-section .el-text {
  white-space: nowrap;
}

.deploy-steps {
  margin: 20px 0;
}

.deploy-info {
  margin-top: 20px;
}

.log-container {
  height: 300px;
  overflow-y: auto;
  background: #1e1e1e;
  border-radius: 4px;
  padding: 10px;
}

.log-content {
  color: #f0f0f0;
  font-family: 'Courier New', monospace;
  font-size: 12px;
  line-height: 1.4;
  margin: 0;
  white-space: pre-wrap;
  word-break: break-all;
}
</style>