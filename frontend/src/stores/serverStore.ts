import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { serverApi } from '../utils/api'

export interface ServerConfig {
  id: number
  config_name: string
  server_ip: string
  ssh_port: number
  username: string
  password?: string
  private_key_path?: string
  backend_upload_path?: string
  frontend_upload_path?: string
  restart_script_path?: string
  nginx_reload: boolean
  is_default: boolean
  created_at: string
  updated_at: string
}

export const useServerStore = defineStore('server', () => {
  // 状态
  const servers = ref<ServerConfig[]>([])
  const loading = ref(false)
  const currentServer = ref<ServerConfig | null>(null)
  const testingConnection = ref(false)

  // 获取所有服务器
  const fetchServers = async () => {
    loading.value = true
    try {
      const response = await serverApi.getAll()
      if (response.data.success) {
        servers.value = response.data.data
      }
    } catch (error) {
      console.error('获取服务器列表失败:', error)
      throw error
    } finally {
      loading.value = false
    }
  }

  // 获取单个服务器
  const fetchServer = async (id: number) => {
    loading.value = true
    try {
      const response = await serverApi.getById(id)
      if (response.data.success) {
        currentServer.value = response.data.data
        return response.data.data
      }
      return null
    } catch (error) {
      console.error('获取服务器详情失败:', error)
      throw error
    } finally {
      loading.value = false
    }
  }

  // 获取默认服务器
  const fetchDefaultServer = async () => {
    try {
      const response = await serverApi.getDefault()
      if (response.data.success && response.data.data) {
        return response.data.data
      }
      return null
    } catch (error) {
      console.error('获取默认服务器失败:', error)
      return null
    }
  }

  // 测试服务器连接
  const testConnection = async (data: any) => {
    testingConnection.value = true
    try {
      const response = await serverApi.test(data)
      return response.data
    } catch (error) {
      console.error('测试连接失败:', error)
      throw error
    } finally {
      testingConnection.value = false
    }
  }

  // 创建服务器配置
  const createServer = async (data: Omit<ServerConfig, 'id' | 'created_at' | 'updated_at'>) => {
    loading.value = true
    try {
      const response = await serverApi.create(data)
      if (response.data.success) {
        await fetchServers() // 刷新列表
        return response.data.data
      }
      throw new Error(response.data.error || '创建服务器配置失败')
    } catch (error) {
      console.error('创建服务器配置失败:', error)
      throw error
    } finally {
      loading.value = false
    }
  }

  // 更新服务器配置
  const updateServer = async (id: number, data: Partial<ServerConfig>) => {
    loading.value = true
    try {
      const response = await serverApi.update(id, data)
      if (response.data.success) {
        await fetchServers() // 刷新列表
        return response.data.data
      }
      throw new Error(response.data.error || '更新服务器配置失败')
    } catch (error) {
      console.error('更新服务器配置失败:', error)
      throw error
    } finally {
      loading.value = false
    }
  }

  // 设置默认服务器
  const setDefaultServer = async (id: number) => {
    try {
      const response = await serverApi.setDefault(id)
      if (response.data.success) {
        await fetchServers() // 刷新列表
        return response.data.data
      }
      throw new Error(response.data.error || '设置默认服务器失败')
    } catch (error) {
      console.error('设置默认服务器失败:', error)
      throw error
    }
  }

  // 删除服务器配置
  const deleteServer = async (id: number) => {
    loading.value = true
    try {
      const response = await serverApi.delete(id)
      if (response.data.success) {
        await fetchServers() // 刷新列表
        return true
      }
      throw new Error(response.data.error || '删除服务器配置失败')
    } catch (error) {
      console.error('删除服务器配置失败:', error)
      throw error
    } finally {
      loading.value = false
    }
  }

  // 检查远程路径
  const checkRemotePath = async (id: number, remotePath: string) => {
    try {
      const response = await serverApi.checkPath(id, remotePath)
      return response.data
    } catch (error) {
      console.error('检查远程路径失败:', error)
      throw error
    }
  }

  // 获取远程文件列表
  const listRemoteFiles = async (id: number, remotePath: string) => {
    try {
      const response = await serverApi.listFiles(id, remotePath)
      return response.data
    } catch (error) {
      console.error('获取远程文件列表失败:', error)
      throw error
    }
  }

  // 计算属性
  const defaultServer = computed(() => 
    servers.value.find(s => s.is_default) || null
  )

  const serverCount = computed(() => servers.value.length)

  const activeServers = computed(() => 
    servers.value.filter(s => s.backend_upload_path || s.frontend_upload_path)
  )

  return {
    // 状态
    servers,
    loading,
    currentServer,
    testingConnection,
    
    // 计算属性
    defaultServer,
    serverCount,
    activeServers,
    
    // 方法
    fetchServers,
    fetchServer,
    fetchDefaultServer,
    testConnection,
    createServer,
    updateServer,
    setDefaultServer,
    deleteServer,
    checkRemotePath,
    listRemoteFiles
  }
})