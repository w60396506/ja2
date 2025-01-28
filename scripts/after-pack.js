const fs = require('fs');
const path = require('path');

exports.default = async function(context) {
  // 确保数据库文件有正确的权限
  const dbPath = path.join(context.appOutDir, 'soundbuttons.db');
  if (fs.existsSync(dbPath)) {
    fs.chmodSync(dbPath, 0o666);
  }
}; 