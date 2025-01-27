const { app, BrowserWindow, ipcMain, globalShortcut, dialog } = require('electron')
const path = require('path')
const fs = require('fs')
require('@electron/remote/main').initialize()
const AudioEncryption = require('./core/audio/encryption.js')
const ConfigManager = require('./core/config/manager.js')
const { createMenu } = require('./core/utils/menu.js')
const sqlite3 = require('sqlite3').verbose();

let mainWindow;
let db = null;
let isShortcutsEnabled = true;

const ActionTypes = {
    PLAY_SOUND: 'play_sound',
    STOP: 'stop',
    PAUSE: 'pause',
    TOGGLE_HOTKEY: 'toggle_hotkey'
};

// 添加全局错误处理
process.on('uncaughtException', (error) => {
    console.error('未捕获的异常:', error);
});

function createWindow() {
    try {
        mainWindow = new BrowserWindow({
            width: 422,
            height: 622,
            resizable: false,
            frame: false,
            transparent: true,
            backgroundColor: '#00000000',
            hasShadow: true,
            show: false,  // 先不显示窗口
            webPreferences: {
                nodeIntegration: true,
                contextIsolation: false,
                enableRemoteModule: true
            }
        });

        console.log('窗口创建成功');

        require('@electron/remote/main').enable(mainWindow.webContents);

        // 添加开发者工具快捷键
        mainWindow.webContents.on('before-input-event', (event, input) => {
            // Ctrl+Shift+I 或 Command+Option+I
            if ((input.control && input.shift && input.key.toLowerCase() === 'i') || 
                (input.meta && input.alt && input.key.toLowerCase() === 'i')) {
                console.log('打开开发者工具');
                mainWindow.webContents.openDevTools();
                event.preventDefault();
            }
        });

        // 或者直接添加快捷键
        mainWindow.webContents.on('keydown', (event) => {
            if (event.ctrlKey && event.shiftKey && event.code === 'KeyI') {
                mainWindow.webContents.openDevTools();
            }
        });

        // 添加页面加载事件
        mainWindow.webContents.on('did-finish-load', () => {
            console.log('页面加载完成');
            mainWindow.show();  // 页面加载完成后显示窗口
        });

        mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
            console.error('页面加载失败:', errorCode, errorDescription);
        });

        mainWindow.loadFile('index.html');
        console.log('开始加载页面');

        // 创建菜单
        createMenu();
    } catch (err) {
        console.error('创建窗口失败:', err);
    }
}

app.whenReady().then(() => {
    try {
        console.log('应用程序就绪');
        
        // 获取应用程序根目录
        const rootPath = app.isPackaged 
            ? path.dirname(process.execPath)
            : __dirname;
        
        // 数据库路径始终在根目录
        const dbPath = path.join(rootPath, 'soundbuttons.db');
        console.log('数据库路径:', dbPath);

        // 检查文件权限
        try {
            fs.accessSync(dbPath, fs.constants.R_OK | fs.constants.W_OK);
            console.log('数据库文件权限正常');
        } catch (err) {
            console.error('数据库文件权限错误:', err);
        }

        // 先创建窗口
        createWindow();
        
        // 连接数据库并保持连接
        db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, (err) => {
            if (err) {
                console.error('数据库连接失败:', err);
            } else {
                console.log('数据库连接成功');
                // 检查表是否存在
                db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='sound_buttons'", [], (err, row) => {
                    if (err) {
                        console.error('检查表失败:', err);
                    } else {
                        if (!row) {
                            console.error('sound_buttons 表不存在');
                        } else {
                            console.log('sound_buttons 表存在');
                            // 验证表结构
                            db.all("PRAGMA table_info(sound_buttons)", [], (err, columns) => {
                                if (err) {
                                    console.error('获取表结构失败:', err);
                                } else {
                                    console.log('表结构:', columns);
                                    // 初始化快捷键
                                    initShortcuts();
                                }
                            });
                        }
                    }
                });
            }
        });

        // 确保程序退出时关闭数据库
        app.on('will-quit', () => {
            if (db) {
                console.log('正在关闭数据库...');
                db.close((err) => {
                    if (err) {
                        console.error('关闭数据库失败:', err);
                    } else {
                        console.log('数据库已关闭');
                    }
                });
            }
        });

    } catch (err) {
        console.error('初始化失败:', err);
    }
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit()
    }
})

// 处理获取音频数据的请求
ipcMain.handle('get-audio-data', async (event, relativePath) => {
    try {
        console.log('收到音频数据请求:', {
            relativePath,
            cwd: process.cwd(),
            dirname: __dirname
        });
        return await AudioEncryption.getAudioData(relativePath)
    } catch (err) {
        console.error('处理音频数据请求失败:', err)
        console.error('错误详情:', {
            message: err.message,
            stack: err.stack
        });
        throw err
    }
})

// 处理文件复制和加密的请求
ipcMain.handle('copy-file-to-app', async (event, sourcePath) => {
    try {
        // 使用 process.cwd() 作为根路径
        const soundsPath = path.join(process.cwd(), 'sounds');
        
        console.log('路径信息:', {
            __dirname,
            process_cwd: process.cwd(),
            app_path: app.getAppPath(),
            exe_path: process.execPath,
            sourcePath,
            soundsPath
        });

        // 确保 sounds 文件夹存在
        if (!fs.existsSync(soundsPath)) {
            await fs.promises.mkdir(soundsPath, { recursive: true });
            console.log('创建 sounds 文件夹:', soundsPath);
        }

        // 直接使用原始文件名
        const fileName = path.basename(sourcePath);
        const finalFileName = fileName.replace(path.extname(fileName), '.rack');
        const targetPath = path.join(soundsPath, finalFileName);

        console.log('文件操作:', {
            sourcePath,
            targetPath,
            exists: fs.existsSync(sourcePath)
        });

        // 加密并保存文件
        await AudioEncryption.encryptAudio(sourcePath, targetPath);
        
        // 返回路径，保持一致性
        return `sounds/${finalFileName}`;
        
    } catch (err) {
        console.error('复制和加密文件失败:', err, {
            stack: err.stack
        });
        throw err;
    }
});

// 添加音频设备相关的 IPC 处理程序
ipcMain.handle('get-audio-device', async () => {
    try {
        // 从配置文件获取保存的音频设备
        return ConfigManager.get('audioDevice');
    } catch (err) {
        console.error('获取音频设备配置失败:', err);
        return null;
    }
});

// 保存音频设备设置
ipcMain.on('save-audio-device', (event, deviceId) => {
    try {
        ConfigManager.set('audioDevice', deviceId);
        console.log('已保存音频设备设置:', deviceId);
    } catch (err) {
        console.error('保存音频设备设置失败:', err);
    }
});

// 处理获取配置的请求
ipcMain.handle('get-config', async (event, key) => {
    console.log(`获取配置: ${key} = ${ConfigManager.get(key)}`);
    return ConfigManager.get(key);
});

// 处理保存配置的请求
ipcMain.on('save-config', (event, key, value) => {
    console.log(`准备保存配置: ${key} = ${value}`);
    ConfigManager.set(key, value);
    console.log(`配置已保存: ${key} = ${value}`);
});

// 修改快捷键启用状态处理
ipcMain.on('set-shortcuts-enabled', (event, enabled) => {
    console.log('\n========== 设置快捷键状态 ==========');
    console.log('启用状态:', enabled);
    
    isShortcutsEnabled = enabled;
    
    if (!enabled) {
        // 获取所有非 toggle_hotkey 的快捷键并注销
        db.all('SELECT shortcut_key FROM sound_buttons WHERE action_type != "toggle_hotkey" AND shortcut_key IS NOT NULL', (err, rows) => {
            if (err) {
                console.error('查询快捷键失败:', err);
                return;
            }
            
            console.log('准备注销的快捷键:', rows);
            
            rows.forEach(row => {
                try {
                    if (row && row.shortcut_key) {
                        // 转换键码为快捷键格式
                        let accelerator;
                        const keyCode = parseInt(row.shortcut_key);
                        
                        if (keyCode >= 96 && keyCode <= 105) {
                            accelerator = `num${keyCode - 96}`;
                        } else if (keyCode >= 48 && keyCode <= 57) {
                            accelerator = String(keyCode - 48);
                        } else if (keyCode >= 65 && keyCode <= 90) {
                            accelerator = String.fromCharCode(keyCode);
                        } else if (keyCode >= 112 && keyCode <= 123) {
                            accelerator = `F${keyCode - 111}`;
                        }

                        if (accelerator) {
                            console.log('正在注销快捷键:', accelerator);
                            globalShortcut.unregister(accelerator);
                        }
                    }
                } catch (error) {
                    console.error('注销快捷键失败:', error);
                }
            });
        });
        console.log('已注销非 toggle 快捷键');
    } else {
        // 启用时重新注册所有快捷键
        mainWindow.webContents.send('reload-shortcuts');
        console.log('已请求重新加载快捷键');
    }
});

// 注册快捷键
ipcMain.on('register-shortcut', (event, { shortcut, buttonId }) => {
    console.log('\n========== 快捷键注册 ==========');
    console.log('快捷键:', shortcut);
    console.log('按钮:', buttonId);
    
    try {
        // 先注销已存在的快捷键
        if (globalShortcut.isRegistered(shortcut)) {
            globalShortcut.unregister(shortcut);
        }

        // 注册快捷键
        const success = globalShortcut.register(shortcut, () => {
            // toggle 按钮不受 shortcutsEnabled 状态影响
            if (!isShortcutsEnabled && buttonId !== 'toggle') return;
            
            console.log('\n========== 快捷键触发 ==========');
            console.log('按下按键:', shortcut);
            console.log('按钮名称:', buttonId);
            
            // 查询按钮数据
            db.get(
                'SELECT button_name, sound_path, action_type FROM sound_buttons WHERE button_name = ?',
                [buttonId],
                (err, row) => {
                    if (err) {
                        console.error('查询按钮数据出错:', err);
                        return;
                    }
                    
                    if (row) {
                        console.log('找到按钮:', row);
                        
                        // 根据不同的操作类型执行不同的操作
                        switch (row.action_type) {
                            case ActionTypes.STOP:
                                mainWindow.webContents.executeJavaScript('AudioController.stop();');
                                break;
                                
                            case ActionTypes.PAUSE:
                                mainWindow.webContents.executeJavaScript(`
                                    // 直接调用暂停按钮的点击事件
                                    document.getElementById('btnPause').click();
                                `);
                                break;
                                
                            case ActionTypes.TOGGLE_HOTKEY:
                                mainWindow.webContents.executeJavaScript(`
                                    // 直接调用快捷键开关的点击事件
                                    document.getElementById('shortcutSwitch').click();
                                `);
                                break;
                                
                            case ActionTypes.PLAY_SOUND:
                            default:
                                if (row.sound_path) {
                                    mainWindow.webContents.executeJavaScript(`
                                        AudioController.play('${row.sound_path}', '${row.button_name}');
                                    `);
                                }
                                break;
                        }
                    }
                }
            );
        });

        console.log('快捷键注册' + (success ? '成功' : '失败') + ':', shortcut);
    } catch (err) {
        console.error('注册快捷键出错:', err);
    }
});

// 注销所有快捷键
ipcMain.on('unregister-all-shortcuts', () => {
    globalShortcut.unregisterAll();
    console.log('已注销所有快捷键');
});

// 添加一个测试事件来确认 IPC 通道是否正常工作
ipcMain.on('test-trigger', (event, buttonId) => {
    console.log('测试触发按钮:', buttonId);
    mainWindow.webContents.send('trigger-sound-button', buttonId);
});

// 在应用退出时关闭数据库连接
app.on('will-quit', () => {
    if (db) {
        db.close((err) => {
            if (err) {
                console.error('关闭数据库失败:', err);
            }
        });
    }
    globalShortcut.unregisterAll();
    console.log('程序退出，注销所有快捷键');
});

// 在现有的 ipcMain 事件处理部分添加
ipcMain.on('unregister-shortcut', (event, shortcutKey) => {
    console.log('注销快捷键:', shortcutKey);
    
    // 转换键码为快捷键格式
    let accelerator;
    const keyCode = parseInt(shortcutKey);
    
    if (keyCode >= 96 && keyCode <= 105) { // 小键盘数字
        accelerator = `num${keyCode - 96}`;
    } else if (keyCode >= 48 && keyCode <= 57) { // 主键盘数字
        accelerator = String(keyCode - 48);
    } else if (keyCode >= 65 && keyCode <= 90) { // 字母
        accelerator = String.fromCharCode(keyCode);
    } else if (keyCode >= 112 && keyCode <= 123) { // F1-F12
        accelerator = `F${keyCode - 111}`;
    }

    if (accelerator && globalShortcut.isRegistered(accelerator)) {
        globalShortcut.unregister(accelerator);
        console.log('成功注销快捷键:', accelerator);
    }
});

// 在保存快捷键的地方（应该是处理 save-shortcut 事件的地方）
ipcMain.on('save-shortcut', (event, { buttonName, shortcutKey }) => {
    // ... 现有的保存代码 ...

    // 如果是 toggle 按钮，需要立即重新注册它的快捷键
    if (buttonName === 'toggle') {
        // 先注销旧的 toggle 快捷键（如果有的话）
        db.get('SELECT shortcut_key FROM sound_buttons WHERE button_name = "toggle"', (err, row) => {
            if (!err && row && row.shortcut_key) {
                globalShortcut.unregister(row.shortcut_key);
            }
            
            // 注册新的快捷键
            if (shortcutKey) {
                globalShortcut.register(shortcutKey, () => {
                    ipcMain.emit('set-shortcuts-enabled', null, !isShortcutsEnabled);
                });
            }
        });
    }
});

// 修改对话框状态处理
ipcMain.on('shortcut-dialog-state', (event, isOpen) => {
    console.log('设置快捷键对话框状态:', isOpen);
    
    if (isOpen) {
        // 对话框打开时，暂时注销所有快捷键
        db.all('SELECT shortcut_key FROM sound_buttons WHERE shortcut_key IS NOT NULL', [], (err, rows) => {
            if (err) {
                console.error('查询快捷键失败:', err);
                return;
            }
            
            rows.forEach(row => {
                if (row && row.shortcut_key) {
                    let accelerator;
                    const keyCode = parseInt(row.shortcut_key);
                    
                    if (keyCode >= 96 && keyCode <= 105) {
                        accelerator = `num${keyCode - 96}`;
                    } else if (keyCode >= 48 && keyCode <= 57) {
                        accelerator = String(keyCode - 48);
                    } else if (keyCode >= 65 && keyCode <= 90) {
                        accelerator = String.fromCharCode(keyCode);
                    } else if (keyCode >= 112 && keyCode <= 123) {
                        accelerator = `F${keyCode - 111}`;
                    }

                    if (accelerator) {
                        console.log('暂时注销快捷键:', accelerator);
                        globalShortcut.unregister(accelerator);
                    }
                }
            });
        });

        // 添加按键监听
        mainWindow.webContents.on('before-input-event', (event, input) => {
            // 将按键信息发送到渲染进程
            mainWindow.webContents.send('shortcut-key-pressed', {
                keyCode: input.keyCode,
                key: input.key,
                code: input.code
            });
        });
    } else {
        // 对话框关闭时，移除按键监听
        mainWindow.webContents.removeAllListeners('before-input-event');
        
        // 使用开关的函数重新注册快捷键
        ipcMain.emit('set-shortcuts-enabled', null, isShortcutsEnabled);
    }
});

// 修改原有的快捷键处理函数
function handleShortcut(shortcut) {
  if (!isShortcutsEnabled) return;
  // 原有的快捷键处理逻辑...
}

// 添加新的 IPC 处理程序
ipcMain.handle('check-shortcut', (event, keyCode) => {
    // 临时注销所有快捷键
    const registeredShortcuts = globalShortcut.isRegistered(keyCode);
    if (registeredShortcuts) {
        globalShortcut.unregister(keyCode);
        // 100ms 后重新注册，给渲染进程处理时间
        setTimeout(() => {
            globalShortcut.register(keyCode, () => {
                // 原来的快捷键处理逻辑
            });
        }, 100);
    }
    return registeredShortcuts;
});

// 添加文件选择对话框处理
ipcMain.handle('show-open-dialog', async (event, options) => {
    try {
        console.log('显示文件选择对话框:', options);
        const result = await dialog.showOpenDialog(mainWindow, {
            properties: ['openFile'],
            filters: [
                { name: 'Audio Files', extensions: ['mp3', 'wav', 'ogg', 'flac'] }
            ],
            ...options
        });
        console.log('文件选择结果:', result);
        return result;
    } catch (err) {
        console.error('显示文件选择对话框失败:', err);
        throw err;
    }
});

// 添加数据库查询的 IPC 处理
ipcMain.handle('db-query', async (event, sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) {
                console.error('数据库查询失败:', err);
                reject(err);
            } else {
                resolve(rows);
            }
        });
    });
});

// 添加数据库执行的 IPC 处理
ipcMain.handle('db-run', async (event, sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) {
                console.error('数据库执行失败:', err);
                reject(err);
            } else {
                resolve({ lastID: this.lastID, changes: this.changes });
            }
        });
    });
});

// 修改快捷键初始化函数
async function initShortcuts() {
    try {
        // 从数据库加载快捷键
        db.all("SELECT * FROM sound_buttons WHERE shortcut_key IS NOT NULL", [], (err, rows) => {
            if (err) {
                console.error('加载快捷键失败:', err);
                return;
            }
            
            console.log('找到的快捷键:', rows);
            
            // 先注销所有快捷键
            globalShortcut.unregisterAll();
            
            // 注册每个快捷键
            rows.forEach(row => {
                if (row.shortcut_key) {
                    try {
                        const success = globalShortcut.register(row.shortcut_key, () => {
                            console.log('触发快捷键:', row.shortcut_key, '按钮索引:', row.button_index);
                            if (isShortcutsEnabled && mainWindow) {
                                mainWindow.webContents.send('trigger-button', row.button_index);
                            }
                        });
                        
                        if (success) {
                            console.log('注册快捷键成功:', row.shortcut_key);
                        } else {
                            console.error('注册快捷键失败:', row.shortcut_key);
                        }
                    } catch (err) {
                        console.error('注册快捷键出错:', row.shortcut_key, err);
                    }
                }
            });
            
            console.log('快捷键初始化完成');
        });
    } catch (err) {
        console.error('初始化快捷键失败:', err);
    }
}

// 修改快捷键开关处理
ipcMain.on('toggle-shortcuts', (event, enabled) => {
    console.log('切换快捷键状态:', enabled);
    isShortcutsEnabled = enabled;
    
    if (enabled) {
        // 重新初始化快捷键
        initShortcuts();
    } else {
        // 注销所有快捷键
        globalShortcut.unregisterAll();
        console.log('已注销所有快捷键');
    }
}); 