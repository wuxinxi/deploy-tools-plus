const Database = require('../config/database');

class DeployRecord {
  constructor() {
    this.db = Database.getInstance();
  }

  // 创建部署记录
  async create(deployData) {
    const {
      project_config_id,
      server_config_id,
      deploy_type,
      build_result = 'skipped',
      upload_result = 'skipped',
      restart_result = 'skipped',
      log_content = '',
      error_message = null
    } = deployData;

    try {
      const result = await this.db.run(
        `INSERT INTO deploy_record (
          project_config_id, server_config_id, deploy_type, build_result,
          upload_result, restart_result, log_content, error_message
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          project_config_id,
          server_config_id,
          deploy_type,
          build_result,
          upload_result,
          restart_result,
          log_content,
          error_message
        ]
      );
      
      return await this.getById(result.id);
    } catch (error) {
      throw new Error(`创建部署记录失败: ${error.message}`);
    }
  }

  // 根据ID获取部署记录
  async getById(id) {
    try {
      return await this.db.get(`
        SELECT 
          dr.*,
          pc.project_name,
          pc.project_type,
          pc.project_path,
          sc.config_name as server_name,
          sc.server_ip
        FROM deploy_record dr
        LEFT JOIN project_config pc ON dr.project_config_id = pc.id
        LEFT JOIN server_config sc ON dr.server_config_id = sc.id
        WHERE dr.id = ?
      `, [id]);
    } catch (error) {
      throw new Error(`获取部署记录失败: ${error.message}`);
    }
  }

  // 获取所有部署记录
  async getAll(limit = 50, offset = 0) {
    try {
      return await this.db.all(`
        SELECT 
          dr.*,
          pc.project_name,
          pc.project_type,
          pc.project_path,
          sc.config_name as server_name,
          sc.server_ip
        FROM deploy_record dr
        LEFT JOIN project_config pc ON dr.project_config_id = pc.id
        LEFT JOIN server_config sc ON dr.server_config_id = sc.id
        ORDER BY dr.deploy_time DESC
        LIMIT ? OFFSET ?
      `, [limit, offset]);
    } catch (error) {
      throw new Error(`获取部署记录列表失败: ${error.message}`);
    }
  }

  // 根据项目配置ID获取部署记录
  async getByProjectConfig(projectConfigId, limit = 20) {
    try {
      return await this.db.all(`
        SELECT 
          dr.*,
          pc.project_name,
          pc.project_type,
          pc.project_path,
          sc.config_name as server_name,
          sc.server_ip
        FROM deploy_record dr
        LEFT JOIN project_config pc ON dr.project_config_id = pc.id
        LEFT JOIN server_config sc ON dr.server_config_id = sc.id
        WHERE dr.project_config_id = ?
        ORDER BY dr.deploy_time DESC
        LIMIT ?
      `, [projectConfigId, limit]);
    } catch (error) {
      throw new Error(`获取项目部署记录失败: ${error.message}`);
    }
  }

  // 根据服务器配置ID获取部署记录
  async getByServerConfig(serverConfigId, limit = 20) {
    try {
      return await this.db.all(`
        SELECT 
          dr.*,
          pc.project_name,
          pc.project_type,
          pc.project_path,
          sc.config_name as server_name,
          sc.server_ip
        FROM deploy_record dr
        LEFT JOIN project_config pc ON dr.project_config_id = pc.id
        LEFT JOIN server_config sc ON dr.server_config_id = sc.id
        WHERE dr.server_config_id = ?
        ORDER BY dr.deploy_time DESC
        LIMIT ?
      `, [serverConfigId, limit]);
    } catch (error) {
      throw new Error(`获取服务器部署记录失败: ${error.message}`);
    }
  }

  // 更新部署记录
  async update(id, updateData) {
    const allowedFields = [
      'build_result', 'upload_result', 'restart_result', 
      'log_content', 'error_message', 'status', 'end_time',
      'git_branch', 'description'
    ];
    
    const fields = [];
    const values = [];

    Object.keys(updateData).forEach(key => {
      if (allowedFields.includes(key)) {
        fields.push(`${key} = ?`);
        values.push(updateData[key]);
      }
    });

    if (fields.length === 0) {
      console.warn('更新部署记录: 没有有效的更新字段', updateData);
      return await this.getById(id); // 返回原记录而不抛错
    }

    values.push(id);

    try {
      await this.db.run(
        `UPDATE deploy_record SET ${fields.join(', ')} WHERE id = ?`,
        values
      );
      
      return await this.getById(id);
    } catch (error) {
      throw new Error(`更新部署记录失败: ${error.message}`);
    }
  }

  // 删除部署记录
  async delete(id) {
    try {
      const result = await this.db.run(
        'DELETE FROM deploy_record WHERE id = ?',
        [id]
      );
      
      return result.changes > 0;
    } catch (error) {
      throw new Error(`删除部署记录失败: ${error.message}`);
    }
  }

  // 获取部署统计信息
  async getStatistics(startDate = null, endDate = null) {
    try {
      let sql = `
        SELECT 
          COUNT(*) as total_deploys,
          SUM(CASE WHEN build_result = 'success' THEN 1 ELSE 0 END) as successful_builds,
          SUM(CASE WHEN upload_result = 'success' THEN 1 ELSE 0 END) as successful_uploads,
          SUM(CASE WHEN restart_result = 'success' THEN 1 ELSE 0 END) as successful_restarts,
          deploy_type,
          DATE(deploy_time) as deploy_date
        FROM deploy_record
      `;
      
      const params = [];
      
      if (startDate && endDate) {
        sql += ' WHERE deploy_time BETWEEN ? AND ?';
        params.push(startDate, endDate);
      } else if (startDate) {
        sql += ' WHERE deploy_time >= ?';
        params.push(startDate);
      } else if (endDate) {
        sql += ' WHERE deploy_time <= ?';
        params.push(endDate);
      }
      
      sql += ' GROUP BY deploy_type, DATE(deploy_time) ORDER BY deploy_date DESC';
      
      return await this.db.all(sql, params);
    } catch (error) {
      throw new Error(`获取部署统计信息失败: ${error.message}`);
    }
  }

  // 清理旧的部署记录（保留最近N条记录）
  async cleanOldRecords(keepCount = 100) {
    try {
      const result = await this.db.run(`
        DELETE FROM deploy_record 
        WHERE id NOT IN (
          SELECT id FROM deploy_record 
          ORDER BY deploy_time DESC 
          LIMIT ?
        )
      `, [keepCount]);
      
      return result.changes;
    } catch (error) {
      throw new Error(`清理旧部署记录失败: ${error.message}`);
    }
  }

  // 添加日志内容
  async appendLog(id, logContent) {
    try {
      const record = await this.getById(id);
      if (!record) {
        throw new Error('部署记录不存在');
      }
      
      const newLogContent = record.log_content 
        ? `${record.log_content}\n${logContent}`
        : logContent;
      
      await this.update(id, { log_content: newLogContent });
      return true;
    } catch (error) {
      throw new Error(`添加日志内容失败: ${error.message}`);
    }
  }
}

module.exports = DeployRecord;