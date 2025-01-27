class UIController {
    constructor(audioController, view) {
        this.audioController = audioController;
        this.view = view;
        this.initEventListeners();
    }

    initEventListeners() {
        // 绑定界面事件...
    }

    updateVolumeDisplay(value) {
        this.view.updateVolume(value);
    }
} 