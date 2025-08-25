import axios from 'axios'

// 创建axios实例
const api = axios.create({
  baseURL: 'http://localhost:3001/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
})

// 请求拦截器
api.interceptors.request.use(
  config => {
    console.log('API请求:', config.method?.toUpperCase(), config.url)
    return config
  },
  error => {
    return Promise.reject(error)
  }
)

// 响应拦截器
api.interceptors.response.use(
  response => {
    console.log('API响应:', response.config.url, response.data)
    return response
  },
  error => {
    console.error('API错误:', error.response?.data || error.message)
    return Promise.reject(error)
  }
)

// 项目配置API
export const projectApi = {
  // 获取所有项目
  getAll: () => api.get('/projects'),
  
  // 根据类型获取项目
  getByType: (type: string) => api.get(`/projects/type/${type}`),
  
  // 获取单个项目
  getById: (id: number) => api.get(`/projects/${id}`),
  
  // 验证项目路径
  validate: (projectPath: string) => api.post('/projects/validate', { project_path: projectPath }),
  
  // 创建项目
  create: (data: any) => api.post('/projects', data),
  
  // 更新项目
  update: (id: number, data: any) => api.put(`/projects/${id}`, data),
  
  // 更新Git分支
  updateBranch: (id: number, branch: string) => api.put(`/projects/${id}/branch`, { git_branch: branch }),
  
  // 删除项目
  delete: (id: number) => api.delete(`/projects/${id}`)
}

// 服务器配置API
export const serverApi = {
  // 获取所有服务器
  getAll: () => api.get('/servers'),
  
  // 获取单个服务器
  getById: (id: number) => api.get(`/servers/${id}`),
  
  // 获取默认服务器
  getDefault: () => api.get('/servers/default/config'),
  
  // 测试服务器连接
  test: (data: any) => api.post('/servers/test', data),
  
  // 创建服务器配置
  create: (data: any) => api.post('/servers', data),
  
  // 更新服务器配置
  update: (id: number, data: any) => api.put(`/servers/${id}`, data),
  
  // 设置默认服务器
  setDefault: (id: number) => api.put(`/servers/${id}/default`),
  
  // 删除服务器配置
  delete: (id: number) => api.delete(`/servers/${id}`),
  
  // 检查远程路径
  checkPath: (id: number, remotePath: string) => api.post(`/servers/${id}/check-path`, { remote_path: remotePath }),
  
  // 获取远程文件列表
  listFiles: (id: number, remotePath: string) => api.post(`/servers/${id}/list-files`, { remote_path: remotePath })
}

// Git操作API
export const gitApi = {
  // 获取远程分支
  getRemoteBranches: (projectId: number) => api.get(`/git/branches/remote/${projectId}`),
  
  // 获取本地分支
  getLocalBranches: (projectId: number) => api.get(`/git/branches/local/${projectId}`),
  
  // 获取当前分支
  getCurrentBranch: (projectId: number) => api.get(`/git/current-branch/${projectId}`),
  
  // 检查分支是否存在
  checkBranch: (projectId: number, branchName: string) => api.post(`/git/check-branch/${projectId}`, { branch_name: branchName }),
  
  // 切换分支
  checkout: (projectId: number, branchName: string) => api.post(`/git/checkout/${projectId}`, { branch_name: branchName }),
  
  // 获取工作区状态
  getStatus: (projectId: number) => api.get(`/git/status/${projectId}`),
  
  // 拉取代码
  pull: (projectId: number, branchName?: string) => api.post(`/git/pull/${projectId}`, branchName ? { branch_name: branchName } : {}),
  
  // 获取提交历史
  getHistory: (projectId: number, limit = 10) => api.get(`/git/history/${projectId}?limit=${limit}`),
  
  // 获取Git仓库信息
  getRepository: (projectId: number) => api.get(`/git/repository/${projectId}`),
  
  // 验证项目
  validate: (projectId: number) => api.get(`/git/validate/${projectId}`)
}

// 构建API
export const buildApi = {
  // 检查构建工具
  getTools: () => api.get('/build/tools'),
  
  // 检测项目构建类型
  detect: (projectId: number) => api.get(`/build/detect/${projectId}`),
  
  // 开始构建
  start: (projectId: number, options = {}) => api.post(`/build/start/${projectId}`, options),
  
  // 停止构建
  stop: (buildId: string) => api.post(`/build/stop/${buildId}`),
  
  // 获取构建产物
  getArtifacts: (projectId: number) => api.get(`/build/artifacts/${projectId}`),
  
  // 清理构建产物
  clean: (projectId: number) => api.post(`/build/clean/${projectId}`),
  
  // 获取活动构建
  getActive: () => api.get('/build/active')
}

// 部署API
export const deployApi = {
  // 执行部署
  execute: (data: any) => api.post('/deploy/execute', data),
  
  // 获取部署状态
  getStatus: (deployId: number) => api.get(`/deploy/status/${deployId}`)
}

// 历史记录API
export const historyApi = {
  // 获取所有部署记录
  getAll: (limit = 50, offset = 0) => api.get(`/history?limit=${limit}&offset=${offset}`),
  
  // 根据项目获取部署记录
  getByProject: (projectId: number, limit = 20) => api.get(`/history/project/${projectId}?limit=${limit}`),
  
  // 根据服务器获取部署记录
  getByServer: (serverId: number, limit = 20) => api.get(`/history/server/${serverId}?limit=${limit}`),
  
  // 获取单个部署记录
  getById: (id: number) => api.get(`/history/${id}`),
  
  // 获取统计信息
  getStats: (startDate?: string, endDate?: string) => {
    let url = '/history/stats/summary'
    const params = new URLSearchParams()
    if (startDate) params.append('startDate', startDate)
    if (endDate) params.append('endDate', endDate)
    if (params.toString()) url += `?${params.toString()}`
    return api.get(url)
  },
  
  // 删除部署记录
  delete: (id: number) => api.delete(`/history/${id}`),
  
  // 清理旧记录
  cleanup: (keepCount = 100) => api.post('/history/cleanup', { keepCount })
}

// 系统API
export const systemApi = {
  // 健康检查
  health: () => api.get('/health'),
  
  // 系统信息
  getInfo: () => api.get('/system/info')
}

export default api