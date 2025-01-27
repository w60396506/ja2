let activeNotification = null;

const showNotification = (title, message, duration = 3000) => {
    // 如果有活动的通知，先移除它
    if (activeNotification) {
        activeNotification.remove();
    }

    // 创建通知元素
    const notification = document.createElement('div');
    notification.className = 'notification';
    
    const titleElement = document.createElement('div');
    titleElement.className = 'notification-title';
    titleElement.textContent = title;
    
    const messageElement = document.createElement('div');
    messageElement.className = 'notification-message';
    messageElement.textContent = message;
    
    notification.appendChild(titleElement);
    notification.appendChild(messageElement);
    document.body.appendChild(notification);
    
    activeNotification = notification;

    // 定时移除通知
    setTimeout(() => {
        notification.classList.add('hide');
        setTimeout(() => {
            notification.remove();
            if (activeNotification === notification) {
                activeNotification = null;
            }
        }, 300);
    }, duration);
};

module.exports = { showNotification }; 