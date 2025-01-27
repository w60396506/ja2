const { globalShortcut, BrowserWindow, ipcMain } = require('electron');
const sqlite3 = require('sqlite3');
const path = require('path');
const { app } = require('electron');

class HotkeyManager {
    constructor() {
        this.enabled = true;  // 添加状态标记
        try {
            const dbPath = path.join(app.getPath('userData'), 'soundboard.db');
            this.db = new sqlite3.Database(dbPath);
            
            const sql = `
                SELECT * FROM sound_buttons 
                WHERE shortcut_key IS NOT NULL 
                AND shortcut_key != ''
            `;

            this.db.all(sql, [], (err, rows) => {
                if (err) return;
                if (rows && rows.length > 0) {
                    rows.forEach(button => {
                        if (button.shortcut_key) {
                            if (button.button_name === 'toggle') {
                                this.registerToggleHotkey(button.shortcut_key);
                            } else {
                                this.registerHotkey(button.shortcut_key, button);
                            }
                            
                            if (global.mainWindow && !global.mainWindow.isDestroyed()) {
                                global.mainWindow.webContents.executeJavaScript(`
                                    console.log('注册热键:', {
                                        name: '${button.button_name}',
                                        key: '${button.shortcut_key}'
                                    });
                                `);
                            }
                        }
                    });
                }
            });

            // 添加 IPC 监听
            ipcMain.on('set-shortcuts-enabled', (event, value) => {
                if (global.mainWindow && !global.mainWindow.isDestroyed()) {
                    global.mainWindow.webContents.send('toggle-state-changed', value);
                }
            });
        } catch (error) {}
    }

    registerHotkey(shortcut_key, button) {
        try {
            globalShortcut.register(shortcut_key, () => {
                if (global.mainWindow && !global.mainWindow.isDestroyed()) {
                    global.mainWindow.webContents.send('hotkey-triggered', button.id);
                }
            });
        } catch (error) {}
    }

    registerToggleHotkey(shortcut_key) {
        try {
            globalShortcut.register(shortcut_key, () => {
                if (global.mainWindow && !global.mainWindow.isDestroyed()) {
                    this.enabled = !this.enabled;  // 切换状态
                    
                    // 发送状态变更事件
                    ipcMain.emit('set-shortcuts-enabled', null, this.enabled);
                }
            });
        } catch (error) {}
    }

    cleanup() {
        try {
            globalShortcut.unregisterAll();
            if (this.db) {
                this.db.close();
            }
        } catch (error) {}
    }

    init() {
        const db = new sqlite3.Database(path.join(__dirname, '../../soundbuttons.db'));
        
        // 读取 toggle 的快捷键
        db.get('SELECT shortcut_key FROM sound_buttons WHERE button_name = "toggle"', (err, row) => {
            if (err) {
                console.error('读取快捷键失败:', err);
                return;
            }
            
            if (row && row.shortcut_key) {
                this.registerToggleHotkey(row.shortcut_key);
            }
        });

        db.close();
    }
}

const hotkeyManager = new HotkeyManager();

process.on('exit', () => {
    hotkeyManager.cleanup();
});

module.exports = hotkeyManager; 