const { ipcRenderer } = require('electron');
console.log('Toast module loading...');

let activeToast = null;

const ICONS = {
    success: '✓',
    warning: '⚠',
    error: '✕',
    info: 'ℹ'
};

const showToast = (message, type = 'info', duration = 3000) => {
    console.log('showToast called:', {
        message,
        type,
        duration
    });
    // 如果有活动的提示，先移除它
    if (activeToast) {
        activeToast.remove();
    }

    // 创建提示元素
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    // 添加图标
    const icon = document.createElement('span');
    icon.className = 'toast-icon';
    icon.textContent = ICONS[type];
    
    // 添加消息
    const messageElement = document.createElement('span');
    messageElement.className = 'toast-message';
    messageElement.textContent = message;
    
    toast.appendChild(icon);
    toast.appendChild(messageElement);
    console.log('Appending toast to document.body');
    document.body.appendChild(toast);
    
    activeToast = toast;

    // 定时移除提示
    setTimeout(() => {
        toast.classList.add('hide');
        setTimeout(() => {
            toast.remove();
            if (activeToast === toast) {
                activeToast = null;
            }
        }, 300);
    }, duration);
};

module.exports = {
    success: (message, duration) => showToast(message, 'success', duration),
    warning: (message, duration) => showToast(message, 'warning', duration),
    error: (message, duration) => showToast(message, 'error', duration),
    info: (message, duration) => showToast(message, 'info', duration),
    showToast
};

console.log('Toast module loaded:', module.exports); 