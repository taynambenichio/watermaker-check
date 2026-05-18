import { clearOverlay, renderAmplify, renderHistogram, renderSobel } from './canvas.js';
import { renderELA } from './ela.js';
import { applyFilters, initFilters } from './filters.js';
import type { AppState } from './types.js';
import { enableImageTools, initTabs, initUpload, updateAnalysisPanel } from './ui.js';

export const state: AppState = {
    image: null,
    zoom: 1.0,
    activePreset: null,
    activeCanvasMode: null,
    beforeAfterActive: false,
};

function getEl<T extends HTMLElement>(id: string): T {
    const el = document.getElementById(id);
    if (!el) throw new Error(`Required element #${id} not found`);
    return el as T;
}

function matchImageBounds(el: HTMLElement): void {
    const img = getEl<HTMLImageElement>('currentImage');
    const container = getEl<HTMLElement>('imageDisplay');
    const imgRect = img.getBoundingClientRect();
    const ctnRect = container.getBoundingClientRect();
    el.style.top = `${imgRect.top - ctnRect.top}px`;
    el.style.left = `${imgRect.left - ctnRect.left}px`;
    el.style.width = `${imgRect.width}px`;
    el.style.height = `${imgRect.height}px`;
}

function onImageLoaded(img: HTMLImageElement): void {
    state.image = img;
    state.activeCanvasMode = null;
    state.beforeAfterActive = false;
    const overlay = getEl<HTMLCanvasElement>('canvasOverlay');
    clearOverlay(overlay);
    getEl<HTMLElement>('histogramContainer').style.display = 'none';
    getEl<HTMLElement>('elaCanvasContainer').style.display = 'none';
    getEl<HTMLElement>('elaSuspicionScore').style.display = 'none';
    getEl<HTMLElement>('beforeAfterDivider').style.display = 'none';
    getEl<HTMLElement>('beforeImage').style.display = 'none';
    img.style.clipPath = '';
    applyFilters(state);
    updateAnalysisPanel(state);
    enableImageTools();
}

function initCanvasTab(): void {
    const overlay = getEl<HTMLCanvasElement>('canvasOverlay');
    const histCanvas = getEl<HTMLCanvasElement>('histogramCanvas');
    const histContainer = getEl<HTMLElement>('histogramContainer');

    function setCanvasMode(mode: AppState['activeCanvasMode'], btn: HTMLElement): void {
        document.querySelectorAll('.canvas-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        state.activeCanvasMode = mode;
        updateAnalysisPanel(state);
    }

    const histogramBtn = getEl<HTMLButtonElement>('histogramBtn');
    histogramBtn.addEventListener('click', () => {
        if (!state.image) return;
        clearOverlay(overlay);
        const tmp = document.createElement('canvas');
        tmp.width = state.image.naturalWidth;
        tmp.height = state.image.naturalHeight;
        try {
            const tmpCtx = tmp.getContext('2d')!;
            tmpCtx.drawImage(state.image, 0, 0);
            const imageData = tmpCtx.getImageData(0, 0, tmp.width, tmp.height);
            histContainer.style.display = '';
            renderHistogram(imageData, histCanvas);
            setCanvasMode('histogram', histogramBtn);
        } catch (e: unknown) {
            if (e instanceof Error && e.name === 'SecurityError')
                alert('Análise Canvas não disponível para imagens externas');
            else alert(`Erro ao processar imagem: ${e instanceof Error ? e.message : String(e)}`);
        }
    });

    const sobelBtn = getEl<HTMLButtonElement>('sobelBtn');
    sobelBtn.addEventListener('click', () => {
        if (!state.image) return;
        histContainer.style.display = 'none';
        matchImageBounds(overlay);
        renderSobel(state.image, overlay);
        setCanvasMode('sobel', sobelBtn);
    });

    const amplifyBtn = getEl<HTMLButtonElement>('amplifyBtn');
    amplifyBtn.addEventListener('click', () => {
        if (!state.image) return;
        histContainer.style.display = 'none';
        matchImageBounds(overlay);
        renderAmplify(state.image, overlay);
        setCanvasMode('amplify', amplifyBtn);
    });

    getEl<HTMLButtonElement>('clearCanvasBtn').addEventListener('click', () => {
        clearOverlay(overlay);
        histContainer.style.display = 'none';
        state.activeCanvasMode = null;
        document.querySelectorAll('.canvas-btn').forEach((b) => b.classList.remove('active'));
        updateAnalysisPanel(state);
    });
}

function initZoom(): void {
    const imageDisplay = getEl<HTMLElement>('imageDisplay');
    const zoomLabel = getEl<HTMLElement>('zoomValue');
    let zoomRafId = 0;

    function setZoom(z: number): void {
        state.zoom = Math.max(0.5, Math.min(4, Math.round(z * 100) / 100));
        zoomLabel.textContent = `${Math.round(state.zoom * 100)}%`;
        if (!state.image) return;
        state.image.style.transform = `scale(${state.zoom})`;
        cancelAnimationFrame(zoomRafId);
        zoomRafId = requestAnimationFrame(() => {
            const overlay = getEl<HTMLCanvasElement>('canvasOverlay');
            if (getComputedStyle(overlay).display !== 'none') matchImageBounds(overlay);
            if (state.beforeAfterActive) matchImageBounds(getEl<HTMLImageElement>('beforeImage'));
        });
    }

    getEl<HTMLButtonElement>('zoomInBtn').addEventListener('click', () =>
        setZoom(state.zoom + 0.25),
    );
    getEl<HTMLButtonElement>('zoomOutBtn').addEventListener('click', () =>
        setZoom(state.zoom - 0.25),
    );
    getEl<HTMLButtonElement>('zoomResetBtn').addEventListener('click', () => setZoom(1));

    imageDisplay.addEventListener(
        'wheel',
        (e: WheelEvent) => {
            if (!state.image) return;
            e.preventDefault();
            setZoom(state.zoom + (e.deltaY < 0 ? 0.1 : -0.1));
        },
        { passive: false },
    );
}

function initBeforeAfter(): void {
    const divider = getEl<HTMLElement>('beforeAfterDivider');
    const beforeImg = getEl<HTMLImageElement>('beforeImage');
    const imageDisp = getEl<HTMLElement>('imageDisplay');
    const btn = getEl<HTMLButtonElement>('beforeAfterBtn');
    let dragging = false;

    function applyClip(pct: number): void {
        if (!state.image) return;
        beforeImg.style.clipPath = `inset(0 ${100 - pct}% 0 0)`;
        state.image.style.clipPath = `inset(0 0 0 ${pct}%)`;
        divider.style.left = `${pct}%`;
    }

    function activate(): void {
        if (!state.image) return;
        matchImageBounds(beforeImg);
        beforeImg.src = state.image.src;
        beforeImg.style.filter = 'none';
        beforeImg.style.display = '';
        divider.style.display = '';
        applyClip(50);
        state.beforeAfterActive = true;
        btn.classList.add('active');
    }

    function deactivate(): void {
        divider.style.display = 'none';
        beforeImg.style.display = 'none';
        if (state.image) state.image.style.clipPath = '';
        state.beforeAfterActive = false;
        btn.classList.remove('active');
    }

    btn.addEventListener('click', () => (state.beforeAfterActive ? deactivate() : activate()));

    divider.addEventListener('mousedown', (e: MouseEvent) => {
        if (!state.beforeAfterActive) return;
        dragging = true;
        e.preventDefault();
    });
    window.addEventListener('mouseup', () => {
        dragging = false;
    });
    window.addEventListener('mousemove', (e: MouseEvent) => {
        if (!dragging || !state.beforeAfterActive) return;
        const rect = imageDisp.getBoundingClientRect();
        const pct = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
        applyClip(pct);
    });
}

function initExport(): void {
    getEl<HTMLButtonElement>('exportBtn').addEventListener('click', () => {
        if (!state.image) return;
        const tmp = document.createElement('canvas');
        tmp.width = state.image.naturalWidth;
        tmp.height = state.image.naturalHeight;
        const ctx = tmp.getContext('2d')!;
        ctx.filter = state.image.style.filter || 'none';
        try {
            ctx.drawImage(state.image, 0, 0);
            const overlay = getEl<HTMLCanvasElement>('canvasOverlay');
            if (getComputedStyle(overlay).display !== 'none') {
                ctx.filter = 'none';
                ctx.drawImage(overlay, 0, 0, tmp.width, tmp.height);
            }
            const a = document.createElement('a');
            a.href = tmp.toDataURL('image/png');
            a.download = 'watermark-analysis.png';
            a.click();
        } catch (e: unknown) {
            if (e instanceof Error && e.name === 'SecurityError')
                alert('Não é possível exportar imagens de origem externa');
            else alert(`Erro ao exportar: ${e instanceof Error ? e.message : String(e)}`);
        }
    });
}

function initElaTab(): void {
    const elaBtn = getEl<HTMLButtonElement>('elaBtn');
    const elaSlider = getEl<HTMLInputElement>('elaAmplification');
    const elaSliderValue = getEl<HTMLElement>('elaAmplificationValue');
    const elaScore = getEl<HTMLElement>('elaSuspicionScore');
    const elaScoreValue = getEl<HTMLElement>('elaScoreValue');
    const elaCanvasContainer = getEl<HTMLElement>('elaCanvasContainer');
    const elaCanvas = getEl<HTMLCanvasElement>('elaCanvas');

    elaSlider.addEventListener('input', () => {
        elaSliderValue.textContent = elaSlider.value;
    });

    elaBtn.addEventListener('click', () => {
        if (!state.image) return;
        elaBtn.disabled = true;
        elaBtn.textContent = '⏳ Analisando...';
        renderELA(state.image, elaCanvas, parseInt(elaSlider.value, 10))
            .then((score) => {
                elaCanvasContainer.style.display = '';
                elaScore.style.display = '';
                const label =
                    score < 30 ? `🟢 ${score}%` : score < 60 ? `🟡 ${score}%` : `🔴 ${score}%`;
                elaScoreValue.textContent = label;
                state.activeCanvasMode = 'ela';
                updateAnalysisPanel(state);
            })
            .catch((e: unknown) => {
                if (e instanceof Error && e.name === 'SecurityError')
                    alert('ELA não disponível para imagens de origem externa');
                else alert(`Erro ao analisar: ${e instanceof Error ? e.message : String(e)}`);
            })
            .finally(() => {
                elaBtn.disabled = false;
                elaBtn.textContent = '🔬 Analisar ELA';
            });
    });
}

// Bootstrap
initTabs();
initUpload(state, onImageLoaded);
initFilters(state, () => updateAnalysisPanel(state));
initCanvasTab();
initZoom();
initBeforeAfter();
initExport();
initElaTab();
updateAnalysisPanel(state);
