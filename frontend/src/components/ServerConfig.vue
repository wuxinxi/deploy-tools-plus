<template>
  <div class="server-config">
    <div class="page-header">
      <h2>服务器配置</h2>
      <el-button type="primary" :icon="Plus" @click="showCreateDialog = true">
        添加服务器
      </el-button>
    </div>

    <!-- 服务器列表 -->
    <el-card>
      <template #header>
        <div class="card-header">
          <span>服务器列表 ({{ serverStore.serverCount }})</span>
          <el-button :icon="Refresh" @click="refreshServers" :loading="serverStore.loading">
            刷新
          </el-button>
        </div>
      </template>

      <el-table
        :data="serverStore.servers"
        v-loading="serverStore.loading"
        stripe
        style="width: 100%"
      >
        <el-table-column prop="config_name" label="配置名称" min-width="150">
          <template #default="{ row }">
            <div class="server-name">
              <el-icon class="server-icon">
                <CloudServer />
              </el-icon>
              {{ row.config_name }}
              <el-tag v-if="row.is_default" type="success" size="small">默认</el-tag>
            </div>
          </template>
        </el-table-column>

        <el-table-column prop="server_ip" label="服务器IP" width="140" />

        <el-table-column prop="ssh_port" label="SSH端口" width="80" />

        <el-table-column prop="username" label="用户名" width="100" />

        <el-table-column label="认证方式" width="100">
          <template #default="{ row }">
            <el-tag :type="row.private_key_path ? 'warning' : 'info'" size="small">
              {{ row.private_key_path ? '私钥' : '密码' }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column label="上传路径" min-width="200" show-overflow-tooltip>
          <template #default="{ row }">
            <div class="upload-paths">
              <div v-if="row.backend_upload_path">
                <el-tag size="small" type="success">后端</el-tag>
                {{ row.backend_upload_path }}
              </div>
              <div v-if="row.frontend_upload_path">
                <el-tag size="small" type="primary">前端</el-tag>
                {{ row.frontend_upload_path }}
              </div>
              <span v-if="!row.backend_upload_path && !row.frontend_upload_path" class="text-muted">
                未配置
              </span>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-button
              size="small"
              type="primary"
              :icon="Connection"
              @click="testConnection(row)"
              :loading="testingServers.has(row.id)"
            >
              测试
            </el-button>
          </template>
        </el-table-column>

        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button-group>
              <el-button
                size="small"
                :icon="Edit"
                @click="editServer(row)"
              >
                编辑
              </el-button>
              <el-button
                v-if="!row.is_default"
                size="small"
                type="warning"
                :icon="Star"
                @click="setDefault(row)"
              >
                设为默认
              </el-button>
              <el-button
                size="small"
                type="danger"
                :icon="Delete"
                @click="deleteServer(row)"
              >
                删除
              </el-button>
            </el-button-group>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 创建/编辑服务器对话框 -->
    <el-dialog
      v-model="showCreateDialog"
      :title="editingServer ? '编辑服务器' : '添加服务器'"
      width="700px"
      @closed="resetForm"
    >
      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-width="120px"
      >
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="配置名称" prop="config_name">
              <el-input
                v-model="form.config_name"
                placeholder="如：测试环境"
                maxlength="30"
                show-word-limit
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="服务器IP" prop="server_ip">
              <el-input
                v-model="form.server_ip"
                placeholder="192.168.1.100"
              />
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="SSH端口" prop="ssh_port">
              <el-input-number
                v-model="form.ssh_port"
                :min="1"
                :max="65535"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="用户名" prop="username">
              <el-input
                v-model="form.username"
                placeholder="root"
              />
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item label="认证方式" prop="auth_type">
          <el-radio-group v-model="authType">
            <el-radio value="password">密码认证</el-radio>
            <el-radio value="key">私钥认证</el-radio>
          </el-radio-group>
        </el-form-item>

        <el-form-item
          v-if="authType === 'password'"
          label="密码"
          prop="password"
        >
          <el-input
            v-model="form.password"
            type="password"
            placeholder="请输入密码"
            show-password
            clearable
          />
        </el-form-item>

        <el-form-item
          v-if="authType === 'key'"
          label="私钥文件"
          prop="private_key_path"
        >
          <el-input
            v-model="form.private_key_path"
            placeholder="私钥文件路径"
          >
            <template #append>
              <el-button :icon="FolderOpened" @click="selectKeyFile">
                选择
              </el-button>
            </template>
          </el-input>
        </el-form-item>

        <el-divider content-position="left">上传路径配置</el-divider>

        <el-form-item label="后端上传路径">
          <el-input
            v-model="form.backend_upload_path"
            placeholder="/opt/backend/"
          />
        </el-form-item>

        <el-form-item label="前端上传路径">
          <el-input
            v-model="form.frontend_upload_path"
            placeholder="/var/www/html/"
          />
        </el-form-item>

        <el-divider content-position="left">服务管理配置</el-divider>

        <el-form-item label="重启脚本路径">
          <el-input
            v-model="form.restart_script_path"
            placeholder="/opt/scripts/restart.sh"
          />
        </el-form-item>

        <el-form-item label="其他设置">
          <el-checkbox v-model="form.nginx_reload">
            启用Nginx重载
          </el-checkbox>
          <br>
          <el-checkbox v-model="form.is_default">
            设为默认服务器
          </el-checkbox>
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="showCreateDialog = false">取消</el-button>
        <el-button
          type="warning"
          @click="testCurrentConnection"
          :loading="testingConnection"
          :disabled="!canTestConnection"
        >
          测试连接
        </el-button>
        <el-button
          type="primary"
          @click="submitForm"
          :loading="submitting"
        >
          {{ editingServer ? '更新' : '创建' }}
        </el-button>
      </template>
    </el-dialog>

    <!-- 连接测试结果对话框 -->
    <el-dialog
      v-model="showTestDialog"
      title="连接测试结果"
      width="500px"
    >
      <div v-if="testResult">
        <el-result
          :icon="testResult.success ? 'success' : 'error'"
          :title="testResult.success ? '连接成功' : '连接失败'"
          :sub-title="testResult.message || testResult.error"
        >
          <template #extra v-if="testResult.success">
            <el-descriptions :column="1" border>
              <el-descriptions-item label="远程用户">
                {{ testResult.username }}
              </el-descriptions-item>
              <el-descriptions-item label="服务器">
                {{ testResult.server }}
              </el-descriptions-item>
            </el-descriptions>
          </template>
        </el-result>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import {
    Connection,
    Delete,
    Edit,
    FolderOpened,
    Plus,
    Refresh,
    Star
} from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { computed, onMounted, ref, watch } from 'vue'
import { useServerStore, type ServerConfig } from '../stores/serverStore'
import { validateIP, validatePort } from '../utils/common'

// 状态
const serverStore = useServerStore()
const showCreateDialog = ref(false)
const showTestDialog = ref(false)
const editingServer = ref<ServerConfig | null>(null)
const submitting = ref(false)
const testingConnection = ref(false)
const testingServers = ref(new Set<number>())
const testResult = ref<any>(null)

// 认证方式
const authType = ref<'password' | 'key'>('password')

// 表单
const formRef = ref()
const form = ref({
  config_name: '',
  server_ip: '',
  ssh_port: 22,
  username: '',
  password: '',
  private_key_path: '',
  backend_upload_path: '',
  frontend_upload_path: '',
  restart_script_path: '',
  nginx_reload: false,
  is_default: false
})

// 表单验证规则
const rules = {
  config_name: [
    { required: true, message: '请输入配置名称', trigger: 'blur' },
    { min: 2, max: 30, message: '配置名称长度在 2 到 30 个字符', trigger: 'blur' }
  ],
  server_ip: [
    { required: true, message: '请输入服务器IP', trigger: 'blur' },
    { validator: validateIPRule, trigger: 'blur' }
  ],
  ssh_port: [
    { required: true, message: '请输入SSH端口', trigger: 'blur' },
    { validator: validatePortRule, trigger: 'blur' }
  ],
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' }
  ],
  password: [
    { 
      validator: validateAuthRule, 
      trigger: 'blur',
      required: computed(() => authType.value === 'password')
    }
  ],
  private_key_path: [
    { 
      validator: validateAuthRule, 
      trigger: 'blur',
      required: computed(() => authType.value === 'key')
    }
  ]
}

// 计算属性
const canTestConnection = computed(() => {
  return form.value.server_ip && 
         form.value.username && 
         (authType.value === 'password' ? form.value.password : form.value.private_key_path)
})

// 验证函数
function validateIPRule(rule: any, value: string, callback: Function) {
  if (!value) {
    callback(new Error('请输入服务器IP'))
  } else if (!validateIP(value)) {
    callback(new Error('请输入有效的IP地址'))
  } else {
    callback()
  }
}

function validatePortRule(rule: any, value: number, callback: Function) {
  if (!value) {
    callback(new Error('请输入SSH端口'))
  } else if (!validatePort(value)) {
    callback(new Error('端口号必须在 1-65535 之间'))
  } else {
    callback()
  }
}

function validateAuthRule(rule: any, value: string, callback: Function) {
  if (authType.value === 'password' && rule.field === 'password') {
    if (!value) {
      callback(new Error('请输入密码'))
    } else {
      callback()
    }
  } else if (authType.value === 'key' && rule.field === 'private_key_path') {
    if (!value) {
      callback(new Error('请选择私钥文件'))
    } else {
      callback()
    }
  } else {
    callback()
  }
}

// 监听认证方式变化
watch(authType, (newType) => {
  if (newType === 'password') {
    form.value.private_key_path = ''
  } else {
    form.value.password = ''
  }
})

// 方法
async function refreshServers() {
  await serverStore.fetchServers()
}

// 选择私钥文件
function selectKeyFile() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.pem,.key,.rsa'
  input.onchange = (e: any) => {
    const files = e.target.files
    if (files.length > 0) {
      form.value.private_key_path = files[0].name
    }
  }
  input.click()
}

// 编辑服务器
function editServer(server: ServerConfig) {
  editingServer.value = server
  form.value = {
    config_name: server.config_name,
    server_ip: server.server_ip,
    ssh_port: server.ssh_port,
    username: server.username,
    password: server.password || '',
    private_key_path: server.private_key_path || '',
    backend_upload_path: server.backend_upload_path || '',
    frontend_upload_path: server.frontend_upload_path || '',
    restart_script_path: server.restart_script_path || '',
    nginx_reload: server.nginx_reload,
    is_default: server.is_default
  }
  
  // 设置认证方式
  authType.value = server.private_key_path ? 'key' : 'password'
  
  showCreateDialog.value = true
}

// 测试连接
async function testConnection(server: ServerConfig) {
  testingServers.value.add(server.id)
  try {
    const result = await serverStore.testConnection({
      server_ip: server.server_ip,
      ssh_port: server.ssh_port,
      username: server.username,
      password: server.password,
      private_key_path: server.private_key_path
    })
    
    testResult.value = result
    showTestDialog.value = true
  } catch (error: any) {
    ElMessage.error(error.message || '连接测试失败')
  } finally {
    testingServers.value.delete(server.id)
  }
}

// 测试当前表单连接
async function testCurrentConnection() {
  if (!canTestConnection.value) return
  
  testingConnection.value = true
  try {
    const result = await serverStore.testConnection({
      server_ip: form.value.server_ip,
      ssh_port: form.value.ssh_port,
      username: form.value.username,
      password: authType.value === 'password' ? form.value.password : undefined,
      private_key_path: authType.value === 'key' ? form.value.private_key_path : undefined
    })
    
    testResult.value = result
    showTestDialog.value = true
  } catch (error: any) {
    ElMessage.error(error.message || '连接测试失败')
  } finally {
    testingConnection.value = false
  }
}

// 设为默认
async function setDefault(server: ServerConfig) {
  try {
    await serverStore.setDefaultServer(server.id)
    ElMessage.success('默认服务器设置成功')
  } catch (error: any) {
    ElMessage.error(error.message || '设置失败')
  }
}

// 删除服务器
async function deleteServer(server: ServerConfig) {
  try {
    await ElMessageBox.confirm(
      `确定要删除服务器配置 "${server.config_name}" 吗？`,
      '确认删除',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    
    await serverStore.deleteServer(server.id)
    ElMessage.success('服务器配置删除成功')
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error(error.message || '删除失败')
    }
  }
}

// 提交表单
async function submitForm() {
  if (!formRef.value) return

  try {
    await formRef.value.validate()
    submitting.value = true

    const data = { ...form.value }
    
    // 根据认证方式清理不需要的字段
    if (authType.value === 'password') {
      delete (data as any).private_key_path
    } else {
      delete (data as any).password
    }

    if (editingServer.value) {
      // 更新服务器
      await serverStore.updateServer(editingServer.value.id, data)
      ElMessage.success('服务器配置更新成功')
    } else {
      // 创建服务器
      await serverStore.createServer(data)
      ElMessage.success('服务器配置创建成功')
    }

    showCreateDialog.value = false
  } catch (error: any) {
    if (error.message) {
      ElMessage.error(error.message)
    }
  } finally {
    submitting.value = false
  }
}

// 重置表单
function resetForm() {
  editingServer.value = null
  authType.value = 'password'
  form.value = {
    config_name: '',
    server_ip: '',
    ssh_port: 22,
    username: '',
    password: '',
    private_key_path: '',
    backend_upload_path: '',
    frontend_upload_path: '',
    restart_script_path: '',
    nginx_reload: false,
    is_default: false
  }
  if (formRef.value) {
    formRef.value.resetFields()
  }
}

// 生命周期
onMounted(() => {
  serverStore.fetchServers()
})
</script>

<style scoped>
.server-config {
  padding: 20px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.page-header h2 {
  margin: 0;
  color: #333;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.server-name {
  display: flex;
  align-items: center;
  gap: 8px;
}

.server-icon {
  color: #409eff;
}

.upload-paths {
  font-size: 12px;
}

.upload-paths > div {
  margin-bottom: 4px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.text-muted {
  color: #999;
}

:deep(.el-divider__text) {
  background-color: #fff;
  font-weight: 500;
  color: #409eff;
}

.form-hint {
  margin-top: 5px;
}

.form-hint .el-text {
  line-height: 1.4;
}
</style>