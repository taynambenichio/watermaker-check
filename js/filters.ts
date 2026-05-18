import type { AppState } from './types.js';

const PRESETS: Record<string, Record<string, number>> = {
    uv:        { brightness: 150, contrast: 200, saturation:  50, hue: 280, invert:   0, blur: 0 },
    infrared:  { brightness: 120, contrast: 180, saturation:   0, hue:   0, invert:  30, blur: 1 },
    watermark: { brightness:  80, contrast: 250, saturation: 200, hue:   0, invert:   0, blur: 0 },
    security:  { brightness: 200, contrast: 300, saturation: 150, hue:  45, invert:   0, blur: 0 },
    edges:     { brightness:  50, contrast: 300, saturation:   0, hue:   0, invert:  50, blur: 0 },
    negative:  { brightness: 120, contrast: 120, saturation: 120, hue: 180, invert: 100, blur: 0 },
};

const SLIDER_IDS: string[] = ['brightness', 'contrast', 'saturation', 'hue', 'invert', 'blur'];

const UNITS: Record<string, string> = {
    brightness: '%', contrast: '%', saturation: '%', hue: '°', invert: '%', blur: 'px',
};

const CSS_FN: Record<string, (v: string) => string> = {
    brightness: v => `brightness(${v}%)`,
    contrast:   v => `contrast(${v}%)`,
    saturation: v => `saturate(${v}%)`,
    hue:        v => `hue-rotate(${v}deg)`,
    invert:     v => `invert(${v}%)`,
    blur:       v => `blur(${v}px)`,
};

function getEl<T extends HTMLElement>(id: string): T {
    const el = document.getElementById(id);
    if (!el) throw new Error(`Required element #${id} not found`);
    return el as T;
}

function getFilterString(): string {
    return SLIDER_IDS
        .map(id => (CSS_FN[id] ?? (v => `${id}(${v})`))(getEl<HTMLInputElement>(id).value))
        .join(' ');
}

function updateValueDisplays(): void {
    SLIDER_IDS.forEach(id => {
        getEl<HTMLElement>(id + 'Value').textContent =
            getEl<HTMLInputElement>(id).value + (UNITS[id] ?? '');
    });
}

export function applyFilters(state: AppState): void {
    if (!state.image) return;
    state.image.style.filter = getFilterString();
}

export function resetFilters(state: AppState): void {
    const defaults: Record<string, number> = {
        brightness: 100, contrast: 100, saturation: 100, hue: 0, invert: 0, blur: 0,
    };
    SLIDER_IDS.forEach(id => {
        getEl<HTMLInputElement>(id).value = String(defaults[id] ?? 0);
    });
    updateValueDisplays();
    state.activePreset = null;
    document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
    applyFilters(state);
}

export function applyPreset(name: string, state: AppState): void {
    const settings = PRESETS[name];
    if (!settings) return;
    SLIDER_IDS.forEach(id => {
        getEl<HTMLInputElement>(id).value = String(settings[id] ?? 0);
    });
    updateValueDisplays();
    state.activePreset = name;
    document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
    document.querySelector<HTMLButtonElement>(`.preset-btn[data-preset="${name}"]`)
        ?.classList.add('active');
    applyFilters(state);
}

export function initFilters(state: AppState, onUpdate: (state: AppState) => void = () => {}): void {
    SLIDER_IDS.forEach(id => {
        getEl<HTMLInputElement>(id).addEventListener('input', () => {
            updateValueDisplays();
            state.activePreset = null;
            document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
            applyFilters(state);
            onUpdate(state);
        });
    });
    document.querySelectorAll<HTMLButtonElement>('.preset-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            applyPreset(btn.dataset['preset'] ?? '', state);
            onUpdate(state);
        });
    });
    getEl<HTMLButtonElement>('resetBtn').addEventListener('click', () => {
        resetFilters(state);
        onUpdate(state);
    });
}
