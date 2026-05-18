# UI Redesign: React + Tailwind + shadcn/ui Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the vanilla TypeScript UI to React 18 + Tailwind CSS v4 + shadcn/ui implementing the "Forensic Instrument" design — warm-dark split-panel layout with amber accent, Syne + JetBrains Mono + DM Sans typography, expandable module cards, and SVG score ring.

**Architecture:** The forensics pipeline and canvas utilities (`js/forensics/`, `js/canvas.ts`, `js/ela.ts`) are pure TypeScript with zero DOM coupling — they stay untouched. Only the UI layer (`js/main.ts`, `js/ui.ts`, `css/styles.css`, `index.html`) is replaced by a React app in `src/`. App state lives in `useReducer` in `App.tsx`. React refs are passed to the canvas functions for Ghost, Noise, ELA, Histogram, and overlay rendering.

**Tech Stack:** React 18, Vite 5, TypeScript 5 strict, Tailwind CSS v4 (`@tailwindcss/vite`), shadcn/ui, Radix UI, heic2any (existing)

---

## File Map

### New (src/)
- `src/main.tsx` — React entry point
- `src/index.css` — Tailwind + CSS variables + global base styles
- `src/types.ts` — `AppState`, `AppAction`, `appReducer`, `FilterState`, helpers
- `src/App.tsx` — root component, reducer, shared refs, layout
- `src/hooks/useImageLoader.ts` — file load/drop/HEIC conversion
- `src/hooks/useForensics.ts` — pipeline runner + dispatch progress
- `src/components/layout/TopBar.tsx` — logo, status dot, file info, action buttons
- `src/components/layout/TabBar.tsx` — tab nav (Forense · Filtros · Canvas · ELA · Ferramentas)
- `src/components/DocPane.tsx` — left pane: image display, drop zone, canvas overlay, zoom, before/after
- `src/components/RightPanel.tsx` — right panel: routes activeTab to the correct content component
- `src/components/forensics/ForensicsContent.tsx` — verdict block + module cards (scroll container)
- `src/components/forensics/ScoreRing.tsx` — SVG ring gauge
- `src/components/forensics/VerdictBlock.tsx` — score ring + score breakdown bars
- `src/components/forensics/ModuleCard.tsx` — collapsible card with colored left border
- `src/components/forensics/modules/ExifModule.tsx` — EXIF table + flags
- `src/components/forensics/modules/NoiseModule.tsx` — noise map canvas + stats
- `src/components/forensics/modules/GhostModule.tsx` — ghost canvas + quality slider + HEIC warning
- `src/components/forensics/modules/QualityModule.tsx` — sharpness + exposure meters + flags
- `src/components/tabs/FiltersTab.tsx` — CSS filter sliders + presets
- `src/components/tabs/CanvasTab.tsx` — histogram/sobel/amplify buttons + histogram canvas
- `src/components/tabs/ElaTab.tsx` — ELA canvas + amplification slider
- `src/components/tabs/ToolsTab.tsx` — zoom controls, before/after toggle, export

### Modified
- `vite.config.ts` — add `@vitejs/plugin-react` + `@tailwindcss/vite`
- `tsconfig.json` — add `"jsx": "react-jsx"`, add `"src/**/*"` to include
- `index.html` — replace body with `<div id="root">` + Google Fonts + `src/main.tsx`
- `package.json` — (managed by pnpm add commands)

### Deleted (Task 10 — cleanup)
- `js/main.ts`, `js/ui.ts`, `css/styles.css`

### Unchanged
- `js/forensics/` (all 5 files), `js/canvas.ts`, `js/ela.ts`, `js/filters.ts`, `js/types.ts`
- `tests/` (all 57 tests — zero changes needed)

---

## Task 1: Install dependencies + update Vite config + TypeScript

**Files:**
- Modify: `package.json` (via pnpm add)
- Modify: `vite.config.ts`
- Modify: `tsconfig.json`

- [ ] **Step 1: Install React + Tailwind + Vite plugins**

```bash
cd /home/taynam/watermaker-check
pnpm add react react-dom
pnpm add -D @vitejs/plugin-react @types/react @types/react-dom tailwindcss @tailwindcss/vite
```

- [ ] **Step 2: Update `vite.config.ts`**

Replace the entire file:

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
    plugins: [react(), tailwindcss()],
    root: '.',
    test: {
        environment: 'node',
    },
});
```

- [ ] **Step 3: Update `tsconfig.json`**

Add `"jsx": "react-jsx"` to `compilerOptions` and `"src/**/*"` to `include`:

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
    "skipLibCheck": true,
    "jsx": "react-jsx"
  },
  "include": ["js/**/*", "tests/**/*", "src/**/*", "vite.config.ts"]
}
```

- [ ] **Step 4: Verify existing tests still pass**

```bash
pnpm test --run
```

Expected: 57 passed, 0 failed.

- [ ] **Step 5: Commit**

```bash
git add vite.config.ts tsconfig.json package.json pnpm-lock.yaml
git commit -m "build: add React 18 + Tailwind v4 + vite plugin deps

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Task 2: Design system — CSS + fonts + shadcn/ui

**Files:**
- Create: `src/index.css`
- Create: `src/main.tsx` (temporary minimal)
- Create: `src/App.tsx` (temporary minimal)
- Modify: `index.html`

- [ ] **Step 1: Update `index.html`**

Replace the entire file:

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Watermark Check — Análise Forense</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=JetBrains+Mono:wght@400;500;700&family=DM+Sans:opsz,wght@9..40,300;9..40,400&display=swap" rel="stylesheet">
</head>
<body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
</body>
</html>
```

- [ ] **Step 2: Create `src/index.css`**

```css
@import "tailwindcss";

@theme {
    /* Backgrounds */
    --color-bg:          #0c0c0a;
    --color-bg-1:        #131311;
    --color-bg-2:        #1b1b18;
    --color-bg-3:        #242420;
    /* Borders */
    --color-border:      #2a2a26;
    --color-border-soft: #222220;
    /* Text */
    --color-text:        #e6e1d5;
    --color-text-2:      #9a9485;
    --color-text-3:      #5a5750;
    /* Semantic accent */
    --color-amber:       #e8a800;
    --color-amber-dim:   #3a2a00;
    --color-green:       #5cb87a;
    --color-green-dim:   #0d2818;
    --color-red:         #d95f5f;
    --color-red-dim:     #2a0f0f;
    --color-blue:        #5b9cf6;
    --color-blue-dim:    #0d1e3a;
    /* Typography */
    --font-sans:  'DM Sans', system-ui, sans-serif;
    --font-syne:  'Syne', system-ui, sans-serif;
    --font-mono:  'JetBrains Mono', ui-monospace, monospace;
}

/* Base */
*, *::before, *::after { box-sizing: border-box; }
html, body, #root { height: 100%; margin: 0; padding: 0; }
body { background: #0c0c0a; color: #e6e1d5; font-family: 'DM Sans', sans-serif; }

/* Scrollbar */
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: #131311; }
::-webkit-scrollbar-thumb { background: #2a2a26; border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: #3a3a36; }

/* Focus ring */
*:focus-visible { outline: 2px solid #e8a800; outline-offset: 2px; }

/* Grid texture for document stage */
.doc-grid {
    background-image:
        linear-gradient(rgba(230, 225, 213, 0.025) 1px, transparent 1px),
        linear-gradient(90deg, rgba(230, 225, 213, 0.025) 1px, transparent 1px);
    background-size: 20px 20px;
}

/* Scan line animation */
@keyframes scan-line {
    0%   { transform: translateY(-100%); }
    100% { transform: translateY(100%); }
}
.scan-line::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(
        to bottom,
        transparent 40%,
        rgba(232, 168, 0, 0.04) 50%,
        transparent 60%
    );
    pointer-events: none;
    animation: scan-line 4s linear infinite;
}

/* Noise canvas pixel rendering */
canvas.noise-map { image-rendering: pixelated; }

/* Accent range slider */
input[type="range"] { accent-color: #e8a800; }
```

- [ ] **Step 3: Create minimal `src/main.tsx`**

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <App />
    </StrictMode>,
);
```

- [ ] **Step 4: Create minimal `src/App.tsx` to verify Tailwind works**

```tsx
export default function App() {
    return (
        <div className="h-screen w-screen bg-bg text-text font-sans flex items-center justify-center">
            <span className="font-syne font-bold text-2xl text-amber">Forensic Instrument</span>
        </div>
    );
}
```

- [ ] **Step 5: Run dev server and verify the styled text appears**

```bash
pnpm run dev
```

Open `http://localhost:5173` and confirm: black background, gold text "Forensic Instrument" in Syne font.

Stop the dev server with Ctrl+C.

- [ ] **Step 6: Install shadcn/ui**

```bash
npx shadcn@latest init
```

When prompted:
- Style: **Default**
- Base color: **Neutral**
- CSS variables: **Yes**

After init completes, install the components we'll use:

```bash
npx shadcn@latest add button badge card collapsible progress separator tooltip slider
```

This creates `src/components/ui/` with the shadcn component files.

- [ ] **Step 7: Verify build still works**

```bash
pnpm run build
pnpm test --run
```

Expected: build succeeds, 57 tests pass.

- [ ] **Step 8: Commit**

```bash
git add src/ index.html
git commit -m "feat: add React entry, Tailwind design system, shadcn/ui init

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Task 3: App state — types, reducer, and hooks

**Files:**
- Create: `src/types.ts`
- Create: `src/hooks/useImageLoader.ts`
- Create: `src/hooks/useForensics.ts`

- [ ] **Step 1: Create `src/types.ts`**

```ts
import type { ForensicPipelineResult, PipelineStep } from '../js/types.js';

export type ActiveTab = 'forensics' | 'filters' | 'canvas' | 'ela' | 'tools';
export type CanvasMode = 'histogram' | 'sobel' | 'amplify' | null;

export interface FilterState {
    brightness: number;   // 0–300, default 100
    contrast: number;     // 0–300, default 100
    saturation: number;   // 0–300, default 100
    hue: number;          // 0–360, default 0
    invert: number;       // 0–100, default 0
    blur: number;         // 0–20, default 0
    preset: string | null;
}

export const DEFAULT_FILTERS: FilterState = {
    brightness: 100,
    contrast: 100,
    saturation: 100,
    hue: 0,
    invert: 0,
    blur: 0,
    preset: null,
};

export function filtersToCSS(f: FilterState): string {
    return [
        `brightness(${f.brightness}%)`,
        `contrast(${f.contrast}%)`,
        `saturate(${f.saturation}%)`,
        `hue-rotate(${f.hue}deg)`,
        `invert(${f.invert}%)`,
        `blur(${f.blur}px)`,
    ].join(' ');
}

export interface AppState {
    imageElement: HTMLImageElement | null;
    sourceFile: File | null;
    objectUrl: string | null;
    isAnalyzing: boolean;
    progress: Partial<Record<PipelineStep, 'running' | 'done' | 'error'>>;
    forensicResult: ForensicPipelineResult | null;
    ghostLevelIndex: number;
    activeTab: ActiveTab;
    canvasMode: CanvasMode;
    beforeAfterActive: boolean;
    zoom: number;
    filters: FilterState;
    elaAmplification: number;
    elaScore: number | null;
}

export const initialAppState: AppState = {
    imageElement: null,
    sourceFile: null,
    objectUrl: null,
    isAnalyzing: false,
    progress: {},
    forensicResult: null,
    ghostLevelIndex: 0,
    activeTab: 'forensics',
    canvasMode: null,
    beforeAfterActive: false,
    zoom: 1,
    filters: DEFAULT_FILTERS,
    elaAmplification: 10,
    elaScore: null,
};

export type AppAction =
    | { type: 'IMAGE_LOADED'; imageElement: HTMLImageElement; sourceFile: File; objectUrl: string }
    | { type: 'ANALYSIS_STARTED' }
    | { type: 'STEP_PROGRESS'; step: PipelineStep; status: 'running' | 'done' | 'error' }
    | { type: 'ANALYSIS_DONE'; result: ForensicPipelineResult }
    | { type: 'ANALYSIS_ERROR' }
    | { type: 'SET_TAB'; tab: ActiveTab }
    | { type: 'SET_GHOST_LEVEL'; index: number }
    | { type: 'SET_ZOOM'; zoom: number }
    | { type: 'SET_CANVAS_MODE'; mode: CanvasMode }
    | { type: 'TOGGLE_BEFORE_AFTER' }
    | { type: 'SET_FILTER'; key: keyof Omit<FilterState, 'preset'>; value: number }
    | { type: 'SET_PRESET'; preset: string; values: Omit<FilterState, 'preset'> }
    | { type: 'RESET_FILTERS' }
    | { type: 'SET_ELA_AMP'; value: number }
    | { type: 'SET_ELA_SCORE'; score: number | null };

export function appReducer(state: AppState, action: AppAction): AppState {
    switch (action.type) {
        case 'IMAGE_LOADED':
            if (state.objectUrl) URL.revokeObjectURL(state.objectUrl);
            return {
                ...initialAppState,
                activeTab: state.activeTab,
                imageElement: action.imageElement,
                sourceFile: action.sourceFile,
                objectUrl: action.objectUrl,
            };
        case 'ANALYSIS_STARTED':
            return { ...state, isAnalyzing: true, progress: {}, forensicResult: null };
        case 'STEP_PROGRESS':
            return { ...state, progress: { ...state.progress, [action.step]: action.status } };
        case 'ANALYSIS_DONE':
            return { ...state, isAnalyzing: false, forensicResult: action.result, ghostLevelIndex: 0 };
        case 'ANALYSIS_ERROR':
            return { ...state, isAnalyzing: false };
        case 'SET_TAB':
            return { ...state, activeTab: action.tab };
        case 'SET_GHOST_LEVEL':
            return { ...state, ghostLevelIndex: action.index };
        case 'SET_ZOOM':
            return { ...state, zoom: Math.max(0.5, Math.min(4, Math.round(action.zoom * 100) / 100)) };
        case 'SET_CANVAS_MODE':
            return { ...state, canvasMode: action.mode };
        case 'TOGGLE_BEFORE_AFTER':
            return { ...state, beforeAfterActive: !state.beforeAfterActive };
        case 'SET_FILTER':
            return { ...state, filters: { ...state.filters, [action.key]: action.value, preset: null } };
        case 'SET_PRESET':
            return { ...state, filters: { ...action.values, preset: action.preset } };
        case 'RESET_FILTERS':
            return { ...state, filters: DEFAULT_FILTERS };
        case 'SET_ELA_AMP':
            return { ...state, elaAmplification: action.value };
        case 'SET_ELA_SCORE':
            return { ...state, elaScore: action.score };
        default:
            return state;
    }
}
```

- [ ] **Step 2: Create `src/hooks/useImageLoader.ts`**

```ts
import { useCallback } from 'react';
import heic2any from 'heic2any';
import type { AppState } from '../types.ts';

interface LoadedImage {
    imageElement: HTMLImageElement;
    sourceFile: File;
    objectUrl: string;
}

function isHeicFile(file: File): boolean {
    return (
        file.type === 'image/heic' ||
        file.type === 'image/heif' ||
        /\.(heic|heif)$/i.test(file.name)
    );
}

export function useImageLoader(onLoaded: (data: LoadedImage) => void) {
    const loadFile = useCallback(
        async (file: File): Promise<void> => {
            const heic = isHeicFile(file);
            if (!heic && !file.type.startsWith('image/')) return;

            let objectUrl: string;
            if (heic) {
                const blob = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.92 });
                const single = Array.isArray(blob) ? blob[0] : blob;
                objectUrl = URL.createObjectURL(single);
            } else {
                objectUrl = URL.createObjectURL(file);
            }

            const img = new Image();
            img.onload = () => onLoaded({ imageElement: img, sourceFile: file, objectUrl });
            img.onerror = () => URL.revokeObjectURL(objectUrl);
            img.src = objectUrl;
        },
        [onLoaded],
    );

    const loadUrl = useCallback(
        (url: string): void => {
            const img = new Image();
            img.onload = () =>
                onLoaded({
                    imageElement: img,
                    sourceFile: new File([], url.split('/').pop() ?? 'image'),
                    objectUrl: url,
                });
            img.src = url;
        },
        [onLoaded],
    );

    return { loadFile, loadUrl };
}
```

- [ ] **Step 3: Create `src/hooks/useForensics.ts`**

```ts
import { useCallback } from 'react';
import { runForensicPipeline } from '../../js/forensics/index.js';
import type { PipelineStep } from '../../js/types.js';
import type { AppAction } from '../types.ts';

export function useForensics(dispatch: React.Dispatch<AppAction>) {
    const analyze = useCallback(
        async (img: HTMLImageElement, sourceFile: File | null): Promise<void> => {
            dispatch({ type: 'ANALYSIS_STARTED' });
            try {
                const result = await runForensicPipeline(
                    img,
                    (step: PipelineStep, status: 'running' | 'done' | 'error') => {
                        dispatch({ type: 'STEP_PROGRESS', step, status });
                    },
                    sourceFile,
                );
                dispatch({ type: 'ANALYSIS_DONE', result });
            } catch (err) {
                console.error('Forensic pipeline failed:', err);
                dispatch({ type: 'ANALYSIS_ERROR' });
            }
        },
        [dispatch],
    );

    return { analyze };
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
pnpm run build 2>&1 | head -30
```

Expected: no TS errors, build succeeds (the new src/ files are compiled).

- [ ] **Step 5: Commit**

```bash
git add src/types.ts src/hooks/
git commit -m "feat: app state reducer + useImageLoader + useForensics hooks

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Task 4: App shell — layout skeleton + TopBar + TabBar

**Files:**
- Create: `src/components/layout/TopBar.tsx`
- Create: `src/components/layout/TabBar.tsx`
- Modify: `src/App.tsx` (replace minimal version)

- [ ] **Step 1: Create `src/components/layout/TopBar.tsx`**

```tsx
import type { AppState, AppAction } from '../../types.ts';

interface TopBarProps {
    state: AppState;
    onReanalyze: () => void;
}

export function TopBar({ state, onReanalyze }: TopBarProps) {
    const { imageElement, sourceFile, forensicResult, isAnalyzing } = state;

    const statusColor = !imageElement
        ? '#5a5750'
        : isAnalyzing
          ? '#e8a800'
          : forensicResult
            ? forensicResult.report.totalScore < 30
                ? '#5cb87a'
                : forensicResult.report.totalScore <= 60
                  ? '#e8a800'
                  : '#d95f5f'
            : '#5a5750';

    const fileName = sourceFile?.name ?? null;
    const dims = imageElement
        ? `${imageElement.naturalWidth} × ${imageElement.naturalHeight}`
        : null;

    return (
        <header className="h-11 shrink-0 flex items-center gap-3 px-4 border-b border-border bg-bg-1">
            {/* Logo */}
            <div className="flex items-center gap-2 mr-2">
                <span className="font-syne font-bold text-sm text-text tracking-wide">
                    WATERMARK<span className="text-amber">CHECK</span>
                </span>
            </div>

            {/* Status dot */}
            <div
                className="w-1.5 h-1.5 rounded-full shrink-0 transition-colors"
                style={{ background: statusColor }}
                title={isAnalyzing ? 'A analisar…' : imageElement ? 'Pronto' : 'Sem imagem'}
            />

            {/* File info */}
            {fileName && (
                <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono text-xs text-text-3 truncate max-w-48">{fileName}</span>
                    {dims && <span className="font-mono text-xs text-text-3 shrink-0">{dims}</span>}
                </div>
            )}

            <div className="flex-1" />

            {/* Actions */}
            {imageElement && !isAnalyzing && (
                <button
                    onClick={onReanalyze}
                    className="h-7 px-2.5 rounded-sm border border-border text-text-3 text-xs font-syne font-bold hover:border-amber hover:text-amber transition-colors"
                    title="Re-analisar"
                >
                    ↺ Re-analisar
                </button>
            )}
        </header>
    );
}
```

- [ ] **Step 2: Create `src/components/layout/TabBar.tsx`**

```tsx
import type { ActiveTab } from '../../types.ts';

const TABS: { id: ActiveTab; label: string }[] = [
    { id: 'forensics', label: 'Forense' },
    { id: 'filters',   label: 'Filtros' },
    { id: 'canvas',    label: 'Canvas' },
    { id: 'ela',       label: 'ELA' },
    { id: 'tools',     label: 'Ferramentas' },
];

interface TabBarProps {
    activeTab: ActiveTab;
    onTabChange: (tab: ActiveTab) => void;
}

export function TabBar({ activeTab, onTabChange }: TabBarProps) {
    return (
        <nav className="h-9 shrink-0 flex border-b border-border bg-bg-1 px-2 gap-0.5 items-end">
            {TABS.map(({ id, label }) => {
                const active = activeTab === id;
                return (
                    <button
                        key={id}
                        onClick={() => onTabChange(id)}
                        className={[
                            'h-8 px-3 text-xs font-syne font-bold tracking-wide rounded-t-sm transition-colors',
                            active
                                ? 'bg-bg-2 text-amber border-t border-x border-border border-b-0'
                                : 'text-text-3 hover:text-text-2',
                        ].join(' ')}
                    >
                        {label.toUpperCase()}
                    </button>
                );
            })}
        </nav>
    );
}
```

- [ ] **Step 3: Rewrite `src/App.tsx` with full shell layout**

```tsx
import { useReducer, useRef, useEffect, useCallback } from 'react';
import { appReducer, initialAppState } from './types.ts';
import { useImageLoader } from './hooks/useImageLoader.ts';
import { useForensics } from './hooks/useForensics.ts';
import { TopBar } from './components/layout/TopBar.tsx';
import { TabBar } from './components/layout/TabBar.tsx';

export default function App() {
    const [state, dispatch] = useReducer(appReducer, initialAppState);
    const imageRef = useRef<HTMLImageElement>(null);
    const overlayCanvasRef = useRef<HTMLCanvasElement>(null);

    const { analyze } = useForensics(dispatch);

    const handleImageLoaded = useCallback(
        (data: { imageElement: HTMLImageElement; sourceFile: File; objectUrl: string }) => {
            dispatch({ type: 'IMAGE_LOADED', ...data });
        },
        [],
    );

    const { loadFile, loadUrl } = useImageLoader(handleImageLoaded);

    // Auto-analyze on image load
    useEffect(() => {
        if (state.imageElement && !state.forensicResult && !state.isAnalyzing) {
            analyze(state.imageElement, state.sourceFile);
        }
    }, [state.imageElement]);

    const handleReanalyze = useCallback(() => {
        if (state.imageElement) analyze(state.imageElement, state.sourceFile);
    }, [state.imageElement, state.sourceFile, analyze]);

    return (
        <div className="h-screen w-screen flex flex-col overflow-hidden bg-bg font-sans text-text">
            <TopBar state={state} onReanalyze={handleReanalyze} />
            <TabBar
                activeTab={state.activeTab}
                onTabChange={(tab) => dispatch({ type: 'SET_TAB', tab })}
            />
            <main className="flex flex-1 overflow-hidden">
                {/* Placeholder: DocPane will go here */}
                <div className="flex-1 bg-bg flex items-center justify-center text-text-3 text-sm">
                    DocPane — Task 5
                </div>
                {/* Placeholder: RightPanel will go here */}
                <aside className="w-[360px] shrink-0 border-l border-border bg-bg-1 flex items-center justify-center text-text-3 text-sm">
                    RightPanel — Task 6
                </aside>
            </main>
        </div>
    );
}
```

- [ ] **Step 4: Verify dev server shows the shell**

```bash
pnpm run dev
```

Open `http://localhost:5173`. Confirm: TopBar with "WATERMARKCHECK" logo visible, TabBar with 5 tabs, two placeholder panels.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/components/layout/
git commit -m "feat: app shell — TopBar, TabBar, layout skeleton

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Task 5: DocPane — image display, drop zone, canvas overlay, zoom, before/after

**Files:**
- Create: `src/components/DocPane.tsx`
- Modify: `src/App.tsx` (replace DocPane placeholder)

- [ ] **Step 1: Create `src/components/DocPane.tsx`**

```tsx
import { useRef, useCallback, useEffect, useState } from 'react';
import type { AppState, AppAction, FilterState } from '../types.ts';
import { filtersToCSS } from '../types.ts';
import { clearOverlay } from '../../js/canvas.js';

interface DocPaneProps {
    state: AppState;
    dispatch: React.Dispatch<AppAction>;
    imageRef: React.RefObject<HTMLImageElement>;
    overlayCanvasRef: React.RefObject<HTMLCanvasElement>;
    onFileDrop: (file: File) => Promise<void>;
    onSampleLoad: () => void;
    onFileSelect: () => void;
    fileInputRef: React.RefObject<HTMLInputElement>;
}

export function DocPane({
    state,
    dispatch,
    imageRef,
    overlayCanvasRef,
    onFileDrop,
    onSampleLoad,
    onFileSelect,
    fileInputRef,
}: DocPaneProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const beforeImgRef = useRef<HTMLImageElement>(null);
    const dividerRef = useRef<HTMLDivElement>(null);
    const [isDragOver, setIsDragOver] = useState(false);
    const draggingRef = useRef(false);
    const { imageElement, zoom, filters, canvasMode, beforeAfterActive } = state;

    // Apply CSS filter to image
    useEffect(() => {
        if (imageRef.current) {
            imageRef.current.style.filter = filtersToCSS(filters);
        }
    }, [filters, imageRef]);

    // Apply zoom
    useEffect(() => {
        if (imageRef.current) {
            imageRef.current.style.transform = `scale(${zoom})`;
        }
    }, [zoom, imageRef]);

    // Sync before-image src and position when activated
    useEffect(() => {
        const before = beforeImgRef.current;
        const img = imageRef.current;
        if (!before || !img) return;
        if (beforeAfterActive && imageElement) {
            before.src = imageElement.src;
            before.style.filter = 'none';
            before.style.display = '';
            applyBeforeAfterClip(50);
            if (dividerRef.current) dividerRef.current.style.display = '';
        } else {
            before.style.display = 'none';
            if (img) img.style.clipPath = '';
            if (dividerRef.current) dividerRef.current.style.display = 'none';
        }
    }, [beforeAfterActive, imageElement]);

    function applyBeforeAfterClip(pct: number) {
        const before = beforeImgRef.current;
        const img = imageRef.current;
        const divider = dividerRef.current;
        if (!before || !img || !divider) return;
        before.style.clipPath = `inset(0 ${100 - pct}% 0 0)`;
        img.style.clipPath = `inset(0 0 0 ${pct}%)`;
        divider.style.left = `${pct}%`;
    }

    // Before/After mouse drag
    const onDividerMouseDown = useCallback((e: React.MouseEvent) => {
        draggingRef.current = true;
        e.preventDefault();
    }, []);

    useEffect(() => {
        function onMouseUp() { draggingRef.current = false; }
        function onMouseMove(e: MouseEvent) {
            if (!draggingRef.current || !containerRef.current) return;
            const rect = containerRef.current.getBoundingClientRect();
            const pct = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
            applyBeforeAfterClip(pct);
        }
        window.addEventListener('mouseup', onMouseUp);
        window.addEventListener('mousemove', onMouseMove);
        return () => {
            window.removeEventListener('mouseup', onMouseUp);
            window.removeEventListener('mousemove', onMouseMove);
        };
    }, []);

    // Zoom on wheel
    const onWheel = useCallback(
        (e: React.WheelEvent) => {
            if (!imageElement) return;
            e.preventDefault();
            dispatch({ type: 'SET_ZOOM', zoom: state.zoom + (e.deltaY < 0 ? 0.1 : -0.1) });
        },
        [imageElement, state.zoom, dispatch],
    );

    // Drag and drop
    const onDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(true);
    }, []);
    const onDragLeave = useCallback((e: React.DragEvent) => {
        if (containerRef.current?.contains(e.relatedTarget as Node)) return;
        setIsDragOver(false);
    }, []);
    const onDrop = useCallback(
        (e: React.DragEvent) => {
            e.preventDefault();
            setIsDragOver(false);
            const file = e.dataTransfer?.files[0];
            if (file) onFileDrop(file);
        },
        [onFileDrop],
    );

    const fileName = state.sourceFile?.name;
    const dims = imageElement
        ? `${imageElement.naturalWidth}×${imageElement.naturalHeight}`
        : null;

    return (
        <section className="flex-1 flex flex-col overflow-hidden bg-bg relative">
            {/* Document stage */}
            <div
                ref={containerRef}
                className={[
                    'flex-1 relative overflow-hidden doc-grid scan-line',
                    isDragOver ? 'ring-1 ring-amber ring-inset' : '',
                ].join(' ')}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                onWheel={onWheel}
            >
                {/* Upload zone — shown when no image */}
                {!imageElement && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 z-10">
                        <div className="text-5xl opacity-20">◻</div>
                        <p className="font-syne font-bold text-text-3 text-sm tracking-wide uppercase">
                            Arraste um documento ou
                        </p>
                        <div className="flex gap-2">
                            <button
                                onClick={onFileSelect}
                                className="h-8 px-4 rounded-sm border border-border text-text-2 text-xs font-syne font-bold hover:border-amber hover:text-amber transition-colors"
                            >
                                Selecionar arquivo
                            </button>
                            <button
                                onClick={onSampleLoad}
                                className="h-8 px-4 rounded-sm border border-border-soft text-text-3 text-xs font-syne hover:text-text-2 transition-colors"
                            >
                                Usar exemplo
                            </button>
                        </div>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*,.heic,.heif"
                            className="hidden"
                        />
                    </div>
                )}

                {/* Before image (before/after comparison) */}
                <img
                    ref={beforeImgRef}
                    alt=""
                    style={{ display: 'none' }}
                    className="absolute inset-0 w-full h-full object-contain pointer-events-none z-2"
                />

                {/* Main image */}
                {imageElement && (
                    <img
                        ref={imageRef}
                        src={imageElement.src}
                        alt=""
                        className="absolute inset-0 w-full h-full object-contain z-1 origin-center transition-transform duration-100"
                    />
                )}

                {/* Canvas overlay (Sobel / Amplify) */}
                <canvas
                    ref={overlayCanvasRef}
                    className="absolute inset-0 w-full h-full object-contain z-3 pointer-events-none"
                    style={{ display: 'none' }}
                />

                {/* Before/After divider */}
                <div
                    ref={dividerRef}
                    style={{ display: 'none', position: 'absolute', top: 0, bottom: 0, left: '50%', zIndex: 10 }}
                    className="w-px bg-amber cursor-ew-resize"
                    onMouseDown={onDividerMouseDown}
                >
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-amber flex items-center justify-center text-bg text-xs font-bold">
                        ↔
                    </div>
                </div>

                {/* Corner labels */}
                {imageElement && (
                    <>
                        <div className="absolute bottom-2 left-2 font-mono text-xs text-text-3 bg-bg/70 px-1.5 py-0.5 rounded-sm z-10">
                            {fileName} {dims && `· ${dims}`}
                        </div>
                        <div className="absolute top-2 right-2 font-mono text-xs text-text-3 bg-bg/70 px-1.5 py-0.5 rounded-sm z-10">
                            {Math.round(zoom * 100)}%
                        </div>
                    </>
                )}
            </div>
        </section>
    );
}
```

- [ ] **Step 2: Update `src/App.tsx` to use `DocPane`**

Add the import at the top of `App.tsx`:
```tsx
import { DocPane } from './components/DocPane.tsx';
```

Add refs and file input ref:
```tsx
const fileInputRef = useRef<HTMLInputElement>(null);
```

Add event handlers:
```tsx
const handleFileSelect = useCallback(() => fileInputRef.current?.click(), []);
const handleSampleLoad = useCallback(() => loadUrl('example.png'), [loadUrl]);

// Wire file input change
const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) loadFile(file);
    },
    [loadFile],
);
```

Replace the DocPane placeholder in the JSX:
```tsx
<DocPane
    state={state}
    dispatch={dispatch}
    imageRef={imageRef}
    overlayCanvasRef={overlayCanvasRef}
    onFileDrop={loadFile}
    onSampleLoad={handleSampleLoad}
    onFileSelect={handleFileSelect}
    fileInputRef={fileInputRef}
/>
```

Also add the hidden file input handler — in `DocPane`, attach `onChange` to the `fileInputRef`:

In `DocPane.tsx`, the `<input>` element already has `ref={fileInputRef}`. Add `onChange` to wire the file selection. The `onFileSelect` is called when the button is clicked (it calls `fileInputRef.current?.click()`), but the input's `onChange` needs to be connected. Since the `fileInputRef` is created in `App.tsx`, wire the `onChange` there by passing it as a prop:

Add to `DocPaneProps`:
```tsx
onFileInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
```

Add to `<input>` in `DocPane.tsx`:
```tsx
onChange={onFileInputChange}
```

Pass from `App.tsx`:
```tsx
onFileInputChange={handleFileInputChange}
```

- [ ] **Step 3: Verify drag-drop and image rendering**

```bash
pnpm run dev
```

- Open `http://localhost:5173`
- Drag an image file onto the left pane — the upload zone should disappear and the image should appear
- Confirm zoom label appears in top-right corner
- Mouse wheel should zoom in/out

- [ ] **Step 4: Commit**

```bash
git add src/components/DocPane.tsx src/App.tsx
git commit -m "feat: DocPane — image display, drop zone, canvas overlay, zoom, before/after

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Task 6: Forensics content — VerdictBlock, ScoreRing, ModuleCard + all 4 modules

**Files:**
- Create: `src/components/forensics/ScoreRing.tsx`
- Create: `src/components/forensics/VerdictBlock.tsx`
- Create: `src/components/forensics/ModuleCard.tsx`
- Create: `src/components/forensics/modules/ExifModule.tsx`
- Create: `src/components/forensics/modules/NoiseModule.tsx`
- Create: `src/components/forensics/modules/GhostModule.tsx`
- Create: `src/components/forensics/modules/QualityModule.tsx`
- Create: `src/components/forensics/ForensicsContent.tsx`

- [ ] **Step 1: Create `src/components/forensics/ScoreRing.tsx`**

```tsx
interface ScoreRingProps {
    score: number; // 0–100
    size?: number; // px, default 100
}

function scoreColor(score: number): string {
    return score < 30 ? '#5cb87a' : score <= 60 ? '#e8a800' : '#d95f5f';
}

export function ScoreRing({ score, size = 100 }: ScoreRingProps) {
    const sw = 7; // strokeWidth
    const r = (size - sw * 2) / 2;
    const cx = size / 2;
    const cy = size / 2;
    const circ = 2 * Math.PI * r;
    const offset = circ * (1 - score / 100);
    const color = scoreColor(score);

    return (
        <div className="relative shrink-0" style={{ width: size, height: size }}>
            <svg
                width={size}
                height={size}
                style={{ transform: 'rotate(-90deg)' }}
                aria-hidden="true"
            >
                <circle cx={cx} cy={cy} r={r} fill="none" stroke="#2a2a26" strokeWidth={sw} />
                <circle
                    cx={cx} cy={cy} r={r}
                    fill="none"
                    stroke={color}
                    strokeWidth={sw}
                    strokeDasharray={circ}
                    strokeDashoffset={offset}
                    strokeLinecap="round"
                    style={{ transition: 'stroke-dashoffset 0.6s ease' }}
                />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span
                    className="font-mono font-bold leading-none"
                    style={{ fontSize: size * 0.26, color }}
                    aria-label={`Score ${score} de 100`}
                >
                    {score}
                </span>
                <span className="font-mono text-text-3" style={{ fontSize: size * 0.1 }}>
                    /100
                </span>
            </div>
        </div>
    );
}
```

- [ ] **Step 2: Create `src/components/forensics/VerdictBlock.tsx`**

```tsx
import { ScoreRing } from './ScoreRing.tsx';
import type { ForensicReport, PipelineStep } from '../../../js/types.js';

const STEPS: PipelineStep[] = ['exif', 'noise', 'ghost', 'ela', 'quality'];
const STEP_LABELS: Record<string, string> = {
    exif: 'Metadados EXIF',
    noise: 'Ruído',
    ghost: 'Ghost JPEG',
    ela: 'ELA',
    quality: 'Qualidade',
    report: 'Relatório',
};

const WEIGHTS = [
    { key: 'ela'   as const, label: 'ELA',   weight: '×0.25' },
    { key: 'ghost' as const, label: 'Ghost', weight: '×0.30' },
    { key: 'noise' as const, label: 'Ruído', weight: '×0.25' },
    { key: 'exif'  as const, label: 'EXIF',  weight: '×0.20' },
];

interface VerdictBlockProps {
    report: ForensicReport | null;
    isAnalyzing: boolean;
    progress: Partial<Record<PipelineStep, 'running' | 'done' | 'error'>>;
}

function scoreColor(s: number): string {
    return s < 30 ? '#5cb87a' : s <= 60 ? '#e8a800' : '#d95f5f';
}

export function VerdictBlock({ report, isAnalyzing, progress }: VerdictBlockProps) {
    if (isAnalyzing) {
        return (
            <div className="p-4 border-b border-border">
                <p className="font-syne text-xs font-bold text-text-2 uppercase tracking-widest mb-3">
                    A analisar…
                </p>
                <div className="flex flex-col gap-2">
                    {STEPS.map((s) => {
                        const st = progress[s];
                        const icon = !st ? '○' : st === 'running' ? '◔' : st === 'done' ? '●' : '✕';
                        const cls = !st
                            ? 'text-text-3'
                            : st === 'running'
                              ? 'text-amber'
                              : st === 'done'
                                ? 'text-green'
                                : 'text-red';
                        return (
                            <div key={s} className={`flex items-center gap-2 text-xs ${cls}`}>
                                <span className="font-mono w-3">{icon}</span>
                                <span>{STEP_LABELS[s]}</span>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    }

    if (!report) {
        return (
            <div className="p-6 border-b border-border flex flex-col items-center gap-3 text-center">
                <div className="text-5xl text-text-3 opacity-20 select-none">◉</div>
                <p className="text-text-3 text-xs max-w-[200px]">
                    Carregue um documento para iniciar a análise forense automática
                </p>
            </div>
        );
    }

    const verdictText =
        report.verdict === 'authentic'
            ? 'Provavelmente Autêntico'
            : report.verdict === 'suspicious'
              ? 'Suspeito'
              : 'Provável Adulteração';

    return (
        <div className="p-4 border-b border-border">
            <div className="flex items-start gap-4 mb-4">
                <ScoreRing score={report.totalScore} />
                <div className="flex-1 pt-1">
                    <p
                        className="font-syne font-bold text-sm mb-3"
                        style={{ color: scoreColor(report.totalScore) }}
                    >
                        {verdictText}
                    </p>
                    <div className="flex flex-col gap-2">
                        {WEIGHTS.map(({ key, label, weight }) => {
                            const s = report[key];
                            const c = scoreColor(s);
                            return (
                                <div key={key} className="flex items-center gap-2">
                                    <span className="font-syne text-xs text-text-3 w-10">{label}</span>
                                    <div className="flex-1 h-px bg-bg-3 rounded-full overflow-hidden">
                                        <div
                                            className="h-full transition-all duration-500"
                                            style={{ width: `${s}%`, background: c }}
                                        />
                                    </div>
                                    <span
                                        className="font-mono text-xs w-5 text-right"
                                        style={{ color: c }}
                                    >
                                        {s}
                                    </span>
                                    <span className="text-text-3 text-xs w-8">{weight}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}
```

- [ ] **Step 3: Create `src/components/forensics/ModuleCard.tsx`**

```tsx
import { useState } from 'react';

interface ModuleCardProps {
    title: string;
    score: number;
    icon: string;
    children: React.ReactNode;
    defaultOpen?: boolean;
    isQuality?: boolean; // uses isAcceptable badge instead of score
    isAcceptable?: boolean;
}

function scoreColor(score: number): string {
    return score < 30 ? '#5cb87a' : score <= 60 ? '#e8a800' : '#d95f5f';
}

export function ModuleCard({
    title,
    score,
    icon,
    children,
    defaultOpen = false,
    isQuality = false,
    isAcceptable,
}: ModuleCardProps) {
    const [open, setOpen] = useState(defaultOpen);
    const borderColor = isQuality
        ? isAcceptable
            ? '#5cb87a'
            : '#e8a800'
        : scoreColor(score);

    const badgeText = isQuality
        ? isAcceptable
            ? 'OK'
            : 'Atenção'
        : String(score);
    const badgeColor = isQuality
        ? isAcceptable
            ? '#5cb87a'
            : '#e8a800'
        : scoreColor(score);

    return (
        <div className="border border-border bg-bg-2 overflow-hidden rounded-sm">
            <button
                onClick={() => setOpen((v) => !v)}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-bg-3 transition-colors"
                style={{ borderLeft: `3px solid ${borderColor}` }}
                aria-expanded={open}
            >
                <span className="text-xs shrink-0">{icon}</span>
                <span className="font-syne font-bold text-xs uppercase tracking-wide text-text flex-1">
                    {title}
                </span>
                <span className="font-mono text-xs font-bold" style={{ color: badgeColor }}>
                    {badgeText}
                </span>
                <span className="text-text-3 text-xs ml-1">{open ? '▲' : '▼'}</span>
            </button>
            {open && (
                <div className="px-3 pb-3 pt-2 border-t border-border text-sm text-text-2">
                    {children}
                </div>
            )}
        </div>
    );
}
```

- [ ] **Step 4: Create `src/components/forensics/modules/ExifModule.tsx`**

```tsx
import type { ExifResult } from '../../../../js/types.js';

export function ExifModule({ result }: { result: ExifResult }) {
    return (
        <div className="flex flex-col gap-1.5">
            <table className="w-full text-xs">
                <tbody>
                    <Row label="EXIF" value={result.hasExif ? '✓ Presente' : '✗ Ausente'} color={result.hasExif ? '#5cb87a' : '#d95f5f'} />
                    {result.camera && <Row label="Câmara" value={result.camera} />}
                    {result.software && <Row label="Software" value={result.software} color="#e8a800" />}
                    {result.dateTime && <Row label="Data" value={result.dateTime} />}
                    <Row label="GPS" value={result.gpsPresent ? '✓ Presente' : '—'} color={result.gpsPresent ? '#5cb87a' : undefined} />
                </tbody>
            </table>
            {result.flags.map((f) => (
                <div key={f.code} className="flex items-start gap-1.5 text-xs text-amber">
                    <span className="shrink-0">⚠</span>
                    <span>{f.message}</span>
                </div>
            ))}
        </div>
    );
}

function Row({ label, value, color }: { label: string; value: string; color?: string }) {
    return (
        <tr className="border-b border-border-soft last:border-0">
            <td className="py-1 pr-3 text-text-3 whitespace-nowrap w-20">{label}</td>
            <td className="py-1 font-mono text-xs" style={{ color: color ?? '#9a9485' }}>
                {value}
            </td>
        </tr>
    );
}
```

- [ ] **Step 5: Create `src/components/forensics/modules/NoiseModule.tsx`**

```tsx
import { useEffect, useRef } from 'react';
import { renderNoiseMap } from '../../../../js/forensics/noise.js';
import type { NoiseResult } from '../../../../js/types.js';

interface NoiseModuleProps {
    result: NoiseResult;
    imageWidth: number;
    imageHeight: number;
}

export function NoiseModule({ result, imageWidth, imageHeight }: NoiseModuleProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        if (canvasRef.current) {
            renderNoiseMap(result, canvasRef.current, imageWidth, imageHeight);
        }
    }, [result, imageWidth, imageHeight]);

    return (
        <div className="flex flex-col gap-2">
            <p className="text-xs text-text-3">
                {result.suspiciousBlockCount} bloco(s) anómalo(s) de {result.totalBlockCount} total
            </p>
            <canvas ref={canvasRef} className="w-full rounded-sm noise-map" />
        </div>
    );
}
```

- [ ] **Step 6: Create `src/components/forensics/modules/GhostModule.tsx`**

```tsx
import { useEffect, useRef } from 'react';
import type { GhostResult } from '../../../../js/types.js';

const QUALITIES = [50, 65, 80, 95] as const;

interface GhostModuleProps {
    result: GhostResult;
    levelIndex: number;
    onLevelChange: (idx: number) => void;
}

export function GhostModule({ result, levelIndex, onLevelChange }: GhostModuleProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        const level = result.levels[levelIndex];
        if (!canvas || !level) return;
        canvas.width = level.imageData.width;
        canvas.height = level.imageData.height;
        const ctx = canvas.getContext('2d')!;
        const id = ctx.createImageData(level.imageData.width, level.imageData.height);
        id.data.set(level.imageData.data);
        ctx.putImageData(id, 0, 0);
    }, [result, levelIndex]);

    return (
        <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
                <span className="text-text-3 text-xs shrink-0">Qualidade</span>
                <input
                    type="range"
                    min={0}
                    max={3}
                    value={levelIndex}
                    onChange={(e) => onLevelChange(Number(e.target.value))}
                    className="flex-1 h-1"
                    aria-label="Qualidade JPEG Ghost"
                />
                <span className="font-mono text-xs text-blue w-8 text-right">
                    Q{QUALITIES[levelIndex]}
                </span>
            </div>
            <canvas ref={canvasRef} className="w-full rounded-sm" />
            <p className="text-xs text-text-3">
                {result.suspectedOriginalQuality
                    ? `Qualidade original suspeita: Q${result.suspectedOriginalQuality}`
                    : 'Sem sinal de dupla compressão JPEG detectado'}
                {result.heicConverted && (
                    <span className="text-amber"> — ⚠ Fonte HEIC: análise Ghost pode ser imprecisa</span>
                )}
            </p>
        </div>
    );
}
```

- [ ] **Step 7: Create `src/components/forensics/modules/QualityModule.tsx`**

```tsx
import type { QualityResult } from '../../../../js/types.js';

export function QualityModule({ result }: { result: QualityResult }) {
    return (
        <div className="flex flex-col gap-2">
            <MeterRow label="Nitidez" value={result.sharpness} />
            <MeterRow label="Exposição" value={result.exposure} />
            {result.flags.map((f) => (
                <div key={f.code} className="flex items-start gap-1.5 text-xs text-amber">
                    <span className="shrink-0">⚠</span>
                    <span>{f.message}</span>
                </div>
            ))}
        </div>
    );
}

function meterColor(value: number): string {
    return value < 30 ? '#d95f5f' : value < 70 ? '#e8a800' : '#5cb87a';
}

function MeterRow({ label, value }: { label: string; value: number }) {
    return (
        <div className="flex items-center gap-2">
            <span className="text-text-3 text-xs w-16 shrink-0">{label}</span>
            <div className="flex-1 h-1 bg-bg-3 rounded-full overflow-hidden">
                <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{ width: `${value}%`, background: meterColor(value) }}
                />
            </div>
            <span className="font-mono text-xs text-text-3 w-7 text-right">{value}</span>
        </div>
    );
}
```

- [ ] **Step 8: Create `src/components/forensics/ForensicsContent.tsx`**

```tsx
import type { AppState, AppAction } from '../../types.ts';
import { VerdictBlock } from './VerdictBlock.tsx';
import { ModuleCard } from './ModuleCard.tsx';
import { ExifModule } from './modules/ExifModule.tsx';
import { NoiseModule } from './modules/NoiseModule.tsx';
import { GhostModule } from './modules/GhostModule.tsx';
import { QualityModule } from './modules/QualityModule.tsx';

interface ForensicsContentProps {
    state: AppState;
    dispatch: React.Dispatch<AppAction>;
}

export function ForensicsContent({ state, dispatch }: ForensicsContentProps) {
    const { forensicResult, isAnalyzing, progress, ghostLevelIndex, imageElement } = state;
    const report = forensicResult?.report ?? null;

    const imageWidth = imageElement?.naturalWidth ?? 0;
    const imageHeight = imageElement?.naturalHeight ?? 0;

    return (
        <div className="flex flex-col h-full">
            <VerdictBlock report={report} isAnalyzing={isAnalyzing} progress={progress} />

            {forensicResult && (
                <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
                    <ModuleCard title="Metadados EXIF" score={forensicResult.exif.score} icon="🗂" defaultOpen>
                        <ExifModule result={forensicResult.exif} />
                    </ModuleCard>

                    <ModuleCard title="Inconsistência de Ruído" score={forensicResult.noise.score} icon="🌊">
                        <NoiseModule
                            result={forensicResult.noise}
                            imageWidth={imageWidth}
                            imageHeight={imageHeight}
                        />
                    </ModuleCard>

                    <ModuleCard title="JPEG Ghost" score={forensicResult.ghost.score} icon="👻">
                        <GhostModule
                            result={forensicResult.ghost}
                            levelIndex={ghostLevelIndex}
                            onLevelChange={(idx) =>
                                dispatch({ type: 'SET_GHOST_LEVEL', index: idx })
                            }
                        />
                    </ModuleCard>

                    <ModuleCard
                        title="Qualidade de Captura"
                        score={0}
                        icon="📷"
                        isQuality
                        isAcceptable={forensicResult.quality.isAcceptable}
                    >
                        <QualityModule result={forensicResult.quality} />
                    </ModuleCard>

                    {/* ELA score pill */}
                    <ModuleCard title="Error Level Analysis" score={forensicResult.elaScore} icon="🔬">
                        <p className="text-xs text-text-3">
                            Score ELA: <span className="font-mono text-blue">{forensicResult.elaScore}</span>
                            {' '}— Use a aba ELA para visualização detalhada.
                        </p>
                    </ModuleCard>
                </div>
            )}

            {!forensicResult && !isAnalyzing && (
                <div className="flex-1" />
            )}
        </div>
    );
}
```

- [ ] **Step 9: Verify TypeScript compilation**

```bash
pnpm run build 2>&1 | tail -10
```

Expected: build succeeds, no TS errors.

- [ ] **Step 10: Commit**

```bash
git add src/components/forensics/
git commit -m "feat: forensics UI — ScoreRing, VerdictBlock, ModuleCard, all 4 modules

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Task 7: RightPanel + non-forensics tabs (Filters, Canvas, ELA, Tools)

**Files:**
- Create: `src/components/RightPanel.tsx`
- Create: `src/components/tabs/FiltersTab.tsx`
- Create: `src/components/tabs/CanvasTab.tsx`
- Create: `src/components/tabs/ElaTab.tsx`
- Create: `src/components/tabs/ToolsTab.tsx`

- [ ] **Step 1: Create `src/components/tabs/FiltersTab.tsx`**

```tsx
import type { AppState, AppAction, FilterState } from '../../types.ts';

const FILTER_DEFS = [
    { key: 'brightness' as const, label: 'Brilho',     min: 0, max: 300, unit: '%'  },
    { key: 'contrast'   as const, label: 'Contraste',  min: 0, max: 300, unit: '%'  },
    { key: 'saturation' as const, label: 'Saturação',  min: 0, max: 300, unit: '%'  },
    { key: 'hue'        as const, label: 'Matiz',      min: 0, max: 360, unit: '°'  },
    { key: 'invert'     as const, label: 'Inversão',   min: 0, max: 100, unit: '%'  },
    { key: 'blur'       as const, label: 'Desfoque',   min: 0, max: 20,  unit: 'px' },
];

const PRESETS: Record<string, Omit<FilterState, 'preset'>> = {
    uv:        { brightness: 150, contrast: 200, saturation: 50,  hue: 280, invert: 0,  blur: 0 },
    infrared:  { brightness: 120, contrast: 180, saturation: 0,   hue: 0,   invert: 30, blur: 1 },
    watermark: { brightness: 80,  contrast: 250, saturation: 200, hue: 0,   invert: 0,  blur: 0 },
    security:  { brightness: 200, contrast: 300, saturation: 150, hue: 45,  invert: 0,  blur: 0 },
    edges:     { brightness: 50,  contrast: 300, saturation: 0,   hue: 0,   invert: 50, blur: 0 },
    negative:  { brightness: 120, contrast: 120, saturation: 120, hue: 180, invert: 100, blur: 0 },
};

const PRESET_LABELS: Record<string, string> = {
    uv:        'Luz UV',
    infrared:  'Infravermelho',
    watermark: "Marca d'Água",
    security:  'Segurança',
    edges:     'Bordas',
    negative:  'Negativo',
};

interface FiltersTabProps {
    state: AppState;
    dispatch: React.Dispatch<AppAction>;
}

export function FiltersTab({ state, dispatch }: FiltersTabProps) {
    const { filters } = state;

    return (
        <div className="p-3 flex flex-col gap-3">
            {FILTER_DEFS.map(({ key, label, min, max, unit }) => (
                <div key={key} className="flex flex-col gap-1">
                    <div className="flex justify-between items-center">
                        <label htmlFor={`filter-${key}`} className="text-xs text-text-2 font-syne font-bold">
                            {label.toUpperCase()}
                        </label>
                        <span className="font-mono text-xs text-amber">
                            {filters[key]}{unit}
                        </span>
                    </div>
                    <input
                        id={`filter-${key}`}
                        type="range"
                        min={min}
                        max={max}
                        value={filters[key]}
                        onChange={(e) =>
                            dispatch({ type: 'SET_FILTER', key, value: Number(e.target.value) })
                        }
                        className="w-full h-1"
                    />
                </div>
            ))}

            <div className="border-t border-border pt-3">
                <p className="font-syne font-bold text-xs text-text-3 uppercase tracking-wide mb-2">
                    Predefinidos
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                    {Object.entries(PRESET_LABELS).map(([key, label]) => (
                        <button
                            key={key}
                            onClick={() =>
                                dispatch({ type: 'SET_PRESET', preset: key, values: PRESETS[key]! })
                            }
                            className={[
                                'h-7 px-2 rounded-sm border text-xs font-syne font-bold transition-colors',
                                filters.preset === key
                                    ? 'border-amber text-amber bg-amber-dim'
                                    : 'border-border text-text-3 hover:border-border hover:text-text-2',
                            ].join(' ')}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            </div>

            <button
                onClick={() => dispatch({ type: 'RESET_FILTERS' })}
                className="h-8 w-full border border-border text-text-3 text-xs font-syne font-bold hover:border-amber hover:text-amber transition-colors rounded-sm"
            >
                ↺ Restaurar original
            </button>
        </div>
    );
}
```

- [ ] **Step 2: Create `src/components/tabs/CanvasTab.tsx`**

```tsx
import { useRef, useCallback } from 'react';
import type { AppState, AppAction } from '../../types.ts';
import {
    renderHistogram,
    renderSobel,
    renderAmplify,
    clearOverlay,
} from '../../../js/canvas.js';

interface CanvasTabProps {
    state: AppState;
    dispatch: React.Dispatch<AppAction>;
    imageRef: React.RefObject<HTMLImageElement>;
    overlayCanvasRef: React.RefObject<HTMLCanvasElement>;
}

export function CanvasTab({ state, dispatch, imageRef, overlayCanvasRef }: CanvasTabProps) {
    const histCanvasRef = useRef<HTMLCanvasElement>(null);
    const { imageElement, canvasMode } = state;

    const runHistogram = useCallback(() => {
        if (!imageElement) return;
        const tmp = document.createElement('canvas');
        tmp.width = imageElement.naturalWidth;
        tmp.height = imageElement.naturalHeight;
        const ctx = tmp.getContext('2d')!;
        ctx.drawImage(imageElement, 0, 0);
        const imageData = ctx.getImageData(0, 0, tmp.width, tmp.height);
        if (histCanvasRef.current) renderHistogram(imageData, histCanvasRef.current);
        if (overlayCanvasRef.current) clearOverlay(overlayCanvasRef.current);
        dispatch({ type: 'SET_CANVAS_MODE', mode: 'histogram' });
    }, [imageElement, overlayCanvasRef, dispatch]);

    const runSobel = useCallback(() => {
        if (!imageElement || !overlayCanvasRef.current) return;
        renderSobel(imageElement, overlayCanvasRef.current);
        dispatch({ type: 'SET_CANVAS_MODE', mode: 'sobel' });
    }, [imageElement, overlayCanvasRef, dispatch]);

    const runAmplify = useCallback(() => {
        if (!imageElement || !overlayCanvasRef.current) return;
        renderAmplify(imageElement, overlayCanvasRef.current);
        dispatch({ type: 'SET_CANVAS_MODE', mode: 'amplify' });
    }, [imageElement, overlayCanvasRef, dispatch]);

    const runClear = useCallback(() => {
        if (overlayCanvasRef.current) clearOverlay(overlayCanvasRef.current);
        dispatch({ type: 'SET_CANVAS_MODE', mode: null });
    }, [overlayCanvasRef, dispatch]);

    const disabled = !imageElement;

    const btnClass = (mode: typeof canvasMode) =>
        [
            'h-8 px-3 rounded-sm border text-xs font-syne font-bold transition-colors text-left',
            canvasMode === mode
                ? 'border-amber text-amber bg-amber-dim'
                : disabled
                  ? 'border-border-soft text-text-3 opacity-40 cursor-not-allowed'
                  : 'border-border text-text-3 hover:border-border hover:text-text-2',
        ].join(' ');

    return (
        <div className="p-3 flex flex-col gap-2">
            <p className="text-xs text-text-3 mb-1">Processamento de pixels via Canvas API</p>
            <button onClick={runHistogram} disabled={disabled} className={btnClass('histogram')}>
                📊 Histograma RGB
            </button>
            <button onClick={runSobel} disabled={disabled} className={btnClass('sobel')}>
                📐 Bordas (Sobel)
            </button>
            <button onClick={runAmplify} disabled={disabled} className={btnClass('amplify')}>
                🔍 Amplificar diferenças
            </button>
            <button
                onClick={runClear}
                disabled={disabled}
                className="h-8 px-3 rounded-sm border border-border-soft text-text-3 text-xs font-syne font-bold hover:text-text-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
                ✕ Limpar
            </button>
            {canvasMode === 'histogram' && (
                <div className="mt-2 border border-border rounded-sm overflow-hidden bg-bg-3">
                    <canvas ref={histCanvasRef} width={256} height={80} className="w-full" />
                </div>
            )}
        </div>
    );
}
```

- [ ] **Step 3: Create `src/components/tabs/ElaTab.tsx`**

```tsx
import { useRef, useCallback, useState } from 'react';
import type { AppState, AppAction } from '../../types.ts';
import { renderELA } from '../../../js/ela.js';

interface ElaTabProps {
    state: AppState;
    dispatch: React.Dispatch<AppAction>;
    imageRef: React.RefObject<HTMLImageElement>;
}

export function ElaTab({ state, dispatch, imageRef }: ElaTabProps) {
    const elaCanvasRef = useRef<HTMLCanvasElement>(null);
    const [isRunning, setIsRunning] = useState(false);
    const { imageElement, elaAmplification, elaScore } = state;

    const runELA = useCallback(async () => {
        const img = imageRef.current ?? imageElement;
        const canvas = elaCanvasRef.current;
        if (!img || !canvas || isRunning) return;
        setIsRunning(true);
        dispatch({ type: 'SET_ELA_SCORE', score: null });
        try {
            const score = await renderELA(img, canvas, elaAmplification);
            dispatch({ type: 'SET_ELA_SCORE', score });
        } catch (e: unknown) {
            if (e instanceof Error && e.name === 'SecurityError')
                alert('ELA não disponível para imagens de origem externa');
            else alert(`Erro ao analisar: ${e instanceof Error ? e.message : String(e)}`);
        } finally {
            setIsRunning(false);
        }
    }, [imageElement, imageRef, elaAmplification, isRunning, dispatch]);

    const disabled = !imageElement || isRunning;
    const scoreColor = elaScore === null
        ? '#5a5750'
        : elaScore < 30
          ? '#5cb87a'
          : elaScore < 60
            ? '#e8a800'
            : '#d95f5f';

    return (
        <div className="p-3 flex flex-col gap-3">
            <p className="text-xs text-text-3">
                Detecta regiões adulteradas por diferenças de compressão JPEG.
                Regiões quentes (vermelho/branco) indicam adulteração.
            </p>

            <div className="flex flex-col gap-1">
                <div className="flex justify-between items-center">
                    <label htmlFor="ela-amp" className="text-xs text-text-2 font-syne font-bold">
                        SENSIBILIDADE
                    </label>
                    <span className="font-mono text-xs text-amber">{elaAmplification}</span>
                </div>
                <input
                    id="ela-amp"
                    type="range"
                    min={1}
                    max={30}
                    value={elaAmplification}
                    onChange={(e) =>
                        dispatch({ type: 'SET_ELA_AMP', value: Number(e.target.value) })
                    }
                    className="w-full h-1"
                />
            </div>

            <button
                onClick={runELA}
                disabled={disabled}
                className="h-8 w-full rounded-sm border border-border text-xs font-syne font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed hover:border-amber hover:text-amber text-text-2"
            >
                {isRunning ? '⏳ A analisar…' : '🔬 Analisar ELA'}
            </button>

            {elaScore !== null && (
                <div className="flex items-center gap-2">
                    <span className="text-xs text-text-3">Score ELA:</span>
                    <span className="font-mono text-sm font-bold" style={{ color: scoreColor }}>
                        {elaScore}%
                    </span>
                </div>
            )}

            {elaScore !== null && (
                <div className="border border-border rounded-sm overflow-hidden">
                    <canvas ref={elaCanvasRef} className="w-full block" />
                </div>
            )}
            {elaScore === null && (
                <canvas ref={elaCanvasRef} className="hidden" />
            )}
        </div>
    );
}
```

- [ ] **Step 4: Create `src/components/tabs/ToolsTab.tsx`**

```tsx
import { useCallback } from 'react';
import type { AppState, AppAction } from '../../types.ts';
import { clearOverlay } from '../../../js/canvas.js';

interface ToolsTabProps {
    state: AppState;
    dispatch: React.Dispatch<AppAction>;
    imageRef: React.RefObject<HTMLImageElement>;
    overlayCanvasRef: React.RefObject<HTMLCanvasElement>;
}

export function ToolsTab({ state, dispatch, imageRef, overlayCanvasRef }: ToolsTabProps) {
    const { imageElement, zoom, beforeAfterActive, forensicResult } = state;
    const disabled = !imageElement;

    const zoomIn = () => dispatch({ type: 'SET_ZOOM', zoom: zoom + 0.25 });
    const zoomOut = () => dispatch({ type: 'SET_ZOOM', zoom: zoom - 0.25 });
    const zoomReset = () => dispatch({ type: 'SET_ZOOM', zoom: 1 });

    const exportPNG = useCallback(() => {
        const img = imageRef.current;
        if (!img) return;
        const tmp = document.createElement('canvas');
        tmp.width = img.naturalWidth;
        tmp.height = img.naturalHeight;
        const ctx = tmp.getContext('2d')!;
        ctx.filter = img.style.filter || 'none';
        try {
            ctx.drawImage(img, 0, 0);
            const overlay = overlayCanvasRef.current;
            if (overlay && getComputedStyle(overlay).display !== 'none') {
                ctx.filter = 'none';
                ctx.drawImage(overlay, 0, 0, tmp.width, tmp.height);
            }
            const a = document.createElement('a');
            a.href = tmp.toDataURL('image/png');
            a.download = 'watermark-analysis.png';
            a.click();
        } catch (e: unknown) {
            alert(`Erro ao exportar: ${e instanceof Error ? e.message : String(e)}`);
        }
    }, [imageRef, overlayCanvasRef]);

    const exportJSON = useCallback(() => {
        if (!forensicResult) return;
        const { report } = forensicResult;
        const data = {
            timestamp: new Date(report.completedAt).toISOString(),
            verdict: report.verdict,
            totalScore: report.totalScore,
            breakdown: { ela: report.ela, ghost: report.ghost, noise: report.noise, exif: report.exif },
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'forensic-report.json';
        a.click();
        URL.revokeObjectURL(url);
    }, [forensicResult]);

    const btnClass =
        'h-8 w-full rounded-sm border border-border text-xs font-syne font-bold text-text-2 hover:border-amber hover:text-amber transition-colors disabled:opacity-40 disabled:cursor-not-allowed';

    return (
        <div className="p-3 flex flex-col gap-3">
            {/* Zoom */}
            <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                    <span className="font-syne font-bold text-xs text-text-2 uppercase tracking-wide">Zoom</span>
                    <span className="font-mono text-xs text-amber">{Math.round(zoom * 100)}%</span>
                </div>
                <div className="flex gap-1.5">
                    <button onClick={zoomOut} disabled={disabled} className={btnClass} title="Reduzir">−</button>
                    <button onClick={zoomReset} disabled={disabled} className={btnClass} title="Restaurar zoom">↺</button>
                    <button onClick={zoomIn} disabled={disabled} className={btnClass} title="Ampliar">+</button>
                </div>
            </div>

            {/* Before/After */}
            <button
                onClick={() => dispatch({ type: 'TOGGLE_BEFORE_AFTER' })}
                disabled={disabled}
                className={[btnClass, beforeAfterActive ? 'border-amber text-amber bg-amber-dim' : ''].join(' ')}
            >
                ↔ Antes / Depois
            </button>

            {/* Exports */}
            <div className="border-t border-border pt-3 flex flex-col gap-1.5">
                <p className="font-syne font-bold text-xs text-text-3 uppercase tracking-wide mb-1">Exportar</p>
                <button onClick={exportPNG} disabled={disabled} className={btnClass}>
                    💾 Exportar PNG
                </button>
                <button onClick={exportJSON} disabled={!forensicResult} className={btnClass}>
                    📋 Exportar relatório JSON
                </button>
            </div>
        </div>
    );
}
```

- [ ] **Step 5: Create `src/components/RightPanel.tsx`**

```tsx
import type { AppState, AppAction } from '../types.ts';
import { ForensicsContent } from './forensics/ForensicsContent.tsx';
import { FiltersTab } from './tabs/FiltersTab.tsx';
import { CanvasTab } from './tabs/CanvasTab.tsx';
import { ElaTab } from './tabs/ElaTab.tsx';
import { ToolsTab } from './tabs/ToolsTab.tsx';

interface RightPanelProps {
    state: AppState;
    dispatch: React.Dispatch<AppAction>;
    imageRef: React.RefObject<HTMLImageElement>;
    overlayCanvasRef: React.RefObject<HTMLCanvasElement>;
}

export function RightPanel({ state, dispatch, imageRef, overlayCanvasRef }: RightPanelProps) {
    const { activeTab } = state;

    return (
        <aside className="w-[360px] shrink-0 border-l border-border flex flex-col overflow-hidden bg-bg-1">
            <div className="flex-1 overflow-y-auto">
                {activeTab === 'forensics' && (
                    <ForensicsContent state={state} dispatch={dispatch} />
                )}
                {activeTab === 'filters' && (
                    <FiltersTab state={state} dispatch={dispatch} />
                )}
                {activeTab === 'canvas' && (
                    <CanvasTab
                        state={state}
                        dispatch={dispatch}
                        imageRef={imageRef}
                        overlayCanvasRef={overlayCanvasRef}
                    />
                )}
                {activeTab === 'ela' && (
                    <ElaTab state={state} dispatch={dispatch} imageRef={imageRef} />
                )}
                {activeTab === 'tools' && (
                    <ToolsTab
                        state={state}
                        dispatch={dispatch}
                        imageRef={imageRef}
                        overlayCanvasRef={overlayCanvasRef}
                    />
                )}
            </div>
        </aside>
    );
}
```

- [ ] **Step 6: Wire `RightPanel` into `App.tsx`**

Add import:
```tsx
import { RightPanel } from './components/RightPanel.tsx';
```

Replace the `<aside>` placeholder in `App.tsx` with:
```tsx
<RightPanel
    state={state}
    dispatch={dispatch}
    imageRef={imageRef}
    overlayCanvasRef={overlayCanvasRef}
/>
```

- [ ] **Step 7: Verify the complete app works in dev**

```bash
pnpm run dev
```

Open `http://localhost:5173`. Test:
- Load an image (drag-drop or select)
- Forense tab: VerdictBlock shows "A analisar…" then fills with score ring + module cards
- Filtros tab: sliders update image filter in real time
- Canvas tab: Sobel / Amplify buttons apply canvas overlay
- ELA tab: "Analisar ELA" runs and shows heatmap
- Ferramentas tab: zoom buttons work, export PNG downloads the image

- [ ] **Step 8: Run full test suite to confirm nothing broke**

```bash
pnpm test --run
pnpm run build
```

Expected: 57 tests pass, build succeeds.

- [ ] **Step 9: Commit**

```bash
git add src/components/
git commit -m "feat: complete RightPanel — FiltersTab, CanvasTab, ElaTab, ToolsTab

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Task 8: Final wiring, filter-to-image sync, and CSS polish

**Files:**
- Modify: `src/App.tsx` — wire filter CSS effect to the actual `<img>` element
- Modify: `src/components/DocPane.tsx` — apply filter CSS from state on each render

The `filtersToCSS(state.filters)` must be applied to `imageRef.current.style.filter` whenever `filters` changes. This is already in DocPane's `useEffect` from Task 5. Verify it works with the Filters tab:

- [ ] **Step 1: Verify filter live preview**

In the running dev server:
1. Load an image
2. Switch to Filtros tab
3. Move the Brilho slider — the image should instantly get brighter

If it does not update, check that `DocPane` has the `useEffect` for filters:
```tsx
useEffect(() => {
    if (imageRef.current) {
        imageRef.current.style.filter = filtersToCSS(filters);
    }
}, [filters, imageRef]);
```

- [ ] **Step 2: Verify overlay canvas sizing for Sobel/Amplify**

The `renderSobel` and `renderAmplify` functions in `js/canvas.ts` call `overlayCanvas.style.display = ''` and set `overlayCanvas.width/height`. In the old code, `matchImageBounds()` positioned the overlay canvas to match the image bounds. In the new React implementation, the overlay canvas uses `absolute inset-0 w-full h-full object-contain` CSS — this is sufficient because the canvas draws at its natural resolution and CSS scales it. Verify Sobel output is visible on the image.

If the overlay canvas needs positioning, add in `DocPane.tsx` a `useEffect` that copies the `imageRef` bounds to the `overlayCanvasRef` whenever `canvasMode` changes:
```tsx
useEffect(() => {
    const overlay = overlayCanvasRef.current;
    const img = imageRef.current;
    if (!overlay || !img || canvasMode === null) return;
    const imgRect = img.getBoundingClientRect();
    const ctnRect = containerRef.current?.getBoundingClientRect();
    if (!ctnRect) return;
    overlay.style.top = `${imgRect.top - ctnRect.top}px`;
    overlay.style.left = `${imgRect.left - ctnRect.left}px`;
    overlay.style.width = `${imgRect.width}px`;
    overlay.style.height = `${imgRect.height}px`;
    overlay.style.position = 'absolute';
    overlay.style.objectFit = 'unset';
}, [canvasMode, zoom, imageRef, overlayCanvasRef]);
```

- [ ] **Step 3: Add pnpm check pass**

```bash
pnpm check
```

Fix any Biome linting issues if they arise (usually import ordering or trailing commas).

- [ ] **Step 4: Run full verification**

```bash
pnpm test --run && pnpm run build
```

Expected: 57 tests pass, build succeeds with no errors.

- [ ] **Step 5: Commit**

```bash
git add src/
git commit -m "feat: complete React UI migration — filter sync, overlay positioning

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Task 9: Cleanup — remove old vanilla TS files

**Files:**
- Delete: `js/main.ts`
- Delete: `js/ui.ts`
- Delete: `css/styles.css`

- [ ] **Step 1: Remove old files**

```bash
git rm js/main.ts js/ui.ts css/styles.css
```

- [ ] **Step 2: Verify tests still pass (they don't import the deleted files)**

```bash
pnpm test --run
```

Expected: 57 passed. (The deleted files were only UI glue — tests only import `js/forensics/` modules.)

- [ ] **Step 3: Verify build succeeds**

```bash
pnpm run build
```

Expected: build succeeds. If there are "cannot find module" errors, check that nothing in the surviving files imports `js/main.ts` or `js/ui.ts`.

- [ ] **Step 4: Run pnpm check**

```bash
pnpm check
```

Fix any issues.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: remove old vanilla TS UI — js/main.ts, js/ui.ts, css/styles.css

Replaced by React app in src/

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Self-Review

### Spec coverage check

| Spec requirement | Covered in |
|---|---|
| React + Vite + Tailwind CSS v4 + shadcn/ui | Task 1-2 |
| `#0c0c0a` warm dark background | Task 2 `@theme` |
| Amber `#e8a800` accent | Task 2 `@theme` |
| Syne + JetBrains Mono + DM Sans | Task 2 Google Fonts + `@theme` |
| Split panel (left flex:1 + right 360px) | Task 4 App.tsx |
| TopBar: logo, status dot, file info | Task 4 TopBar.tsx |
| TabBar: 5 tabs | Task 4 TabBar.tsx |
| Document stage: grid texture | Task 2 `.doc-grid` CSS |
| Scan line animation | Task 2 `.scan-line` CSS |
| Drop zone with upload area | Task 5 DocPane.tsx |
| Zoom (buttons + wheel) | Task 5 DocPane.tsx |
| Before/After divider | Task 5 DocPane.tsx |
| Score ring SVG gauge | Task 6 ScoreRing.tsx |
| VerdictBlock with progress steps | Task 6 VerdictBlock.tsx |
| ModuleCard: collapsible, color border | Task 6 ModuleCard.tsx |
| EXIF module | Task 6 ExifModule.tsx |
| Noise module + canvas map | Task 6 NoiseModule.tsx |
| Ghost module + slider + HEIC warning | Task 6 GhostModule.tsx |
| Quality module + meters | Task 6 QualityModule.tsx |
| Filters tab: sliders + presets | Task 7 FiltersTab.tsx |
| Canvas tab: histogram/sobel/amplify | Task 7 CanvasTab.tsx |
| ELA tab: canvas + slider | Task 7 ElaTab.tsx |
| Tools tab: zoom/before-after/export | Task 7 ToolsTab.tsx |
| Keyboard navigation + ARIA labels | ModuleCard `aria-expanded`, ScoreRing `aria-label`, inputs `id`/`htmlFor` |
| Export PNG + JSON | Task 7 ToolsTab.tsx |
| All 57 tests passing | Verified in Task 1, 3, 7, 8, 9 |
| desktop-only (min 1024px) | Layout uses fixed 360px panel — no mobile breakpoints |

### Type consistency check
- `AppState` defined in `src/types.ts`, used consistently across all components
- `AppAction` discriminated union covers all dispatches used in components
- `filtersToCSS(f: FilterState)` exported from `src/types.ts`, used in DocPane
- `renderNoiseMap(result, canvas, width, height)` — NoiseModule passes `imageElement.naturalWidth/Height` correctly
- `GhostModule` uses `result.levels[levelIndex]` — level index 0–3, `max={3}` on slider ✓
- `ForensicsContent` passes `ghostLevelIndex` from state to `GhostModule` ✓

### Placeholder scan
- No "TBD" or "TODO" found
- All code blocks are complete
- All file paths are exact

---

**Plan complete and saved to `docs/superpowers/plans/2026-05-18-ui-redesign-react.md`.**

**Two execution options:**

**1. Subagent-Driven (recommended)** — Fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — Execute tasks in this session using executing-plans
