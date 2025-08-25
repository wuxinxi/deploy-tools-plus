const Database = require('./database');

async function initDatabase() {
  console.log('开始初始化数据库...');
  
  const db = Database.getInstance();
  
  try {
    await db.connect();
    await db.initTables();
    
    console.log('数据库初始化成功!');
    console.log('数据库文件位置:', db.dbPath);
    
    // 关闭数据库连接
    await db.close();
  } catch (error) {
    console.error('数据库初始化失败:', error);
    process.exit(1);
  }
}

// 如果直接运行此脚本，则执行初始化
if (require.main === module) {
  initDatabase();
}

module.exports = initDatabase;