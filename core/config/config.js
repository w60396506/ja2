// 配置文件
module.exports = {
    // 音频设置
    audio: {
        volume: 100,          // 默认音量为 100%
        device: null,         // 默认音频设备
        repeat: false         // 默认不循环播放
    },

    // 快捷键设置
    shortcuts: {
        enabled: true,        // 默认开启快捷键
        keys: {
            stop: 'Escape',   // 停止播放快捷键
            pause: 'Space'    // 暂停/继续播放快捷键
        }
    },

    // 界面设置
    ui: {
        theme: 'light',       // 默认主题
        language: 'zh_CN'     // 默认语言
    },

    // 文件设置
    files: {
        audioPath: './sounds',    // 音频文件存放路径
        configPath: './config'    // 配置文件存放路径
    }
}; 