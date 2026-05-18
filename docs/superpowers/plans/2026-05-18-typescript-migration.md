# TypeScript Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the 4-module JavaScript codebase to TypeScript using Vite + Vitest, with `strict: true`, zero new features.

**Architecture:** Big-bang rename `.js` → `.ts`, keeping `js/` folder structure. Vite serves `index.html` at the root and resolves `.ts` imports. Shared interfaces live in `js/types.ts`. Tests migrate from Node.js `assert` to Vitest format.

**Tech Stack:** TypeScript 5, Vite 5, Vitest 1

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `package.json` | **Create** | npm scripts: dev, build, test |
| `tsconfig.json` | **Create** | strict: true, moduleResolution: bundler, lib: DOM |
| `vite.config.ts` | **Create** | Vite entry at project root; Vitest node environment |
| `.gitignore` | **Modify** | Add `node_modules/`, `dist/` |
| `js/types.ts` | **Create** | `AppState`, `HistogramResult`, `ImageDataLike` interfaces |
| `js/canvas.ts` | **Create** (rename) | Pure canvas algorithms + DOM renders, typed |
| `js/canvas.js` | **Delete** | Replaced by canvas.ts |
| `tests/canvas.test.ts` | **Create** (rename) | 7 Vitest tests for pure canvas functions |
| `tests/canvas.test.mjs` | **Delete** | Replaced by canvas.test.ts |
| `js/filters.ts` | **Create** (rename) | CSS filter sliders + presets, typed |
| `js/filters.js` | **Delete** | Replaced by filters.ts |
| `js/ui.ts` | **Create** (rename) | Tabs, upload, analysis panel, typed |
| `js/ui.js` | **Delete** | Replaced by ui.ts |
| `js/main.ts` | **Create** (rename) | Orchestrator + state, typed |
| `js/main.js` | **Delete** | Replaced by main.ts |
| `index.html` | **Modify** | Change `src="js/main.js"` → `src="js/main.ts"` |

---

### Task 1: Setup toolchain

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Modify: `.gitignore`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "watermaker-check",
  "private": true,
  "type": "module",
  "scripts": {
    "dev":   "vite",
    "build": "vite build",
    "test":  "vitest run"
  },
  "devDependencies": {
    "typescript": "^5",
    "vite": "^5",
    "vitest": "^1"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2020", "DOM"],
    "strict": true,
    "outDir": "dist",
    "rootDir": ".",
    "skipLibCheck": true
  },
  "include": ["js/**/*", "tests/**/*", "vite.config.ts"]
}
```

- [ ] **Step 3: Create `vite.config.ts`**

```typescript
import { defineConfig } from 'vite';

export default defineConfig({
    root: '.',
    test: {
        environment: 'node',
    },
});
```

The `environment: 'node'` is required so Vitest does not try to provide a browser DOM for the pure canvas function tests.

- [ ] **Step 4: Update `.gitignore`**

Append to the existing `.gitignore`:
```
node_modules/
dist/
```

The file should now contain:
```
.superpowers/
node_modules/
dist/
```

- [ ] **Step 5: Install dependencies**

```bash
npm install
```

Expected: `node_modules/` created, no errors. Check:
```bash
ls node_modules/.bin/vite && ls node_modules/.bin/vitest && echo "OK"
```
Expected output: `OK`

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json tsconfig.json vite.config.ts .gitignore
git commit -m "chore: add TypeScript + Vite + Vitest toolchain"
```

---

### Task 2: Create `js/types.ts`

**Files:**
- Create: `js/types.ts`

- [ ] **Step 1: Create `js/types.ts`**

```typescript
export interface AppState {
    image:             HTMLImageElement | null;
    zoom:              number;
    activePreset:      string | null;
    activeCanvasMode:  'histogram' | 'sobel' | 'amplify' | null;
    beforeAfterActive: boolean;
}

export interface HistogramResult {
    r: Uint32Array;
    g: Uint32Array;
    b: Uint32Array;
}

export interface ImageDataLike {
    data: Uint8ClampedArray;
    width: number;
    height: number;
}
```

`ImageDataLike` is structurally compatible with the browser's `ImageData` type, keeping pure functions testable in Node/Vitest without a DOM.

- [ ] **Step 2: Verify TypeScript can find the file**

```bash
npx tsc --noEmit --allowJs 2>&1 | grep "types.ts" || echo "types.ts: no errors"
```

Expected output: `types.ts: no errors` (or no output about types.ts errors)

- [ ] **Step 3: Commit**

```bash
git add js/types.ts
git commit -m "feat: add shared TypeScript interfaces (AppState, HistogramResult, ImageDataLike)"
```

---

### Task 3: Migrate `tests/canvas.test.ts` (TDD step)

**Files:**
- Create: `tests/canvas.test.ts`
- Delete: `tests/canvas.test.mjs`

Write the Vitest test file first. It still imports from `../js/canvas.js` (the file that currently exists). Vitest will transform both files. In Task 4, when we rename `canvas.js` → `canvas.ts`, the import resolves to `canvas.ts` via TypeScript module resolution (`.js` → `.ts`).

- [ ] **Step 1: Create `tests/canvas.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { computeHistogram, sobelEdges, amplifyDifferences } from '../js/canvas.js';
import type { ImageDataLike } from '../js/types.js';

function img(pixels: number[], width: number, height: number): ImageDataLike {
    return { data: new Uint8ClampedArray(pixels), width, height };
}

describe('computeHistogram', () => {
    it('pixel vermelho', () => {
        const h = computeHistogram(img([255, 0, 0, 255], 1, 1));
        expect(h.r[255]).toBe(1);
        expect(h.g[0]).toBe(1);
        expect(h.b[0]).toBe(1);
    });

    it('dois pixels', () => {
        const h = computeHistogram(img([255, 0, 0, 255, 0, 0, 255, 255], 2, 1));
        expect(h.r[255]).toBe(1);
        expect(h.r[0]).toBe(1);
        expect(h.b[255]).toBe(1);
        expect(h.b[0]).toBe(1);
    });

    it('256 valores únicos em R', () => {
        const pixels: number[] = [];
        for (let i = 0; i < 256; i++) pixels.push(i, 0, 0, 255);
        const h = computeHistogram(img(pixels, 256, 1));
        for (let i = 0; i < 256; i++) expect(h.r[i]).toBe(1);
    });
});

describe('sobelEdges', () => {
    it('imagem uniforme → sem bordas', () => {
        const pixels: number[] = new Array<number>(3 * 3 * 4).fill(0);
        for (let i = 0; i < 9; i++) {
            pixels[i * 4] = pixels[i * 4 + 1] = pixels[i * 4 + 2] = 128;
            pixels[i * 4 + 3] = 255;
        }
        const result = sobelEdges(img(pixels, 3, 3));
        const center = (1 * 3 + 1) * 4;
        expect(result.data[center]).toBe(0);
    });

    it('borda vertical detectada', () => {
        const pixels: number[] = new Array<number>(3 * 3 * 4).fill(0);
        for (let y = 0; y < 3; y++) {
            for (let x = 0; x < 3; x++) {
                const v = x >= 2 ? 255 : 0;
                const i = (y * 3 + x) * 4;
                pixels[i] = pixels[i + 1] = pixels[i + 2] = v;
                pixels[i + 3] = 255;
            }
        }
        const result = sobelEdges(img(pixels, 3, 3));
        const center = (1 * 3 + 1) * 4;
        expect(result.data[center]).toBeGreaterThan(0);
        expect(result.data.length).toBe(3 * 3 * 4);
        expect(result.width).toBe(3);
        expect(result.height).toBe(3);
    });
});

describe('amplifyDifferences', () => {
    it('imagem uniforme → saída zero', () => {
        const pixels: number[] = new Array<number>(3 * 3 * 4).fill(0);
        for (let i = 0; i < 9; i++) {
            pixels[i * 4] = pixels[i * 4 + 1] = pixels[i * 4 + 2] = 100;
            pixels[i * 4 + 3] = 255;
        }
        const result = amplifyDifferences(img(pixels, 3, 3));
        const center = (1 * 3 + 1) * 4;
        expect(result.data[center]).toBe(0);
    });

    it('pixel diferente amplificado', () => {
        const pixels: number[] = new Array<number>(3 * 3 * 4).fill(0);
        for (let i = 0; i < 9; i++) {
            pixels[i * 4] = pixels[i * 4 + 1] = pixels[i * 4 + 2] = 100;
            pixels[i * 4 + 3] = 255;
        }
        pixels[4 * 4] = pixels[4 * 4 + 1] = pixels[4 * 4 + 2] = 200;
        const result = amplifyDifferences(img(pixels, 3, 3));
        const center = (1 * 3 + 1) * 4;
        expect(result.data[center]).toBeGreaterThan(0);
        expect(result.data[center + 3]).toBe(255);
    });
});
```

- [ ] **Step 2: Run tests — expect PASS (canvas.js still exists)**

```bash
npm test
```

Expected: 7 tests pass. If Vitest can't find types, that's fine — the TypeScript errors in the test file don't block Vitest from running. If there are import errors, verify `canvas.js` still exists: `ls js/canvas.js`.

- [ ] **Step 3: Delete old test file**

```bash
git rm tests/canvas.test.mjs
```

- [ ] **Step 4: Commit**

```bash
git add tests/canvas.test.ts
git commit -m "test: migrate canvas tests to Vitest (canvas.test.ts)"
```

---

### Task 4: Migrate `js/canvas.ts`

**Files:**
- Create: `js/canvas.ts`
- Delete: `js/canvas.js`

- [ ] **Step 1: Create `js/canvas.ts`**

```typescript
import type { ImageDataLike, HistogramResult } from './types.js';

// ── Pure functions — testable in Node/Vitest ──────────────────

export function computeHistogram({ data }: ImageDataLike): HistogramResult {
    const r = new Uint32Array(256);
    const g = new Uint32Array(256);
    const b = new Uint32Array(256);
    for (let i = 0; i < data.length; i += 4) {
        r[data[i]!]++;
        g[data[i + 1]!]++;
        b[data[i + 2]!]++;
    }
    return { r, g, b };
}

export function sobelEdges({ data, width, height }: ImageDataLike): ImageDataLike {
    const gray = new Uint8Array(width * height);
    for (let i = 0; i < width * height; i++) {
        gray[i] = Math.round(
            0.299 * data[i * 4]! + 0.587 * data[i * 4 + 1]! + 0.114 * data[i * 4 + 2]!
        );
    }

    const out = new Uint8ClampedArray(width * height * 4);
    const px = (row: number, col: number): number => gray[row * width + col] ?? 0;

    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            const gx = -px(y-1,x-1) + px(y-1,x+1)
                       -2*px(y,x-1) + 2*px(y,x+1)
                       -px(y+1,x-1) + px(y+1,x+1);
            const gy = -px(y-1,x-1) - 2*px(y-1,x) - px(y-1,x+1)
                       +px(y+1,x-1) + 2*px(y+1,x) + px(y+1,x+1);
            const mag = Math.min(255, Math.round(Math.sqrt(gx * gx + gy * gy)));
            const idx = (y * width + x) * 4;
            out[idx] = out[idx + 1] = out[idx + 2] = mag;
            out[idx + 3] = 255;
        }
    }
    return { data: out, width, height };
}

export function amplifyDifferences({ data, width, height }: ImageDataLike): ImageDataLike {
    const out = new Uint8ClampedArray(data.length);
    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            const idx = (y * width + x) * 4;
            for (let c = 0; c < 3; c++) {
                let sum = 0, count = 0;
                for (let dy = -1; dy <= 1; dy++) {
                    for (let dx = -1; dx <= 1; dx++) {
                        if (dy === 0 && dx === 0) continue;
                        sum += data[((y + dy) * width + (x + dx)) * 4 + c]!;
                        count++;
                    }
                }
                const diff = Math.abs(data[idx + c]! - sum / count);
                out[idx + c] = Math.min(255, Math.round(diff * 5));
            }
            out[idx + 3] = 255;
        }
    }
    return { data: out, width, height };
}

// ── DOM rendering functions (browser only) ────────────────────

export function renderHistogram(imageData: ImageDataLike, histCanvas: HTMLCanvasElement): void {
    const { r, g, b } = computeHistogram(imageData);
    const ctx = histCanvas.getContext('2d')!;
    const W = histCanvas.width, H = histCanvas.height;
    ctx.clearRect(0, 0, W, H);
    const maxVal = Math.max(...Array.from(r), ...Array.from(g), ...Array.from(b)) || 1;
    const barW = W / 256;
    ctx.globalAlpha = 0.7;
    for (let i = 0; i < 256; i++) {
        const x = i * barW;
        ctx.fillStyle = '#e57373';
        ctx.fillRect(x, H - (r[i]! / maxVal) * H, barW, (r[i]! / maxVal) * H);
        ctx.fillStyle = '#81c784';
        ctx.fillRect(x, H - (g[i]! / maxVal) * H, barW, (g[i]! / maxVal) * H);
        ctx.fillStyle = '#64b5f6';
        ctx.fillRect(x, H - (b[i]! / maxVal) * H, barW, (b[i]! / maxVal) * H);
    }
    ctx.globalAlpha = 1;
}

function captureImage(img: HTMLImageElement): ImageDataLike {
    const tmp = document.createElement('canvas');
    tmp.width  = img.naturalWidth;
    tmp.height = img.naturalHeight;
    tmp.getContext('2d')!.drawImage(img, 0, 0);
    return tmp.getContext('2d')!.getImageData(0, 0, tmp.width, tmp.height);
}

function putResultOnCanvas(result: ImageDataLike, overlayCanvas: HTMLCanvasElement): void {
    overlayCanvas.width  = result.width;
    overlayCanvas.height = result.height;
    const ctx = overlayCanvas.getContext('2d')!;
    const out = ctx.createImageData(result.width, result.height);
    out.data.set(result.data);
    ctx.putImageData(out, 0, 0);
    overlayCanvas.style.display = '';
}

export function renderSobel(img: HTMLImageElement, overlayCanvas: HTMLCanvasElement): void {
    try {
        putResultOnCanvas(sobelEdges(captureImage(img)), overlayCanvas);
    } catch (e: unknown) {
        if (e instanceof Error && e.name === 'SecurityError')
            alert('Análise Canvas não disponível para imagens externas');
        else
            alert('Erro ao processar imagem: ' + (e instanceof Error ? e.message : String(e)));
    }
}

export function renderAmplify(img: HTMLImageElement, overlayCanvas: HTMLCanvasElement): void {
    try {
        putResultOnCanvas(amplifyDifferences(captureImage(img)), overlayCanvas);
    } catch (e: unknown) {
        if (e instanceof Error && e.name === 'SecurityError')
            alert('Análise Canvas não disponível para imagens externas');
        else
            alert('Erro ao processar imagem: ' + (e instanceof Error ? e.message : String(e)));
    }
}

export function clearOverlay(overlayCanvas: HTMLCanvasElement): void {
    overlayCanvas.style.display = 'none';
    overlayCanvas.getContext('2d')!.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
}
```

**Note on `!` non-null assertions:** `data[i]!` tells TypeScript the value is always `number` (not `undefined`). This is safe here because the loop bounds are controlled and TypedArray access is always defined within bounds. Without `noUncheckedIndexedAccess` in tsconfig, TypeScript doesn't require these, but some TypeScript versions in strict mode may still flag them — add `!` if `tsc` complains.

- [ ] **Step 2: Run tests — expect PASS (canvas.ts now resolves the `canvas.js` import)**

```bash
npm test
```

Expected: 7 tests pass. The import `from '../js/canvas.js'` in the test file resolves to `canvas.ts` via TypeScript's `moduleResolution: "bundler"` rules.

- [ ] **Step 3: Delete old file**

```bash
git rm js/canvas.js
```

- [ ] **Step 4: Commit**

```bash
git add js/canvas.ts
git commit -m "feat: migrate canvas.js → canvas.ts with strict types"
```

---

### Task 5: Migrate `js/filters.ts`

**Files:**
- Create: `js/filters.ts`
- Delete: `js/filters.js`

- [ ] **Step 1: Create `js/filters.ts`**

```typescript
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

function getEl<T extends HTMLElement>(id: string): T {
    return document.getElementById(id) as T;
}

function getFilterString(): string {
    const v = (id: string): string => getEl<HTMLInputElement>(id).value;
    return `brightness(${v('brightness')}%) contrast(${v('contrast')}%) ` +
           `saturate(${v('saturation')}%) hue-rotate(${v('hue')}deg) ` +
           `invert(${v('invert')}%) blur(${v('blur')}px)`;
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
```

- [ ] **Step 2: Delete old file**

```bash
git rm js/filters.js
```

- [ ] **Step 3: Run TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors for `js/filters.ts`. Ignore errors in files not yet migrated (`.js` files still present will show implicit-any errors — those are expected and will be fixed in upcoming tasks).

- [ ] **Step 4: Commit**

```bash
git add js/filters.ts
git commit -m "feat: migrate filters.js → filters.ts with strict types"
```

---

### Task 6: Migrate `js/ui.ts`

**Files:**
- Create: `js/ui.ts`
- Delete: `js/ui.js`

- [ ] **Step 1: Create `js/ui.ts`**

```typescript
import type { AppState } from './types.js';

export function initTabs(): void {
    const tabBtns     = document.querySelectorAll<HTMLButtonElement>('.tab-btn');
    const tabContents = document.querySelectorAll<HTMLElement>('.tab-content');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const target = btn.dataset['tab'];
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.toggle('active', c.dataset['tab'] === target));
            btn.classList.add('active');
        });
    });
}

export function initUpload(
    state: AppState,
    onImageLoaded: (img: HTMLImageElement) => void
): void {
    const fileInput    = document.getElementById('fileInput') as HTMLInputElement;
    const imageDisplay = document.getElementById('imageDisplay') as HTMLElement;
    const uploadArea   = document.getElementById('uploadArea') as HTMLElement;
    const currentImage = document.getElementById('currentImage') as HTMLImageElement;

    function handleLoaded(): void {
        uploadArea.style.display   = 'none';
        currentImage.style.display = '';
        state.image = currentImage;
        onImageLoaded(currentImage);
    }

    function loadSrc(src: string): void {
        currentImage.onload = handleLoaded;
        currentImage.src    = src;
        if (currentImage.complete && currentImage.naturalHeight !== 0) {
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

    (document.getElementById('selectFileBtn') as HTMLButtonElement)
        .addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', (e: Event) => {
        const target = e.target as HTMLInputElement;
        if (target.files?.[0]) loadFile(target.files[0]);
    });

    (document.getElementById('sampleImageBtn') as HTMLButtonElement)
        .addEventListener('click', () => loadSrc('example.png'));

    imageDisplay.addEventListener('dragover', (e: DragEvent) => {
        e.preventDefault();
        imageDisplay.style.borderColor = '#667eea';
    });
    imageDisplay.addEventListener('dragleave', (e: DragEvent) => {
        e.preventDefault();
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
    const recommendation  = document.getElementById('recommendation')  as HTMLElement;

    if (!state.image) {
        activeTechnique.textContent = 'Nenhuma imagem carregada';
        processingLevel.textContent = 'N/A';
        recommendation.textContent  = 'Carregue uma imagem para iniciar';
        return;
    }

    const canvasModeLabels: Record<string, string> = {
        histogram: 'Histograma RGB',
        sobel:     'Detecção de Bordas (Sobel)',
        amplify:   'Amplificação de Diferenças',
    };
    const presetLabels: Record<string, string> = {
        uv:        'Simulação de Luz UV',
        infrared:  'Filtro Infravermelho',
        watermark: "Detecção de Marca d'Água",
        security:  'Análise de Segurança',
        edges:     'Detecção de Bordas CSS',
        negative:  'Imagem Negativa',
    };

    let technique = 'Ajustes manuais';
    if (state.activeCanvasMode)
        technique = canvasModeLabels[state.activeCanvasMode] ?? technique;
    else if (state.activePreset)
        technique = presetLabels[state.activePreset] ?? technique;
    activeTechnique.textContent = technique;

    const getVal = (id: string): number =>
        parseInt((document.getElementById(id) as HTMLInputElement).value, 10);

    const b  = getVal('brightness');
    const c  = getVal('contrast');
    const s  = getVal('saturation');
    const h  = getVal('hue');
    const iv = getVal('invert');
    const bl = getVal('blur');
    const total = Math.abs(b - 100) + Math.abs(c - 100) + Math.abs(s - 100) + h + iv + bl * 10;
    processingLevel.textContent = total > 200 ? 'Alto' : total > 100 ? 'Médio' : 'Baixo';

    let rec = 'Ajuste os controles para revelar elementos ocultos';
    if      (state.activeCanvasMode === 'sobel')    rec = 'Bordas reais detectadas pelo algoritmo Sobel';
    else if (state.activeCanvasMode === 'amplify')  rec = 'Diferenças sutis amplificadas 5×';
    else if (state.activeCanvasMode === 'histogram')rec = 'Veja a distribuição de cores no histograma';
    else if (state.activePreset === 'uv')           rec = 'Ideal para detectar tintas fluorescentes';
    else if (state.activePreset === 'watermark')    rec = "Optimize contraste para marcas d'água";
    else if (state.activePreset === 'security')     rec = 'Configuração para elementos de segurança';
    else if (total > 150)                           rec = 'Processamento intenso aplicado';
    recommendation.textContent = rec;
}

export function enableImageTools(): void {
    const toolIds = [
        'histogramBtn', 'sobelBtn', 'amplifyBtn', 'clearCanvasBtn',
        'zoomInBtn', 'zoomOutBtn', 'zoomResetBtn', 'beforeAfterBtn', 'exportBtn',
    ];
    toolIds.forEach(id => {
        const el = document.getElementById(id) as HTMLButtonElement | null;
        if (el) el.disabled = false;
    });
}
```

- [ ] **Step 2: Delete old file**

```bash
git rm js/ui.js
```

- [ ] **Step 3: Run TypeScript check on ui.ts**

```bash
npx tsc --noEmit 2>&1 | grep "ui.ts" | head -20
```

Expected: no errors for `ui.ts`. Errors in `main.js` (still `.js`) are expected — ignore them.

- [ ] **Step 4: Commit**

```bash
git add js/ui.ts
git commit -m "feat: migrate ui.js → ui.ts with strict types"
```

---

### Task 7: Migrate `js/main.ts` + update `index.html`

**Files:**
- Create: `js/main.ts`
- Delete: `js/main.js`
- Modify: `index.html` (line 153: change `main.js` → `main.ts`)

- [ ] **Step 1: Create `js/main.ts`**

```typescript
import type { AppState } from './types.js';
import { initFilters, applyFilters } from './filters.js';
import { initTabs, initUpload, updateAnalysisPanel, enableImageTools } from './ui.js';
import { renderHistogram, renderSobel, renderAmplify, clearOverlay } from './canvas.js';

export const state: AppState = {
    image:             null,
    zoom:              1.0,
    activePreset:      null,
    activeCanvasMode:  null,
    beforeAfterActive: false,
};

function getEl<T extends HTMLElement>(id: string): T {
    return document.getElementById(id) as T;
}

function matchImageBounds(el: HTMLElement): void {
    const img       = getEl<HTMLImageElement>('currentImage');
    const container = getEl<HTMLElement>('imageDisplay');
    const imgRect   = img.getBoundingClientRect();
    const ctnRect   = container.getBoundingClientRect();
    el.style.top    = (imgRect.top  - ctnRect.top)  + 'px';
    el.style.left   = (imgRect.left - ctnRect.left) + 'px';
    el.style.width  = imgRect.width  + 'px';
    el.style.height = imgRect.height + 'px';
}

function onImageLoaded(img: HTMLImageElement): void {
    state.image             = img;
    state.activeCanvasMode  = null;
    state.beforeAfterActive = false;
    const overlay = getEl<HTMLCanvasElement>('canvasOverlay');
    clearOverlay(overlay);
    getEl<HTMLElement>('histogramContainer').style.display = 'none';
    getEl<HTMLElement>('beforeAfterDivider').style.display = 'none';
    getEl<HTMLElement>('beforeImage').style.display        = 'none';
    img.style.clipPath = '';
    applyFilters(state);
    updateAnalysisPanel(state);
    enableImageTools();
}

function initCanvasTab(): void {
    const overlay       = getEl<HTMLCanvasElement>('canvasOverlay');
    const histCanvas    = getEl<HTMLCanvasElement>('histogramCanvas');
    const histContainer = getEl<HTMLElement>('histogramContainer');

    function setCanvasMode(mode: AppState['activeCanvasMode'], btn: HTMLElement): void {
        document.querySelectorAll('.canvas-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.activeCanvasMode = mode;
        updateAnalysisPanel(state);
    }

    const histogramBtn = getEl<HTMLButtonElement>('histogramBtn');
    histogramBtn.addEventListener('click', () => {
        if (!state.image) return;
        clearOverlay(overlay);
        const tmp = document.createElement('canvas');
        tmp.width  = state.image.naturalWidth;
        tmp.height = state.image.naturalHeight;
        try {
            tmp.getContext('2d')!.drawImage(state.image, 0, 0);
            const imageData = tmp.getContext('2d')!.getImageData(0, 0, tmp.width, tmp.height);
            histContainer.style.display = '';
            renderHistogram(imageData, histCanvas);
            setCanvasMode('histogram', histogramBtn);
        } catch (e: unknown) {
            if (e instanceof Error && e.name === 'SecurityError')
                alert('Análise Canvas não disponível para imagens externas');
            else
                alert('Erro ao processar imagem: ' + (e instanceof Error ? e.message : String(e)));
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
        document.querySelectorAll('.canvas-btn').forEach(b => b.classList.remove('active'));
        updateAnalysisPanel(state);
    });
}

function initZoom(): void {
    const imageDisplay = getEl<HTMLElement>('imageDisplay');
    const zoomLabel    = getEl<HTMLElement>('zoomValue');

    function setZoom(z: number): void {
        state.zoom = Math.max(0.5, Math.min(4, Math.round(z * 100) / 100));
        zoomLabel.textContent = Math.round(state.zoom * 100) + '%';
        if (!state.image) return;
        state.image.style.transform = `scale(${state.zoom})`;
        requestAnimationFrame(() => {
            const overlay = getEl<HTMLCanvasElement>('canvasOverlay');
            if (getComputedStyle(overlay).display !== 'none') matchImageBounds(overlay);
            if (state.beforeAfterActive) matchImageBounds(getEl<HTMLImageElement>('beforeImage'));
        });
    }

    getEl<HTMLButtonElement>('zoomInBtn').addEventListener('click',    () => setZoom(state.zoom + 0.25));
    getEl<HTMLButtonElement>('zoomOutBtn').addEventListener('click',   () => setZoom(state.zoom - 0.25));
    getEl<HTMLButtonElement>('zoomResetBtn').addEventListener('click', () => setZoom(1));

    imageDisplay.addEventListener('wheel', (e: WheelEvent) => {
        if (!state.image) return;
        e.preventDefault();
        setZoom(state.zoom + (e.deltaY < 0 ? 0.1 : -0.1));
    }, { passive: false });
}

function initBeforeAfter(): void {
    const divider   = getEl<HTMLElement>('beforeAfterDivider');
    const beforeImg = getEl<HTMLImageElement>('beforeImage');
    const imageDisp = getEl<HTMLElement>('imageDisplay');
    const btn       = getEl<HTMLButtonElement>('beforeAfterBtn');
    let dragging    = false;

    function applyClip(pct: number): void {
        if (!state.image) return;
        beforeImg.style.clipPath   = `inset(0 ${100 - pct}% 0 0)`;
        state.image.style.clipPath = `inset(0 0 0 ${pct}%)`;
        divider.style.left         = pct + '%';
    }

    function activate(): void {
        if (!state.image) return;
        matchImageBounds(beforeImg);
        beforeImg.src           = state.image.src;
        beforeImg.style.filter  = 'none';
        beforeImg.style.display = '';
        divider.style.display   = '';
        applyClip(50);
        state.beforeAfterActive = true;
        btn.classList.add('active');
    }

    function deactivate(): void {
        divider.style.display    = 'none';
        beforeImg.style.display  = 'none';
        if (state.image) state.image.style.clipPath = '';
        state.beforeAfterActive  = false;
        btn.classList.remove('active');
    }

    btn.addEventListener('click', () => state.beforeAfterActive ? deactivate() : activate());

    divider.addEventListener('mousedown', (e: MouseEvent) => {
        if (!state.beforeAfterActive) return;
        dragging = true;
        e.preventDefault();
    });
    window.addEventListener('mouseup', () => { dragging = false; });
    window.addEventListener('mousemove', (e: MouseEvent) => {
        if (!dragging || !state.beforeAfterActive) return;
        const rect = imageDisp.getBoundingClientRect();
        const pct  = Math.max(0, Math.min(100, (e.clientX - rect.left) / rect.width * 100));
        applyClip(pct);
    });
}

function initExport(): void {
    getEl<HTMLButtonElement>('exportBtn').addEventListener('click', () => {
        if (!state.image) return;
        const tmp    = document.createElement('canvas');
        tmp.width    = state.image.naturalWidth;
        tmp.height   = state.image.naturalHeight;
        const ctx    = tmp.getContext('2d')!;
        ctx.filter   = state.image.style.filter || 'none';
        try {
            ctx.drawImage(state.image, 0, 0);
            const overlay = getEl<HTMLCanvasElement>('canvasOverlay');
            if (getComputedStyle(overlay).display !== 'none') {
                ctx.filter = 'none';
                ctx.drawImage(overlay, 0, 0, tmp.width, tmp.height);
            }
            const a    = document.createElement('a');
            a.href     = tmp.toDataURL('image/png');
            a.download = 'watermark-analysis.png';
            a.click();
        } catch (e: unknown) {
            if (e instanceof Error && e.name === 'SecurityError')
                alert('Não é possível exportar imagens de origem externa');
            else
                alert('Erro ao exportar: ' + (e instanceof Error ? e.message : String(e)));
        }
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
updateAnalysisPanel(state);
```

- [ ] **Step 2: Update `index.html` script reference**

In `index.html`, find line 153:
```html
    <script type="module" src="js/main.js"></script>
```

Replace with:
```html
    <script type="module" src="js/main.ts"></script>
```

- [ ] **Step 3: Delete old file**

```bash
git rm js/main.js
```

- [ ] **Step 4: Run full TypeScript check — expect clean**

```bash
npx tsc --noEmit 2>&1
```

Expected: no output (zero errors). If errors appear, fix them before proceeding.

- [ ] **Step 5: Run tests — expect all 7 pass**

```bash
npm test
```

Expected output (all 7 passing):
```
✓ computeHistogram > pixel vermelho
✓ computeHistogram > dois pixels
✓ computeHistogram > 256 valores únicos em R
✓ sobelEdges > imagem uniforme → sem bordas
✓ sobelEdges > borda vertical detectada
✓ amplifyDifferences > imagem uniforme → saída zero
✓ amplifyDifferences > pixel diferente amplificado

Test Files  1 passed (1)
Tests       7 passed (7)
```

- [ ] **Step 6: Run build — expect success**

```bash
npm run build 2>&1 | tail -10
```

Expected: `dist/` folder created, output ending with `✓ built in ...ms` or similar success message. No TypeScript errors.

- [ ] **Step 7: Commit**

```bash
git add js/main.ts index.html
git commit -m "feat: migrate main.js → main.ts with strict types; update index.html entry point"
```

---

### Task 8: Final verification + push

- [ ] **Step 1: Run full TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no output (zero errors).

- [ ] **Step 2: Run all tests**

```bash
npm test
```

Expected: 7/7 tests pass.

- [ ] **Step 3: Run build**

```bash
npm run build
```

Expected: `dist/` built without errors.

- [ ] **Step 4: Verify no `any` types remain**

```bash
grep -rn ": any" js/ tests/ || echo "No 'any' found"
```

Expected: `No 'any' found` (or only lines with comments explaining why `any` was necessary).

- [ ] **Step 5: Verify old `.js` source files are gone**

```bash
ls js/*.js 2>/dev/null && echo "STALE FILES FOUND" || echo "All JS files removed"
```

Expected: `All JS files removed`

- [ ] **Step 6: Verify dist was not committed**

```bash
git status
```

Expected: `dist/` not in the staged or committed files (it's in `.gitignore`).

- [ ] **Step 7: Push to GitHub**

```bash
git push
```

---

## Acceptance Criteria

- [ ] `npm install` — no errors
- [ ] `npm run dev` — Vite dev server starts, app loads in browser at `http://localhost:5173`
- [ ] `npm run build` — `dist/` produced, zero TypeScript errors
- [ ] `npm test` — 7/7 Vitest tests pass
- [ ] `npx tsc --noEmit` — zero errors
- [ ] No `any` types in source without a comment explaining why
- [ ] All old `.js` source files deleted
