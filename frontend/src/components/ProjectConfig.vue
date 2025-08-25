<template>
  <div class="project-config">
    <div class="page-header">
      <h2>项目配置</h2>
      <el-button type="primary" :icon="Plus" @click="showCreateDialog = true">
        添加项目
      </el-button>
    </div>

    <!-- 项目列表 -->
    <el-card>
      <template #header>
        <div class="card-header">
          <span>项目列表 ({{ projectStore.projectCount.total }})</span>
          <el-button-group>
            <el-button
              :type="activeTab === 'all' ? 'primary' : ''"
              @click="activeTab = 'all'"
            >
              全部 ({{ projectStore.projectCount.total }})
            </el-button>
            <el-button
              :type="activeTab === 'backend' ? 'primary' : ''"
              @click="activeTab = 'backend'"
            >
              后端 ({{ projectStore.projectCount.backend }})
            </el-button>
            <el-button
              :type="activeTab === 'frontend' ? 'primary' : ''"
              @click="activeTab = 'frontend'"
            >
              前端 ({{ projectStore.projectCount.frontend }})
            </el-button>
          </el-button-group>
        </div>
      </template>

      <el-table
        :data="filteredProjects"
        v-loading="projectStore.loading"
        stripe
        style="width: 100%"
      >
        <el-table-column prop="project_name" label="项目名称" min-width="150">
          <template #default="{ row }">
            <div class="project-name">
              <el-icon class="project-icon">
                <component :is="getProjectTypeIcon(row.project_type)" />
              </el-icon>
              {{ row.project_name }}
            </div>
          </template>
        </el-table-column>

        <el-table-column prop="project_type" label="项目类型" width="100">
          <template #default="{ row }">
            <el-tag :type="row.project_type === 'backend' ? 'success' : 'primary'">
              {{ getProjectTypeLabel(row.project_type) }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column prop="project_path" label="项目路径" min-width="200" show-overflow-tooltip />

        <el-table-column prop="git_branch" label="Git分支" width="120">
          <template #default="{ row }">
            <el-tag v-if="row.git_branch" type="info">
              {{ row.git_branch }}
            </el-tag>
            <span v-else class="text-muted">未设置</span>
          </template>
        </el-table-column>

        <el-table-column prop="updated_at" label="更新时间" width="160">
          <template #default="{ row }">
            {{ formatTime(row.updated_at) }}
          </template>
        </el-table-column>

        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <el-button-group>
              <el-button
                size="small"
                :icon="Edit"
                @click="editProject(row)"
              >
                编辑
              </el-button>
              <el-button
                size="small"
                :icon="DocumentCopy"
                @click="validateProject(row)"
              >
                验证
              </el-button>
              <el-button
                size="small"
                type="danger"
                :icon="Delete"
                @click="deleteProject(row)"
              >
                删除
              </el-button>
            </el-button-group>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 创建/编辑项目对话框 -->
    <el-dialog
      v-model="showCreateDialog"
      :title="editingProject ? '编辑项目' : '添加项目'"
      width="600px"
      @closed="resetForm"
    >
      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-width="100px"
      >
        <el-form-item label="项目类型" prop="project_type">
          <el-radio-group v-model="form.project_type" :disabled="!!editingProject">
            <el-radio value="backend">
              <el-icon><Cpu /></el-icon>
              后端项目 (SpringBoot)
            </el-radio>
            <el-radio value="frontend">
              <el-icon><Monitor /></el-icon>
              前端项目 (Vue3)
            </el-radio>
          </el-radio-group>
        </el-form-item>

        <el-form-item label="项目名称" prop="project_name">
          <el-input
            v-model="form.project_name"
            placeholder="请输入项目名称"
            maxlength="50"
            show-word-limit
          />
        </el-form-item>

        <el-form-item label="项目路径" prop="project_path">
          <el-input
            v-model="form.project_path"
            placeholder="请选择或输入项目根目录路径"
            :disabled="validating"
          >
            <template #append>
              <el-button
                :icon="FolderOpened"
                @click="selectFolder"
                :disabled="validating"
              >
                选择
              </el-button>
            </template>
          </el-input>
          <div class="path-validation" v-if="pathValidation">
            <el-alert
              :title="pathValidation.message"
              :type="pathValidation.type"
              :closable="false"
              show-icon
            />
            <div v-if="pathValidation.details" class="validation-details">
              <p><strong>检测结果:</strong></p>
              <ul>
                <li><strong>项目类型:</strong> {{ getProjectTypeLabel(pathValidation.details.project_type) }}</li>
                <li><strong>构建工具:</strong> {{ pathValidation.details.build_tool }}</li>
                <li><strong>Git仓库:</strong> {{ pathValidation.details.is_git ? '是' : '否' }}</li>
                <li v-if="pathValidation.details.current_branch">
                  <strong>当前分支:</strong> {{ pathValidation.details.current_branch }}
                </li>
              </ul>
            </div>
          </div>
        </el-form-item>

        <el-form-item label="Git分支" prop="git_branch">
          <el-input
            v-model="form.git_branch"
            placeholder="请输入Git分支名称（可选）"
          />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="showCreateDialog = false">取消</el-button>
        <el-button
          type="primary"
          @click="submitForm"
          :loading="submitting"
          :disabled="!isFormValid"
        >
          {{ editingProject ? '更新' : '创建' }}
        </el-button>
      </template>
    </el-dialog>

    <!-- 验证结果对话框 -->
    <el-dialog
      v-model="showValidationDialog"
      title="项目验证结果"
      width="500px"
    >
      <div v-if="validationResult">
        <el-result
          :icon="validationResult.success ? 'success' : 'error'"
          :title="validationResult.success ? '验证成功' : '验证失败'"
          :sub-title="validationResult.message"
        >
          <template #extra>
            <div v-if="validationResult.details" class="validation-info">
              <el-descriptions :column="1" border>
                <el-descriptions-item label="项目类型">
                  {{ getProjectTypeLabel(validationResult.details.project_type) }}
                </el-descriptions-item>
                <el-descriptions-item label="构建工具">
                  {{ validationResult.details.build_tool }}
                </el-descriptions-item>
                <el-descriptions-item label="Git仓库">
                  {{ validationResult.details.is_git ? '是' : '否' }}
                </el-descriptions-item>
                <el-descriptions-item v-if="validationResult.details.current_branch" label="当前分支">
                  {{ validationResult.details.current_branch }}
                </el-descriptions-item>
              </el-descriptions>
            </div>
          </template>
        </el-result>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import {
    Cpu,
    Delete,
    DocumentCopy,
    Edit,
    FolderOpened,
    Monitor,
    Plus
} from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { computed, onMounted, ref, watch } from 'vue'
import { useProjectStore, type ProjectConfig } from '../stores/projectStore'
import { formatTime, getProjectTypeIcon, getProjectTypeLabel, validatePath } from '../utils/common'

// 状态
const projectStore = useProjectStore()
const showCreateDialog = ref(false)
const showValidationDialog = ref(false)
const activeTab = ref('all')
const editingProject = ref<ProjectConfig | null>(null)
const validating = ref(false)
const submitting = ref(false)
const pathValidation = ref<any>(null)
const validationResult = ref<any>(null)

// 表单
const formRef = ref()
const form = ref({
  project_type: 'backend' as 'backend' | 'frontend',
  project_name: '',
  project_path: '',
  git_branch: ''
})

// 表单验证规则
const rules = {
  project_type: [
    { required: true, message: '请选择项目类型', trigger: 'change' }
  ],
  project_name: [
    { required: true, message: '请输入项目名称', trigger: 'blur' },
    { min: 2, max: 50, message: '项目名称长度在 2 到 50 个字符', trigger: 'blur' }
  ],
  project_path: [
    { required: true, message: '请输入项目路径', trigger: 'blur' },
    { validator: validateProjectPath, trigger: 'blur' }
  ]
}

// 计算属性
const filteredProjects = computed(() => {
  if (activeTab.value === 'all') return projectStore.projects
  if (activeTab.value === 'backend') return projectStore.backendProjects
  if (activeTab.value === 'frontend') return projectStore.frontendProjects
  return []
})

const isFormValid = computed(() => {
  return form.value.project_name && 
         form.value.project_path && 
         form.value.project_type &&
         pathValidation.value?.type === 'success'
})

// 监听项目路径变化，自动验证
watch(() => form.value.project_path, async (newPath) => {
  if (newPath && validatePath(newPath)) {
    await validateProjectPath(newPath)
  } else {
    pathValidation.value = null
  }
}, { immediate: false })

// 方法
async function validateProjectPath(path: string) {
  if (!path) return
  
  validating.value = true
  pathValidation.value = null
  
  try {
    const result = await projectStore.validateProject(path)
    if (result.success) {
      // 验证成功，检查项目类型是否匹配
      if (result.data.project_type === form.value.project_type) {
        pathValidation.value = {
          type: 'success',
          message: '项目路径验证成功',
          details: result.data
        }
        // 自动填充Git分支
        if (result.data.current_branch && !form.value.git_branch) {
          form.value.git_branch = result.data.current_branch
        }
      } else {
        pathValidation.value = {
          type: 'warning',
          message: `检测到的项目类型为${getProjectTypeLabel(result.data.project_type)}，与所选类型不匹配`,
          details: result.data
        }
      }
    } else {
      pathValidation.value = {
        type: 'error',
        message: result.error || '项目路径验证失败'
      }
    }
  } catch (error: any) {
    pathValidation.value = {
      type: 'error',
      message: error.message || '项目路径验证失败'
    }
  } finally {
    validating.value = false
  }
}

// 选择文件夹
function selectFolder() {
  // 在实际应用中，这里可以使用 Electron 的文件选择对话框
  // 目前使用input元素模拟
  const input = document.createElement('input')
  input.type = 'file'
  input.webkitdirectory = true
  input.onchange = (e: any) => {
    const files = e.target.files
    if (files.length > 0) {
      const path = files[0].webkitRelativePath.split('/')[0]
      form.value.project_path = path
    }
  }
  input.click()
}

// 编辑项目
function editProject(project: ProjectConfig) {
  editingProject.value = project
  form.value = {
    project_type: project.project_type,
    project_name: project.project_name,
    project_path: project.project_path,
    git_branch: project.git_branch || ''
  }
  showCreateDialog.value = true
}

// 验证项目
async function validateProject(project: ProjectConfig) {
  try {
    const result = await projectStore.validateProject(project.project_path)
    validationResult.value = result
    showValidationDialog.value = true
  } catch (error: any) {
    ElMessage.error(error.message || '验证失败')
  }
}

// 删除项目
async function deleteProject(project: ProjectConfig) {
  try {
    await ElMessageBox.confirm(
      `确定要删除项目 "${project.project_name}" 吗？`,
      '确认删除',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    
    await projectStore.deleteProject(project.id)
    ElMessage.success('项目删除成功')
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

    if (editingProject.value) {
      // 更新项目
      await projectStore.updateProject(editingProject.value.id, form.value)
      ElMessage.success('项目更新成功')
    } else {
      // 创建项目
      await projectStore.createProject(form.value)
      ElMessage.success('项目创建成功')
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
  editingProject.value = null
  pathValidation.value = null
  form.value = {
    project_type: 'backend',
    project_name: '',
    project_path: '',
    git_branch: ''
  }
  if (formRef.value) {
    formRef.value.resetFields()
  }
}

// 生命周期
onMounted(() => {
  projectStore.fetchProjects()
})
</script>

<style scoped>
.project-config {
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

.project-name {
  display: flex;
  align-items: center;
  gap: 8px;
}

.project-icon {
  color: #409eff;
}

.text-muted {
  color: #999;
}

.path-validation {
  margin-top: 8px;
}

.validation-details {
  margin-top: 8px;
  padding: 8px 12px;
  background: #f5f7fa;
  border-radius: 4px;
  font-size: 12px;
}

.validation-details ul {
  margin: 4px 0;
  padding-left: 16px;
}

.validation-details li {
  margin: 2px 0;
}

.validation-info {
  text-align: left;
}

:deep(.el-radio) {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
}

:deep(.el-radio__label) {
  display: flex;
  align-items: center;
  gap: 4px;
}
</style>