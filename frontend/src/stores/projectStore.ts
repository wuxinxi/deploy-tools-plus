import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { projectApi } from '../utils/api'

export interface ProjectConfig {
  id: number
  project_type: 'backend' | 'frontend'
  project_name: string
  project_path: string
  git_branch?: string
  created_at: string
  updated_at: string
}

export const useProjectStore = defineStore('project', () => {
  // 状态
  const projects = ref<ProjectConfig[]>([])
  const loading = ref(false)
  const currentProject = ref<ProjectConfig | null>(null)

  // 获取所有项目
  const fetchProjects = async () => {
    loading.value = true
    try {
      const response = await projectApi.getAll()
      if (response.data.success) {
        projects.value = response.data.data
      }
    } catch (error) {
      console.error('获取项目列表失败:', error)
      throw error
    } finally {
      loading.value = false
    }
  }

  // 根据类型获取项目
  const fetchProjectsByType = async (type: 'backend' | 'frontend') => {
    loading.value = true
    try {
      const response = await projectApi.getByType(type)
      if (response.data.success) {
        return response.data.data
      }
      return []
    } catch (error) {
      console.error('获取项目列表失败:', error)
      throw error
    } finally {
      loading.value = false
    }
  }

  // 获取单个项目
  const fetchProject = async (id: number) => {
    loading.value = true
    try {
      const response = await projectApi.getById(id)
      if (response.data.success) {
        currentProject.value = response.data.data
        return response.data.data
      }
      return null
    } catch (error) {
      console.error('获取项目详情失败:', error)
      throw error
    } finally {
      loading.value = false
    }
  }

  // 验证项目路径
  const validateProject = async (projectPath: string) => {
    try {
      const response = await projectApi.validate(projectPath)
      return response.data
    } catch (error) {
      console.error('验证项目路径失败:', error)
      throw error
    }
  }

  // 创建项目
  const createProject = async (data: Omit<ProjectConfig, 'id' | 'created_at' | 'updated_at'>) => {
    loading.value = true
    try {
      const response = await projectApi.create(data)
      if (response.data.success) {
        await fetchProjects() // 刷新列表
        return response.data.data
      }
      throw new Error(response.data.error || '创建项目失败')
    } catch (error) {
      console.error('创建项目失败:', error)
      throw error
    } finally {
      loading.value = false
    }
  }

  // 更新项目
  const updateProject = async (id: number, data: Partial<ProjectConfig>) => {
    loading.value = true
    try {
      const response = await projectApi.update(id, data)
      if (response.data.success) {
        await fetchProjects() // 刷新列表
        return response.data.data
      }
      throw new Error(response.data.error || '更新项目失败')
    } catch (error) {
      console.error('更新项目失败:', error)
      throw error
    } finally {
      loading.value = false
    }
  }

  // 更新Git分支
  const updateBranch = async (id: number, branch: string) => {
    try {
      const response = await projectApi.updateBranch(id, branch)
      if (response.data.success) {
        await fetchProjects() // 刷新列表
        return response.data.data
      }
      throw new Error(response.data.error || '更新分支失败')
    } catch (error) {
      console.error('更新分支失败:', error)
      throw error
    }
  }

  // 删除项目
  const deleteProject = async (id: number) => {
    loading.value = true
    try {
      const response = await projectApi.delete(id)
      if (response.data.success) {
        await fetchProjects() // 刷新列表
        return true
      }
      throw new Error(response.data.error || '删除项目失败')
    } catch (error) {
      console.error('删除项目失败:', error)
      throw error
    } finally {
      loading.value = false
    }
  }

  // 计算属性
  const backendProjects = computed(() => 
    projects.value.filter(p => p.project_type === 'backend')
  )

  const frontendProjects = computed(() => 
    projects.value.filter(p => p.project_type === 'frontend')
  )

  const projectCount = computed(() => ({
    total: projects.value.length,
    backend: backendProjects.value.length,
    frontend: frontendProjects.value.length
  }))

  return {
    // 状态
    projects,
    loading,
    currentProject,
    
    // 计算属性
    backendProjects,
    frontendProjects,
    projectCount,
    
    // 方法
    fetchProjects,
    fetchProjectsByType,
    fetchProject,
    validateProject,
    createProject,
    updateProject,
    updateBranch,
    deleteProject
  }
})