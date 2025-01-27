const { getCurrentWindow, Menu, MenuItem } = require('@electron/remote')
const { ipcRenderer } = require('electron')
const sqlite3 = require('sqlite3').verbose()
const path = require('path')
const AudioController = require('./core/audio/controller.js')
const Toast = require('./core/utils/toast.js')
const { initContextMenu } = require('./core/utils/contextMenu.js')
const AudioEncryption = require('./core/audio/encryption.js')
const ShortcutDialog = require('./core/utils/shortcutDialog.js')

// 在文件顶部定义一个变量来保存复制的按钮信息
let copiedButton = null;

// 连接数据库
const db = new sqlite3.Database(path.join(process.cwd(), 'soundbuttons.db'), (err) => {
    if (err) {
        console.error('数据库连接错误:', err, {
            cwd: process.cwd(),
            dirname: __dirname,
            dbPath: path.join(process.cwd(), 'soundbuttons.db')
        });
    } else {
        console.log('成功连接到数据库', {
            cwd: process.cwd(),
            dirname: __dirname,
            dbPath: path.join(process.cwd(), 'soundbuttons.db')
        });
        
        // 列出所有表
        db.all("SELECT name FROM sqlite_master WHERE type='table'", [], (err, tables) => {
            if (err) {
                console.error('获取表列表错误:', err)
                return
            }
            console.log('数据库中的表:', tables)
            
            // 如果找到表，显示其结构
            tables.forEach(table => {
                db.all(`PRAGMA table_info(${table.name})`, [], (err, columns) => {
                    if (err) {
                        console.error(`获取表 ${table.name} 结构错误:`, err)
                        return
                    }
                    console.log(`表 ${table.name} 的结构:`, columns)
                })
            })
        })
    }
})

// 在现有的数据库连接后添加
async function loadAndRegisterShortcuts() {
    try {
        // 先检查表是否存在
        const tables = await ipcRenderer.invoke('db-query', 
            "SELECT name FROM sqlite_master WHERE type='table' AND name='sound_buttons'");
        
        if (!tables || tables.length === 0) {
            console.error('sound_buttons 表不存在');
            return;
        }

        // 然后查询快捷键
        const rows = await ipcRenderer.invoke('db-query', 
            `SELECT button_name, shortcut_key, shortcut_display 
             FROM sound_buttons 
             WHERE shortcut_key IS NOT NULL AND shortcut_key != '(Null)'`);
        
        console.log('加载的快捷键:', rows);
        
        rows.forEach(row => {
            try {
                const keyCode = parseInt(row.shortcut_key);
                if (isNaN(keyCode)) return;

                let accelerator;
                // 主键盘数字键 1-9
                if (keyCode >= 49 && keyCode <= 57) {
                    accelerator = String(keyCode - 48);
                }
                // 小键盘数字键 1-9
                else if (keyCode >= 97 && keyCode <= 105) {
                    accelerator = `num${keyCode - 96}`;
                }
                // 字母键 A-Z
                else if (keyCode >= 65 && keyCode <= 90) {
                    accelerator = String.fromCharCode(keyCode);
                }
                // F1-F12
                else if (keyCode >= 112 && keyCode <= 123) {
                    accelerator = `F${keyCode - 111}`;
                }
                // 其他特殊按键
                else {
                    const keyMap = {
                        32: 'Space',
                        13: 'Return',
                        9: 'Tab',
                        27: 'Esc'
                    };
                    accelerator = keyMap[keyCode];
                }

                if (accelerator) {
                    console.log('注册快捷键:', {
                        keyCode: keyCode,
                        accelerator: accelerator,
                        buttonId: row.button_name
                    });

                    ipcRenderer.send('register-shortcut', {
                        shortcut: accelerator,
                        buttonId: row.button_name
                    });
                }
            } catch (error) {
                console.error('处理快捷键时出错:', error);
            }
        });
    } catch (err) {
        console.error('读取快捷键失败:', err);
    }
}

// 确保数据库连接后调用
db.on('open', () => {
    try {
        console.log('数据库已连接');
        loadAndRegisterShortcuts();
    } catch (error) {
        console.error('数据库连接后的操作出错:', error);
    }
});

// 添加全局错误处理
window.onerror = function(msg, url, lineNo, columnNo, error) {
    console.error('全局错误:', {
        message: msg,
        url: url,
        lineNo: lineNo,
        columnNo: columnNo,
        error: error
    });
    return false;
};

// 添加未捕获的 Promise 错误处理
window.addEventListener('unhandledrejection', function(event) {
    console.error('未处理的 Promise 错误:', event.reason);
});

// 添加热键触发的监听
ipcRenderer.on('trigger-sound-button', (event, buttonId) => {
    console.log('收到按钮触发事件:', buttonId);
    const button = document.querySelector(`[data-name="${buttonId}"]`);
    if (button) {
        console.log('找到按钮，触发点击');
        button.click();
    } else {
        console.log('未找到对应按钮:', buttonId);
    }
});

// 创建按钮的函数
function createButtonWithLabel(text, shortcut = '') {
    // 创建容器
    const container = document.createElement('div');
    container.className = 'button-container';
    
    // 创建按钮
    const btn = document.createElement('button');
    btn.className = 'sound-btn';
    btn.textContent = text;
    
    // 创建快捷键标签
    const label = document.createElement('div');
    label.className = 'kuaijiejianbiaoqian';
    label.textContent = shortcut;
    
    // 组装
    container.appendChild(btn);
    container.appendChild(label);
    
    return container;
}

// 修改添加按钮的事件处理
document.querySelector('.add-btn').addEventListener('click', async () => {
    try {
        console.log('点击添加按钮 - 开始处理');
        
        // 获取当前分类
        const currentCategory = document.querySelector('.nav-item.active');
    if (!currentCategory) {
        console.error('未找到选中的分类');
        Toast.error('添加失败：未找到当前分类');
        return;
    }
    
        // 获取分类ID
    const categoryId = Array.from(currentCategory.parentNode.children).indexOf(currentCategory) + 1;
    if (!categoryId) {
        console.error('分类ID计算错误');
        Toast.error('添加失败：分类ID错误');
        return;
    }
    
        // 使用 IPC 获取最大索引
        const result = await ipcRenderer.invoke('db-query', 'SELECT MAX(button_index) as maxIndex FROM sound_buttons');
        const newIndex = ((result[0] && result[0].maxIndex) || 0) + 1;
        
        // 使用 IPC 插入新按钮
        await ipcRenderer.invoke('db-run', 
            'INSERT INTO sound_buttons (button_name, button_index, sound_path, category_id) VALUES (?, ?, ?, ?)',
            ['新按钮', newIndex, '', categoryId]
        );
                
                // 创建并显示新按钮
                const buttonContainer = createButtonWithLabel('新按钮', '');
                const btn = buttonContainer.querySelector('.sound-btn');
                btn.dataset.soundPath = '';
                btn.dataset.categoryId = categoryId;
                btn.dataset.buttonIndex = newIndex;
                
                // 添加点击事件
                btn.addEventListener('click', async () => {
                    if (btn.dataset.soundPath) {
                        try {
                            await AudioController.play(btn.dataset.soundPath, '新按钮');
                        } catch (err) {
                            console.error('播放音频失败:', err);
                        }
                    }
                });
                
                // 添加拖拽功能
                addDropZoneToButton(btn);
                
                // 插入到添加按钮之前
                const addBtn = document.querySelector('.add-btn');
                addBtn.parentNode.insertBefore(buttonContainer, addBtn);
                
                // 自动滚动到底部
                const grid = document.querySelector('.sound-grid');
                requestAnimationFrame(() => {
                    grid.scrollTop = grid.scrollHeight;
                });
                
                Toast.success('添加按钮成功');
        
    } catch (err) {
        console.error('添加按钮失败:', err);
        Toast.error('添加按钮失败');
            }
});

// 修改加载按钮的函数
async function loadButtons(categoryId = 1) {
    try {
        const rows = await ipcRenderer.invoke('db-query', 'SELECT * FROM sound_buttons WHERE category_id = ? ORDER BY button_index', [categoryId]);
        const grid = document.querySelector('.sound-grid');
        
        // 清空现有按钮，但保留添加按钮
        const addBtn = document.querySelector('.add-btn');
        grid.innerHTML = '';
        grid.appendChild(addBtn);

        rows.forEach(row => {
            const buttonContainer = createButtonWithLabel(
                row.button_name,
                row.shortcut_display || ''
            );
            
            // 保存数据到按钮元素
            const btn = buttonContainer.querySelector('.sound-btn');
            btn.dataset.soundPath = row.sound_path;
            btn.dataset.shortcutKey = row.shortcut_key || '';
            btn.dataset.shortcutDisplay = row.shortcut_display || '';
            btn.dataset.buttonIndex = row.button_index;
            
            // 添加点击事件
            btn.addEventListener('click', async () => {
                // 获取当前分类ID
                const currentCategory = document.querySelector('.nav-item.active');
                const categoryId = Array.from(currentCategory.parentNode.children).indexOf(currentCategory) + 1;
                
                // 获取按钮索引
                const buttonIndex = btn.dataset.buttonIndex;
                
                // 从数据库获取音效路径
                const result = await ipcRenderer.invoke('db-query', 'SELECT sound_path FROM sound_buttons WHERE button_index = ? AND category_id = ?', [buttonIndex, categoryId]);
                if (result.length > 0 && result[0].sound_path) {
                    try {
                        await AudioController.play(result[0].sound_path, btn.textContent);
                    } catch (err) {
                        console.error('播放音频失败:', err);
                    }
                }
            });
            
            // 插入到添加按钮之前
            grid.insertBefore(buttonContainer, addBtn);
        });
    } catch (err) {
        console.error('加载按钮失败:', err);
    }
}

// 初始加载分类1的按钮
loadButtons(1)

// 导航菜单点击事件
document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
        // 移除其他导航项的选中状态
        document.querySelectorAll('.nav-item').forEach(nav => {
            nav.classList.remove('active')
        })
        // 添加当前导航项的选中状态
        e.target.classList.add('active')
        
        // 根据导航项的索引加载对应分类的按钮
        const index = Array.from(e.target.parentNode.children).indexOf(e.target) + 1
        loadButtons(index)
    })
})

// 窗口控制
document.querySelector('.minimize-btn').addEventListener('click', () => {
    getCurrentWindow().minimize()
})

document.querySelector('.close-btn').addEventListener('click', () => {
    getCurrentWindow().close()
})

// 添加全局变量
let quan_yjsy = 0;

// 添加一个全局变量来跟踪当前的事件监听器
let currentKeyHandler = null;
let currentTip = null;

// 添加右键菜单处理
document.addEventListener('contextmenu', (e) => {
    const button = e.target.classList.contains('sound-btn') ? 
                  e.target : 
                  e.target.querySelector('.sound-btn');
    
    if (button) {
        e.preventDefault();
        console.log('右键点击按钮:', button.textContent);
        
        const menu = new Menu();
        const buttonName = button.textContent;

        // 设置快捷键
        menu.append(new MenuItem({
            label: '设置快捷键',
            click: () => {
                console.log('点击了设置快捷键');
                ShortcutDialog.show(button.dataset.buttonIndex);
            }
        }));

        // 清除快捷键
        menu.append(new MenuItem({
            label: '清除快捷键',
            click: () => {
                // 获取当前按钮的快捷键
                ipcRenderer.invoke('db-query', 'SELECT shortcut_key FROM sound_buttons WHERE button_name = ?', [buttonName])
                    .then(rows => {
                        if (rows.length > 0 && rows[0].shortcut_key) {
                            ipcRenderer.send('unregister-shortcut', rows[0].shortcut_key);
                            
                            // 从数据库中清除快捷键
                            ipcRenderer.invoke('db-run', 'UPDATE sound_buttons SET shortcut_key = NULL, shortcut_display = NULL WHERE button_name = ?', [buttonName])
                                .then(() => {
                                    // 更新按钮显示
                                    const buttons = document.querySelectorAll('.sound-btn');
                                    buttons.forEach(btn => {
                                        if (btn.textContent === buttonName) {
                                            const label = btn.parentElement.querySelector('.kuaijiejianbiaoqian');
                                            if (label) {
                                                label.textContent = '';
                                            }
                                        }
                                    });
                                    
                                    Toast.success('快捷键已清除');
                                })
                                .catch(err => {
                                    console.error('清除快捷键失败:', err);
                                    Toast.error('清除快捷键失败');
                                });
                        }
                    })
                    .catch(err => {
                        console.error('获取快捷键失败:', err);
                        Toast.error('获取快捷键失败');
                    });
            }
        }));

        // 分隔线
        menu.append(new MenuItem({ type: 'separator' }));

        // 添加音效
        menu.append(new MenuItem({
            label: '添加音效',
            click: async () => {
                const result = await ipcRenderer.invoke('show-open-dialog', {
                    filters: [
                        { name: '音频文件', extensions: ['mp3', 'wav', 'ogg', 'm4a'] }
                    ]
                });
                if (!result.canceled && result.filePaths.length > 0) {
                    const filePath = result.filePaths[0];
                    try {
                        // 加密并复制音频文件到应用目录
                        const targetPath = await ipcRenderer.invoke('copy-file-to-app', filePath);
                        
                        // 获取文件名（不包含扩展名）作为按钮名称
                        const fileName = path.basename(filePath, path.extname(filePath));
                        
                        // 获取当前分类ID和按钮索引
                        const currentCategory = document.querySelector('.nav-item.active');
                        const categoryId = Array.from(currentCategory.parentNode.children).indexOf(currentCategory) + 1;
                        const buttonIndex = button.dataset.buttonIndex;

                        // 在更新数据库之前打印参数
                        console.log('更新数据库参数:', {
                            buttonName: fileName,
                            targetPath,
                            buttonIndex,
                            categoryId
                        });
                        
                        // 更新数据库
                        await ipcRenderer.invoke('db-run', 
                            'UPDATE sound_buttons SET button_name = ?, sound_path = ? WHERE button_index = ? AND category_id = ?', 
                            [
                                fileName,
                                targetPath,
                                buttonIndex,
                                categoryId
                            ]
                        );

                        // 验证更新
                        const result = await ipcRenderer.invoke('db-query',
                            'SELECT * FROM sound_buttons WHERE button_index = ? AND category_id = ?',
                            [buttonIndex, categoryId]
                        );
                        console.log('更新后的数据库记录:', result);
                        
                        // 更新按钮显示
                        button.textContent = fileName;
                        button.dataset.soundPath = targetPath;

                        Toast.success('音效添加成功');
                        
                        // 添加动画效果
                        button.style.transition = 'all 0.3s';
                        button.style.backgroundColor = '#4CAF50';
                        button.style.color = 'white';
                        
                        setTimeout(() => {
                            button.style.backgroundColor = '';
                            button.style.color = '';
                            setTimeout(() => {
                                button.style.transition = '';
                            }, 300);
                        }, 1000);
                        
                    } catch (err) {
                        console.error('处理音频文件失败:', err, {
                            buttonIndex: button.dataset.buttonIndex,
                            categoryId: Array.from(document.querySelector('.nav-item.active').parentNode.children)
                                .indexOf(document.querySelector('.nav-item.active')) + 1
                        });
                        Toast.error('添加音效失败');
                    }
                }
            }
        }));

        // 重命名音效
        menu.append(new MenuItem({
            label: '重命名音效',
            click: () => {
                // 创建遮罩层
                const overlay = document.createElement('div');
                overlay.className = 'dialog-overlay';
                overlay.style.cssText = `
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.5);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 9999;
                `;

                // 创建对话框
                const dialog = document.createElement('div');
                dialog.className = 'rename-dialog';
                dialog.style.cssText = `
                    background: white;
                    padding: 20px;
                    border-radius: 8px;
                    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
                    text-align: center;
                    min-width: 300px;
                `;

                // 添加内容
                dialog.innerHTML = `
                    <h3 style="margin: 0 0 15px 0; color: #333;">重命名音效</h3>
                    <input type="text" id="newName" value="${button.textContent}" style="
                        width: 100%;
                        padding: 8px;
                        margin-bottom: 20px;
                        border: 1px solid #ddd;
                        border-radius: 4px;
                        box-sizing: border-box;
                    ">
                    <div style="display: flex; justify-content: center; gap: 10px;">
                        <button class="cancel-btn" style="
                            padding: 8px 20px;
                            border: 1px solid #ddd;
                            border-radius: 4px;
                            background: #f5f5f5;
                            cursor: pointer;
                        ">取消</button>
                        <button class="confirm-btn" style="
                            padding: 8px 20px;
                            border: none;
                            border-radius: 4px;
                            background: #2587ee;
                            color: white;
                            cursor: pointer;
                        ">确定</button>
                    </div>
                `;

                overlay.appendChild(dialog);
                document.body.appendChild(overlay);

                // 获取输入框并聚焦
                const input = dialog.querySelector('#newName');
                input.focus();
                input.select();

                // 添加按钮事件
                const cancelBtn = dialog.querySelector('.cancel-btn');
                const confirmBtn = dialog.querySelector('.confirm-btn');

                cancelBtn.onclick = () => {
                    document.body.removeChild(overlay);
                };

                confirmBtn.onclick = async () => {
                    const newName = input.value.trim();
                    if (!newName) {
                        Toast.error('名称不能为空');
                        return;
                    }

                    // 获取当前分类ID
                    const currentCategory = document.querySelector('.nav-item.active');
                    const categoryId = Array.from(currentCategory.parentNode.children).indexOf(currentCategory) + 1;
                    
                    // 获取按钮索引
                    const buttonIndex = button.dataset.buttonIndex;

                    // 更新数据库
                    ipcRenderer.invoke('db-run', 'UPDATE sound_buttons SET button_name = ? WHERE button_index = ? AND category_id = ?', [newName, buttonIndex, categoryId])
                        .then(() => {
                            // 更新按钮显示
                            button.textContent = newName;
                            Toast.success('重命名成功');
                        })
                        .catch(err => {
                            console.error('重命名失败:', err);
                            Toast.error('重命名失败');
                        });

                    // 关闭对话框
                    document.body.removeChild(overlay);
                };

                // 点击遮罩层关闭对话框
                overlay.onclick = (e) => {
                    if (e.target === overlay) {
                        document.body.removeChild(overlay);
                    }
                };

                // 添加回车键确认功能
                input.onkeyup = (e) => {
                    if (e.key === 'Enter') {
                        confirmBtn.click();
                    } else if (e.key === 'Escape') {
                        cancelBtn.click();
                    }
                };
            }
        }));

        // 删除音效
        menu.append(new MenuItem({
            label: '删除音效',
            click: async () => {
                try {
                    // 获取当前分类ID和按钮索引
                    const currentCategory = document.querySelector('.nav-item.active');
                    const categoryId = Array.from(currentCategory.parentNode.children).indexOf(currentCategory) + 1;
                    const buttonIndex = button.dataset.buttonIndex;
                    
                    // 使用 IPC 更新数据库 - 清空音效路径、按钮名称和快捷键相关字段
                    await ipcRenderer.invoke('db-run', 
                        `UPDATE sound_buttons SET 
                            sound_path = NULL, 
                            button_name = "", 
                            shortcut_key = NULL, 
                            shortcut_display = NULL 
                        WHERE button_index = ? AND category_id = ?`, 
                        [buttonIndex, categoryId]
                    );

                    // 清空按钮的显示和数据
                    button.dataset.soundPath = '';
                    button.textContent = '';
                    const label = button.parentElement.querySelector('.kuaijiejianbiaoqian');
                    if (label) {
                        label.textContent = '';
                    }

                    Toast.success('音效已删除');
                } catch (err) {
                    console.error('删除音效失败:', err);
                    Toast.error('删除音效失败');
                }
            }
        }));

        // 分隔线
        menu.append(new MenuItem({ type: 'separator' }));

        // 删除按钮
        menu.append(new MenuItem({
            label: '删除按钮',
            click: () => {
                // 创建遮罩层
                const overlay = document.createElement('div');
                overlay.className = 'dialog-overlay';
                overlay.style.cssText = `
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.5);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 9999;
                `;

                // 创建对话框
                const dialog = document.createElement('div');
                dialog.className = 'confirm-dialog';
                dialog.style.cssText = `
                    background: white;
                    padding: 20px;
                    border-radius: 8px;
                    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
                    text-align: center;
                    min-width: 300px;
                `;

                // 添加内容
                dialog.innerHTML = `
                    <h3 style="margin: 0 0 15px 0; color: #333;">确认删除</h3>
                    <p style="margin: 0 0 20px 0; color: #666;">确定要删除这个按钮吗？</p>
                    <div style="display: flex; justify-content: center; gap: 10px;">
                        <button class="cancel-btn" style="
                            padding: 8px 20px;
                            border: 1px solid #ddd;
                            border-radius: 4px;
                            background: #f5f5f5;
                            cursor: pointer;
                        ">取消</button>
                        <button class="confirm-btn" style="
                            padding: 8px 20px;
                            border: none;
                            border-radius: 4px;
                            background: #ff4d4f;
                            color: white;
                            cursor: pointer;
                        ">删除</button>
                    </div>
                `;

                overlay.appendChild(dialog);
                document.body.appendChild(overlay);

                // 添加按钮事件
                const cancelBtn = dialog.querySelector('.cancel-btn');
                const confirmBtn = dialog.querySelector('.confirm-btn');

                cancelBtn.onclick = () => {
                    document.body.removeChild(overlay);
                };

                confirmBtn.onclick = async () => {
                    try {
                        // 获取当前分类ID
                        const currentCategory = document.querySelector('.nav-item.active');
                        const categoryId = Array.from(currentCategory.parentNode.children).indexOf(currentCategory) + 1;
                        
                        // 获取按钮索引
                        const buttonIndex = button.dataset.buttonIndex;
                        
                        // 通过按钮索引和分类ID删除按钮
                        await ipcRenderer.invoke('db-run', 
                            'DELETE FROM sound_buttons WHERE button_index = ? AND category_id = ?', 
                            [buttonIndex, categoryId]
                        );

                        // 获取当前分类下所有按钮并重新排序
                        const rows = await ipcRenderer.invoke('db-query', 
                            'SELECT rowid, * FROM sound_buttons WHERE category_id = ? ORDER BY button_index', 
                            [categoryId]
                        );

                        if (rows.length > 0) {
                            // 开始一个事务来更新所有按钮的索引
                            await ipcRenderer.invoke('db-run', 'BEGIN TRANSACTION');
                            for (const [index, row] of rows.entries()) {
                                await ipcRenderer.invoke('db-run', 
                                    'UPDATE sound_buttons SET button_index = ? WHERE rowid = ? AND category_id = ?', 
                                    [index + 1, row.rowid, categoryId]
                                );
                            }
                            await ipcRenderer.invoke('db-run', 'COMMIT');
                        }

                        // 移除按钮元素
                        button.parentElement.remove();

                        // 更新当前分类下其他按钮的显示索引
                        const currentCategoryButtons = document.querySelectorAll(`.category-${categoryId} .sound-btn`);
                        currentCategoryButtons.forEach((btn, index) => {
                            btn.dataset.buttonIndex = index + 1;
                        });

                        Toast.success('按钮已删除');
                        
                        // 关闭对话框
                        document.body.removeChild(overlay);
                        
                    } catch (err) {
                        console.error('删除按钮失败:', err);
                        Toast.error('删除按钮失败');
                        await ipcRenderer.invoke('db-run', 'ROLLBACK');
                        // 即使失败也关闭对话框
                        document.body.removeChild(overlay);
                    }
                };

                // 点击遮罩层关闭对话框
                overlay.onclick = (e) => {
                    if (e.target === overlay) {
                        document.body.removeChild(overlay);
                    }
                };
            }
        }));

        // 复制音效
        menu.append(new MenuItem({
            label: '复制音效',
            click: () => {
                // 获取当前分类ID
                const currentCategory = document.querySelector('.nav-item.active');
                const categoryId = Array.from(currentCategory.parentNode.children).indexOf(currentCategory) + 1;
                
                // 获取按钮索引
                const buttonIndex = button.dataset.buttonIndex;
                
                // 保存当前按钮信息
                ipcRenderer.invoke('db-query', 'SELECT button_name, sound_path FROM sound_buttons WHERE button_index = ? AND category_id = ?', [buttonIndex, categoryId])
                    .then(rows => {
                        if (rows.length > 0 && rows[0].sound_path) {
                            copiedButton = {
                                buttonName: rows[0].button_name,
                                soundPath: rows[0].sound_path
                            };
                            Toast.success('音效已复制');
                        } else {
                            Toast.error('没有可复制的音效');
                        }
                    })
                    .catch(err => {
                        console.error('获取音效信息失败:', err);
                        Toast.error('获取音效信息失败');
                    });
            }
        }));

        // 粘贴音效
        menu.append(new MenuItem({
            label: '粘贴音效',
            enabled: !!copiedButton,
            click: () => {
                if (!copiedButton) {
                    Toast.error('没有可粘贴的音效');
                    return;
                }
                
                // 获取当前分类ID
                const currentCategory = document.querySelector('.nav-item.active');
                const categoryId = Array.from(currentCategory.parentNode.children).indexOf(currentCategory) + 1;
                
                // 获取按钮索引
                const buttonIndex = button.dataset.buttonIndex;
                
                // 更新数据库
                ipcRenderer.invoke('db-run', 'UPDATE sound_buttons SET button_name = ?, sound_path = ? WHERE button_index = ? AND category_id = ?', [copiedButton.buttonName, copiedButton.soundPath, buttonIndex, categoryId])
                    .then(() => {
                        // 更新按钮显示
                        button.textContent = copiedButton.buttonName;
                        button.dataset.soundPath = copiedButton.soundPath;
                        
                        Toast.success('音效已粘贴');
                    })
                    .catch(err => {
                        console.error('粘贴音效失败:', err);
                        Toast.error('粘贴音效失败');
                    });
            }
        }));

        menu.popup();
    }
});

// 创建音效按钮
function createSoundButton(buttonData) {
    const button = document.createElement('button');
    button.className = 'sound-button';
    button.dataset.buttonId = buttonData.id;
    button.dataset.soundPath = buttonData.sound_path || '';
    
    // 添加点击事件
    button.addEventListener('click', async () => {
        if (buttonData.sound_path) {
            try {
                await AudioController.play(buttonData.sound_path, buttonData.button_name);
            } catch (err) {
                console.error('播放音频失败:', err);
            }
        }
    });

    return button;
}

// 音量控制相关
const volumeSlider = document.querySelector('.volume-slider input');
const volumeValue = document.querySelector('.volume-value');

// 更新音量显示
function updateVolumeDisplay(value) {
    if (volumeValue) {
        volumeValue.textContent = value;
        volumeSlider.style.setProperty('--value', `${value}%`);
    }
}

// 初始化音量
ipcRenderer.invoke('get-config', 'volume').then(volume => {
    if (volumeSlider) {
        volumeSlider.value = volume;
        updateVolumeDisplay(volume);
    }
});

// 监听音量变化
volumeSlider.addEventListener('input', (e) => {
    const value = e.target.value;
    updateVolumeDisplay(value);
    // 更新滑块背景
    e.target.style.setProperty('--value', value + '%');
    ipcRenderer.send('save-config', 'volume', parseInt(value));
});

// 初始化时也设置一次滑块背景
ipcRenderer.invoke('get-config', 'volume').then(volume => {
    if (volumeSlider) {
        volumeSlider.style.setProperty('--value', volume + '%');
    }
});

// 创建全局 Toast 函数
window.showToast = {
    success: (message) => Toast.success(message),
    error: (message) => Toast.error(message),
    warning: (message) => Toast.warning(message),
    info: (message) => Toast.info(message)
}; 

// 控制按钮功能
const btnTopmost = document.getElementById('btnTopmost');
const btnPause = document.getElementById('btnPause');
const btnStop = document.getElementById('btnStop');

// 窗口置顶
btnTopmost.addEventListener('click', () => {
    const win = getCurrentWindow();
    const isTopmost = win.isAlwaysOnTop();
    win.setAlwaysOnTop(!isTopmost);
    btnTopmost.classList.toggle('active', !isTopmost);
});

// 暂停播放
btnPause.addEventListener('click', () => {
    if (AudioController.isPlaying) {
        AudioController.pause();
        btnPause.textContent = '继续播放';
    } else {
        AudioController.resume();
        btnPause.textContent = '暂停播放';
    }
});

// 停止播放
btnStop.addEventListener('click', () => {
    AudioController.stop();
    btnPause.textContent = '暂停播放';
}); 

// 初始化开关状态
function initSwitches() {
    // 获取开关元素
    const shortcutSwitch = document.getElementById('shortcutSwitch');
    
    if (!shortcutSwitch) {
        console.error('找不到快捷键开关元素');
        return;
    }
    
    // 从配置中读取初始状态
    ipcRenderer.invoke('get-config', 'shortcuts').then(value => {
        console.log('快捷键开关状态:', value);
        shortcutSwitch.checked = value;
        
        // 根据初始状态设置快捷键
        ipcRenderer.send('set-shortcuts-enabled', value);
        
        // 添加事件监听
        shortcutSwitch.addEventListener('change', (e) => {
            console.log('快捷键开关变化:', e.target.checked);
            // 保存配置
            ipcRenderer.send('save-config', 'shortcuts', e.target.checked);
            // 启用/禁用快捷键
            ipcRenderer.send('set-shortcuts-enabled', e.target.checked);
        });
    });
}

// 初始化音量控制
async function initVolumeControl() {
    try {
        // 从配置中获取音量值
        const volume = await ipcRenderer.invoke('get-config', 'volume');
        console.log('初始化音量控制:', volume);
        
        // 设置音量滑块的值
        const volumeSlider = document.querySelector('.volume-slider input');
        const volumeValue = document.querySelector('.volume-value');
        if (volumeSlider && volumeValue) {
            volumeSlider.value = volume;
            volumeValue.textContent = volume;
            
            // 添加音量变化事件监听
            volumeSlider.addEventListener('input', (e) => {
                const newVolume = parseInt(e.target.value);
                ipcRenderer.send('save-config', 'volume', newVolume);
                volumeValue.textContent = e.target.value;
            });
        }
    } catch (err) {
        console.error('初始化音量控制失败:', err);
    }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    window.onerror = function(msg, url, lineNo, columnNo, error) {
        console.log('Error: ' + msg + '\nURL: ' + url + '\nLine: ' + lineNo + '\nColumn: ' + columnNo + '\nError object: ' + JSON.stringify(error));
        return false;
    };
    initSwitches();
    initVolumeControl();
    console.log('初始化开关状态');
    initContextMenu();
    // 列出所有可能的按钮
    const buttons = document.querySelectorAll('[data-name]');
    console.log('找到的所有按钮:', Array.from(buttons).map(b => b.getAttribute('data-name')));

    // 初始化特殊按钮的快捷键显示
    const specialButtons = [
        { id: 'btnStop', type: 'stop', name: '停止播放' },
        { id: 'btnPause', type: 'pause', name: '暂停播放' },
        { id: 'shortcutSwitch', type: 'toggle_hotkey', name: '快捷键开关' }
    ];

    specialButtons.forEach(button => {
        ipcRenderer.invoke('db-query', 'SELECT shortcut_display FROM sound_buttons WHERE button_name = ? AND action_type = ?', [button.name, button.type])
            .then(rows => {
                if (rows.length > 0 && rows[0].shortcut_display) {
                    // 找到对应按钮的标签元素
                    const label = document.querySelector(`#${button.id} + .kuaijiejianbiaoqian`);
                    if (label) {
                        label.textContent = rows[0].shortcut_display;
                    }
                }
            })
            .catch(err => {
                console.error(`查询${button.name}快捷键失败:`, err);
            });
    });

    console.log('开始测试标签访问');
    
    // 尝试找到停止播放的快捷键标签
    const stopShortcut = document.getElementById('stopShortcut');
    
    if (stopShortcut) {
        console.log('找到停止播放标签元素');
        stopShortcut.textContent = '666';
    } else {
        console.error('未找到停止播放标签元素 (stopShortcut)');
        
        // 输出所有 div 元素的 id，帮助调试
        const allDivs = document.getElementsByTagName('div');
        console.log('页面中所有的 div 元素 id:');
        Array.from(allDivs).forEach(div => {
            if (div.id) {
                console.log('- div id:', div.id);
            }
        });
    }

    // 确保快捷键开关的 action_type 正确
    ipcRenderer.invoke('db-query', 'SELECT action_type FROM sound_buttons WHERE button_name = ?', ['shortcut'])
        .then(rows => {
            if (rows.length > 0 && rows[0].action_type !== 'toggle_hotkey') {
                ipcRenderer.invoke('db-run', 'UPDATE sound_buttons SET action_type = ? WHERE button_name = ?', ['toggle_hotkey', 'shortcut'])
                    .then(() => {
                        console.log('已更新快捷键开关的 action_type');
                    })
                    .catch(err => {
                        console.error('更新快捷键开关类型失败:', err);
                    });
            }
        })
        .catch(err => {
            console.error('查询快捷键开关记录失败:', err);
        });
}); 

// 添加热键触发的监听
ipcRenderer.on('trigger-sound-button', (event, buttonId) => {
    console.log('收到快捷键触发事件:', buttonId);
}); 

// 页面加载时注册所有快捷键
document.addEventListener('DOMContentLoaded', () => {
    registerAllShortcuts();
});

// 注册所有快捷键的函数
function registerAllShortcuts() {
    ipcRenderer.invoke('db-query', 'SELECT button_name, shortcut_key FROM sound_buttons WHERE shortcut_key IS NOT NULL')
        .then(rows => {
            const shortcuts = rows.map(row => ({
                buttonName: row.button_name,
                key: row.shortcut_key
            }));
            
            ipcRenderer.send('register-all-shortcuts', shortcuts);
        })
        .catch(err => {
            console.error('获取快捷键失败:', err);
        });
}

// 快捷键触发事件处理
ipcRenderer.on('shortcut-triggered', (event, buttonName) => {
    // 直接从数据库获取按钮信息
    ipcRenderer.invoke('db-query', 'SELECT * FROM sound_buttons WHERE button_name = ?', [buttonName])
        .then(rows => {
            if (rows.length > 0 && rows[0].sound_path) {
                try {
                    console.log('播放音频:', rows[0].sound_path);
                    AudioController.play(rows[0].sound_path, rows[0].button_name);
                } catch (err) {
                    console.error('播放音频失败:', err);
                }
            }
        })
        .catch(err => {
            console.error('获取按钮信息失败:', err);
        });
});

// 清除快捷键
function clearShortcut(buttonName) {
    ipcRenderer.invoke('db-query', 'SELECT shortcut_key FROM sound_buttons WHERE button_name = ?', [buttonName])
        .then(rows => {
            if (rows.length > 0 && rows[0].shortcut_key) {
                ipcRenderer.send('unregister-shortcut', rows[0].shortcut_key);
                
                // 从数据库中清除快捷键
                ipcRenderer.invoke('db-run', 'UPDATE sound_buttons SET shortcut_key = NULL, shortcut_display = NULL WHERE button_name = ?', [buttonName])
                    .then(() => {
                        // 重新注册所有快捷键
                        registerAllShortcuts();
                        
                        Toast.success('快捷键已清除');
                    })
                    .catch(err => {
                        console.error('清除快捷键失败:', err);
                        Toast.error('清除快捷键失败');
                    });
            }
        })
        .catch(err => {
            console.error('获取快捷键失败:', err);
        });
}

// 添加闪烁动画的样式
const style = document.createElement('style');
style.textContent = `
    @keyframes highlight {
        0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(255, 77, 79, 0.4); }
        50% { transform: scale(1.05); box-shadow: 0 0 0 10px rgba(255, 77, 79, 0); }
        100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(255, 77, 79, 0); }
    }
`;
document.head.appendChild(style); 

// 添加重新注册快捷键的监听
ipcRenderer.on('re-register-shortcuts', () => {
    registerAllShortcuts();
}); 

// 为按钮添加拖放音频文件功能
function addDropZoneToButton(btn) {
    btn.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        btn.style.border = '2px dashed #2587ee';
        btn.style.backgroundColor = 'rgba(37, 135, 238, 0.1)';
        btn.style.transform = 'scale(1.05)';
        btn.style.transition = 'all 0.2s';
    });

    btn.addEventListener('dragleave', (e) => {
        e.preventDefault();
        e.stopPropagation();
        btn.style.border = '';
        btn.style.backgroundColor = '';
        btn.style.transform = '';
    });

    btn.addEventListener('drop', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        // 重置样式
        btn.style.border = '';
        btn.style.backgroundColor = '';
        btn.style.transform = '';

        const files = e.dataTransfer.files;
        if (files.length > 0) {
            const file = files[0];
            if (file.type.startsWith('audio/') || file.name.match(/\.(mp3|wav|ogg|m4a)$/i)) {
                try {
                    // 获取不带扩展名的文件名作为按钮名
                    const buttonName = file.name.replace(/\.[^/.]+$/, '');
                    
                    // 加密文件名加上 .rack 后缀
                    const encryptedFileName = buttonName + '.rack';
                    const targetPath = 'sounds/' + encryptedFileName;
                    
                    await AudioEncryption.encryptAudio(
                        file.path, 
                        path.join(process.cwd(), 'sounds', encryptedFileName)
                    );
                    
                    // 获取当前分类ID和按钮索引
                    const currentCategory = document.querySelector('.nav-item.active');
                    const categoryId = Array.from(currentCategory.parentNode.children).indexOf(currentCategory) + 1;
                    const buttonIndex = btn.dataset.buttonIndex;

                    // 更新数据库 - 使用不带后缀的文件名作为按钮名
                    await ipcRenderer.invoke('db-run', 
                        'UPDATE sound_buttons SET button_name = ?, sound_path = ? WHERE button_index = ? AND category_id = ?',
                        [
                            buttonName,  // 使用不带后缀的名字
                            targetPath,
                            buttonIndex,
                            categoryId
                        ]
                    );
                    
                    // 更新按钮显示 - 同样使用不带后缀的名字
                    btn.dataset.soundPath = targetPath;
                    btn.textContent = buttonName;
                    
                    Toast.success('音频设置成功');
                    
                } catch (err) {
                    console.error('处理音频文件失败:', err);
                    Toast.error('设置音频失败');
                }
            } else {
                Toast.error('请拖放音频文件');
            }
        }
    });
}

// 为所有按钮添加拖放功能
function initAudioDrop() {
    // 为现有按钮添加拖放功能
    document.querySelectorAll('.sound-btn').forEach(btn => {
        addDropZoneToButton(btn);
    });

    // 修改创建按钮函数，为新按钮添加拖放功能
    const originalCreateButtonWithLabel = window.createButtonWithLabel;
    window.createButtonWithLabel = function(name, shortcut) {
        const container = originalCreateButtonWithLabel(name, shortcut);
        const btn = container.querySelector('.sound-btn');
        addDropZoneToButton(btn);
        return container;
    };
}

// 在页面加载完成后初始化拖放功能
document.addEventListener('DOMContentLoaded', () => {
    initAudioDrop();
}); 

// 检查所有按钮
document.addEventListener('DOMContentLoaded', () => {
    const buttons = document.querySelectorAll('.sound-btn');
    console.log('找到的所有按钮:', Array.from(buttons).map(btn => ({
        text: btn.textContent,
        dataset: btn.dataset,
        attributes: Array.from(btn.attributes).map(attr => ({
            name: attr.name,
            value: attr.value
        }))
    })));
}); 

// 创建右键菜单
function createContextMenu(button) {
    const menu = new Menu();
    const buttonName = button.textContent;
    
    // 从数据库中获取按钮的快捷键和音效信息
    ipcRenderer.invoke('db-query', 'SELECT shortcut_key, sound_path FROM sound_buttons WHERE button_name = ?', [buttonName])
        .then(rows => {
            if (rows.length > 0) {
                const hasShortcut = rows[0].shortcut_key;
                const hasSoundEffect = rows[0].sound_path;

                // 添加到顶部菜单
                menu.append(new MenuItem({
                    label: '添加到顶部菜单',
                    click: () => {
                        console.log('添加到顶部菜单:', buttonName);
                    }
                }));

                // 分隔线
                menu.append(new MenuItem({ type: 'separator' }));

                // 音效相关菜单
                menu.append(new MenuItem({
                    label: '添加音效',
                    click: async () => {
                        const result = await ipcRenderer.invoke('show-open-dialog', {
                            filters: [
                                { name: '音频文件', extensions: ['mp3', 'wav', 'ogg', 'm4a'] }
                            ]
                        });
                        if (!result.canceled && result.filePaths.length > 0) {
                            const filePath = result.filePaths[0];
                            try {
                                // 加密并复制音频文件到应用目录
                                const targetPath = await ipcRenderer.invoke('copy-file-to-app', filePath);
                                
                                // 获取文件名（不包含扩展名）作为按钮名称
                                const fileName = path.basename(filePath, path.extname(filePath));
                                
                                // 获取当前分类ID和按钮索引
                                const currentCategory = document.querySelector('.nav-item.active');
                                const categoryId = Array.from(currentCategory.parentNode.children).indexOf(currentCategory) + 1;
                                const buttonIndex = button.dataset.buttonIndex;

                                // 打印调试信息
                                console.log('更新按钮信息:', {
                                    fileName,
                                    targetPath,
                                    buttonIndex,
                                    categoryId,
                                    button: button.dataset
                                });
                                
                                // 更新数据库，使用 button_index 和 category_id 定位按钮
                                await ipcRenderer.invoke('db-run', 
                                    'UPDATE sound_buttons SET button_name = ?, sound_path = ? WHERE button_index = ? AND category_id = ?', 
                                    [fileName, targetPath, buttonIndex, categoryId]
                                );

                                // 验证更新是否成功
                                const updatedRow = await ipcRenderer.invoke('db-query',
                                    'SELECT * FROM sound_buttons WHERE button_index = ? AND category_id = ?',
                                    [buttonIndex, categoryId]
                                );
                                console.log('更新后的数据库记录:', updatedRow);
                                
                                // 更新按钮显示
                                button.textContent = fileName;
                                button.dataset.soundPath = targetPath;

                                Toast.success('音效添加成功');
                                
                                // 添加动画效果
                                button.style.transition = 'all 0.3s';
                                button.style.backgroundColor = '#4CAF50';
                                button.style.color = 'white';
                                
                                setTimeout(() => {
                                    button.style.backgroundColor = '';
                                    button.style.color = '';
                                    setTimeout(() => {
                                        button.style.transition = '';
                                    }, 300);
                                }, 1000);
                                
                            } catch (err) {
                                console.error('处理音频文件失败:', err, {
                                    buttonIndex: button.dataset.buttonIndex,
                                    categoryId: Array.from(document.querySelector('.nav-item.active').parentNode.children)
                                        .indexOf(document.querySelector('.nav-item.active')) + 1
                                });
                                Toast.error('添加音效失败');
                            }
                        }
                    }
                }));

                if (hasSoundEffect) {
                    menu.append(new MenuItem({
                        label: '删除音效',
                        click: async () => {
                            try {
                                // 获取当前分类ID和按钮索引
                                const currentCategory = document.querySelector('.nav-item.active');
                                const categoryId = Array.from(currentCategory.parentNode.children).indexOf(currentCategory) + 1;
                                const buttonIndex = button.dataset.buttonIndex;
                                
                                // 使用 IPC 更新数据库 - 清空音效路径、按钮名称和快捷键相关字段
                                await ipcRenderer.invoke('db-run', 
                                    `UPDATE sound_buttons SET 
                                        sound_path = NULL, 
                                        button_name = "", 
                                        shortcut_key = NULL, 
                                        shortcut_display = NULL 
                                    WHERE button_index = ? AND category_id = ?`, 
                                    [buttonIndex, categoryId]
                                );

                                // 清空按钮的显示和数据
                                button.dataset.soundPath = '';
                                button.textContent = '';
                                const label = button.parentElement.querySelector('.kuaijiejianbiaoqian');
                                if (label) {
                                    label.textContent = '';
                                }

                                Toast.success('音效已删除');
                            } catch (err) {
                                console.error('删除音效失败:', err);
                                Toast.error('删除音效失败');
                            }
                        }
                    }));
                }

                // 复制音效
                menu.append(new MenuItem({
                    label: '复制音效',
                    click: () => {
                        // 获取当前分类ID
                        const currentCategory = document.querySelector('.nav-item.active');
                        const categoryId = Array.from(currentCategory.parentNode.children).indexOf(currentCategory) + 1;
                        
                        // 获取按钮索引
                        const buttonIndex = button.dataset.buttonIndex;
                        
                        // 保存当前按钮信息
                        ipcRenderer.invoke('db-query', 'SELECT button_name, sound_path FROM sound_buttons WHERE button_index = ? AND category_id = ?', [buttonIndex, categoryId])
                            .then(rows => {
                                if (rows.length > 0 && rows[0].sound_path) {
                                    copiedButton = {
                                        buttonName: rows[0].button_name,
                                        soundPath: rows[0].sound_path
                                    };
                                    Toast.success('音效已复制');
                                } else {
                                    Toast.error('没有可复制的音效');
                                }
                            })
                            .catch(err => {
                                console.error('获取音效信息失败:', err);
                                Toast.error('获取音效信息失败');
                            });
                    }
                }));

                // 粘贴音效
                menu.append(new MenuItem({
                    label: '粘贴音效',
                    enabled: !!copiedButton,
                    click: () => {
                        if (!copiedButton) {
                            Toast.error('没有可粘贴的音效');
                            return;
                        }
                        
                        // 获取当前分类ID
                        const currentCategory = document.querySelector('.nav-item.active');
                        const categoryId = Array.from(currentCategory.parentNode.children).indexOf(currentCategory) + 1;
                        
                        // 获取按钮索引
                        const buttonIndex = button.dataset.buttonIndex;
                        
                        // 更新数据库
                        ipcRenderer.invoke('db-run', 'UPDATE sound_buttons SET button_name = ?, sound_path = ? WHERE button_index = ? AND category_id = ?', [copiedButton.buttonName, copiedButton.soundPath, buttonIndex, categoryId])
                            .then(() => {
                                // 更新按钮显示
                                button.textContent = copiedButton.buttonName;
                                button.dataset.soundPath = copiedButton.soundPath;
                                
                                Toast.success('音效已粘贴');
                            })
                            .catch(err => {
                                console.error('粘贴音效失败:', err);
                                Toast.error('粘贴音效失败');
                            });
                    }
                }));

                // 分隔线
                menu.append(new MenuItem({ type: 'separator' }));

                // 快捷键相关菜单
                if (hasShortcut) {
                    menu.append(new MenuItem({
                        label: '清除快捷键',
                        click: async () => {
                            try {
                                await clearShortcut(buttonName);
                            } catch (err) {
                                console.error('清除快捷键失败:', err);
                            }
                        }
                    }));
                }

                menu.append(new MenuItem({
                    label: hasShortcut ? '修改快捷键' : '设置快捷键',
                    click: () => {
                        ShortcutDialog.show(button.dataset.buttonIndex);
                    }
                }));

                // 分隔线
                menu.append(new MenuItem({ type: 'separator' }));

                // 删除按钮
                menu.append(new MenuItem({
                    label: '删除按钮',
                    click: () => {
                        // 创建遮罩层
                        const overlay = document.createElement('div');
                        overlay.className = 'dialog-overlay';
                        overlay.style.cssText = `
                            position: fixed;
                            top: 0;
                            left: 0;
                            right: 0;
                            bottom: 0;
                            background: rgba(0, 0, 0, 0.5);
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            z-index: 9999;
                        `;

                        // 创建对话框
                        const dialog = document.createElement('div');
                        dialog.className = 'confirm-dialog';
                        dialog.style.cssText = `
                            background: white;
                            padding: 20px;
                            border-radius: 8px;
                            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
                            text-align: center;
                            min-width: 300px;
                        `;

                        // 添加内容
                        dialog.innerHTML = `
                            <h3 style="margin: 0 0 15px 0; color: #333;">确认删除</h3>
                            <p style="margin: 0 0 20px 0; color: #666;">确定要删除这个按钮吗？</p>
                            <div style="display: flex; justify-content: center; gap: 10px;">
                                <button class="cancel-btn" style="
                                    padding: 8px 20px;
                                    border: 1px solid #ddd;
                                    border-radius: 4px;
                                    background: #f5f5f5;
                                    cursor: pointer;
                                ">取消</button>
                                <button class="confirm-btn" style="
                                    padding: 8px 20px;
                                    border: none;
                                    border-radius: 4px;
                                    background: #ff4d4f;
                                    color: white;
                                    cursor: pointer;
                                ">删除</button>
                            </div>
                        `;

                        overlay.appendChild(dialog);
                        document.body.appendChild(overlay);

                        // 添加按钮事件
                        const cancelBtn = dialog.querySelector('.cancel-btn');
                        const confirmBtn = dialog.querySelector('.confirm-btn');

                        cancelBtn.onclick = () => {
                            document.body.removeChild(overlay);
                        };

                        confirmBtn.onclick = async () => {
                            try {
                                // 获取当前分类ID
                                const currentCategory = document.querySelector('.nav-item.active');
                                const categoryId = Array.from(currentCategory.parentNode.children).indexOf(currentCategory) + 1;
                                
                                // 获取按钮索引
                                const buttonIndex = button.dataset.buttonIndex;
                                
                                // 通过按钮索引和分类ID删除按钮
                                await ipcRenderer.invoke('db-run', 
                                    'DELETE FROM sound_buttons WHERE button_index = ? AND category_id = ?', 
                                    [buttonIndex, categoryId]
                                );

                                // 获取当前分类下所有按钮并重新排序
                                const rows = await ipcRenderer.invoke('db-query', 
                                    'SELECT rowid, * FROM sound_buttons WHERE category_id = ? ORDER BY button_index', 
                                    [categoryId]
                                );

                                if (rows.length > 0) {
                                    // 开始一个事务来更新所有按钮的索引
                                    await ipcRenderer.invoke('db-run', 'BEGIN TRANSACTION');
                                    for (const [index, row] of rows.entries()) {
                                        await ipcRenderer.invoke('db-run', 
                                            'UPDATE sound_buttons SET button_index = ? WHERE rowid = ? AND category_id = ?', 
                                            [index + 1, row.rowid, categoryId]
                                        );
                                    }
                                    await ipcRenderer.invoke('db-run', 'COMMIT');
                                }

                                // 移除按钮元素
                                button.parentElement.remove();

                                // 更新当前分类下其他按钮的显示索引
                                const currentCategoryButtons = document.querySelectorAll(`.category-${categoryId} .sound-btn`);
                                currentCategoryButtons.forEach((btn, index) => {
                                    btn.dataset.buttonIndex = index + 1;
                                });

                                Toast.success('按钮已删除');
                                
                                // 关闭对话框
                                document.body.removeChild(overlay);
                                
                            } catch (err) {
                                console.error('删除按钮失败:', err);
                                Toast.error('删除按钮失败');
                                await ipcRenderer.invoke('db-run', 'ROLLBACK');
                                // 即使失败也关闭对话框
                                document.body.removeChild(overlay);
                            }
                        };

                        // 点击遮罩层关闭对话框
                        overlay.onclick = (e) => {
                            if (e.target === overlay) {
                                document.body.removeChild(overlay);
                            }
                        };
                    }
                }));

                // 显示菜单
                menu.popup();
            }
        })
        .catch(err => {
            console.error('查询按钮信息失败:', err);
        });

    return menu;
}

// 为所有音效按钮添加右键菜单
document.querySelectorAll('.sound-button').forEach(button => {
    button.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        createContextMenu(button);
    });
}); 

// 监听快捷键注册结果
ipcRenderer.on('shortcut-registered', (event, { success, shortcut, buttonId }) => {
    if (success) {
        console.log('快捷键注册成功:', shortcut, buttonId);
    } else {
        console.error('快捷键注册失败:', shortcut, buttonId);
        Toast.error('快捷键注册失败');
    }
}); 

// 添加重新加载快捷键的监听器
ipcRenderer.on('reload-shortcuts', () => {
    console.log('收到重新加载快捷键请求');
    loadAndRegisterShortcuts();
});

// 修改快捷键开关处理函数
function toggleShortcuts(enabled) {
    console.log('切换快捷键状态:', enabled);
    ipcRenderer.send('set-shortcuts-enabled', enabled);
    
    if (enabled) {
        // 启用时主动重新加载快捷键
        console.log('重新加载快捷键');
        loadAndRegisterShortcuts();
    }
} 

// 快捷键设置对话框的事件处理
function handleKeyDown(e) {
    e.preventDefault();
    
    console.log('\n========== 按键事件信息 ==========');
    console.log('按键事件:', {
        key: e.key,
        code: e.code,
        keyCode: e.keyCode,
        which: e.which
    });

    // 直接使用 keyCode，不要用 code 属性
    const keyCode = e.keyCode || e.which;

    // 检查快捷键冲突
    ipcRenderer.invoke('db-query', 'SELECT button_name FROM sound_buttons WHERE shortcut_key = ?', [keyCode])
        .then(rows => {
            if (rows.length > 0) {
                // 发现冲突
                const confirmReplace = confirm(
                    `此快捷键已被按钮"${rows[0].button_name}"使用\n是否要替换？`
                );
                
                if (!confirmReplace) {
                    console.log('用户取消了快捷键设置');
                    return;
                }

                // 用户确认替换，清除原按钮的快捷键
                ipcRenderer.invoke('db-run', 'UPDATE sound_buttons SET shortcut_key = NULL, shortcut_display = NULL WHERE button_name = ?', [rows[0].button_name])
                    .then(() => {
                        // 继续设置新的快捷键
                        setNewShortcut(keyCode);
                    })
                    .catch(err => {
                        console.error('清除原快捷键失败:', err);
                        Toast.error('设置快捷键失败');
                    });
            } else {
                // 没有冲突，直接设置新的快捷键
                setNewShortcut(keyCode);
            }
        })
        .catch(err => {
            console.error('检查快捷键冲突失败:', err);
        });
}

// 设置新的快捷键
function setNewShortcut(keyCode) {
    console.log('\n========== 设置快捷键 ==========');
    console.log('收到的键码:', keyCode);
    
    let shortcutDisplay = '';
    let shortcutKey = '';

    // 处理不同类型的按键
    if (keyCode >= 96 && keyCode <= 105) {
        // 小键盘数字
        shortcutKey = keyCode.toString();
        shortcutDisplay = `小键盘${keyCode - 96}`;
    } else if (keyCode >= 49 && keyCode <= 57) {
        // 主键盘数字 (49-57)
        shortcutKey = (keyCode - 48).toString();
        shortcutDisplay = String(keyCode - 48);
    } else if (keyCode >= 65 && keyCode <= 90) {
        // 字母键
        shortcutKey = `Key${String.fromCharCode(keyCode)}`;
        shortcutDisplay = String.fromCharCode(keyCode);
    } else if (keyCode >= 112 && keyCode <= 123) {
        // 功能键
        shortcutKey = `F${keyCode - 111}`;
        shortcutDisplay = `F${keyCode - 111}`;
    }

    if (shortcutDisplay) {
        ipcRenderer.invoke('db-run', 'UPDATE sound_buttons SET shortcut_key = ?, shortcut_display = ? WHERE button_name = ?', [shortcutKey, shortcutDisplay, currentButton])
            .then(() => {
                // ... 其余代码保持不变 ...
            })
            .catch(err => {
                console.error('保存快捷键失败:', err);
                Toast.error('设置快捷键失败');
            });
    }
}

// 添加快捷键设置成功的事件监听
document.addEventListener('shortcut-selected', (event) => {
    const { target, key, display, categoryId } = event.detail;
    
    // 更新按钮显示
    const button = document.querySelector(`.sound-btn[data-button-index="${target}"]`);
    if (button) {
        const label = button.parentElement.querySelector('.kuaijiejianbiaoqian');
        if (label) {
            label.textContent = display;
        }
    }

    // 注册新快捷键
    const keyCode = parseInt(key);
    let accelerator;
    
    // 转换键码为快捷键格式
    if (keyCode >= 96 && keyCode <= 105) {
        // 小键盘数字
        accelerator = `num${keyCode - 96}`;
    } else if (keyCode >= 48 && keyCode <= 57) {
        // 主键盘数字
        accelerator = String(keyCode - 48);
    } else if (keyCode >= 65 && keyCode <= 90) {
        // 字母键
        accelerator = String.fromCharCode(keyCode);
    } else if (keyCode >= 112 && keyCode <= 123) {
        // 功能键
        accelerator = `F${keyCode - 111}`;
    }

    if (accelerator) {
        ipcRenderer.send('register-shortcut', {
            shortcut: accelerator,
            buttonId: target
        });
    }

    Toast.success('快捷键设置成功');
}); 

// 处理快捷键的函数
function handleShortcut(keyCode) {
    // 先查询这个键码对应的按钮
    ipcRenderer.invoke('db-query', 'SELECT * FROM sound_buttons WHERE shortcut_key = ?', [keyCode.toString()])
        .then(rows => {
            if (rows.length > 0) {
                console.log('找到快捷键对应的按钮:', rows[0]);
                
                // 判断是否是停止播放
                if (rows[0].sound_path === '停止播放') {
                    console.log('触发停止播放快捷键');
                    // 这里可以调用停止播放的函数
                    AudioController.stop();
                } else {
                    // 其他普通按钮的处理逻辑
                    if (rows[0].sound_path) {
                        AudioController.play(rows[0].sound_path, rows[0].button_name);
                    }
                }
            }
        })
        .catch(err => {
            console.error('查询快捷键失败:', err);
        });
} 

document.addEventListener('DOMContentLoaded', () => {
    console.log('开始初始化特殊按钮快捷键显示');
    
    ipcRenderer.invoke('db-query', 'SELECT button_name, shortcut_display, action_type FROM sound_buttons WHERE action_type IN (\'stop\', \'pause\', \'toggle_hotkey\')')
        .then(rows => {
            if (rows.length > 0) {
                console.log('查询到的特殊按钮数据:', rows);

                // 处理每个特殊按钮
                rows.forEach(row => {
                    let labelId;
                    switch (row.action_type) {
                        case 'stop':
                            labelId = 'stopShortcut';
                            break;
                        case 'pause':
                            labelId = 'pauseShortcut';
                            break;
                        case 'toggle_hotkey':
                            labelId = 'shortcutTip';
                            break;
                    }

                    if (labelId) {
                        const label = document.getElementById(labelId);
                        if (label) {
                            console.log(`更新${row.action_type}的快捷键显示:`, row.shortcut_display);
                            label.textContent = row.shortcut_display || '未设置';
                        } else {
                            console.log(`未找到标签元素:`, labelId);
                        }
                    }
                });
            }
        })
        .catch(err => {
            console.error('查询特殊按钮快捷键失败:', err);
            ipcRenderer.invoke('db-run', 'ROLLBACK');
        });
}); 

// 添加快捷键开关的监听
ipcRenderer.on('toggle-shortcuts', () => {
    const shortcutSwitch = document.getElementById('shortcutSwitch');
    if (shortcutSwitch) {
        shortcutSwitch.click();
    }
}); 

// 处理外部音频文件播放
ipcRenderer.on('play-external-audio', async (event, filePath) => {
    // 获取当前分类ID
    const currentCategory = document.querySelector('.nav-item.active');
    const categoryId = Array.from(currentCategory.parentNode.children).indexOf(currentCategory) + 1;
    
    // 获取当前分类下最大的按钮索引
    ipcRenderer.invoke('db-query', 'SELECT MAX(button_index) as maxIndex FROM sound_buttons WHERE category_id = ?', [categoryId])
        .then(rows => {
            if (rows.length > 0) {
                const newIndex = (rows[0].maxIndex || 0) + 1;
                const fileName = path.basename(filePath, path.extname(filePath));

                // 加密并复制音频文件
                AudioEncryption.encryptAudio(filePath, path.join(process.cwd(), 'sounds', fileName + '.rack'))
                    .then(() => {
                        // 更新数据库，包含分类ID
                        ipcRenderer.invoke('db-run', 'INSERT INTO sound_buttons (button_name, button_index, sound_path, category_id) VALUES (?, ?, ?, ?)', [fileName, newIndex, 'sounds/' + fileName + '.rack', categoryId])
                            .then(() => {
                                // 创建新按钮
                                const buttonContainer = createButtonWithLabel(fileName, '');
                                const btn = buttonContainer.querySelector('.sound-btn');
                                btn.dataset.soundPath = 'sounds/' + fileName + '.rack';
                                btn.dataset.buttonIndex = newIndex;
                                btn.dataset.categoryId = categoryId;
                                
                                // 添加到当前分类的容器中
                                const currentCategoryContainer = document.querySelector(`.category-${categoryId}`);
                                currentCategoryContainer.appendChild(buttonContainer);
                                
                                // 添加拖放功能
                                addDropZoneToButton(btn);
                                
                                Toast.success('音频添加成功');
                            })
                            .catch(err => {
                                console.error('保存按钮失败:', err);
                                Toast.error('添加音频失败');
                            });
                    })
                    .catch(err => {
                        console.error('处理音频文件失败:', err);
                        Toast.error('添加音频失败');
                    });
            }
        })
        .catch(err => {
            console.error('获取最大索引失败:', err);
        });
}); 

// 添加触发按钮的监听器
ipcRenderer.on('trigger-button', (event, buttonIndex) => {
    // 找到对应的按钮并触发点击
    const button = document.querySelector(`[data-index="${buttonIndex}"]`);
    if (button) {
        button.click();
    }
}); 