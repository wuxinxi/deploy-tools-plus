import 'element-plus/dist/index.css'
import './assets/main.css'

import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import ElementPlus from 'element-plus'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import { createPinia } from 'pinia'
import { createApp } from 'vue'

import axios from 'axios'
import App from './App.vue'
import router from './router'

// 配置axios
axios.defaults.baseURL = 'http://localhost:3001'
axios.defaults.timeout = 30000

const app = createApp(App)

// 注册Element Plus图标
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}

app.use(createPinia())
app.use(router)
app.use(ElementPlus, {
  locale: zhCn,
})

// 添加全局属性
app.config.globalProperties.$http = axios

app.mount('#app')
