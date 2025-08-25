const Database = require('../config/database');
const crypto = require('crypto');

class ServerConfig {
  constructor() {
    this.db = Database.getInstance();
    this.encryptionKey = process.env.ENCRYPTION_KEY || 'deploy-tools-default-key-2024';
  }

  // 加密敏感信息
  encrypt(text) {
    if (!text) return null;
    const cipher = crypto.createCipher('aes192', this.encryptionKey);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
  }

  // 解密敏感信息
  decrypt(encryptedText) {
    if (!encryptedText) return null;
    try {
      const decipher = crypto.createDecipher('aes192', this.encryptionKey);
      let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (error) {
      console.error('解密失败:', error);
      return null;
    }
  }

  // 添加服务器配置
  async create(serverData) {
    const {
      config_name,
      server_ip,
      ssh_port = 22,
      username,
      password,
      private_key_path,
      backend_upload_path,
      frontend_upload_path,
      restart_script_path,
      nginx_reload = false,
      is_default = false
    } = serverData;

    // 如果设置为默认配置，先清除其他默认配置
    if (is_default) {
      await this.clearDefaultConfig();
    }

    try {
      const result = await this.db.run(
        `INSERT INTO server_config (
          config_name, server_ip, ssh_port, username, password, private_key_path,
          backend_upload_path, frontend_upload_path, restart_script_path, 
          nginx_reload, is_default, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [
          config_name,
          server_ip,
          ssh_port,
          username,
          this.encrypt(password),
          private_key_path,
          backend_upload_path,
          frontend_upload_path,
          restart_script_path,
          nginx_reload ? 1 : 0,
          is_default ? 1 : 0
        ]
      );
      
      return await this.getById(result.id);
    } catch (error) {
      throw new Error(`创建服务器配置失败: ${error.message}`);
    }
  }

  // 根据ID获取服务器配置
  async getById(id) {
    try {
      const config = await this.db.get(
        'SELECT * FROM server_config WHERE id = ?',
        [id]
      );
      
      if (config) {
        // 解密密码
        config.password = this.decrypt(config.password);
        // 转换布尔值
        config.nginx_reload = Boolean(config.nginx_reload);
        config.is_default = Boolean(config.is_default);
      }
      
      return config;
    } catch (error) {
      throw new Error(`获取服务器配置失败: ${error.message}`);
    }
  }

  // 根据配置名称获取服务器配置
  async getByName(configName) {
    try {
      const config = await this.db.get(
        'SELECT * FROM server_config WHERE config_name = ?',
        [configName]
      );
      
      if (config) {
        config.password = this.decrypt(config.password);
        config.nginx_reload = Boolean(config.nginx_reload);
        config.is_default = Boolean(config.is_default);
      }
      
      return config;
    } catch (error) {
      throw new Error(`获取服务器配置失败: ${error.message}`);
    }
  }

  // 获取所有服务器配置
  async getAll() {
    try {
      const configs = await this.db.all(
        'SELECT * FROM server_config ORDER BY is_default DESC, updated_at DESC'
      );
      
      return configs.map(config => {
        config.password = this.decrypt(config.password);
        config.nginx_reload = Boolean(config.nginx_reload);
        config.is_default = Boolean(config.is_default);
        return config;
      });
    } catch (error) {
      throw new Error(`获取服务器配置列表失败: ${error.message}`);
    }
  }

  // 获取默认服务器配置
  async getDefault() {
    try {
      const config = await this.db.get(
        'SELECT * FROM server_config WHERE is_default = 1'
      );
      
      if (config) {
        config.password = this.decrypt(config.password);
        config.nginx_reload = Boolean(config.nginx_reload);
        config.is_default = Boolean(config.is_default);
      }
      
      return config;
    } catch (error) {
      throw new Error(`获取默认服务器配置失败: ${error.message}`);
    }
  }

  // 更新服务器配置
  async update(id, updateData) {
    const allowedFields = [
      'config_name', 'server_ip', 'ssh_port', 'username', 'password',
      'private_key_path', 'backend_upload_path', 'frontend_upload_path',
      'restart_script_path', 'nginx_reload', 'is_default'
    ];
    
    const fields = [];
    const values = [];

    // 如果设置为默认配置，先清除其他默认配置
    if (updateData.is_default) {
      await this.clearDefaultConfig();
    }

    Object.keys(updateData).forEach(key => {
      if (allowedFields.includes(key)) {
        if (key === 'password') {
          fields.push(`${key} = ?`);
          values.push(this.encrypt(updateData[key]));
        } else if (key === 'nginx_reload' || key === 'is_default') {
          fields.push(`${key} = ?`);
          values.push(updateData[key] ? 1 : 0);
        } else {
          fields.push(`${key} = ?`);
          values.push(updateData[key]);
        }
      }
    });

    if (fields.length === 0) {
      throw new Error('没有有效的更新字段');
    }

    values.push(id);

    try {
      await this.db.run(
        `UPDATE server_config SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        values
      );
      
      return await this.getById(id);
    } catch (error) {
      throw new Error(`更新服务器配置失败: ${error.message}`);
    }
  }

  // 删除服务器配置
  async delete(id) {
    try {
      const result = await this.db.run(
        'DELETE FROM server_config WHERE id = ?',
        [id]
      );
      
      return result.changes > 0;
    } catch (error) {
      throw new Error(`删除服务器配置失败: ${error.message}`);
    }
  }

  // 清除默认配置标记
  async clearDefaultConfig() {
    try {
      await this.db.run(
        'UPDATE server_config SET is_default = 0'
      );
    } catch (error) {
      throw new Error(`清除默认配置失败: ${error.message}`);
    }
  }

  // 检查配置名称是否已存在
  async nameExists(configName, excludeId = null) {
    try {
      let sql = 'SELECT COUNT(*) as count FROM server_config WHERE config_name = ?';
      let params = [configName];
      
      if (excludeId) {
        sql += ' AND id != ?';
        params.push(excludeId);
      }
      
      const result = await this.db.get(sql, params);
      return result.count > 0;
    } catch (error) {
      throw new Error(`检查配置名称失败: ${error.message}`);
    }
  }
}

module.exports = ServerConfig;