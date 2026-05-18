import { renderNoiseMap } from './forensics/noise.js';
import type { AppState, ForensicPipelineResult } from './types.js';

export function initTabs(): void {
    const tabBtns = document.querySelectorAll<HTMLButtonElement>('.tab-btn');
    const tabContents = document.querySelectorAll<HTMLElement>('.tab-content');
    tabBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
            const target = btn.dataset.tab;
            tabBtns.forEach((b) => b.classList.remove('active'));
            tabContents.forEach((c) => c.classList.toggle('active', c.dataset.tab === target));
            btn.classList.add('active');
        });
    });
}

export function initUpload(state: AppState, onImageLoaded: (img: HTMLImageElement) => void): void {
    const fileInput = document.getElementById('fileInput') as HTMLInputElement;
    const imageDisplay = document.getElementById('imageDisplay') as HTMLElement;
    const uploadArea = document.getElementById('uploadArea') as HTMLElement;
    const currentImage = document.getElementById('currentImage') as HTMLImageElement;

    function handleLoaded(): void {
        uploadArea.style.display = 'none';
        currentImage.style.display = '';
        state.image = currentImage;
        onImageLoaded(currentImage);
    }

    function loadSrc(src: string): void {
        currentImage.onload = handleLoaded;
        currentImage.src = src;
        if (currentImage.complete && currentImage.naturalHeight !== 0) {
            currentImage.onload = null;
            handleLoaded();
        }
    }

    function loadFile(file: File): void {
        if (!file.type.startsWith('image/')) return;
        const reader = new FileReader();
        reader.onload = (e: ProgressEvent<FileReader>): void => {
            const result = e.target?.result;
            if (typeof result === 'string') loadSrc(result);
        };
        reader.readAsDataURL(file);
    }

    (document.getElementById('selectFileBtn') as HTMLButtonElement).addEventListener('click', () =>
        fileInput.click(),
    );

    fileInput.addEventListener('change', (e: Event) => {
        const target = e.target as HTMLInputElement;
        if (target.files?.[0]) loadFile(target.files[0]);
    });

    (document.getElementById('sampleImageBtn') as HTMLButtonElement).addEventListener('click', () =>
        loadSrc('example.png'),
    );

    imageDisplay.addEventListener('dragover', (e: DragEvent) => {
        e.preventDefault();
        imageDisplay.style.borderColor = '#667eea';
    });
    imageDisplay.addEventListener('dragleave', (e: DragEvent) => {
        if (imageDisplay.contains(e.relatedTarget as Node)) return;
        imageDisplay.style.borderColor = 'rgba(255,255,255,0.3)';
    });
    imageDisplay.addEventListener('drop', (e: DragEvent) => {
        e.preventDefault();
        imageDisplay.style.borderColor = 'rgba(255,255,255,0.3)';
        if (e.dataTransfer?.files[0]) loadFile(e.dataTransfer.files[0]);
    });
}

export function updateAnalysisPanel(state: AppState): void {
    const activeTechnique = document.getElementById('activeTechnique') as HTMLElement;
    const processingLevel = document.getElementById('processingLevel') as HTMLElement;
    const recommendation = document.getElementById('recommendation') as HTMLElement;

    if (!state.image) {
        activeTechnique.textContent = 'Nenhuma imagem carregada';
        processingLevel.textContent = 'N/A';
        recommendation.textContent = 'Carregue uma imagem para iniciar';
        return;
    }

    const canvasModeLabels: Record<string, string> = {
        histogram: 'Histograma RGB',
        sobel: 'Detecção de Bordas (Sobel)',
        amplify: 'Amplificação de Diferenças',
        ela: 'Error Level Analysis (ELA)',
    };
    const presetLabels: Record<string, string> = {
        uv: 'Simulação de Luz UV',
        infrared: 'Filtro Infravermelho',
        watermark: "Detecção de Marca d'Água",
        security: 'Análise de Segurança',
        edges: 'Detecção de Bordas CSS',
        negative: 'Imagem Negativa',
    };

    let technique = 'Ajustes manuais';
    if (state.activeCanvasMode) technique = canvasModeLabels[state.activeCanvasMode] ?? technique;
    else if (state.activePreset) technique = presetLabels[state.activePreset] ?? technique;
    activeTechnique.textContent = technique;

    const getVal = (id: string): number =>
        parseInt((document.getElementById(id) as HTMLInputElement).value, 10);

    const b = getVal('brightness');
    const c = getVal('contrast');
    const s = getVal('saturation');
    const h = getVal('hue');
    const iv = getVal('invert');
    const bl = getVal('blur');
    const total = Math.abs(b - 100) + Math.abs(c - 100) + Math.abs(s - 100) + h + iv + bl * 10;
    processingLevel.textContent = total > 200 ? 'Alto' : total > 100 ? 'Médio' : 'Baixo';

    let rec = 'Ajuste os controles para revelar elementos ocultos';
    if (state.activeCanvasMode === 'sobel') rec = 'Bordas reais detectadas pelo algoritmo Sobel';
    else if (state.activeCanvasMode === 'amplify') rec = 'Diferenças sutis amplificadas 5×';
    else if (state.activeCanvasMode === 'histogram')
        rec = 'Veja a distribuição de cores no histograma';
    else if (state.activeCanvasMode === 'ela')
        rec = 'Regiões quentes (vermelho/branco) indicam adulteração';
    else if (state.activePreset === 'uv') rec = 'Ideal para detectar tintas fluorescentes';
    else if (state.activePreset === 'watermark') rec = "Optimize contraste para marcas d'água";
    else if (state.activePreset === 'security') rec = 'Configuração para elementos de segurança';
    else if (total > 150) rec = 'Processamento intenso aplicado';
    recommendation.textContent = rec;
}

export function enableImageTools(): void {
    const toolIds = [
        'histogramBtn',
        'sobelBtn',
        'amplifyBtn',
        'elaBtn',
        'clearCanvasBtn',
        'zoomInBtn',
        'zoomOutBtn',
        'zoomResetBtn',
        'beforeAfterBtn',
        'exportBtn',
    ];
    toolIds.forEach((id) => {
        const el = document.getElementById(id) as HTMLButtonElement | null;
        if (el) el.disabled = false;
    });
}

const QUALITIES = [50, 65, 80, 95] as const;

export function renderGhostSlider(result: ForensicPipelineResult, levelIndex: number): void {
    const canvas = document.getElementById('ghostCanvas') as HTMLCanvasElement | null;
    const label = document.getElementById('ghostQualityLabel');
    if (!canvas || !result.ghost.levels[levelIndex]) return;

    const level = result.ghost.levels[levelIndex];
    if (label) label.textContent = `Q ${QUALITIES[levelIndex]}`;

    canvas.width = level.imageData.width;
    canvas.height = level.imageData.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const id = ctx.createImageData(level.imageData.width, level.imageData.height);
    id.data.set(level.imageData.data);
    ctx.putImageData(id, 0, 0);
}

function verdictBadgeClass(score: number): string {
    if (score < 30) return 'forensics-badge-green';
    if (score <= 60) return 'forensics-badge-amber';
    return 'forensics-badge-red';
}

export function renderForensicResults(
    result: ForensicPipelineResult,
    img: HTMLImageElement,
    ghostLevelIndex: number,
): void {
    const show = (id: string) => {
        const el = document.getElementById(id);
        if (el) el.style.display = '';
    };

    // ── EXIF ──────────────────────────────────────────────────────────────
    show('forensicsExifSection');
    const exifBadge = document.getElementById('forensicsExifBadge');
    const exifBody = document.getElementById('forensicsExifBody');

    if (exifBadge) {
        exifBadge.className = `forensics-badge ${verdictBadgeClass(result.exif.score)}`;
        exifBadge.textContent = `Score ${result.exif.score}`;
    }

    if (exifBody) {
        const { exif } = result;
        let html = '<table class="forensics-exif-table">';
        html += `<tr><td>EXIF presente</td><td>${exif.hasExif ? '✅ Sim' : '❌ Não'}</td></tr>`;
        if (exif.camera) html += `<tr><td>Câmara</td><td>${exif.camera}</td></tr>`;
        if (exif.software) html += `<tr><td>Software</td><td>${exif.software}</td></tr>`;
        if (exif.dateTime) html += `<tr><td>Data</td><td>${exif.dateTime}</td></tr>`;
        html += `<tr><td>GPS</td><td>${exif.gpsPresent ? '✅ Presente' : '—'}</td></tr>`;
        html += '</table>';

        for (const flag of exif.flags) {
            html += `<div class="forensics-flag-row">⚠️ <span>${flag.message}</span></div>`;
        }
        exifBody.innerHTML = html;
    }

    // ── Noise ──────────────────────────────────────────────────────────────
    show('forensicsNoiseSection');
    const noiseBadge = document.getElementById('forensicsNoiseBadge');
    const noiseBody = document.getElementById('forensicsNoiseBody');
    const noiseCanvas = document.getElementById('noiseCanvas') as HTMLCanvasElement | null;

    if (noiseBadge) {
        noiseBadge.className = `forensics-badge ${verdictBadgeClass(result.noise.score)}`;
        noiseBadge.textContent = `Score ${result.noise.score}`;
    }

    if (noiseBody) {
        noiseBody.textContent = `${result.noise.suspiciousBlockCount} bloco(s) anómalo(s) de ${result.noise.totalBlockCount} total`;
    }

    if (noiseCanvas) {
        renderNoiseMap(result.noise, noiseCanvas, img.naturalWidth, img.naturalHeight);
    }

    // ── Ghost ──────────────────────────────────────────────────────────────
    show('forensicsGhostSection');
    const ghostBadge = document.getElementById('forensicsGhostBadge');
    const ghostBody = document.getElementById('forensicsGhostBody');

    if (ghostBadge) {
        ghostBadge.className = `forensics-badge ${verdictBadgeClass(result.ghost.score)}`;
        ghostBadge.textContent = `Score ${result.ghost.score}`;
    }

    if (ghostBody) {
        ghostBody.textContent = result.ghost.suspectedOriginalQuality
            ? `Qualidade original suspeita: Q${result.ghost.suspectedOriginalQuality}`
            : 'Sem sinal de dupla compressão JPEG detectado';
    }

    renderGhostSlider(result, ghostLevelIndex);

    // ── Report ──────────────────────────────────────────────────────────────
    show('forensicsReportSection');
    const reportBadge = document.getElementById('forensicsReportBadge');
    const scoreGrid = document.getElementById('forensicsScoreGrid');
    const totalScoreEl = document.getElementById('forensicsTotalScore');
    const scoreBar = document.getElementById('forensicsScoreBar');

    const { report } = result;
    const verdictLabel =
        report.verdict === 'authentic'
            ? '🟢 Autêntico'
            : report.verdict === 'suspicious'
              ? '🟡 Suspeito'
              : '🔴 Adulterado';
    const verdictClass = verdictBadgeClass(report.totalScore);

    if (reportBadge) {
        reportBadge.className = `forensics-badge ${verdictClass}`;
        reportBadge.textContent = verdictLabel;
    }

    if (scoreGrid) {
        const cards = [
            ['ELA', report.ela, '×0.25'],
            ['Ghost', report.ghost, '×0.30'],
            ['Ruído', report.noise, '×0.25'],
            ['EXIF', report.exif, '×0.20'],
        ] as const;
        scoreGrid.innerHTML = cards
            .map(
                ([label, score, weight]) =>
                    `<div class="forensics-score-card">
                        <div class="forensics-score-card-label">${label} <span style="color:#4b5563">${weight}</span></div>
                        <div class="forensics-score-card-value" style="color:${score < 30 ? '#86efac' : score <= 60 ? '#fbbf24' : '#f87171'}">${score}</div>
                    </div>`,
            )
            .join('');
    }

    if (totalScoreEl) {
        totalScoreEl.textContent = `${report.totalScore} / 100`;
        totalScoreEl.style.color =
            report.totalScore < 30 ? '#86efac' : report.totalScore <= 60 ? '#fbbf24' : '#f87171';
    }

    if (scoreBar) {
        scoreBar.style.width = `${report.totalScore}%`;
        scoreBar.style.background =
            report.totalScore < 30 ? '#22c55e' : report.totalScore <= 60 ? '#f59e0b' : '#ef4444';
    }
}
