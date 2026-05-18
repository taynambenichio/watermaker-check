const PRESETS = {
    uv:        { brightness: 150, contrast: 200, saturation:  50, hue: 280, invert:   0, blur: 0 },
    infrared:  { brightness: 120, contrast: 180, saturation:   0, hue:   0, invert:  30, blur: 1 },
    watermark: { brightness:  80, contrast: 250, saturation: 200, hue:   0, invert:   0, blur: 0 },
    security:  { brightness: 200, contrast: 300, saturation: 150, hue:  45, invert:   0, blur: 0 },
    edges:     { brightness:  50, contrast: 300, saturation:   0, hue:   0, invert:  50, blur: 0 },
    negative:  { brightness: 120, contrast: 120, saturation: 120, hue: 180, invert: 100, blur: 0 },
};

const SLIDER_IDS = ['brightness', 'contrast', 'saturation', 'hue', 'invert', 'blur'];

const UNITS = { brightness: '%', contrast: '%', saturation: '%', hue: '°', invert: '%', blur: 'px' };

function getFilterString() {
    const v = id => document.getElementById(id).value;
    return `brightness(${v('brightness')}%) contrast(${v('contrast')}%) ` +
           `saturate(${v('saturation')}%) hue-rotate(${v('hue')}deg) ` +
           `invert(${v('invert')}%) blur(${v('blur')}px)`;
}

function updateValueDisplays() {
    SLIDER_IDS.forEach(id => {
        document.getElementById(id + 'Value').textContent =
            document.getElementById(id).value + UNITS[id];
    });
}

export function applyFilters(state) {
    if (!state.image) return;
    state.image.style.filter = getFilterString();
}

export function resetFilters(state) {
    const defaults = { brightness: 100, contrast: 100, saturation: 100, hue: 0, invert: 0, blur: 0 };
    SLIDER_IDS.forEach(id => { document.getElementById(id).value = defaults[id]; });
    updateValueDisplays();
    state.activePreset = null;
    document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
    applyFilters(state);
}

export function applyPreset(name, state) {
    const settings = PRESETS[name];
    if (!settings) return;
    SLIDER_IDS.forEach(id => { document.getElementById(id).value = settings[id]; });
    updateValueDisplays();
    state.activePreset = name;
    document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
    document.querySelector(`.preset-btn[data-preset="${name}"]`)?.classList.add('active');
    applyFilters(state);
}

export function initFilters(state, onUpdate = () => {}) {
    SLIDER_IDS.forEach(id => {
        document.getElementById(id).addEventListener('input', () => {
            updateValueDisplays();
            state.activePreset = null;
            document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
            applyFilters(state);
            onUpdate(state);
        });
    });
    document.querySelectorAll('.preset-btn').forEach(btn => {
        btn.addEventListener('click', () => { applyPreset(btn.dataset.preset, state); onUpdate(state); });
    });
    document.getElementById('resetBtn').addEventListener('click', () => { resetFilters(state); onUpdate(state); });
}
