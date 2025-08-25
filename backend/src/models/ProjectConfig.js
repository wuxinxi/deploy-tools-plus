const Database = require('../config/database');

class ProjectConfig {
  constructor() {
    this.db = Database.getInstance();
  }

  // 添加项目配置
  async create(projectData) {
    const { project_type, project_name, project_path, git_branch } = projectData;
    
    try {
      const result = await this.db.run(
        `INSERT INTO project_config (project_type, project_name, project_path, git_branch, updated_at) 
         VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [project_type, project_name, project_path, git_branch]
      );
      
      return await this.getById(result.id);
    } catch (error) {
      throw new Error(`创建项目配置失败: ${error.message}`);
    }
  }

  // 根据ID获取项目配置
  async getById(id) {
    try {
      return await this.db.get(
        'SELECT * FROM project_config WHERE id = ?',
        [id]
      );
    } catch (error) {
      throw new Error(`获取项目配置失败: ${error.message}`);
    }
  }

  // 根据路径获取项目配置
  async getByPath(projectPath) {
    try {
      return await this.db.get(
        'SELECT * FROM project_config WHERE project_path = ?',
        [projectPath]
      );
    } catch (error) {
      throw new Error(`获取项目配置失败: ${error.message}`);
    }
  }

  // 获取所有项目配置
  async getAll() {
    try {
      return await this.db.all(
        'SELECT * FROM project_config ORDER BY updated_at DESC'
      );
    } catch (error) {
      throw new Error(`获取项目配置列表失败: ${error.message}`);
    }
  }

  // 根据类型获取项目配置
  async getByType(projectType) {
    try {
      return await this.db.all(
        'SELECT * FROM project_config WHERE project_type = ? ORDER BY updated_at DESC',
        [projectType]
      );
    } catch (error) {
      throw new Error(`获取项目配置失败: ${error.message}`);
    }
  }

  // 更新项目配置
  async update(id, updateData) {
    const allowedFields = ['project_name', 'project_path', 'git_branch'];
    const fields = [];
    const values = [];

    Object.keys(updateData).forEach(key => {
      if (allowedFields.includes(key)) {
        fields.push(`${key} = ?`);
        values.push(updateData[key]);
      }
    });

    if (fields.length === 0) {
      throw new Error('没有有效的更新字段');
    }

    values.push(id);

    try {
      await this.db.run(
        `UPDATE project_config SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        values
      );
      
      return await this.getById(id);
    } catch (error) {
      throw new Error(`更新项目配置失败: ${error.message}`);
    }
  }

  // 删除项目配置
  async delete(id) {
    try {
      const result = await this.db.run(
        'DELETE FROM project_config WHERE id = ?',
        [id]
      );
      
      return result.changes > 0;
    } catch (error) {
      throw new Error(`删除项目配置失败: ${error.message}`);
    }
  }

  // 更新Git分支
  async updateBranch(id, branch) {
    try {
      await this.db.run(
        'UPDATE project_config SET git_branch = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [branch, id]
      );
      
      return await this.getById(id);
    } catch (error) {
      throw new Error(`更新Git分支失败: ${error.message}`);
    }
  }

  // 检查项目路径是否已存在
  async pathExists(projectPath, excludeId = null) {
    try {
      let sql = 'SELECT COUNT(*) as count FROM project_config WHERE project_path = ?';
      let params = [projectPath];
      
      if (excludeId) {
        sql += ' AND id != ?';
        params.push(excludeId);
      }
      
      const result = await this.db.get(sql, params);
      return result.count > 0;
    } catch (error) {
      throw new Error(`检查项目路径失败: ${error.message}`);
    }
  }
}

module.exports = ProjectConfig;