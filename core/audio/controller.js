const { ipcRenderer } = require('electron');
const ConfigManager = require('../config/manager.js');
const Toast = require('../utils/toast.js');

// 音频控制器类 - 负责管理所有音频播放相关功能
class AudioController {
    constructor() {
        console.log('AudioController: constructor called');
        // 当前播放的音频对象
        this.currentAudio = null;
        
        // 当前音频的 Blob URL
        this.currentAudioUrl = null;
        
        // 播放状态标志
        this.isPlaying = false;
        
        // 防止并发播放的锁
        this.isProcessing = false;
        
        // 确保从配置文件读取的音量正确
        const configVolume = ConfigManager.get('volume');
        console.log('从配置读取的音量:', configVolume);
        this.currentVolume = configVolume / 100;
        console.log('设置当前音量:', this.currentVolume);
            
        // 当前输出设备ID
        this.currentDeviceId = null;
        
        // 可用的音频输出设备列表
        this.audioDevices = [];
        
        // 当前播放的按钮名称
        this.currentButtonName = null;

        // 初始化重复播放状态
        const repeatSwitch = document.getElementById('repeatSwitch');
        if (repeatSwitch) {
            const savedRepeatState = ConfigManager.get('repeat');
            console.log('读取重复播放状态:', savedRepeatState);
            repeatSwitch.checked = savedRepeatState;

            // 添加切换事件监听
            repeatSwitch.addEventListener('change', (e) => {
                console.log('重复播放开关切换:', e.target.checked);
                ConfigManager.set('repeat', e.target.checked);
            });
        }
        
        // 初始化音频设备
        this.initDevices();
        
        // 初始化音量控制
        this.initVolumeControl();
    }

    // 初始化音频输出设备
    async initDevices() {
        try {
            // 获取所有媒体设备
            const devices = await navigator.mediaDevices.enumerateDevices();
            
            // 过滤出音频输出设备
            this.audioDevices = devices.filter(device => device.kind === 'audiooutput');
            console.log('可用音频设备:', this.audioDevices);

            // 获取设备选择下拉框
            const selectedDevice = document.querySelector('#selectedDevice');
            const deviceList = document.querySelector('#deviceList');
            if (selectedDevice && deviceList) {
                deviceList.innerHTML = '';
                
                // 添加所有可用设备到下拉框
                this.audioDevices.forEach((device, index) => {
                    const item = document.createElement('div');
                    item.className = 'select-item';
                    item.dataset.deviceId = device.deviceId;
                    const label = device.label || `音频设备 ${index + 1}`;
                    item.textContent = label;
                    item.title = item.textContent;
                    deviceList.appendChild(item);
                    
                    item.addEventListener('click', async () => {
                        // 先更新显示
                        selectedDevice.textContent = label;
                        deviceList.classList.remove('show');
                        
                        // 然后切换设备
                        this.currentDeviceId = device.deviceId;
                        await this.setAudioOutput(device.deviceId);
                        ipcRenderer.send('save-audio-device', device.deviceId);
                        
                        // 最后显示提示
                        setTimeout(() => {
                            Toast.success('通道切换完毕！');
                        }, 100);
                    });
                });
                
                // 点击显示/隐藏下拉列表
                selectedDevice.addEventListener('click', (e) => {
                    e.stopPropagation();  // 阻止事件冒泡
                    deviceList.classList.toggle('show');
                });
                
                // 点击其他地方关闭下拉列表
                document.addEventListener('click', (e) => {
                    if (!e.target.closest('.custom-select')) {
                        deviceList.classList.remove('show');
                    }
                });

                // 如果有保存的设备ID，设置为当前选中设备
                const savedDeviceId = await ipcRenderer.invoke('get-audio-device');
                if (savedDeviceId) {
                    const savedDevice = this.audioDevices.find(d => d.deviceId === savedDeviceId);
                    if (savedDevice) {
                        selectedDevice.textContent = savedDevice.label;
                        this.currentDeviceId = savedDeviceId;
                    } else {
                        selectedDevice.textContent = '默认设备';
                    }
                }
            }
        } catch (err) {
            console.error('初始化音频设备失败:', err);
        }
    }

    // 设置音频输出设备
    async setAudioOutput(deviceId) {
        this.currentDeviceId = deviceId;
        
        if (this.currentAudio && this.currentAudio.setSinkId) {
            try {
                await this.currentAudio.setSinkId(deviceId);
                console.log('已切换到音频设备:', deviceId);
            } catch (err) {
                console.error('切换音频输出设备失败:', err);
                Toast.error('通道切换失败！');
            }
        }
    }

    // 播放音频
    async play(soundPath, buttonName) {
        try {
            console.log('准备播放音频:', {
                soundPath,
                buttonName,
                cwd: process.cwd()
            });

            // 规范化路径
            let normalizedPath = soundPath;
            
            // 1. 移除开头可能重复的 sounds/
            normalizedPath = normalizedPath.replace(/^sounds[\/\\]sounds[\/\\]/, 'sounds/');
            
            // 2. 确保路径以 sounds/ 开头
            if (!normalizedPath.startsWith('sounds/')) {
                normalizedPath = 'sounds/' + normalizedPath.replace(/^[\/\\]/, '');
            }

            // 3. 统一路径分隔符
            normalizedPath = normalizedPath.replace(/\\/g, '/');

            console.log('规范化后的路径:', normalizedPath);
            
            // 获取音频数据
            const audioData = await ipcRenderer.invoke('get-audio-data', normalizedPath);
            
            if (this.isProcessing) return;

            this.isProcessing = true;
            this.stop();
            this.currentButtonName = buttonName;
            
            console.log('音频数据获取成功，准备播放');
            const audioArray = Uint8Array.from(atob(audioData), c => c.charCodeAt(0));
            const blob = new Blob([audioArray], { type: 'audio/mpeg' });
            const audioUrl = URL.createObjectURL(blob);

            const audio = new Audio();
            audio.volume = this.currentVolume;
            console.log('设置音频音量:', this.currentVolume);
            
            // 设置输出设备
            if (this.currentDeviceId && audio.setSinkId) {
                await audio.setSinkId(this.currentDeviceId);
            }

            // 设置循环播放
            const repeatToggle = document.getElementById('repeatSwitch');
            
            // 从配置中读取保存的状态，使用正确的键名 'repeat'
            const savedRepeatState = ConfigManager.get('repeat');
            if (savedRepeatState !== undefined && repeatToggle) {
                repeatToggle.checked = savedRepeatState;
            }
            
            console.log('重复播放开关状态:', {
                element: repeatToggle,
                checked: repeatToggle?.checked,
                exists: !!repeatToggle,
                savedState: savedRepeatState
            });
            
            if (repeatToggle && repeatToggle.checked) {
                console.log('开启循环播放');
                audio.loop = true;
                audio.onended = null;
                // 使用正确的键名保存状态
                ConfigManager.set('repeat', true);
            } else {
                console.log('关闭循环播放');
                audio.loop = false;
                audio.onended = () => {
                    console.log('音频播放结束，停止播放');
                    if (!audio.loop) {
                        this.stop();
                    }
                };
                // 使用正确的键名保存状态
                ConfigManager.set('repeat', false);
            }

            // 等待音频加载
            await new Promise((resolve, reject) => {
                audio.oncanplaythrough = resolve;
                audio.onerror = reject;
                audio.src = audioUrl;
                
                // 再次确认循环状态
                if (repeatToggle && repeatToggle.checked) {
                    audio.loop = true;
                }
            });

            this.currentAudio = audio;
            this.currentAudioUrl = audioUrl;
            await audio.play();
            this.isPlaying = true;
            this.updateUI();

        } catch (err) {
            console.error('播放失败:', err);
            Toast.error('播放失败');
            this.stop();
        } finally {
            this.isProcessing = false;
        }
    }

    // 停止播放
    stop() {
        if (this.currentAudio) {
            this.currentAudio.pause();
            this.currentAudio.currentTime = 0;
            
            // 释放资源
            if (this.currentAudioUrl) {
                URL.revokeObjectURL(this.currentAudioUrl);
            }
            
            // 重置状态
            this.currentAudio = null;
            this.currentAudioUrl = null;
            this.isPlaying = false;
            this.currentButtonName = null;
            
            this.updateUI();
        }
    }

    // 暂停播放
    pause() {
        if (this.currentAudio && this.isPlaying) {
            this.currentAudio.pause();
            this.isPlaying = false;
            this.updateUI();
        }
    }

    // 恢复播放
    resume() {
        if (this.currentAudio && !this.isPlaying) {
            this.currentAudio.play();
            this.isPlaying = true;
            this.updateUI();
        }
    }

    // 更新UI状态
    updateUI() {
        // 这里可以添加更新UI的代码
        // 比如更新播放/暂停按钮状态等
    }

    // 初始化音量控制
    initVolumeControl() {
        const volumeSlider = document.querySelector('.volume-slider input');
        const volumeValue = document.querySelector('.volume-value');
        
        if (volumeSlider && volumeValue) {
            const savedVolume = ConfigManager.get('volume');
            console.log('初始化音量控制:', savedVolume);
            
            // 设置初始值
            volumeSlider.value = savedVolume;
            volumeValue.textContent = savedVolume;
            
            // 监听音量变化
            volumeSlider.addEventListener('input', (e) => {
                const value = e.target.value;
                volumeValue.textContent = value ;
                this.currentVolume = value / 100;
                
                if (this.currentAudio) {
                    this.currentAudio.volume = this.currentVolume;
                }
                
                ConfigManager.set('volume', parseInt(value));
            });
        }
    }

    // 设置音量的方法
    setVolume(value) {
        // 确保值在 0-100 之间
        const volume = Math.max(0, Math.min(100, value));
        
        // 更新当前音量
        this.currentVolume = volume / 100;
        
        // 如果有音频在播放，更新其音量
        if (this.currentAudio) {
            this.currentAudio.volume = this.currentVolume;
        }
        
        // 更新滑块和显示值
        const volumeSlider = document.querySelector('.volume-slider input');
        const volumeValue = document.querySelector('.volume-value');
        
        if (volumeSlider) {
            volumeSlider.value = volume;
        }
        
        if (volumeValue) {
            volumeValue.textContent = volume;
        }
        
        // 保存到本地存储
        localStorage.setItem('volume', volume);
        
        console.log('音量已设置为:', volume);
    }

    // 获取当前音量
    getVolume() {
        return Math.round(this.currentVolume * 100);
    }
}

// 导出音频控制器实例
module.exports = new AudioController(); 