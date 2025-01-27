const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const Toast = require('./toast.js');
const { ipcRenderer } = require('electron');

class ShortcutDialog {
    constructor() {
        this.currentTarget = null;
        this.init();
        // 添加按键监听
        ipcRenderer.on('shortcut-key-pressed', (event, keyInfo) => {
            if (this.dialog.style.display === 'block') {
                this.handleKeyPress(keyInfo);
            }
        });
    }

    init() {
        // 创建样式
        const style = document.createElement('style');
        style.textContent = `
            .shortcut-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.3);
                display: none;
                z-index: 1000;
                backdrop-filter: blur(3px);
            }

            .shortcut-dialog {
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                width: 320px;
                background: white;
                border-radius: 8px;
                box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
                display: none;
                z-index: 1001;
                padding: 20px;
                text-align: center;
            }

            .shortcut-title {
                font-size: 18px;
                color: #333;
                margin-bottom: 15px;
            }

            .shortcut-target {
                color: #2587ee;
                font-weight: bold;
                margin-bottom: 10px;
            }

            .shortcut-input {
                background: #f5f5f5;
                border: 1px solid #e0e0e0;
                border-radius: 6px;
                padding: 10px;
                margin-bottom: 10px;
                font-size: 16px;
                color: #2587ee;
                min-height: 40px;
                display: flex;
                align-items: center;
                justify-content: center;
            }

            .shortcut-tip {
                color: #999;
                font-size: 12px;
                margin-bottom: 15px;
            }

            .shortcut-buttons {
                display: flex;
                justify-content: space-between;
            }

            .shortcut-button {
                flex: 1;
                padding: 10px;
                border: none;
                border-radius: 6px;
                margin: 0 5px;
                cursor: pointer;
                transition: background 0.2s;
            }

            .shortcut-cancel {
                background: #f5f5f5;
                color: #666;
            }

            .shortcut-save {
                background: #2587ee;
                color: white;
            }

            .shortcut-button:hover {
                opacity: 0.9;
            }

            @keyframes shake {
                0%, 100% { transform: translateX(0); }
                25% { transform: translateX(-10px); }
                75% { transform: translateX(10px); }
            }

            .shortcut-input.conflict {
                animation: shake 0.4s ease-in-out;
                background: #fff2f0;
                border-color: #ff4d4f;
                color: #ff4d4f;
            }

            .shortcut-conflict-tip {
                color: #ff4d4f;
                font-size: 14px;
                margin-top: 8px;
                display: none;
            }

            .shortcut-conflict-tip.show {
                display: block;
            }
        `;
        document.head.appendChild(style);

        // 创建遮罩层
        const overlay = document.createElement('div');
        overlay.className = 'shortcut-overlay';
        document.body.appendChild(overlay);

        // 创建对话框
        const dialog = document.createElement('div');
        dialog.className = 'shortcut-dialog';
        dialog.innerHTML = `
            <div class="shortcut-title">设置快捷键</div>
            <div class="shortcut-target"></div>
            <div class="shortcut-input">按下要设置的按键</div>
            <div class="shortcut-conflict-tip"></div>
            <div class="shortcut-tip">支持数字、字母、功能键和小键盘</div>
            <div class="shortcut-buttons">
                <button class="shortcut-button shortcut-cancel">取消</button>
                <button class="shortcut-button shortcut-save">保存</button>
            </div>
        `;
        document.body.appendChild(dialog);

        this.dialog = dialog;
        this.overlay = overlay;
        this.inputDisplay = dialog.querySelector('.shortcut-input');
        this.targetDisplay = dialog.querySelector('.shortcut-target');
        
        // 绑定按钮事件
        dialog.querySelector('.shortcut-save').addEventListener('click', () => this.save());
        dialog.querySelector('.shortcut-cancel').addEventListener('click', () => this.hide());
        
        // 使用 capture 模式来确保最先捕获按键事件
        document.addEventListener('keydown', this.handleKeyDown.bind(this), true);
    }

    show(buttonIndex) {
        this.currentTarget = buttonIndex;
        this.currentKey = null;
        this.currentDisplay = null;
        
        this.inputDisplay.textContent = '按下要设置的按键';
        this.inputDisplay.classList.remove('has-keys');
        this.inputDisplay.classList.remove('conflict');
        
        // 清除冲突提示
        const conflictTip = this.dialog.querySelector('.shortcut-conflict-tip');
        conflictTip.textContent = '';
        conflictTip.classList.remove('show');
        
        // 启用保存按钮
        this.dialog.querySelector('.shortcut-save').disabled = false;
        
        this.overlay.style.display = 'block';
        this.dialog.style.display = 'block';
    }

    hide() {
        this.overlay.style.display = 'none';
        this.dialog.style.display = 'none';
        
        // 通知主进程对话框已关闭
        ipcRenderer.send('shortcut-dialog-state', false);
    }

    async handleKeyDown(e) {
        if (this.dialog.style.display !== 'block') return;
        
        e.preventDefault();
        e.stopPropagation();
        
        const keyCode = e.keyCode;
        let shortcutDisplay = '';
        let shortcutKey = '';

        // 处理所有可能的按键类型
        if (keyCode >= 96 && keyCode <= 105) {
            // 小键盘数字
            shortcutKey = keyCode.toString();
            shortcutDisplay = `小键盘${keyCode - 96}`;
        } else if (keyCode >= 48 && keyCode <= 57) {
            // 主键盘数字
            shortcutKey = keyCode.toString();
            shortcutDisplay = String(keyCode - 48);
        } else if (keyCode >= 65 && keyCode <= 90) {
            // 字母键
            shortcutKey = keyCode.toString();
            shortcutDisplay = String.fromCharCode(keyCode);
        } else if (keyCode >= 112 && keyCode <= 123) {
            // 功能键 F1-F12
            shortcutKey = keyCode.toString();
            shortcutDisplay = `F${keyCode - 111}`;
        } else {
            // 其他特殊按键
            const specialKeys = {
                32: ['32', '空格'],
                13: ['13', '回车'],
                9: ['9', 'Tab'],
                27: ['27', 'Esc'],
                8: ['8', '退格'],
                46: ['46', 'Delete'],
                45: ['45', 'Insert'],
                36: ['36', 'Home'],
                35: ['35', 'End'],
                33: ['33', 'PageUp'],
                34: ['34', 'PageDown'],
                37: ['37', '←'],
                38: ['38', '↑'],
                39: ['39', '→'],
                40: ['40', '↓'],
                106: ['106', '小键盘 *'],
                107: ['107', '小键盘 +'],
                109: ['109', '小键盘 -'],
                110: ['110', '小键盘 .'],
                111: ['111', '小键盘 /'],
                186: ['186', ';'],
                187: ['187', '='],
                188: ['188', ','],
                189: ['189', '-'],
                190: ['190', '.'],
                191: ['191', '/'],
                192: ['192', '`'],
                219: ['219', '['],
                220: ['220', '\\'],
                221: ['221', ']'],
                222: ['222', '\'']
            };

            if (specialKeys[keyCode]) {
                [shortcutKey, shortcutDisplay] = specialKeys[keyCode];
            }
        }

        if (shortcutDisplay) {
            try {
                // 使用 IPC 检查快捷键冲突
                const rows = await ipcRenderer.invoke('db-query', 
                    'SELECT button_name FROM sound_buttons WHERE shortcut_key = ? AND button_name != ?',
                    [shortcutKey, this.currentTarget]
                );

                const conflictTip = this.dialog.querySelector('.shortcut-conflict-tip');

                if (rows && rows.length > 0) {
                    // 发现冲突，显示视觉反馈
                    this.inputDisplay.classList.add('conflict');
                    conflictTip.textContent = `此快捷键已被按钮"${rows[0].button_name}"使用`;
                    conflictTip.classList.add('show');

                    // 更新显示
                    this.inputDisplay.textContent = shortcutDisplay;
                    
                    // 禁用保存按钮
                    this.dialog.querySelector('.shortcut-save').disabled = true;
                } else {
                    // 没有冲突，显示正常状态
                    this.setNewShortcut(shortcutKey, shortcutDisplay);
                    
                    // 启用保存按钮
                    this.dialog.querySelector('.shortcut-save').disabled = false;
                }
            } catch (err) {
                console.error('检查快捷键冲突失败:', err);
            }
        }
    }

    setNewShortcut(shortcutKey, shortcutDisplay) {
        console.log('设置新快捷键:', {
            shortcutKey,
            shortcutDisplay
        });
        
        this.currentKey = shortcutKey;
        this.currentDisplay = shortcutDisplay;
        this.inputDisplay.textContent = shortcutDisplay;
        this.inputDisplay.classList.add('has-keys');
        
        // 清除冲突状态
        this.inputDisplay.classList.remove('conflict');
        const conflictTip = this.dialog.querySelector('.shortcut-conflict-tip');
        conflictTip.classList.remove('show');
    }

    async save() {
        if (!this.currentKey || !this.currentTarget) return;
        
        try {
            // 获取当前分类ID
            const currentCategory = document.querySelector('.nav-item.active');
            const categoryId = Array.from(currentCategory.parentNode.children).indexOf(currentCategory) + 1;
            
            // 获取目标按钮的索引
            const targetButton = document.querySelector(`.sound-btn[data-button-index="${this.currentTarget}"]`);
            const buttonIndex = targetButton.dataset.buttonIndex;

            // 先查询旧快捷键
            const rows = await ipcRenderer.invoke('db-query',
                'SELECT shortcut_key FROM sound_buttons WHERE button_index = ? AND category_id = ?',
                [buttonIndex, categoryId]
            );

            // 如果有旧快捷键，先注销它
            if (rows && rows.length > 0 && rows[0].shortcut_key) {
                ipcRenderer.send('unregister-shortcut', rows[0].shortcut_key);
            }

            // 使用 button_index 和 category_id 更新数据库
            await ipcRenderer.invoke('db-run',
                'UPDATE sound_buttons SET shortcut_key = ?, shortcut_display = ? WHERE button_index = ? AND category_id = ?',
                [this.currentKey, this.currentDisplay, buttonIndex, categoryId]
            );

            // 触发快捷键设置成功事件
            const event = new CustomEvent('shortcut-selected', {
                detail: {
                    target: buttonIndex,  // 改用 buttonIndex
                    key: this.currentKey,
                    display: this.currentDisplay,
                    categoryId: categoryId
                }
            });
            document.dispatchEvent(event);

            this.hide();
        } catch (err) {
            console.error('保存快捷键失败:', err);
            Toast.error('保存快捷键失败');
        }
    }

    // 新增方法，处理数据库保存
    saveToDatabase() {
        const db = new sqlite3.Database(path.join(__dirname, '../../soundbuttons.db'), (err) => {
            if (err) {
                console.error('数据库连接错误:', err);
                return;
            }

            let query;
            let params;

            if (this.currentTarget === 'shortcut') {
                query = `
                    UPDATE sound_buttons 
                    SET shortcut_key = ?, 
                        shortcut_display = ?,
                        action_type = 'toggle_hotkey'
                    WHERE button_name = 'toggle'`;
                params = [this.currentKey, this.currentDisplay];
                
                // 注册快捷键时使用 'toggle' 而不是 'shortcut'
                ipcRenderer.send('register-shortcut', {
                    shortcut: this.currentKey,
                    buttonId: 'toggle',  // 这里很重要，要和数据库里的名字一致
                    action_type: 'toggle_hotkey'
                });
            } else {
                query = `
                    UPDATE sound_buttons 
                    SET shortcut_key = ?, 
                        shortcut_display = ?
                    WHERE button_name = ?`;
                params = [this.currentKey, this.currentDisplay, this.currentTarget];
            }

            console.log('执行 SQL:', query, params);

            db.run(query, params, (err) => {
                if (err) {
                    console.error('保存快捷键失败:', err);
                    Toast.error('保存快捷键失败');
                    return;
                }

                console.log('保存成功');
                this.finishSave();
                db.close();
            });
        });
    }

    finishSave() {
        // 发送事件给 renderer 进程处理保存
        const event = new CustomEvent('shortcut-selected', {
            detail: {
                target: this.currentTarget,
                key: this.currentKey,
                display: this.currentDisplay
            }
        });
        document.dispatchEvent(event);

        console.log('当前目标:', this.currentTarget);

        // 尝试查找所有可能的标签
        const toggleLabel = document.getElementById('shortcutTip');
        const stopLabel = document.getElementById('stopShortcut');
        const pauseLabel = document.getElementById('pauseShortcut');
        
        console.log('查找结果:', {
            toggleLabel,
            stopLabel,
            pauseLabel,
            currentTarget: this.currentTarget
        });

        // 根据按钮类型更新对应标签
        if (this.currentTarget === 'shortcut') {
            console.log('更新快捷键开关标签');
            if (toggleLabel) {
                toggleLabel.textContent = this.currentDisplay;
            }
        } else if (this.currentTarget === 'stop') {
            console.log('更新停止播放标签');
            if (stopLabel) {
                stopLabel.textContent = this.currentDisplay;
            }
        } else if (this.currentTarget === 'pause') {
            console.log('更新暂停播放标签');
            if (pauseLabel) {
                pauseLabel.textContent = this.currentDisplay;
            }
        }

        Toast.success('设置快捷键成功');
        this.hide();
    }

    // 新增方法处理从主进程收到的按键信息
    handleKeyPress(keyInfo) {
        const keyCode = keyInfo.keyCode;
        let shortcutDisplay = '';
        let shortcutKey = '';

        // 处理所有可能的按键类型
        if (keyCode >= 96 && keyCode <= 105) {
            shortcutKey = keyCode.toString();
            shortcutDisplay = `小键盘${keyCode - 96}`;
        } else if (keyCode >= 48 && keyCode <= 57) {
            shortcutKey = keyCode.toString();
            shortcutDisplay = String(keyCode - 48);
        } else if (keyCode >= 65 && keyCode <= 90) {
            shortcutKey = keyCode.toString();
            shortcutDisplay = String.fromCharCode(keyCode);
        } else if (keyCode >= 112 && keyCode <= 123) {
            shortcutKey = keyCode.toString();
            shortcutDisplay = `F${keyCode - 111}`;
        } else {
            // 其他特殊按键处理保持不变...
        }

        if (shortcutDisplay) {
            // 检查快捷键冲突
            const db = new sqlite3.Database(path.join(__dirname, '../../soundbuttons.db'));
            db.get(
                'SELECT button_name FROM sound_buttons WHERE shortcut_key = ? AND button_name != ?',
                [shortcutKey, this.currentTarget],
                (err, row) => {
                    // 冲突检测代码保持不变...
                }
            );
        }
    }
}

// 删除音效的处理函数
async function handleDelete(buttonName) {
    try {
        // 删除数据库记录
        await ipcRenderer.invoke('db-run', 
            'UPDATE sound_buttons SET sound_path = NULL WHERE button_name = ?', 
            [buttonName]
        );
        
        // 更新按钮显示
        const buttons = document.querySelectorAll('.sound-btn');
        buttons.forEach(btn => {
            if (btn.textContent === buttonName) {
                btn.dataset.soundPath = '';
            }
        });
        
        Toast.success('音效删除成功');
        
        // 关闭对话框
        closeDialog();  // 确保这个函数被调用
        
    } catch (err) {
        console.error('删除音效失败:', err);
        Toast.error('删除音效失败');
    }
}

// 确保有关闭对话框的函数
function closeDialog() {
    const dialog = document.querySelector('.shortcut-dialog');
    if (dialog) {
        dialog.remove();
    }
}

// 修改保存快捷键的代码
async function saveShortcut(keyCode, keyDisplay, buttonName) {
    try {
        // 获取当前分类ID
        const currentCategory = document.querySelector('.nav-item.active');
        const categoryId = Array.from(currentCategory.parentNode.children).indexOf(currentCategory) + 1;
        
        // 获取目标按钮的索引
        const targetButton = document.querySelector(`.sound-btn[data-name="${buttonName}"]`);
        const buttonIndex = targetButton.dataset.buttonIndex;

        // 使用 button_index 和 category_id 来更新快捷键
        await ipcRenderer.invoke('db-run', 
            'UPDATE sound_buttons SET shortcut_key = ?, shortcut_display = ? WHERE button_index = ? AND category_id = ?',
            [keyCode, keyDisplay, buttonIndex, categoryId]
        );

        // 更新按钮显示
        const label = targetButton.parentElement.querySelector('.kuaijiejianbiaoqian');
        if (label) {
            label.textContent = keyDisplay;
        }

        // 注册新快捷键
        ipcRenderer.send('register-shortcut', {
            shortcut: keyCode,
            buttonId: buttonName
        });

        Toast.success('快捷键设置成功');
    } catch (err) {
        console.error('保存快捷键失败:', err);
        Toast.error('设置快捷键失败');
    }
}

module.exports = new ShortcutDialog(); 