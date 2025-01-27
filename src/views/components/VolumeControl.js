class VolumeControl {
    constructor(container) {
        this.container = container;
        this.slider = container.querySelector('input[type="range"]');
        this.valueDisplay = container.querySelector('.volume-value');
        this.init();
    }

    init() {
        this.render();
        this.bindEvents();
    }

    render() {
        if (!this.container.querySelector('.volume-slider')) {
            this.container.innerHTML = `
                <span>音量</span>
                <div class="volume-slider">
                    <input type="range" min="0" max="100" value="100">
                    <span class="volume-value">100</span>
                </div>
            `;
        }
    }

    update(value) {
        if (this.slider && this.valueDisplay) {
            this.slider.value = value;
            this.valueDisplay.textContent = value;
            this.slider.style.setProperty('--value', value + '%');
        }
    }

    bindEvents() {
        // 事件绑定将由 UIController 处理
    }
}

module.exports = VolumeControl; 