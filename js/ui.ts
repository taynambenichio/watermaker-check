import type { AppState } from './types.js';

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
