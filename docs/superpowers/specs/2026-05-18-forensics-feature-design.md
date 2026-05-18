# Forensics Feature Design

**Date:** 2026-05-18  
**Status:** Approved  
**Scope:** Aba "🔍 Forense" com pipeline completo de análise de autenticidade documental

---

## Problem

O projecto tem ELA implementado mas carece de um pipeline forense completo similar ao usado por Onfido / Jumio / iProov. Um único score (ELA) não é suficiente — documentos fraudulentos precisam de ser analisados em múltiplas camadas independentes.

---

## Approach

Implementar 4 módulos de análise isolados num directório `js/forensics/`, orquestrados por um pipeline central. Os módulos correm automaticamente ao carregar uma imagem e apresentam resultados numa aba "🔍 Forense" unificada.

---

## Architecture

### New files

```
js/forensics/
  exif.ts        → ExifResult
  noise.ts       → NoiseResult
  ghost.ts       → GhostResult
  report.ts      → ForensicReport
  index.ts       → runForensicPipeline()

tests/
  forensics-exif.test.ts
  forensics-noise.test.ts
  forensics-ghost.test.ts
  forensics-report.test.ts
```

### Modified files

- `js/types.ts` — add `ForensicReport`, `GhostLevel`, result interfaces, extend `AppState`
- `js/ui.ts` — add forensics UI helpers (progress, render results)
- `js/main.ts` — wire auto-run on `onImageLoaded`, init forensics tab
- `index.html` — add "🔍 Forense" tab + full panel HTML

---

## Module Specs

### `js/forensics/exif.ts`

Uses `exifr` npm package (browser-compatible, pure JS).

```ts
export interface ExifFlag {
  code: 'NO_EXIF' | 'EDITING_SOFTWARE' | 'DATE_ANOMALY' | 'NO_CAMERA_INFO';
  message: string;
}

export interface ExifResult {
  hasExif: boolean;
  software: string | null;       // e.g. "Adobe Photoshop 24.0"
  camera: string | null;         // e.g. "Apple iPhone 14"
  dateTime: string | null;       // ISO string or null
  gpsPresent: boolean;
  flags: ExifFlag[];             // suspicious signals
  score: number;                 // 0–100 (suspicion)
}

export async function analyzeExif(img: HTMLImageElement): Promise<ExifResult>
```

**Score logic:**
- Base: 0
- `NO_EXIF`: +60 (screenshot or stripped EXIF)
- `EDITING_SOFTWARE` (Photoshop/GIMP/Snapseed/Affinity): +50
- `DATE_ANOMALY` (future date, date > 10y ago): +20
- `NO_CAMERA_INFO` (no Make/Model): +15
- Score clamped to 0–100

**EXIF reading:** Fetch the image as Blob via `fetch(img.src)`, pass to `exifr.parse()`.

### `js/forensics/noise.ts`

Divides image into blocks and analyses noise texture variance per block using a Laplacian kernel. Outlier blocks (variance > mean + 2σ) are flagged as anomalous.

```ts
export interface NoiseResult {
  score: number;                   // 0–100 (suspicion)
  blockMap: Float32Array;          // normalised variance per block (0–1)
  gridW: number;                   // number of blocks horizontally
  gridH: number;                   // number of blocks vertically
  suspiciousBlockCount: number;
  totalBlockCount: number;
}

export function analyzeNoise(imageData: ImageDataLike, blockSize?: number): NoiseResult
// default blockSize = 32

export function renderNoiseMap(
  result: NoiseResult,
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
): void
```

**Algorithm:**
1. For each block: extract pixels, convert to greyscale
2. Apply 3×3 Laplacian kernel, compute variance of response
3. Build `blockMap` of variances normalised to [0, 1]
4. Compute mean (μ) and std dev (σ) of variances
5. Flag blocks where variance > μ + 2σ as suspicious
6. `score = round(suspiciousBlockCount / totalBlockCount * 100)` scaled by severity (max 100)
7. Render: draw coloured rectangles onto canvas (green → yellow → red based on deviation)

Pure function — no DOM except `renderNoiseMap`. Safe for Vitest.

### `js/forensics/ghost.ts`

JPEG double-compression ghost detection. Recompresses image at 4 quality levels and computes ELA-style difference at each level.

```ts
export interface GhostLevel {
  quality: number;          // 50 | 65 | 80 | 95
  imageData: ImageDataLike; // heatmap (greyscale diff amplified)
  meanDiff: number;         // mean absolute pixel difference (0–255)
}

export interface GhostResult {
  score: number;                    // 0–100 (suspicion)
  levels: GhostLevel[];             // 4 levels, ordered [50, 65, 80, 95]
  suspectedOriginalQuality: number | null;  // quality where ghost is most visible
}

export async function analyzeGhost(img: HTMLImageElement): Promise<GhostResult>
```

**Algorithm:**
1. Capture original ImageData
2. For each quality Q in [50, 65, 80, 95]:
   - Re-compress original canvas → JPEG at quality Q
   - Load back as ImageElement
   - Subtract pixel-by-pixel: `diff = |origR−recompR| + |origG−recompG| + |origB−recompB|`
   - Amplify × 8, store greyscale heatmap
   - Compute `meanDiff`
3. `suspectedOriginalQuality`: quality level with minimum `meanDiff` (original JPEG was likely saved at this quality)
4. `score`: if variance of `meanDiff` across levels is high → dupla compressão detectada → higher score

**Score formula:**
- Compute stdDev of `meanDiff` values across 4 levels
- High stdDev (>5) → score scaled linearly to 0–100
- Flat stdDev → near 0 (uniform — no ghost signal)

### `js/forensics/report.ts`

Aggregates all module scores into a final forensic report. Also accepts ELA score from existing `ela.ts`.

```ts
export type Verdict = 'authentic' | 'suspicious' | 'tampered';

export interface ForensicReport {
  totalScore: number;       // 0–100 weighted aggregate
  verdict: Verdict;         // authentic <30, suspicious 30–60, tampered >60
  ela: number;              // raw ELA score
  exif: number;             // raw EXIF score
  noise: number;            // raw noise score
  ghost: number;            // raw ghost score
  completedAt: number;      // Date.now()
}

export function buildReport(
  elaScore: number,
  exifScore: number,
  noiseScore: number,
  ghostScore: number,
): ForensicReport
```

**Weight formula:**
```
totalScore = ELA×0.25 + Ghost×0.30 + Noise×0.25 + EXIF×0.20
```

**Verdict:**
- `< 30` → `'authentic'` 🟢
- `30–60` → `'suspicious'` 🟡
- `> 60` → `'tampered'` 🔴

Pure function — trivially testable.

### `js/forensics/index.ts`

Pipeline orchestrator. Runs all 5 analyses (EXIF, Noise, Ghost, ELA, Report) and streams progress via callback.

ELA is computed internally via `computeELA` from `js/ela.ts` — no rendering, score only (amplification: 10 default). This avoids needing an ELA score at call time (ELA tab may not have been run yet when auto-run fires).

```ts
export interface ForensicPipelineResult {
  exif: ExifResult;
  noise: NoiseResult;
  ghost: GhostResult;
  elaScore: number;     // from computeELA, no canvas rendering
  report: ForensicReport;
}

export type PipelineStep = 'exif' | 'noise' | 'ghost' | 'ela' | 'report';

export type PipelineProgressCallback = (
  step: PipelineStep,
  status: 'running' | 'done' | 'error',
) => void;

export async function runForensicPipeline(
  img: HTMLImageElement,
  onProgress?: PipelineProgressCallback,
): Promise<ForensicPipelineResult>
```

**Execution order:** EXIF + Noise (parallel) → ELA + Ghost (parallel) → Report

---

## AppState Changes (`js/types.ts`)

```ts
export interface AppState {
  // ... existing fields ...
  forensicResult: ForensicPipelineResult | null;
  ghostLevelIndex: number;  // active slider index 0–3 → maps to [50, 65, 80, 95]
}
```

---

## UI (`index.html`)

New tab added to `.tab-nav`:
```html
<button class="tab-btn" data-tab="forensics">🔍 Forense</button>
```

Forensics tab panel contains (in order):
1. **Progress bar** `#forensicsProgress` — shows during analysis, hides on complete
2. **Re-analisar button** `#forensicsRerunBtn` — triggers manual re-run
3. **EXIF section** `#forensicsExifSection` — table with camera/software/date/GPS + badge
4. **Noise section** `#forensicsNoiseSection` — block heatmap canvas `#noiseCanvas` + anomaly count
5. **Ghost section** `#forensicsGhostSection` — quality slider `#ghostQualitySlider` (0–3) + canvas `#ghostCanvas` + label
6. **Report section** `#forensicsReportSection` — 4-score grid + progress bar + verdict badge + export button `#forensicsExportBtn`

All sections hidden until analysis completes.

---

## Auto-run behaviour (`js/main.ts`)

```ts
function onImageLoaded(img: HTMLImageElement): void {
  // ... existing reset code ...
  startForensicsAnalysis(img);  // fires and forgets
}
```

```ts
export async function startForensicsAnalysis(img: HTMLImageElement): Promise<void>
// Calls runForensicPipeline, updates state.forensicResult, renders UI
```

`startForensicsAnalysis` updates the Forense tab with progress as each step completes. If the user switches tabs mid-analysis, results still render when done.

---

## Export (`#forensicsExportBtn`)

Exports a JSON file:
```json
{
  "timestamp": "2026-05-18T16:00:00Z",
  "verdict": "tampered",
  "totalScore": 63,
  "breakdown": {
    "ela": 58, "ghost": 71, "noise": 44, "exif": 12
  }
}
```

---

## Tests

Each module has a dedicated test file using Vitest:

| File | Covers |
|---|---|
| `forensics-exif.test.ts` | Flag detection, score clamping, no-EXIF case |
| `forensics-noise.test.ts` | Block variance, outlier detection, zero-dim guard |
| `forensics-ghost.test.ts` | Score formula, suspected quality estimation |
| `forensics-report.test.ts` | Weight formula, verdict thresholds |

`analyzeExif` and `analyzeGhost` are async DOM functions — tested via integration where needed. Pure functions (`analyzeNoise`, `buildReport`) are fully unit-tested.

---

## Dependencies

Add to `package.json`:
```
exifr: ^7.1.3  (browser-compatible EXIF reader, no native deps)
```

---

## Non-goals

- No server-side analysis
- No OCR / MRZ reading
- No liveness detection
- No cross-document comparison
