const ShortcutDialog = require('./shortcutDialog.js');
const sqlite3 = require('sqlite3');
const path = require('path');
const { ipcRenderer } = require('electron');
const { Menu, MenuItem } = require('electron');
const Toast = require('./toast.js');

// 创建菜单元素
function createContextMenu(targetType) {
    // 如果已存在菜单，则移除
    const existingMenu = document.getElementById('contextMenu');
    if (existingMenu) {
        existingMenu.remove();
    }

    // 创建菜单容器
    const menu = document.createElement('div');
    menu.id = 'contextMenu';
    menu.className = 'context-menu';
    
    // 创建菜单项
    const setShortcut = document.createElement('div');
    setShortcut.className = 'menu-item';
    setShortcut.textContent = '设置快捷键';
    setShortcut.onclick = () => {
        ShortcutDialog.show(targetType);
        hideContextMenu();
    };

    const clearShortcut = document.createElement('div');
    clearShortcut.className = 'menu-item';
    clearShortcut.textContent = '清除快捷键';
    clearShortcut.onclick = () => {
        console.log('清除快捷键，目标类型:', targetType);
        
        const db = new sqlite3.Database(path.join(__dirname, '../../soundbuttons.db'), (err) => {
            if (err) {
                console.error('数据库连接错误:', err);
                return;
            }

            // 先查询当前的快捷键，以便注销
            db.get(
                'SELECT shortcut_key FROM sound_buttons WHERE button_name = ?',
                [targetType === 'shortcut' ? 'toggle' : targetType],
                (err, row) => {
                    if (err) {
                        console.error('查询快捷键失败:', err);
                        return;
                    }

                    // 如果有快捷键，先注销它
                    if (row && row.shortcut_key) {
                        // 通知主进程注销快捷键
                        ipcRenderer.send('unregister-shortcut', row.shortcut_key);
                    }

                    // 然后清除数据库记录
                    const query = `
                        UPDATE sound_buttons
                        SET shortcut_key = NULL,
                            shortcut_display = NULL
                        WHERE button_name = ?
                    `;

                    db.run(query, [targetType === 'shortcut' ? 'toggle' : targetType], function(err) {
                        if (err) {
                            console.error('清除快捷键失败:', err);
                            Toast.error('清除快捷键失败');
                            return;
                        }

                        // 更新显示
                        let labelId;
                        switch (targetType) {
                            case 'stop':
                                labelId = 'stopShortcut';
                                break;
                            case 'pause':
                                labelId = 'pauseShortcut';
                                break;
                            case 'shortcut':
                                labelId = 'shortcutTip';
                                break;
                        }

                        if (labelId) {
                            const label = document.getElementById(labelId);
                            if (label) {
                                label.textContent = '未设置';
                            }
                        }

                        Toast.success('清除快捷键成功');
                        db.close();
                    });
                }
            );
        });

        hideContextMenu();
    };

    // 组装菜单
    menu.appendChild(setShortcut);
    menu.appendChild(clearShortcut);
    document.body.appendChild(menu);

    return menu;
}

// 显示菜单
function showContextMenu(e, targetType) {
    const menu = createContextMenu(targetType);
    
    // 获取目标元素
    const targetElement = document.getElementById(targetType === 'pause' ? 'btnPause' : 
                                                targetType === 'stop' ? 'btnStop' : 
                                                'shortcutSwitch');
    const rect = targetElement.getBoundingClientRect();
    
    // 计算菜单位置
    const menuWidth = 120;
    const menuHeight = 64;
    
    // 计算箭头位置和菜单位置
    let x = rect.left + (rect.width - menuWidth) / 2;
    let y;
    let arrowClass;
    
    // 检查是否有足够空间在下方显示
    if (rect.bottom + menuHeight + 20 <= window.innerHeight) {
        y = rect.bottom + 10;
        arrowClass = 'arrow-bottom';
    } else {
        y = rect.top - menuHeight - 10;
        arrowClass = 'arrow-top';
    }
    
    // 边界检查
    if (x < 10) x = 10;
    if (x + menuWidth > window.innerWidth - 10) {
        x = window.innerWidth - menuWidth - 10;
    }
    
    // 设置菜单位置和箭头样式
    menu.style.left = Math.round(x) + 'px';
    menu.style.top = Math.round(y) + 'px';
    menu.classList.add(arrowClass);
    
    menu.style.display = 'block';
    e.preventDefault();
}

// 隐藏菜单
function hideContextMenu() {
    const menu = document.getElementById('contextMenu');
    if (menu) {
        menu.remove();
    }
}

// 初始化右键菜单事件
function initContextMenu() {
    // 点击其他地方隐藏菜单
    document.addEventListener('click', hideContextMenu);
    
    // 停止播放按钮右键菜单
    document.getElementById('btnStop').addEventListener('contextmenu', (e) => {
        showContextMenu(e, 'stop');
    });
    
    // 暂停播放按钮右键菜单
    document.getElementById('btnPause').addEventListener('contextmenu', (e) => {
        showContextMenu(e, 'pause');
    });
    
    // 快捷键开关的滑块右键菜单
    document.querySelector('.switch .slider').addEventListener('contextmenu', (e) => {
        showContextMenu(e, 'shortcut');
    });
}

// 在现有的菜单项中添加清除快捷键选项
function createButtonMenu(buttonData) {
    const menu = new Menu();
    
    // ... 现有的菜单项 ...

    // 添加清除快捷键选项
    menu.append(new MenuItem({
        label: '清除快捷键',
        click: () => {
            console.log('开始清除快捷键，按钮数据:', buttonData);
            
            const db = new sqlite3.Database(path.join(__dirname, '../../soundbuttons.db'), (err) => {
                if (err) {
                    console.error('数据库连接错误:', err);
                    return;
                }
                
                console.log('数据库连接成功，开始查询 action_type');

                db.get('SELECT * FROM sound_buttons WHERE button_name = ?', [buttonData.name], (err, row) => {
                    if (err) {
                        console.error('查询按钮数据失败:', err);
                        db.close();
                        return;
                    }

                    console.log('查询结果:', row);

                    // 直接调用现有的清除快捷键代码
                    const query = `
                        UPDATE sound_buttons
                        SET shortcut_key = NULL,
                            shortcut_display = NULL
                        WHERE button_name = ?
                    `;

                    console.log('执行更新，SQL:', query);
                    console.log('参数:', buttonData.name);

                    db.run(query, [buttonData.name], function(err) {
                        if (err) {
                            console.error('清除快捷键失败:', err);
                            Toast.error('清除快捷键失败');
                            return;
                        }

                        console.log('数据库更新成功，影响行数:', this.changes);

                        // 根据 action_type 更新对应的显示
                        if (row && row.action_type) {
                            console.log('按钮类型:', row.action_type);
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

                            console.log('要更新的标签ID:', labelId);

                            if (labelId) {
                                const label = document.getElementById(labelId);
                                if (label) {
                                    console.log('找到标签元素，更新显示');
                                    label.textContent = '未设置';
                                } else {
                                    console.log('未找到标签元素:', labelId);
                                }
                            }
                        }

                        Toast.success('清除快捷键成功');
                        
                        // 通知主进程注销快捷键
                        ipcRenderer.send('unregister-shortcut', buttonData.name);
                        
                        db.close();
                    });
                });
            });
        }
    }));

    return menu;
}

// 导出函数
module.exports = {
    initContextMenu
}; 