const { Menu } = require('electron');
const { showNotification } = require('./notification.js');

const createMenu = () => {
    const template = [
        {
            label: '文件',
            submenu: [
                {
                    label: '导入音频',
                    accelerator: 'CmdOrCtrl+O',
                    click: () => {
                        // 导入音频的处理
                        showNotification('提示', '请选择要导入的音频文件');
                    }
                },
                { type: 'separator' },
                {
                    label: '退出',
                    accelerator: 'CmdOrCtrl+Q',
                    click: () => {
                        app.quit();
                    }
                }
            ]
        },
        {
            label: '编辑',
            submenu: [
                {
                    label: '设置',
                    click: () => {
                        // 打开设置窗口
                        showNotification('提示', '设置功能开发中');
                    }
                }
            ]
        },
        {
            label: '帮助',
            submenu: [
                {
                    label: '关于',
                    click: () => {
                        showNotification('关于', '大主播音效 V2.0');
                    }
                }
            ]
        }
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
};

module.exports = { createMenu }; 