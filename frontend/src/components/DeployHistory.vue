<template>
  <div class="deploy-history">
    <div class="history-header">
      <h2>部署历史</h2>
      <div class="header-actions">
        <el-button 
          :icon="Refresh" 
          @click="refreshHistory"
          :loading="loading"
        >
          刷新
        </el-button>
        <el-button 
          :icon="Download" 
          @click="exportHistory"
        >
          导出
        </el-button>
        <el-button 
          :icon="Delete" 
          type="danger" 
          @click="cleanupHistory"
        >
          清理
        </el-button>
      </div>
    </div>

    <!-- 统计卡片 -->
    <el-row :gutter="20" class="stats-cards">
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-number">{{ stats.totalDeploys }}</div>
          <div class="stat-label">总部署次数</div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-number">{{ stats.successfulDeploys }}</div>
          <div class="stat-label">成功次数</div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-number">{{ successRate }}%</div>
          <div class="stat-label">成功率</div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-number">{{ stats.avgDuration }}</div>
          <div class="stat-label">平均耗时</div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 筛选条件 -->
    <el-card class="filter-card">
      <el-form :inline="true" :model="filterForm" class="filter-form">
        <el-form-item label="项目">
          <el-select 
            v-model="filterForm.projectId" 
            placeholder="所有项目" 
            clearable
            style="width: 180px"
          >
            <el-option
              v-for="project in projects"
              :key="project.id"
              :label="project.project_name"
              :value="project.id"
            />
          </el-select>
        </el-form-item>
        
        <el-form-item label="服务器">
          <el-select 
            v-model="filterForm.serverId" 
            placeholder="所有服务器" 
            clearable
            style="width: 180px"
          >
            <el-option
              v-for="server in servers"
              :key="server.id"
              :label="server.config_name"
              :value="server.id"
            />
          </el-select>
        </el-form-item>
        
        <el-form-item label="状态">
          <el-select 
            v-model="filterForm.status" 
            placeholder="所有状态" 
            clearable
            style="width: 120px"
          >
            <el-option label="成功" value="成功" />
            <el-option label="失败" value="失败" />
            <el-option label="进行中" value="进行中" />
          </el-select>
        </el-form-item>
        
        <el-form-item label="部署类型">
          <el-select 
            v-model="filterForm.deployType" 
            placeholder="所有类型" 
            clearable
            style="width: 120px"
          >
            <el-option label="前端部署" value="frontend" />
            <el-option label="后端部署" value="backend" />
            <el-option label="仅代码" value="code-only" />
            <el-option label="仅重启" value="restart-only" />
          </el-select>
        </el-form-item>
        
        <el-form-item label="时间范围">
          <el-date-picker
            v-model="filterForm.dateRange"
            type="datetimerange"
            start-placeholder="开始时间"
            end-placeholder="结束时间"
            format="YYYY-MM-DD HH:mm:ss"
            value-format="YYYY-MM-DD HH:mm:ss"
            style="width: 350px"
          />
        </el-form-item>
        
        <el-form-item>
          <el-button type="primary" @click="applyFilter">查询</el-button>
          <el-button @click="resetFilter">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 部署记录表格 -->
    <el-card class="history-table">
      <el-table 
        :data="filteredHistory" 
        stripe 
        v-loading="loading"
        @selection-change="handleSelectionChange"
      >
        <el-table-column type="selection" width="55" />
        
        <el-table-column prop="id" label="ID" width="80" />
        
        <el-table-column prop="project_name" label="项目" width="150">
          <template #default="{ row }">
            <div>
              <strong>{{ row.project_name }}</strong>
              <div class="sub-text">{{ row.project_type }}</div>
            </div>
          </template>
        </el-table-column>
        
        <el-table-column prop="server_name" label="服务器" width="120">
          <template #default="{ row }">
            <div>
              <strong>{{ row.server_name }}</strong>
              <div class="sub-text">{{ row.server_ip }}</div>
            </div>
          </template>
        </el-table-column>
        
        <el-table-column prop="deploy_type" label="部署类型" width="100">
          <template #default="{ row }">
            <el-tag :type="getDeployTypeTag(row.deploy_type)">
              {{ getDeployTypeText(row.deploy_type) }}
            </el-tag>
          </template>
        </el-table-column>
        
        <el-table-column prop="git_branch" label="Git分支" width="120" />
        
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)">{{ row.status }}</el-tag>
          </template>
        </el-table-column>
        
        <el-table-column prop="start_time" label="开始时间" width="160">
          <template #default="{ row }">
            {{ formatTime(row.start_time) }}
          </template>
        </el-table-column>
        
        <el-table-column prop="end_time" label="结束时间" width="160">
          <template #default="{ row }">
            {{ formatTime(row.end_time) }}
          </template>
        </el-table-column>
        
        <el-table-column prop="duration" label="耗时" width="100">
          <template #default="{ row }">
            {{ getDuration(row.start_time, row.end_time) }}
          </template>
        </el-table-column>
        
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button 
              size="small" 
              @click="viewDetails(row)"
            >
              详情
            </el-button>
            <el-button 
              size="small" 
              type="primary" 
              @click="repeatDeploy(row)"
              :disabled="row.status === '进行中'"
            >
              重新部署
            </el-button>
            <el-button 
              size="small" 
              type="danger" 
              @click="deleteRecord(row)"
            >
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页 -->
      <div class="pagination">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.size"
          :page-sizes="[20, 50, 100, 200]"
          :total="pagination.total"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="handleSizeChange"
          @current-change="handleCurrentChange"
        />
      </div>
    </el-card>

    <!-- 部署详情对话框 -->
    <el-dialog 
      v-model="showDetailsDialog" 
      title="部署详情" 
      width="90%"
      destroy-on-close
      :close-on-click-modal="false"
    >
      <div v-if="selectedRecord">
        <!-- 基本信息 -->
        <el-card class="detail-card">
          <template #header>
            <div class="card-header">
              <h3>基本信息</h3>
              <el-tag :type="getStatusType(selectedRecord.status)" size="large">
                {{ selectedRecord.status }}
              </el-tag>
            </div>
          </template>
          
          <el-descriptions :column="3" border>
            <el-descriptions-item label="部署ID">
              <el-tag type="info">#{{ selectedRecord.id }}</el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="项目名称">
              <strong>{{ selectedRecord.project_name }}</strong>
            </el-descriptions-item>
            <el-descriptions-item label="项目类型">
              <el-tag :type="selectedRecord.project_type === 'frontend' ? 'success' : 'primary'">
                {{ selectedRecord.project_type }}
              </el-tag>
            </el-descriptions-item>
            
            <el-descriptions-item label="服务器">
              {{ selectedRecord.server_name }}
            </el-descriptions-item>
            <el-descriptions-item label="服务器IP">
              <el-tag type="warning">{{ selectedRecord.server_ip }}</el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="部署类型">
              <el-tag :type="getDeployTypeTag(selectedRecord.deploy_type)">
                {{ getDeployTypeText(selectedRecord.deploy_type) }}
              </el-tag>
            </el-descriptions-item>
            
            <el-descriptions-item label="Git分支">
              <el-tag type="info" v-if="selectedRecord.git_branch">
                <el-icon><Switch /></el-icon>
                {{ selectedRecord.git_branch }}
              </el-tag>
              <span v-else class="text-muted">未指定</span>
            </el-descriptions-item>
            <el-descriptions-item label="开始时间">
              <el-icon><Clock /></el-icon>
              {{ formatTime(selectedRecord.start_time) }}
            </el-descriptions-item>
            <el-descriptions-item label="结束时间">
              <el-icon><Clock /></el-icon>
              {{ formatTime(selectedRecord.end_time) || '进行中' }}
            </el-descriptions-item>
            
            <el-descriptions-item label="总耗时" :span="1">
              <el-tag type="success" v-if="selectedRecord.duration">
                <el-icon><Timer /></el-icon>
                {{ selectedRecord.duration }}
              </el-tag>
              <span v-else>计算中...</span>
            </el-descriptions-item>
            <el-descriptions-item label="部署说明" :span="2">
              {{ selectedRecord.description || '无' }}
            </el-descriptions-item>
          </el-descriptions>
        </el-card>

        <!-- 步骤详情 -->
        <el-card class="detail-card">
          <template #header>
            <h3>步骤详情</h3>
          </template>
          
          <el-table :data="selectedRecord.steps" border stripe>
            <el-table-column prop="step_name" label="步骤" width="150">
              <template #default="{ row }">
                <div class="step-name">
                  <el-icon v-if="row.status === '成功'" class="success-icon"><Check /></el-icon>
                  <el-icon v-else-if="row.status === '失败'" class="error-icon"><Close /></el-icon>
                  <el-icon v-else-if="row.status === '跳过'" class="warning-icon"><Minus /></el-icon>
                  <el-icon v-else class="info-icon"><Loading /></el-icon>
                  {{ row.step_name }}
                </div>
              </template>
            </el-table-column>
            <el-table-column prop="status" label="状态" width="100">
              <template #default="{ row }">
                <el-tag :type="getStepStatusType(row.status)">{{ row.status }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="start_time" label="开始时间" width="160">
              <template #default="{ row }">
                {{ formatTime(row.start_time) }}
              </template>
            </el-table-column>
            <el-table-column prop="end_time" label="结束时间" width="160">
              <template #default="{ row }">
                {{ formatTime(row.end_time) }}
              </template>
            </el-table-column>
            <el-table-column prop="duration" label="耗时" width="100">
              <template #default="{ row }">
                <el-tag size="small" type="info">{{ row.duration }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="error_message" label="结果信息">
              <template #default="{ row }">
                <span v-if="row.error_message" class="error-text">
                  <el-icon><Warning /></el-icon>
                  {{ row.error_message }}
                </span>
                <span v-else-if="row.status === '成功'" class="success-text">
                  <el-icon><Check /></el-icon>
                  执行成功
                </span>
                <span v-else-if="row.status === '跳过'" class="info-text">
                  <el-icon><Minus /></el-icon>
                  已跳过
                </span>
                <span v-else class="info-text">-</span>
              </template>
            </el-table-column>
          </el-table>
        </el-card>

        <!-- 部署日志 -->
        <el-card class="detail-card">
          <template #header>
            <div class="card-header">
              <h3>部署日志</h3>
              <div>
                <el-button 
                  size="small" 
                  @click="copyLogs"
                  v-if="selectedRecord.logs && selectedRecord.logs !== '暂无日志'"
                >
                  <el-icon><CopyDocument /></el-icon>
                  复制日志
                </el-button>
                <el-button 
                  type="primary" 
                  size="small" 
                  @click="downloadDetailLogs"
                  v-if="selectedRecord.logs && selectedRecord.logs !== '暂无日志'"
                >
                  <el-icon><Download /></el-icon>
                  下载日志
                </el-button>
              </div>
            </div>
          </template>
          
          <div class="log-container" v-if="selectedRecord.logs && selectedRecord.logs !== '暂无日志'">
            <pre class="log-content">{{ selectedRecord.logs }}</pre>
          </div>
          <el-empty 
            v-else 
            description="暂无部署日志" 
            :image-size="100"
          />
        </el-card>
      </div>

      <template #footer>
        <div class="dialog-footer">
          <el-button @click="showDetailsDialog = false">关闭</el-button>
          <el-button 
            type="primary" 
            @click="repeatDeploy(selectedRecord)"
            :disabled="selectedRecord?.status === '进行中'"
          >
            <el-icon><Refresh /></el-icon>
            重新部署
          </el-button>
        </div>
      </template>
    </el-dialog>

    <!-- 批量操作提示 -->
    <div class="batch-actions" v-if="selectedRecords.length > 0">
      <el-alert
        :title="`已选择 ${selectedRecords.length} 条记录`"
        type="info"
        :closable="false"
      >
        <template #default>
          <el-button size="small" @click="batchDelete">批量删除</el-button>
          <el-button size="small" @click="batchExport">批量导出</el-button>
        </template>
      </el-alert>
    </div>
  </div>
</template>

<script setup>
import {
    Check,
    Clock,
    Close,
    CopyDocument,
    Delete, Download,
    Loading,
    Minus,
    Refresh,
    Switch,
    Timer,
    Warning
} from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { computed, onMounted, ref } from 'vue'
import { useProjectStore } from '../stores/projectStore'
import { useServerStore } from '../stores/serverStore'
import { historyApi } from '../utils/api'
import { formatDateTime } from '../utils/common'

// 发送事件
const emit = defineEmits(['repeat-deploy'])

// Store
const projectStore = useProjectStore()
const serverStore = useServerStore()

// 响应式数据
const loading = ref(false)
const history = ref([])
const stats = ref({
  totalDeploys: 0,
  successfulDeploys: 0,
  avgDuration: '0分'
})

const filterForm = ref({
  projectId: null,
  serverId: null,
  status: '',
  deployType: '',
  dateRange: null
})

const pagination = ref({
  page: 1,
  size: 20,
  total: 0
})

const selectedRecords = ref([])
const showDetailsDialog = ref(false)
const selectedRecord = ref(null)

// 计算属性
const projects = computed(() => projectStore.projects)
const servers = computed(() => serverStore.servers)

const filteredHistory = computed(() => {
  let result = [...history.value]
  
  if (filterForm.value.projectId) {
    result = result.filter(item => item.project_config_id === filterForm.value.projectId)
  }
  
  if (filterForm.value.serverId) {
    result = result.filter(item => item.server_config_id === filterForm.value.serverId)
  }
  
  if (filterForm.value.status) {
    result = result.filter(item => item.status === filterForm.value.status)
  }
  
  if (filterForm.value.deployType) {
    result = result.filter(item => item.deploy_type === filterForm.value.deployType)
  }
  
  if (filterForm.value.dateRange && filterForm.value.dateRange.length === 2) {
    const [startDate, endDate] = filterForm.value.dateRange
    result = result.filter(item => {
      const itemDate = new Date(item.start_time)
      return itemDate >= new Date(startDate) && itemDate <= new Date(endDate)
    })
  }
  
  return result
})

const successRate = computed(() => {
  if (stats.value.totalDeploys === 0) return 0
  return Math.round((stats.value.successfulDeploys / stats.value.totalDeploys) * 100)
})

// 方法
const refreshHistory = async () => {
  loading.value = true
  try {
    await Promise.all([
      loadHistory(),
      loadStats(),
      projectStore.fetchProjects(),
      serverStore.fetchServers()
    ])
  } catch (error) {
    ElMessage.error('刷新数据失败')
  } finally {
    loading.value = false
  }
}

const loadHistory = async () => {
  try {
    const offset = (pagination.value.page - 1) * pagination.value.size
    const response = await historyApi.getAll(pagination.value.size, offset)
    
    if (response.data.success) {
      history.value = response.data.data
      pagination.value.total = response.data.pagination?.total || response.data.data.length
    }
  } catch (error) {
    console.error('获取部署历史失败:', error)
    throw error
  }
}

const loadStats = async () => {
  try {
    const response = await historyApi.getStats()
    if (response.data.success) {
      const summary = response.data.data.summary
      stats.value = {
        totalDeploys: summary.total_deploys || 0,
        successfulDeploys: summary.successful_builds || 0,
        avgDuration: '5分23秒' // 这里可以从API获取真实数据
      }
    }
  } catch (error) {
    console.error('获取统计数据失败:', error)
  }
}

const applyFilter = () => {
  pagination.value.page = 1
  // 过滤逻辑在计算属性中处理
}

const resetFilter = () => {
  filterForm.value = {
    projectId: null,
    serverId: null,
    status: '',
    deployType: '',
    dateRange: null
  }
  pagination.value.page = 1
}

const handleSizeChange = (size) => {
  pagination.value.size = size
  pagination.value.page = 1
  loadHistory()
}

const handleCurrentChange = (page) => {
  pagination.value.page = page
  loadHistory()
}

const handleSelectionChange = (selection) => {
  selectedRecords.value = selection
}

const viewDetails = async (record) => {
  try {
    const response = await historyApi.getById(record.id)
    if (response.data.success) {
      selectedRecord.value = response.data.data
      showDetailsDialog.value = true
    }
  } catch (error) {
    ElMessage.error('获取部署详情失败')
  }
}

const repeatDeploy = (record) => {
  emit('repeat-deploy', record)
}

const deleteRecord = async (record) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除部署记录 #${record.id} 吗？此操作不可恢复。`,
      '确认删除',
      {
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    await historyApi.delete(record.id)
    ElMessage.success('删除成功')
    refreshHistory()
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('删除失败')
    }
  }
}

const batchDelete = async () => {
  try {
    await ElMessageBox.confirm(
      `确定要删除选中的 ${selectedRecords.value.length} 条记录吗？此操作不可恢复。`,
      '批量删除',
      {
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    for (const record of selectedRecords.value) {
      await historyApi.delete(record.id)
    }
    
    ElMessage.success('批量删除成功')
    refreshHistory()
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('批量删除失败')
    }
  }
}

const exportHistory = () => {
  const csvContent = generateCSV(filteredHistory.value)
  downloadCSV(csvContent, `deploy-history-${new Date().getTime()}.csv`)
}

const batchExport = () => {
  const csvContent = generateCSV(selectedRecords.value)
  downloadCSV(csvContent, `deploy-history-selected-${new Date().getTime()}.csv`)
}

const generateCSV = (data) => {
  const headers = [
    'ID', '项目名称', '项目类型', '服务器名称', '服务器IP', 
    '部署类型', 'Git分支', '状态', '开始时间', '结束时间', '耗时', '部署说明'
  ]
  
  const rows = data.map(record => [
    record.id,
    record.project_name,
    record.project_type,
    record.server_name,
    record.server_ip,
    getDeployTypeText(record.deploy_type),
    record.git_branch,
    record.status,
    formatTime(record.start_time),
    formatTime(record.end_time),
    getDuration(record.start_time, record.end_time),
    record.description || ''
  ])

  return [headers, ...rows].map(row => 
    row.map(field => `"${field}"`).join(',')
  ).join('\n')
}

const downloadCSV = (content, filename) => {
  const blob = new Blob(['\ufeff' + content], { 
    type: 'text/csv;charset=utf-8;' 
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

const cleanupHistory = async () => {
  try {
    const { value: keepCount } = await ElMessageBox.prompt(
      '请输入要保留的最新记录数量（其余将被清理）',
      '清理历史记录',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        inputValue: '100',
        inputValidator: (value) => {
          if (!value || !/^\d+$/.test(value) || parseInt(value) < 10) {
            return '请输入大于等于10的数字'
          }
          return true
        }
      }
    )

    await historyApi.cleanup(parseInt(keepCount))
    ElMessage.success(`清理完成，保留了最新的 ${keepCount} 条记录`)
    refreshHistory()
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('清理失败')
    }
  }
}

const downloadDetailLogs = () => {
  if (!selectedRecord.value?.logs) return
  
  const blob = new Blob([selectedRecord.value.logs], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `deploy-logs-${selectedRecord.value.id}-${new Date().getTime()}.txt`
  a.click()
  URL.revokeObjectURL(url)
}

// 工具方法
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

const getStepStatusType = (status) => {
  switch (status) {
    case '成功':
      return 'success'
    case '失败':
      return 'danger'
    case '跳过':
      return 'info'
    case '进行中':
      return 'warning'
    default:
      return ''
  }
}

const copyLogs = async () => {
  if (!selectedRecord.value?.logs) {
    ElMessage.warning('暂无日志内容')
    return
  }
  
  try {
    await navigator.clipboard.writeText(selectedRecord.value.logs)
    ElMessage.success('日志已复制到剪贴板')
  } catch (error) {
    ElMessage.error('复制失败')
  }
}

const getDeployTypeTag = (type) => {
  switch (type) {
    case 'frontend':
      return 'success'
    case 'backend':
      return 'primary'
    default:
      return 'info'
  }
}

const getDeployTypeText = (type) => {
  switch (type) {
    case 'frontend':
      return '前端部署'
    case 'backend':
      return '后端部署'
    default:
      return type
  }
}

const formatTime = (time) => {
  if (!time) return ''
  return formatDateTime(new Date(time))
}

const getDuration = (startTime, endTime) => {
  if (!startTime || !endTime) return ''
  
  const duration = new Date(endTime).getTime() - new Date(startTime).getTime()
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
  refreshHistory()
})
</script>

<style scoped>
.deploy-history {
  padding: 20px;
}

.history-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.history-header h2 {
  margin: 0;
  color: #333;
}

.header-actions {
  display: flex;
  gap: 10px;
}

.stats-cards {
  margin-bottom: 20px;
}

.stat-card {
  text-align: center;
}

.stat-number {
  font-size: 36px;
  font-weight: bold;
  color: #409eff;
  margin-bottom: 10px;
}

.stat-label {
  color: #666;
  font-size: 14px;
}

.filter-card {
  margin-bottom: 20px;
}

.filter-form {
  margin: 0;
}

.history-table {
  margin-bottom: 20px;
}

.sub-text {
  font-size: 12px;
  color: #999;
  margin-top: 2px;
}

.pagination {
  display: flex;
  justify-content: center;
  margin-top: 20px;
}

.log-container {
  height: 300px;
  overflow-y: auto;
  background: #1e1e1e;
  border-radius: 4px;
  padding: 10px;
  border: 1px solid #ddd;
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

.error-text {
  color: #f56c6c;
  font-weight: 500;
}

.success-text {
  color: #67c23a;
  font-weight: 500;
}

.info-text {
  color: #909399;
}

.text-muted {
  color: #999;
}

/* 部署详情样式 */
.detail-card {
  margin-bottom: 20px;
}

.detail-card .card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.detail-card h3 {
  margin: 0;
  color: #333;
  font-size: 16px;
}

.step-name {
  display: flex;
  align-items: center;
  gap: 8px;
}

.success-icon {
  color: #67c23a;
}

.error-icon {
  color: #f56c6c;
}

.warning-icon {
  color: #e6a23c;
}

.info-icon {
  color: #409eff;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.batch-actions {
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1000;
}
</style>