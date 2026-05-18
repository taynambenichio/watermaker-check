import { initFilters, applyFilters } from './filters.js';
import { initTabs, initUpload, updateAnalysisPanel, enableImageTools } from './ui.js';
import { renderHistogram, renderSobel, renderAmplify, clearOverlay } from './canvas.js';

export const state = {
    image:             null,
    zoom:              1.0,
    activePreset:      null,
    activeCanvasMode:  null,
    beforeAfterActive: false,
};

// Posiciona um elemento absoluto exatamente sobre a imagem exibida
function matchImageBounds(el) {
    const img       = document.getElementById('currentImage');
    const container = document.getElementById('imageDisplay');
    const imgRect   = img.getBoundingClientRect();
    const ctnRect   = container.getBoundingClientRect();
    el.style.top    = (imgRect.top  - ctnRect.top)  + 'px';
    el.style.left   = (imgRect.left - ctnRect.left) + 'px';
    el.style.width  = imgRect.width  + 'px';
    el.style.height = imgRect.height + 'px';
}

function onImageLoaded(img) {
    state.image            = img;
    state.activeCanvasMode = null;
    state.beforeAfterActive = false;
    const overlay = document.getElementById('canvasOverlay');
    clearOverlay(overlay);
    document.getElementById('histogramContainer').style.display = 'none';
    document.getElementById('beforeAfterDivider').style.display = 'none';
    document.getElementById('beforeImage').style.display = 'none';
    img.style.clipPath = '';
    applyFilters(state);
    updateAnalysisPanel(state);
    enableImageTools();
}

function initCanvasTab() {
    const overlay       = document.getElementById('canvasOverlay');
    const histCanvas    = document.getElementById('histogramCanvas');
    const histContainer = document.getElementById('histogramContainer');

    function setCanvasMode(mode, btn) {
        document.querySelectorAll('.canvas-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.activeCanvasMode = mode;
        updateAnalysisPanel(state);
    }

    document.getElementById('histogramBtn').addEventListener('click', function () {
        if (!state.image) return;
        clearOverlay(overlay);
        const tmp = document.createElement('canvas');
        tmp.width = state.image.naturalWidth; tmp.height = state.image.naturalHeight;
        try {
            tmp.getContext('2d').drawImage(state.image, 0, 0);
            const imageData = tmp.getContext('2d').getImageData(0, 0, tmp.width, tmp.height);
            histContainer.style.display = '';
            renderHistogram(imageData, histCanvas);
            setCanvasMode('histogram', this);
        } catch (e) {
            if (e.name === 'SecurityError') alert('Análise Canvas não disponível para imagens externas');
        }
    });

    document.getElementById('sobelBtn').addEventListener('click', function () {
        if (!state.image) return;
        histContainer.style.display = 'none';
        matchImageBounds(overlay);
        renderSobel(state.image, overlay);
        setCanvasMode('sobel', this);
    });

    document.getElementById('amplifyBtn').addEventListener('click', function () {
        if (!state.image) return;
        histContainer.style.display = 'none';
        matchImageBounds(overlay);
        renderAmplify(state.image, overlay);
        setCanvasMode('amplify', this);
    });

    document.getElementById('clearCanvasBtn').addEventListener('click', function () {
        clearOverlay(overlay);
        histContainer.style.display = 'none';
        state.activeCanvasMode = null;
        document.querySelectorAll('.canvas-btn').forEach(b => b.classList.remove('active'));
        updateAnalysisPanel(state);
    });
}

function initZoom() {
    const imageDisplay = document.getElementById('imageDisplay');
    const zoomLabel    = document.getElementById('zoomValue');

    function setZoom(z) {
        state.zoom = Math.max(0.5, Math.min(4, Math.round(z * 100) / 100));
        zoomLabel.textContent = Math.round(state.zoom * 100) + '%';
        if (state.image) state.image.style.transform = `scale(${state.zoom})`;
    }

    document.getElementById('zoomInBtn').addEventListener('click',    () => setZoom(state.zoom + 0.25));
    document.getElementById('zoomOutBtn').addEventListener('click',   () => setZoom(state.zoom - 0.25));
    document.getElementById('zoomResetBtn').addEventListener('click', () => setZoom(1));

    imageDisplay.addEventListener('wheel', e => {
        if (!state.image) return;
        e.preventDefault();
        setZoom(state.zoom + (e.deltaY < 0 ? 0.1 : -0.1));
    }, { passive: false });
}

function initBeforeAfter() {
    const divider    = document.getElementById('beforeAfterDivider');
    const beforeImg  = document.getElementById('beforeImage');
    const imageDisp  = document.getElementById('imageDisplay');
    const btn        = document.getElementById('beforeAfterBtn');
    let dragging     = false;

    function applyClip(pct) {
        beforeImg.style.clipPath      = `inset(0 ${100 - pct}% 0 0)`;
        state.image.style.clipPath    = `inset(0 0 0 ${pct}%)`;
        divider.style.left            = pct + '%';
    }

    function activate() {
        if (!state.image) return;
        matchImageBounds(beforeImg);
        beforeImg.src          = state.image.src;
        beforeImg.style.filter = 'none';
        beforeImg.style.display = '';
        divider.style.display  = '';
        applyClip(50);
        state.beforeAfterActive = true;
        btn.classList.add('active');
    }

    function deactivate() {
        divider.style.display    = 'none';
        beforeImg.style.display  = 'none';
        if (state.image) state.image.style.clipPath = '';
        state.beforeAfterActive  = false;
        btn.classList.remove('active');
    }

    btn.addEventListener('click', () =>
        state.beforeAfterActive ? deactivate() : activate()
    );

    divider.addEventListener('mousedown', e => { if (!state.beforeAfterActive) return; dragging = true; e.preventDefault(); });
    window.addEventListener('mouseup',   () => { dragging = false; });
    window.addEventListener('mousemove', e => {
        if (!dragging || !state.beforeAfterActive) return;
        const rect = imageDisp.getBoundingClientRect();
        const pct  = Math.max(0, Math.min(100, (e.clientX - rect.left) / rect.width * 100));
        applyClip(pct);
    });
}

function initExport() {
    document.getElementById('exportBtn').addEventListener('click', () => {
        if (!state.image) return;
        const tmp = document.createElement('canvas');
        tmp.width  = state.image.naturalWidth;
        tmp.height = state.image.naturalHeight;
        const ctx = tmp.getContext('2d');
        ctx.filter = state.image.style.filter || 'none';
        try {
            ctx.drawImage(state.image, 0, 0);
            const overlay = document.getElementById('canvasOverlay');
            if (getComputedStyle(overlay).display !== 'none') {
                ctx.filter = 'none';
                ctx.drawImage(overlay, 0, 0, tmp.width, tmp.height);
            }
            const a    = document.createElement('a');
            a.href     = tmp.toDataURL('image/png');
            a.download = 'watermark-analysis.png';
            a.click();
        } catch (e) {
            if (e.name === 'SecurityError')
                alert('Não é possível exportar imagens de origem externa');
        }
    });
}

// Bootstrap
initTabs();
initUpload(state, onImageLoaded);
initFilters(state);
initCanvasTab();
initZoom();
initBeforeAfter();
initExport();
updateAnalysisPanel(state);
