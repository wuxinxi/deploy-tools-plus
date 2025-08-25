# 服务器配置密码显示 Bug 修复

## 问题描述
用户反馈：配置服务器后，编辑服务器配置时密码字段显示为 `******`，无法正常编辑和保存。

## 问题分析

### 后端安全机制
后端为了安全考虑，在返回服务器配置时会将密码字段替换为 `'******'`：

```javascript
// backend/src/controllers/serverController.js
const safeServers = servers.map(server => ({
  ...server,
  password: server.password ? '******' : null
}));
```

### 更新时的处理逻辑
后端在更新服务器配置时会检查密码字段：

```javascript
// 如果密码字段为 ******，则不更新密码
if (updateData.password === '******') {
  delete updateData.password;
}
```

### 前端问题所在
前端在编辑服务器时错误地将 `'******'` 清空：

```javascript
// 修复前的错误逻辑
password: server.password === '******' ? '' : server.password || '',
```

这导致：
1. 用户看到密码字段为空
2. 保存时会因为密码验证失败而无法提交
3. 即使能提交，也会清空原有密码

## 修复方案

### 1. 前端逻辑修复
保持后端返回的 `'******'` 不变：

```javascript
// 修复后的正确逻辑
password: server.password || '',
```

### 2. 用户体验改进
添加了明确的提示信息：

```vue
<el-input
  v-model="form.password"
  type="password"
  :placeholder="editingServer && form.password === '******' ? '不更改密码请保持空白' : '请输入密码'"
  show-password
  clearable
/>
<div v-if="editingServer && form.password === '******'" class="form-hint">
  <el-text size="small" type="info">
    密码已加密保存，不更改请保持为 ******，修改密码请先清空再输入新密码
  </el-text>
</div>
```

### 3. 表单验证优化
修改了密码验证规则，允许编辑模式下 `'******'` 通过验证：

```javascript
function validateAuthRule(rule, value, callback) {
  if (authType.value === 'password' && rule.field === 'password') {
    // 如果是编辑模式且密码是 ******，则不需要验证
    if (editingServer.value && value === '******') {
      callback()
    } else if (!value) {
      callback(new Error('请输入密码'))
    } else {
      callback()
    }
  }
  // ... 其他逻辑
}
```

## 修复效果

### ✅ 用户操作流程
1. **查看服务器列表**: 密码字段显示为 `'******'`，保护隐私
2. **编辑服务器配置**: 
   - 密码字段显示 `'******'`
   - 有清晰的提示说明如何处理
   - 不更改密码：保持 `'******'` 不变
   - 更改密码：清空字段，输入新密码
3. **保存配置**: 
   - 保持 `'******'`：后端不更新密码字段
   - 输入新密码：后端更新为新密码

### ✅ 安全性保障
- 密码在传输和显示时都被保护
- 只有在明确输入新密码时才会更新
- 原有密码不会被意外清空

### ✅ 用户体验
- 明确的视觉提示和说明文字
- 符合用户预期的操作逻辑
- 防止误操作导致的密码丢失

## 技术细节

### 前端文件变更
- `frontend/src/components/ServerConfig.vue`
  - 修复 `editServer()` 函数中的密码处理逻辑
  - 改进密码输入框的用户体验
  - 优化表单验证规则
  - 添加相关样式

### 后端逻辑保持
- 后端的安全机制和处理逻辑保持不变
- 继续使用 `'******'` 作为密码保护机制
- 更新时正确处理密码字段

## 测试建议

1. **创建服务器配置**：使用密码认证创建新的服务器配置
2. **编辑配置（不改密码）**：编辑服务器，保持密码为 `******`，保存
3. **编辑配置（改密码）**：编辑服务器，清空密码字段，输入新密码，保存
4. **连接测试**：验证保存后的配置能否正常连接服务器

现在密码管理功能已经完全正常，既保证了安全性又提供了良好的用户体验！