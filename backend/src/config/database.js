const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

class Database {
  constructor() {
    this.dbPath = path.join(__dirname, '../database/deploy_tools.db');
    this.ensureDatabaseDirectory();
    this.db = null;
  }

  // 确保数据库目录存在
  ensureDatabaseDirectory() {
    const dbDir = path.dirname(this.dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
  }

  // 连接数据库
  connect() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          console.error('数据库连接失败:', err.message);
          reject(err);
        } else {
          console.log('SQLite 数据库连接成功');
          resolve(this.db);
        }
      });
    });
  }

  // 关闭数据库连接
  close() {
    return new Promise((resolve, reject) => {
      if (this.db) {
        this.db.close((err) => {
          if (err) {
            console.error('数据库关闭失败:', err.message);
            reject(err);
          } else {
            console.log('数据库连接已关闭');
            resolve();
          }
        });
      } else {
        resolve();
      }
    });
  }

  // 执行SQL查询
  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) {
          console.error('SQL执行失败:', err.message);
          reject(err);
        } else {
          resolve({ id: this.lastID, changes: this.changes });
        }
      });
    });
  }

  // 查询单行数据
  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) {
          console.error('查询失败:', err.message);
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  // 查询多行数据
  all(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) {
          console.error('查询失败:', err.message);
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  // 初始化数据库表
  async initTables() {
    try {
      // 项目配置表
      await this.run(`
        CREATE TABLE IF NOT EXISTS project_config (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          project_type TEXT NOT NULL CHECK(project_type IN ('backend', 'frontend')),
          project_name TEXT NOT NULL,
          project_path TEXT NOT NULL,
          git_branch TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // 服务器配置表
      await this.run(`
        CREATE TABLE IF NOT EXISTS server_config (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          config_name TEXT NOT NULL UNIQUE,
          server_ip TEXT NOT NULL,
          ssh_port INTEGER DEFAULT 22,
          username TEXT NOT NULL,
          password TEXT,
          private_key_path TEXT,
          backend_upload_path TEXT,
          frontend_upload_path TEXT,
          restart_script_path TEXT,
          nginx_reload BOOLEAN DEFAULT 0,
          is_default BOOLEAN DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // 部署记录表
      await this.run(`
        CREATE TABLE IF NOT EXISTS deploy_record (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          project_config_id INTEGER,
          server_config_id INTEGER,
          deploy_type TEXT CHECK(deploy_type IN ('backend', 'frontend', 'both')),
          git_branch TEXT,
          description TEXT,
          status TEXT DEFAULT 'running' CHECK(status IN ('running', 'success', 'failed')),
          build_result TEXT CHECK(build_result IN ('success', 'failed', 'skipped')),
          upload_result TEXT CHECK(upload_result IN ('success', 'failed', 'skipped')),
          restart_result TEXT CHECK(restart_result IN ('success', 'failed', 'skipped')),
          deploy_time DATETIME DEFAULT CURRENT_TIMESTAMP,
          end_time DATETIME,
          log_content TEXT,
          error_message TEXT,
          FOREIGN KEY (project_config_id) REFERENCES project_config (id),
          FOREIGN KEY (server_config_id) REFERENCES server_config (id)
        )
      `);

      // 创建索引
      await this.run(`CREATE INDEX IF NOT EXISTS idx_project_path ON project_config(project_path)`);
      await this.run(`CREATE INDEX IF NOT EXISTS idx_server_ip ON server_config(server_ip)`);
      await this.run(`CREATE INDEX IF NOT EXISTS idx_deploy_time ON deploy_record(deploy_time)`);

      // 数据库迁移 - 为现有表添加缺失的字段
      await this.migrateDatabase();

      console.log('数据库表初始化完成');
    } catch (error) {
      console.error('数据库表初始化失败:', error);
      throw error;
    }
  }

  // 数据库迁移 - 为现有表添加缺失字段
  async migrateDatabase() {
    try {
      // 检查deploy_record表是否有status字段
      const columns = await this.all("PRAGMA table_info(deploy_record)");
      const columnNames = columns.map(col => col.name);
      
      // 添加缺失的字段
      if (!columnNames.includes('status')) {
        await this.run("ALTER TABLE deploy_record ADD COLUMN status TEXT DEFAULT 'running'");
        console.log('添加status字段成功');
      }
      
      if (!columnNames.includes('end_time')) {
        await this.run("ALTER TABLE deploy_record ADD COLUMN end_time DATETIME");
        console.log('添加end_time字段成功');
      }
      
      if (!columnNames.includes('git_branch')) {
        await this.run("ALTER TABLE deploy_record ADD COLUMN git_branch TEXT");
        console.log('添加git_branch字段成功');
      }
      
      if (!columnNames.includes('description')) {
        await this.run("ALTER TABLE deploy_record ADD COLUMN description TEXT");
        console.log('添加description字段成功');
      }
      
    } catch (error) {
      console.warn('数据库迁移警告:', error.message);
    }
  }

  // 获取数据库实例（单例模式）
  static getInstance() {
    if (!Database.instance) {
      Database.instance = new Database();
    }
    return Database.instance;
  }
}

module.exports = Database;