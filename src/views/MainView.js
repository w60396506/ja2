class MainView {
    constructor() {
        this.volumeControl = null;
        this.buttonGrid = null;
        this.titleBar = null;
        this.controlBar = null;
        this.init();
    }

    init() {
        // 初始化各个组件
        this.volumeControl = new VolumeControl(document.querySelector('.volume-control'));
        this.buttonGrid = new ButtonGrid(document.querySelector('.sound-grid'));
        this.titleBar = new TitleBar(document.querySelector('.title-bar'));
        this.controlBar = new ControlBar(document.querySelector('.control-buttons'));
    }

    updateVolume(value) {
        this.volumeControl.update(value);
    }
}

module.exports = MainView; 