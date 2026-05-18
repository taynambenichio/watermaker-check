export function initTabs() {
    const tabBtns     = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const target = btn.dataset.tab;
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.toggle('active', c.dataset.tab === target));
            btn.classList.add('active');
        });
    });
}

export function initUpload(state, onImageLoaded) {
    const fileInput    = document.getElementById('fileInput');
    const imageDisplay = document.getElementById('imageDisplay');
    const uploadArea   = document.getElementById('uploadArea');
    const currentImage = document.getElementById('currentImage');

    function loadSrc(src) {
        currentImage.onload = () => {
            uploadArea.style.display = 'none';
            currentImage.style.display = '';
            state.image = currentImage;
            onImageLoaded(currentImage);
        };
        currentImage.src = src;
        if (currentImage.complete && currentImage.naturalHeight !== 0) {
            currentImage.onload();
        }
    }

    function loadFile(file) {
        if (!file.type.startsWith('image/')) return;
        const reader = new FileReader();
        reader.onload = e => loadSrc(e.target.result);
        reader.readAsDataURL(file);
    }

    document.getElementById('selectFileBtn').addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', e => { if (e.target.files[0]) loadFile(e.target.files[0]); });
    document.getElementById('sampleImageBtn').addEventListener('click', () => loadSrc('example.png'));

    imageDisplay.addEventListener('dragover', e => {
        e.preventDefault();
        imageDisplay.style.borderColor = '#667eea';
    });
    imageDisplay.addEventListener('dragleave', e => {
        e.preventDefault();
        imageDisplay.style.borderColor = 'rgba(255,255,255,0.3)';
    });
    imageDisplay.addEventListener('drop', e => {
        e.preventDefault();
        imageDisplay.style.borderColor = 'rgba(255,255,255,0.3)';
        if (e.dataTransfer.files[0]) loadFile(e.dataTransfer.files[0]);
    });
}

export function updateAnalysisPanel(state) {
    const activeTechnique = document.getElementById('activeTechnique');
    const processingLevel = document.getElementById('processingLevel');
    const recommendation  = document.getElementById('recommendation');

    if (!state.image) {
        activeTechnique.textContent = 'Nenhuma imagem carregada';
        processingLevel.textContent = 'N/A';
        recommendation.textContent  = 'Carregue uma imagem para iniciar';
        return;
    }

    const canvasModeLabels = {
        histogram: 'Histograma RGB',
        sobel:     'Detecção de Bordas (Sobel)',
        amplify:   'Amplificação de Diferenças',
    };
    const presetLabels = {
        uv:        'Simulação de Luz UV',
        infrared:  'Filtro Infravermelho',
        watermark: "Detecção de Marca d'Água",
        security:  'Análise de Segurança',
        edges:     'Detecção de Bordas CSS',
        negative:  'Imagem Negativa',
    };

    let technique = 'Ajustes manuais';
    if (state.activeCanvasMode)  technique = canvasModeLabels[state.activeCanvasMode] || technique;
    else if (state.activePreset) technique = presetLabels[state.activePreset]          || technique;
    activeTechnique.textContent = technique;

    const b = parseInt(document.getElementById('brightness').value);
    const c = parseInt(document.getElementById('contrast').value);
    const s = parseInt(document.getElementById('saturation').value);
    const h = parseInt(document.getElementById('hue').value);
    const i = parseInt(document.getElementById('invert').value);
    const bl = parseInt(document.getElementById('blur').value);
    const total = Math.abs(b - 100) + Math.abs(c - 100) + Math.abs(s - 100) + h + i + bl * 10;
    processingLevel.textContent = total > 200 ? 'Alto' : total > 100 ? 'Médio' : 'Baixo';

    let rec = 'Ajuste os controles para revelar elementos ocultos';
    if (state.activeCanvasMode === 'sobel')    rec = 'Bordas reais detectadas pelo algoritmo Sobel';
    else if (state.activeCanvasMode === 'amplify') rec = 'Diferenças sutis amplificadas 5×';
    else if (state.activeCanvasMode === 'histogram') rec = 'Veja a distribuição de cores no histograma';
    else if (state.activePreset === 'uv')        rec = 'Ideal para detectar tintas fluorescentes';
    else if (state.activePreset === 'watermark') rec = "Optimize contraste para marcas d'água";
    else if (state.activePreset === 'security')  rec = 'Configuração para elementos de segurança';
    else if (total > 150) rec = 'Processamento intenso aplicado';
    recommendation.textContent = rec;
}

export function enableImageTools() {
    ['histogramBtn','sobelBtn','amplifyBtn','clearCanvasBtn',
     'zoomInBtn','zoomOutBtn','zoomResetBtn','beforeAfterBtn','exportBtn'
    ].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.disabled = false;
    });
}
