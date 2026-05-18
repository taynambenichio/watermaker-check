# Watermark Detector — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refatorar `index.html` em módulos ES + adicionar análise Canvas (histograma, Sobel, amplificação de diferenças), zoom, antes/depois e exportar PNG.

**Architecture:** Extrair CSS e JS do `index.html` para arquivos separados. Quatro módulos JS (`main.js`, `filters.js`, `canvas.js`, `ui.js`) comunicam via objeto de estado simples em `main.js`. Algoritmos Canvas são funções puras testáveis em Node.js. Sem build step — módulos ES servidos via GitHub Pages (HTTP) ou `python3 -m http.server` localmente.

**Tech Stack:** HTML5, CSS3, JavaScript ES Modules (sem framework, sem bundler). Node.js 18+ para testes dos algoritmos Canvas.

---

## Estrutura Final de Arquivos

```
watermaker-check/
├── index.html              ← reescrito (só HTML estrutural + <link>/<script>)
├── css/
│   └── styles.css          ← estilos extraídos + novos (tabs, canvas, tools)
├── js/
│   ├── main.js             ← estado global + inicialização + canvas tab + zoom + before/after + export
│   ├── filters.js          ← filtros CSS: sliders, presets, reset
│   ├── canvas.js           ← algoritmos puros (testáveis) + funções DOM de renderização
│   └── ui.js               ← tabs, upload/drag-drop, painel de análise
├── tests/
│   └── canvas.test.mjs     ← testes Node.js para as funções puras de canvas.js
└── example.png             ← mantida
```

---

## Task 1: Scaffold — Estrutura, CSS e novo index.html

**Files:**
- Create: `css/styles.css`
- Create: `js/` (vazio por enquanto)
- Create: `tests/` (vazio por enquanto)
- Modify: `index.html`

- [ ] **Step 1: Criar diretórios**

```bash
mkdir -p css js tests
```

- [ ] **Step 2: Criar `css/styles.css`**

Copie o conteúdo do bloco `<style>` do `index.html` atual (linhas entre `<style>` e `</style>`) e cole em `css/styles.css`. Em seguida, **acrescente** ao final do arquivo os estilos novos abaixo:

```css
/* ── Tabs ── */
.tab-nav {
    display: flex;
    gap: 4px;
    margin-bottom: 16px;
    border-bottom: 1px solid rgba(255,255,255,0.15);
    padding-bottom: 8px;
}
.tab-btn {
    flex: 1;
    background: rgba(255,255,255,0.08);
    color: white;
    border: 1px solid rgba(255,255,255,0.15);
    padding: 8px 4px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.8em;
    transition: all 0.2s;
}
.tab-btn:hover { background: rgba(255,255,255,0.15); }
.tab-btn.active {
    background: linear-gradient(45deg, #667eea 0%, #764ba2 100%);
    border-color: transparent;
}
.tab-content { display: none; }
.tab-content.active { display: block; }
.tab-description {
    font-size: 0.85em;
    opacity: 0.7;
    margin-bottom: 12px;
    font-style: italic;
}

/* ── Canvas controls ── */
.canvas-controls {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-top: 10px;
}
.canvas-btn {
    background: rgba(255,255,255,0.1);
    color: white;
    border: 1px solid rgba(255,255,255,0.2);
    padding: 10px 14px;
    border-radius: 8px;
    cursor: pointer;
    font-size: 0.9em;
    transition: all 0.2s;
    text-align: left;
}
.canvas-btn:hover:not(:disabled) { background: rgba(255,255,255,0.2); }
.canvas-btn.active {
    background: linear-gradient(45deg, #667eea 0%, #764ba2 100%);
    border-color: transparent;
}
.canvas-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.canvas-btn.secondary {
    background: rgba(245,87,108,0.15);
    border-color: rgba(245,87,108,0.3);
}
.canvas-btn.secondary:hover:not(:disabled) { background: rgba(245,87,108,0.3); }

/* ── Tool groups ── */
.tool-group { margin-bottom: 20px; }
.tool-group label { display: block; margin-bottom: 8px; font-size: 0.95em; }
.zoom-controls { display: flex; gap: 8px; }
.tool-btn {
    background: rgba(255,255,255,0.1);
    color: white;
    border: 1px solid rgba(255,255,255,0.2);
    padding: 10px 18px;
    border-radius: 8px;
    cursor: pointer;
    font-size: 1em;
    transition: all 0.2s;
}
.tool-btn:hover:not(:disabled) { background: rgba(255,255,255,0.2); }
.tool-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.tool-btn.wide { width: 100%; margin-bottom: 0; }
.tool-btn.active {
    background: linear-gradient(45deg, #667eea 0%, #764ba2 100%);
    border-color: transparent;
}

/* ── Overlays inside .image-display ── */
#beforeImage {
    display: none;
    position: absolute;
    pointer-events: none;
    z-index: 2;
}
#canvasOverlay {
    display: none;
    position: absolute;
    pointer-events: none;
    z-index: 3;
}
#beforeAfterDivider {
    display: none;
    position: absolute;
    top: 0;
    height: 100%;
    width: 40px;
    transform: translateX(-50%);
    cursor: ew-resize;
    z-index: 4;
}
.divider-line {
    position: absolute;
    left: 50%;
    top: 0;
    width: 2px;
    height: 100%;
    background: white;
    transform: translateX(-50%);
}
.divider-handle {
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    background: white;
    color: #333;
    border-radius: 50%;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.9em;
    box-shadow: 0 2px 8px rgba(0,0,0,0.4);
}

/* ── Histogram ── */
.histogram-container {
    background: rgba(255,255,255,0.1);
    border-radius: 15px;
    padding: 20px;
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255,255,255,0.2);
    margin-top: 20px;
}
.histogram-container h4 { margin-bottom: 12px; }
#histogramCanvas {
    width: 100%;
    height: auto;
    border-radius: 6px;
    background: rgba(0,0,0,0.3);
}
```

- [ ] **Step 3: Reescrever `index.html`**

Substitua todo o conteúdo de `index.html` por:

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Detector de Marcas d'Água - Análise Visual</title>
    <link rel="stylesheet" href="css/styles.css">
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔍 Detector de Marcas d'Água</h1>
            <p>Ferramenta avançada para análise visual e detecção de elementos de segurança em documentos</p>
        </div>

        <div class="main-content">
            <div class="image-container">
                <div class="image-display" id="imageDisplay">
                    <div class="upload-area" id="uploadArea">
                        <div style="font-size: 4em; margin-bottom: 20px;">📄</div>
                        <h3>Carregar Documento</h3>
                        <p>Arraste uma imagem aqui ou clique para selecionar</p>
                        <input type="file" id="fileInput" class="file-input" accept="image/*">
                        <button class="upload-btn" id="selectFileBtn">Selecionar Arquivo</button>
                        <button class="upload-btn" id="sampleImageBtn">Usar Imagem de Exemplo</button>
                    </div>
                    <img id="currentImage" alt="" style="display:none; max-width:100%; max-height:100%; object-fit:contain; position:relative; z-index:1;">
                    <img id="beforeImage" alt="">
                    <canvas id="canvasOverlay"></canvas>
                    <div id="beforeAfterDivider">
                        <div class="divider-line"></div>
                        <div class="divider-handle">↔</div>
                    </div>
                </div>
            </div>

            <div class="controls-panel">
                <div class="tab-nav">
                    <button class="tab-btn active" data-tab="filters">🎚 Filtros</button>
                    <button class="tab-btn" data-tab="canvas">🔬 Canvas</button>
                    <button class="tab-btn" data-tab="tools">🛠 Tools</button>
                </div>

                <!-- Tab: Filtros CSS -->
                <div class="tab-content active" data-tab="filters">
                    <div class="control-group">
                        <label class="tooltip" data-tooltip="Ajusta o brilho da imagem para revelar marcas ocultas">
                            💡 Brilho: <span class="value-display" id="brightnessValue">100%</span>
                        </label>
                        <input type="range" class="slider" id="brightness" min="0" max="300" value="100">
                    </div>
                    <div class="control-group">
                        <label class="tooltip" data-tooltip="Aumenta o contraste para destacar elementos de segurança">
                            🌓 Contraste: <span class="value-display" id="contrastValue">100%</span>
                        </label>
                        <input type="range" class="slider" id="contrast" min="0" max="300" value="100">
                    </div>
                    <div class="control-group">
                        <label class="tooltip" data-tooltip="Ajusta a saturação das cores">
                            🎨 Saturação: <span class="value-display" id="saturationValue">100%</span>
                        </label>
                        <input type="range" class="slider" id="saturation" min="0" max="300" value="100">
                    </div>
                    <div class="control-group">
                        <label class="tooltip" data-tooltip="Rotaciona o matiz das cores para revelar diferentes camadas">
                            🌈 Matiz: <span class="value-display" id="hueValue">0°</span>
                        </label>
                        <input type="range" class="slider" id="hue" min="0" max="360" value="0">
                    </div>
                    <div class="control-group">
                        <label class="tooltip" data-tooltip="Inverte as cores para análise de marcas d'água">
                            🔄 Inversão: <span class="value-display" id="invertValue">0%</span>
                        </label>
                        <input type="range" class="slider" id="invert" min="0" max="100" value="0">
                    </div>
                    <div class="control-group">
                        <label class="tooltip" data-tooltip="Aplica desfoque para suavizar a imagem">
                            🌫️ Desfoque: <span class="value-display" id="blurValue">0px</span>
                        </label>
                        <input type="range" class="slider" id="blur" min="0" max="20" value="0">
                    </div>
                    <h3>🎯 Filtros Predefinidos</h3>
                    <div class="preset-filters">
                        <button class="preset-btn" data-preset="uv">💜 Luz UV</button>
                        <button class="preset-btn" data-preset="infrared">🔴 Infravermelho</button>
                        <button class="preset-btn" data-preset="watermark">💧 Marca d'Água</button>
                        <button class="preset-btn" data-preset="security">🔒 Segurança</button>
                        <button class="preset-btn" data-preset="edges">📐 Bordas</button>
                        <button class="preset-btn" data-preset="negative">📸 Negativo</button>
                    </div>
                    <button class="reset-btn" id="resetBtn">🔄 Restaurar Original</button>
                </div>

                <!-- Tab: Análise Canvas -->
                <div class="tab-content" data-tab="canvas">
                    <p class="tab-description">Processamento real de pixels via Canvas API</p>
                    <div class="canvas-controls">
                        <button class="canvas-btn" id="histogramBtn" disabled>📊 Histograma RGB</button>
                        <button class="canvas-btn" id="sobelBtn" disabled>📐 Bordas (Sobel)</button>
                        <button class="canvas-btn" id="amplifyBtn" disabled>🔍 Amplificar Diferenças</button>
                        <button class="canvas-btn secondary" id="clearCanvasBtn" disabled>✕ Limpar Canvas</button>
                    </div>
                </div>

                <!-- Tab: Ferramentas -->
                <div class="tab-content" data-tab="tools">
                    <div class="tool-group">
                        <label>🔍 Zoom: <span id="zoomValue">100%</span></label>
                        <div class="zoom-controls">
                            <button class="tool-btn" id="zoomOutBtn" disabled>−</button>
                            <button class="tool-btn" id="zoomResetBtn" disabled>↺</button>
                            <button class="tool-btn" id="zoomInBtn" disabled>+</button>
                        </div>
                    </div>
                    <div class="tool-group">
                        <button class="tool-btn wide" id="beforeAfterBtn" disabled>↔ Antes / Depois</button>
                    </div>
                    <div class="tool-group">
                        <button class="tool-btn wide" id="exportBtn" disabled>💾 Exportar PNG</button>
                    </div>
                </div>
            </div>
        </div>

        <div id="histogramContainer" class="histogram-container" style="display:none">
            <h4>📊 Histograma RGB</h4>
            <canvas id="histogramCanvas" width="256" height="100"></canvas>
        </div>

        <div class="analysis-info">
            <h3>📊 Informações da Análise</h3>
            <div class="info-grid">
                <div class="info-card">
                    <h4>🔍 Técnica Ativa</h4>
                    <p id="activeTechnique">Nenhum filtro aplicado</p>
                </div>
                <div class="info-card">
                    <h4>📈 Nível de Processamento</h4>
                    <p id="processingLevel">Baixo</p>
                </div>
                <div class="info-card">
                    <h4>💡 Recomendação</h4>
                    <p id="recommendation">Carregue uma imagem para iniciar</p>
                </div>
                <div class="info-card">
                    <h4>🎯 Elementos Detectáveis</h4>
                    <p id="detectableElements">Hologramas, marcas d'água, microtextos</p>
                </div>
            </div>
        </div>
    </div>

    <script type="module" src="js/main.js"></script>
</body>
</html>
```

- [ ] **Step 4: Verificar no browser**

```bash
cd /home/taynam/watermaker-check && python3 -m http.server 8080
```

Abra `http://localhost:8080`. Esperado: página carrega com visual igual ao atual (sem JS ainda), três abas visíveis no painel direito, upload area presente.

- [ ] **Step 5: Commit**

```bash
git add css/styles.css index.html
git commit -m "refactor: scaffold modular structure — extract CSS, rewrite HTML with tabs"
```

---

## Task 2: js/filters.js — Migrar lógica de filtros CSS

**Files:**
- Create: `js/filters.js`

- [ ] **Step 1: Criar `js/filters.js`**

```js
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

export function initFilters(state) {
    SLIDER_IDS.forEach(id => {
        document.getElementById(id).addEventListener('input', () => {
            updateValueDisplays();
            state.activePreset = null;
            document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
            applyFilters(state);
        });
    });
    document.querySelectorAll('.preset-btn').forEach(btn => {
        btn.addEventListener('click', () => applyPreset(btn.dataset.preset, state));
    });
    document.getElementById('resetBtn').addEventListener('click', () => resetFilters(state));
}
```

- [ ] **Step 2: Verificar (precisará do main.js — pule para Task 4 e volte se quiser testar isolado)**

Apenas commit por enquanto.

- [ ] **Step 3: Commit**

```bash
git add js/filters.js
git commit -m "feat: add filters.js — CSS filter sliders, presets, reset"
```

---

## Task 3: js/ui.js — Tabs, upload e painel de análise

**Files:**
- Create: `js/ui.js`

- [ ] **Step 1: Criar `js/ui.js`**

```js
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
```

- [ ] **Step 2: Commit**

```bash
git add js/ui.js
git commit -m "feat: add ui.js — tabs, upload/drag-drop, analysis panel"
```

---

## Task 4: tests/canvas.test.mjs + js/canvas.js — computeHistogram (TDD)

**Files:**
- Create: `tests/canvas.test.mjs`
- Create: `js/canvas.js`

- [ ] **Step 1: Escrever teste que falha para `computeHistogram`**

Criar `tests/canvas.test.mjs`:

```js
import assert from 'node:assert/strict';

// canvas.js expõe funções puras que aceitam {data: Uint8ClampedArray, width, height}
// compatíveis com ImageData, testáveis em Node.js sem browser
import { computeHistogram } from '../js/canvas.js';

function img(pixels, width, height) {
    return { data: new Uint8ClampedArray(pixels), width, height };
}

// ── computeHistogram ──────────────────────────────────────────
{
    // 1 pixel vermelho puro
    const h = computeHistogram(img([255, 0, 0, 255], 1, 1));
    assert.equal(h.r[255], 1, 'r[255] deve ser 1 para pixel vermelho');
    assert.equal(h.g[0],   1, 'g[0] deve ser 1 para pixel vermelho');
    assert.equal(h.b[0],   1, 'b[0] deve ser 1 para pixel vermelho');
    console.log('✓ computeHistogram: pixel vermelho');
}
{
    // 2 pixels: vermelho e azul
    const h = computeHistogram(img([255,0,0,255, 0,0,255,255], 2, 1));
    assert.equal(h.r[255], 1); assert.equal(h.r[0], 1);
    assert.equal(h.b[255], 1); assert.equal(h.b[0], 1);
    console.log('✓ computeHistogram: dois pixels');
}
{
    // 256 pixels com valor crescente em R
    const pixels = [];
    for (let i = 0; i < 256; i++) pixels.push(i, 0, 0, 255);
    const h = computeHistogram(img(pixels, 256, 1));
    for (let i = 0; i < 256; i++) assert.equal(h.r[i], 1, `r[${i}] deve ser 1`);
    console.log('✓ computeHistogram: 256 valores únicos em R');
}

console.log('\n✅ computeHistogram OK');
```

- [ ] **Step 2: Rodar teste — esperado: falha com "Cannot find module"**

```bash
node tests/canvas.test.mjs
```

Esperado: `Error [ERR_MODULE_NOT_FOUND]: Cannot find module '../js/canvas.js'`

- [ ] **Step 3: Implementar `computeHistogram` em `js/canvas.js`**

Criar `js/canvas.js` com apenas a função necessária por agora:

```js
// ── Pure functions — testable in Node.js ──────────────────────
// Aceitam { data: Uint8ClampedArray, width: number, height: number }

export function computeHistogram({ data }) {
    const r = new Uint32Array(256);
    const g = new Uint32Array(256);
    const b = new Uint32Array(256);
    for (let i = 0; i < data.length; i += 4) {
        r[data[i]]++;
        g[data[i + 1]]++;
        b[data[i + 2]]++;
    }
    return { r, g, b };
}
```

- [ ] **Step 4: Rodar teste — esperado: passa**

```bash
node tests/canvas.test.mjs
```

Esperado:
```
✓ computeHistogram: pixel vermelho
✓ computeHistogram: dois pixels
✓ computeHistogram: 256 valores únicos em R

✅ computeHistogram OK
```

- [ ] **Step 5: Commit**

```bash
git add js/canvas.js tests/canvas.test.mjs
git commit -m "feat(canvas): add computeHistogram with tests"
```

---

## Task 5: js/canvas.js — sobelEdges (TDD)

**Files:**
- Modify: `tests/canvas.test.mjs`
- Modify: `js/canvas.js`

- [ ] **Step 1: Adicionar testes para `sobelEdges` em `tests/canvas.test.mjs`**

Acrescente ao final do arquivo (antes do `console.log('\n✅ computeHistogram OK')`):

```js
import { computeHistogram, sobelEdges } from '../js/canvas.js';
```

Substitua a linha de import no topo do arquivo por essa, e adicione ao final:

```js
// ── sobelEdges ────────────────────────────────────────────────
{
    // 3×3 imagem uniforme → sem bordas
    const pixels = new Array(3 * 3 * 4).fill(0);
    for (let i = 0; i < 9; i++) { pixels[i*4]=pixels[i*4+1]=pixels[i*4+2]=128; pixels[i*4+3]=255; }
    const result = sobelEdges(img(pixels, 3, 3));
    const center = (1 * 3 + 1) * 4;
    assert.equal(result.data[center], 0, 'imagem uniforme: magnitude deve ser 0 no centro');
    console.log('✓ sobelEdges: imagem uniforme → sem bordas');
}
{
    // 3×3 com borda vertical: coluna 0-1 preta, coluna 2 branca
    const pixels = new Array(3 * 3 * 4).fill(0);
    for (let y = 0; y < 3; y++) {
        for (let x = 0; x < 3; x++) {
            const v = x >= 2 ? 255 : 0;
            const i = (y * 3 + x) * 4;
            pixels[i]=pixels[i+1]=pixels[i+2]=v; pixels[i+3]=255;
        }
    }
    const result = sobelEdges(img(pixels, 3, 3));
    const center = (1 * 3 + 1) * 4;
    assert.ok(result.data[center] > 0, 'borda vertical: centro deve ter magnitude > 0');
    assert.equal(result.data.length, 3 * 3 * 4, 'saída deve ter mesmas dimensões');
    assert.equal(result.width, 3); assert.equal(result.height, 3);
    console.log('✓ sobelEdges: borda vertical detectada');
}
```

- [ ] **Step 2: Rodar teste — esperado: falha com "sobelEdges is not a function"**

```bash
node tests/canvas.test.mjs
```

Esperado: `SyntaxError` ou `TypeError: sobelEdges is not a function`

- [ ] **Step 3: Implementar `sobelEdges` em `js/canvas.js`**

Acrescente após `computeHistogram`:

```js
export function sobelEdges({ data, width, height }) {
    // Converter para escala de cinza
    const gray = new Uint8Array(width * height);
    for (let i = 0; i < width * height; i++) {
        gray[i] = Math.round(0.299 * data[i*4] + 0.587 * data[i*4+1] + 0.114 * data[i*4+2]);
    }

    const out = new Uint8ClampedArray(width * height * 4);
    const px = (row, col) => gray[row * width + col];

    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            const gx = -px(y-1,x-1) + px(y-1,x+1)
                       -2*px(y,x-1) + 2*px(y,x+1)
                       -px(y+1,x-1) + px(y+1,x+1);
            const gy = -px(y-1,x-1) - 2*px(y-1,x) - px(y-1,x+1)
                       +px(y+1,x-1) + 2*px(y+1,x) + px(y+1,x+1);
            const mag = Math.min(255, Math.round(Math.sqrt(gx * gx + gy * gy)));
            const idx = (y * width + x) * 4;
            out[idx] = out[idx+1] = out[idx+2] = mag;
            out[idx+3] = 255;
        }
    }
    return { data: out, width, height };
}
```

- [ ] **Step 4: Rodar todos os testes — esperado: todos passam**

```bash
node tests/canvas.test.mjs
```

Esperado:
```
✓ computeHistogram: pixel vermelho
✓ computeHistogram: dois pixels
✓ computeHistogram: 256 valores únicos em R
✓ sobelEdges: imagem uniforme → sem bordas
✓ sobelEdges: borda vertical detectada
```

- [ ] **Step 5: Commit**

```bash
git add js/canvas.js tests/canvas.test.mjs
git commit -m "feat(canvas): add sobelEdges with tests"
```

---

## Task 6: js/canvas.js — amplifyDifferences + funções DOM

**Files:**
- Modify: `tests/canvas.test.mjs`
- Modify: `js/canvas.js`

- [ ] **Step 1: Adicionar testes para `amplifyDifferences` em `tests/canvas.test.mjs`**

Atualizar o import no topo:
```js
import { computeHistogram, sobelEdges, amplifyDifferences } from '../js/canvas.js';
```

Acrescentar ao final do arquivo:

```js
// ── amplifyDifferences ────────────────────────────────────────
{
    // 3×3 imagem uniforme → sem diferenças para amplificar
    const pixels = new Array(3 * 3 * 4).fill(0);
    for (let i = 0; i < 9; i++) { pixels[i*4]=pixels[i*4+1]=pixels[i*4+2]=100; pixels[i*4+3]=255; }
    const result = amplifyDifferences(img(pixels, 3, 3));
    const center = (1 * 3 + 1) * 4;
    assert.equal(result.data[center], 0, 'imagem uniforme: sem diferenças a amplificar');
    console.log('✓ amplifyDifferences: imagem uniforme → saída zero');
}
{
    // 3×3 com pixel central mais brilhante (100 → 200)
    const pixels = new Array(3 * 3 * 4).fill(0);
    for (let i = 0; i < 9; i++) { pixels[i*4]=pixels[i*4+1]=pixels[i*4+2]=100; pixels[i*4+3]=255; }
    pixels[4*4]=pixels[4*4+1]=pixels[4*4+2]=200; // centro mais brilhante
    const result = amplifyDifferences(img(pixels, 3, 3));
    const center = (1 * 3 + 1) * 4;
    assert.ok(result.data[center] > 0, 'pixel central mais brilhante deve ser amplificado');
    assert.equal(result.data[center + 3], 255, 'canal alpha deve ser 255');
    console.log('✓ amplifyDifferences: pixel diferente amplificado');
}
```

- [ ] **Step 2: Rodar — esperado: falha com "amplifyDifferences is not a function"**

```bash
node tests/canvas.test.mjs
```

- [ ] **Step 3: Implementar `amplifyDifferences` e funções DOM em `js/canvas.js`**

Acrescentar ao `js/canvas.js`:

```js
export function amplifyDifferences({ data, width, height }) {
    const out = new Uint8ClampedArray(data.length);
    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            const idx = (y * width + x) * 4;
            for (let c = 0; c < 3; c++) {
                let sum = 0, count = 0;
                for (let dy = -1; dy <= 1; dy++) {
                    for (let dx = -1; dx <= 1; dx++) {
                        if (dy === 0 && dx === 0) continue;
                        sum += data[((y+dy) * width + (x+dx)) * 4 + c];
                        count++;
                    }
                }
                const diff = Math.abs(data[idx + c] - sum / count);
                out[idx + c] = Math.min(255, Math.round(diff * 5));
            }
            out[idx + 3] = 255;
        }
    }
    return { data: out, width, height };
}

// ── DOM rendering functions (browser only) ────────────────────

export function renderHistogram(imageData, histCanvas) {
    const { r, g, b } = computeHistogram(imageData);
    const ctx = histCanvas.getContext('2d');
    const W = histCanvas.width, H = histCanvas.height;
    ctx.clearRect(0, 0, W, H);
    const maxVal = Math.max(...r, ...g, ...b) || 1;
    const barW = W / 256;
    ctx.globalAlpha = 0.7;
    for (let i = 0; i < 256; i++) {
        const x = i * barW;
        ctx.fillStyle = '#e57373';
        ctx.fillRect(x, H - (r[i] / maxVal) * H, barW, (r[i] / maxVal) * H);
        ctx.fillStyle = '#81c784';
        ctx.fillRect(x, H - (g[i] / maxVal) * H, barW, (g[i] / maxVal) * H);
        ctx.fillStyle = '#64b5f6';
        ctx.fillRect(x, H - (b[i] / maxVal) * H, barW, (b[i] / maxVal) * H);
    }
    ctx.globalAlpha = 1;
}

function captureImage(img) {
    const tmp = document.createElement('canvas');
    tmp.width  = img.naturalWidth;
    tmp.height = img.naturalHeight;
    tmp.getContext('2d').drawImage(img, 0, 0);
    return tmp.getContext('2d').getImageData(0, 0, tmp.width, tmp.height);
}

function putResultOnCanvas(result, overlayCanvas) {
    overlayCanvas.width  = result.width;
    overlayCanvas.height = result.height;
    const ctx = overlayCanvas.getContext('2d');
    const out = ctx.createImageData(result.width, result.height);
    out.data.set(result.data);
    ctx.putImageData(out, 0, 0);
    overlayCanvas.style.display = '';
}

export function renderSobel(img, overlayCanvas) {
    try {
        putResultOnCanvas(sobelEdges(captureImage(img)), overlayCanvas);
    } catch (e) {
        if (e.name === 'SecurityError')
            alert('Análise Canvas não disponível para imagens externas');
    }
}

export function renderAmplify(img, overlayCanvas) {
    try {
        putResultOnCanvas(amplifyDifferences(captureImage(img)), overlayCanvas);
    } catch (e) {
        if (e.name === 'SecurityError')
            alert('Análise Canvas não disponível para imagens externas');
    }
}

export function clearOverlay(overlayCanvas) {
    overlayCanvas.style.display = 'none';
    overlayCanvas.getContext('2d').clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
}
```

- [ ] **Step 4: Rodar todos os testes — esperado: todos passam**

```bash
node tests/canvas.test.mjs
```

Esperado:
```
✓ computeHistogram: pixel vermelho
✓ computeHistogram: dois pixels
✓ computeHistogram: 256 valores únicos em R
✓ sobelEdges: imagem uniforme → sem bordas
✓ sobelEdges: borda vertical detectada
✓ amplifyDifferences: imagem uniforme → saída zero
✓ amplifyDifferences: pixel diferente amplificado
```

- [ ] **Step 5: Commit**

```bash
git add js/canvas.js tests/canvas.test.mjs
git commit -m "feat(canvas): add amplifyDifferences + DOM render functions"
```

---

## Task 7: js/main.js — Inicialização + aba Canvas

**Files:**
- Create: `js/main.js`

- [ ] **Step 1: Criar `js/main.js`**

```js
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

// Bootstrap
initTabs();
initUpload(state, onImageLoaded);
initFilters(state);
initCanvasTab();
updateAnalysisPanel(state);
```

- [ ] **Step 2: Verificar no browser**

```bash
python3 -m http.server 8080
```

Abra `http://localhost:8080`. Verificar:
- Upload de arquivo funciona (imagem aparece)
- Sliders de filtro funcionam
- Presets funcionam
- Aba Canvas: carregar imagem local → clicar "Histograma RGB" → histograma aparece abaixo
- Aba Canvas: clicar "Bordas (Sobel)" → resultado aparece sobre a imagem
- Aba Canvas: clicar "Amplificar Diferenças" → resultado aparece sobre a imagem
- "Limpar Canvas" remove o resultado

- [ ] **Step 3: Commit**

```bash
git add js/main.js
git commit -m "feat: add main.js — state, init orchestration, canvas tab"
```

---

## Task 8: js/main.js — Zoom

**Files:**
- Modify: `js/main.js`

- [ ] **Step 1: Adicionar `initZoom` em `js/main.js`** — acrescentar a função e chamá-la no Bootstrap

Adicione a função após `initCanvasTab`:

```js
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
```

No final do Bootstrap (após `updateAnalysisPanel(state)`), adicione:

```js
initZoom();
```

- [ ] **Step 2: Verificar no browser**

Carregar imagem → ir para aba 🛠 Tools → clicar "+" e "−" → zoom muda. Scroll do mouse sobre a imagem → zoom muda. "↺" volta para 100%.

- [ ] **Step 3: Commit**

```bash
git add js/main.js
git commit -m "feat: add zoom — scroll wheel + buttons (50%–400%)"
```

---

## Task 9: js/main.js — Antes / Depois

**Files:**
- Modify: `js/main.js`

- [ ] **Step 1: Adicionar `initBeforeAfter` em `js/main.js`**

Adicione após `initZoom`:

```js
function initBeforeAfter() {
    const divider    = document.getElementById('beforeAfterDivider');
    const beforeImg  = document.getElementById('beforeImage');
    const imageDisp  = document.getElementById('imageDisplay');
    const btn        = document.getElementById('beforeAfterBtn');
    let dragging     = false;

    function applyClip(pct) {
        // beforeImg mostra a esquerda (sem filtro), currentImage mostra a direita (com filtro)
        beforeImg.style.clipPath      = `inset(0 ${100 - pct}% 0 0)`;
        state.image.style.clipPath    = `inset(0 0 0 ${pct}%)`;
        divider.style.left            = pct + '%';
    }

    function activate() {
        if (!state.image) return;
        // Posiciona beforeImg exatamente sobre currentImage
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

    divider.addEventListener('mousedown', e => { dragging = true; e.preventDefault(); });
    window.addEventListener('mouseup',   () => { dragging = false; });
    window.addEventListener('mousemove', e => {
        if (!dragging || !state.beforeAfterActive) return;
        const rect = imageDisp.getBoundingClientRect();
        const pct  = Math.max(0, Math.min(100, (e.clientX - rect.left) / rect.width * 100));
        applyClip(pct);
    });
}
```

No Bootstrap, adicione:

```js
initBeforeAfter();
```

- [ ] **Step 2: Verificar no browser**

Carregar imagem → aplicar um preset (ex: "Negativo") → ir para aba 🛠 Tools → clicar "↔ Antes / Depois" → divisor aparece no centro → arrastar divisor → lado esquerdo mostra original, lado direito mostra com filtro. Clicar botão novamente → desativa.

- [ ] **Step 3: Commit**

```bash
git add js/main.js
git commit -m "feat: add before/after divider with draggable split"
```

---

## Task 10: js/main.js — Exportar PNG

**Files:**
- Modify: `js/main.js`

- [ ] **Step 1: Adicionar `initExport` em `js/main.js`**

Adicione após `initBeforeAfter`:

```js
function initExport() {
    document.getElementById('exportBtn').addEventListener('click', () => {
        if (!state.image) return;
        const tmp = document.createElement('canvas');
        tmp.width  = state.image.naturalWidth;
        tmp.height = state.image.naturalHeight;
        const ctx = tmp.getContext('2d');
        // ctx.filter captura os filtros CSS aplicados (suportado em Chrome/Firefox/Edge modernos)
        ctx.filter = state.image.style.filter || 'none';
        try {
            ctx.drawImage(state.image, 0, 0);
            const overlay = document.getElementById('canvasOverlay');
            if (overlay.style.display !== 'none') {
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
```

No Bootstrap, adicione:

```js
initExport();
```

- [ ] **Step 2: Verificar no browser**

Carregar imagem local → aplicar filtro → aba 🛠 Tools → clicar "💾 Exportar PNG" → arquivo `watermark-analysis.png` baixado com os filtros aplicados. Testar também com Sobel ativo: download deve incluir o resultado Canvas.

- [ ] **Step 3: Commit**

```bash
git add js/main.js
git commit -m "feat: add export PNG — merges CSS filters + canvas overlay"
```

---

## Task 11: Cleanup — .gitignore e remoção do JS inline do index.html original

**Files:**
- Modify: `.gitignore` (criar se não existir)

- [ ] **Step 1: Verificar que `index.html` não tem mais JS ou CSS inline**

```bash
grep -n "<style>" index.html && grep -n "<script>" index.html
```

Esperado: sem resultados (ou apenas o `<script type="module" src="js/main.js">`).

- [ ] **Step 2: Adicionar `.gitignore`**

```bash
cat >> .gitignore << 'EOF'
.superpowers/
EOF
```

Se não existir `.gitignore`:
```bash
echo ".superpowers/" > .gitignore
```

- [ ] **Step 3: Rodar todos os testes uma última vez**

```bash
node tests/canvas.test.mjs
```

Esperado: todos os 7 testes passam.

- [ ] **Step 4: Commit final**

```bash
git add .gitignore
git commit -m "chore: add .gitignore, exclude .superpowers/ from version control"
```

- [ ] **Step 5: Verificação final no browser**

```bash
python3 -m http.server 8080
```

Checklist final em `http://localhost:8080`:
- [ ] Upload de arquivo funciona
- [ ] Drag-and-drop funciona
- [ ] "Usar Imagem de Exemplo" funciona
- [ ] Todos os 6 sliders funcionam
- [ ] Todos os 6 presets funcionam
- [ ] "Restaurar Original" funciona
- [ ] Aba Canvas: Histograma aparece abaixo da imagem
- [ ] Aba Canvas: Sobel aparece sobre a imagem
- [ ] Aba Canvas: Amplificar aparece sobre a imagem
- [ ] "Limpar Canvas" limpa o resultado
- [ ] Aba Tools: zoom + / − / ↺ funcionam
- [ ] Scroll do mouse faz zoom
- [ ] Antes/Depois: divisor arrastável funciona
- [ ] Exportar PNG: baixa arquivo com filtros aplicados
- [ ] Painel de análise atualiza corretamente para cada modo
