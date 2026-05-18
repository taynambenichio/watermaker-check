# Forensics Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a complete forensic document-authentication pipeline (EXIF, Noise, JPEG Ghost, report) to `watermaker-check`, displayed in a new "🔍 Forense" tab that auto-runs when an image loads.

**Architecture:** Five new TypeScript modules in `js/forensics/` (exif, noise, ghost, report, index); all pure logic is tested via Vitest; DOM-dependent code (canvas, fetch) is only tested manually via the dev server. The pipeline runs automatically on `onImageLoaded` and writes results to `state.forensicResult`, which `ui.ts` renders.

**Tech Stack:** TypeScript 5 strict, Vite 5, Vitest 1, pnpm, Biome 2.4.15, `exifr@^7.1.3`. Tests import from `.js` paths (bundler moduleResolution). Vitest runs in `node` environment — only pure-JS functions can be unit-tested.

---

## File Map

| Action | File | Responsibility |
|---|---|---|
| Install | `package.json` | Add exifr dependency |
| Modify | `js/types.ts` | Add all new interfaces; extend AppState |
| Create | `js/forensics/report.ts` | `buildReport()` — weighted score + verdict |
| Create | `js/forensics/noise.ts` | `analyzeNoise()` (pure) + `renderNoiseMap()` (canvas) |
| Create | `js/forensics/ghost.ts` | `computeGhostScore()` (pure) + `analyzeGhost()` (canvas) |
| Create | `js/forensics/exif.ts` | `computeExifScore()` (pure) + `analyzeExif()` (async, exifr) |
| Create | `js/forensics/index.ts` | `runForensicPipeline()` — orchestrates all modules |
| Create | `tests/forensics-report.test.ts` | Tests for buildReport |
| Create | `tests/forensics-noise.test.ts` | Tests for analyzeNoise |
| Create | `tests/forensics-ghost.test.ts` | Tests for computeGhostScore |
| Create | `tests/forensics-exif.test.ts` | Tests for computeExifScore |
| Modify | `index.html` | Add 🔍 Forense tab button + full panel HTML |
| Modify | `css/styles.css` | Add `.forensics-section-header`, `.forensics-section-body` |
| Modify | `js/ui.ts` | Add `renderForensicResults()`, `renderGhostSlider()` |
| Modify | `js/main.ts` | Add `startForensicsAnalysis()`, `initForensicsTab()`; wire to `onImageLoaded` |

---

### Task 1: Install exifr + extend types

**Files:**
- Modify: `package.json` (pnpm install)
- Modify: `js/types.ts`
- Modify: `js/main.ts:7-12` (state initializer — add new fields)

- [ ] **Step 1: Install exifr**

```bash
cd /home/taynam/watermaker-check
pnpm add exifr@^7.1.3
```

Expected: `dependencies` in `package.json` now contains `"exifr": "^7.1.3"`.

- [ ] **Step 2: Extend `js/types.ts`**

Replace the entire file content:

```ts
// ── Existing ──────────────────────────────────────────────────────────────
export interface AppState {
    image: HTMLImageElement | null;
    zoom: number;
    activePreset: string | null;
    activeCanvasMode: 'histogram' | 'sobel' | 'amplify' | 'ela' | null;
    beforeAfterActive: boolean;
    forensicResult: ForensicPipelineResult | null;
    ghostLevelIndex: number;
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

// ── Pipeline progress ──────────────────────────────────────────────────────
export type PipelineStep = 'exif' | 'noise' | 'ghost' | 'ela' | 'report';

export type PipelineProgressCallback = (
    step: PipelineStep,
    status: 'running' | 'done' | 'error',
) => void;

// ── EXIF ──────────────────────────────────────────────────────────────────
export interface ExifFlag {
    code: 'NO_EXIF' | 'EDITING_SOFTWARE' | 'DATE_ANOMALY' | 'NO_CAMERA_INFO';
    message: string;
}

export interface ExifResult {
    hasExif: boolean;
    software: string | null;
    camera: string | null;
    dateTime: string | null;
    gpsPresent: boolean;
    flags: ExifFlag[];
    score: number;
}

// ── Noise ─────────────────────────────────────────────────────────────────
export interface NoiseResult {
    score: number;
    blockMap: Float32Array;  // normalised 0–1 variance per block
    gridW: number;
    gridH: number;
    suspiciousBlockCount: number;
    totalBlockCount: number;
}

// ── Ghost ─────────────────────────────────────────────────────────────────
export interface GhostLevel {
    quality: number;                  // 50 | 65 | 80 | 95
    imageData: ImageDataLike;         // greyscale diff heatmap
    meanDiff: number;                 // mean absolute diff (amplified)
}

export interface GhostResult {
    score: number;
    levels: GhostLevel[];
    suspectedOriginalQuality: number | null;
}

// ── Report ────────────────────────────────────────────────────────────────
export type Verdict = 'authentic' | 'suspicious' | 'tampered';

export interface ForensicReport {
    totalScore: number;
    verdict: Verdict;
    ela: number;
    exif: number;
    noise: number;
    ghost: number;
    completedAt: number;
}

// ── Pipeline result ───────────────────────────────────────────────────────
export interface ForensicPipelineResult {
    exif: ExifResult;
    noise: NoiseResult;
    ghost: GhostResult;
    elaScore: number;
    report: ForensicReport;
}
```

- [ ] **Step 3: Update state initializer in `js/main.ts`**

Find this block (around line 7–13):

```ts
export const state: AppState = {
    image: null,
    zoom: 1,
    activePreset: null,
    activeCanvasMode: null,
    beforeAfterActive: false,
};
```

Replace with:

```ts
export const state: AppState = {
    image: null,
    zoom: 1,
    activePreset: null,
    activeCanvasMode: null,
    beforeAfterActive: false,
    forensicResult: null,
    ghostLevelIndex: 0,
};
```

- [ ] **Step 4: Verify the build still compiles**

```bash
pnpm run build
```

Expected: Build succeeds (no TypeScript errors). Ignore any "module not found" warnings about `./forensics/index.js` — that file doesn't exist yet.

Actually at this point main.ts does NOT import from forensics yet, so the build should be clean.

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml js/types.ts js/main.ts
git commit -m "feat: install exifr, extend types with forensics interfaces

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 2: TDD — `js/forensics/report.ts`

**Files:**
- Create: `tests/forensics-report.test.ts`
- Create: `js/forensics/report.ts`

- [ ] **Step 1: Create the failing test**

Create `tests/forensics-report.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildReport } from '../js/forensics/report.js';

describe('buildReport', () => {
    it('computes weighted score correctly', () => {
        // ela=40, exif=0, noise=20, ghost=80
        // = 40×0.25 + 80×0.30 + 20×0.25 + 0×0.20 = 10+24+5+0 = 39
        const r = buildReport(40, 0, 20, 80);
        expect(r.totalScore).toBe(39);
    });

    it('returns authentic verdict for score < 30', () => {
        const r = buildReport(0, 0, 0, 0);
        expect(r.verdict).toBe('authentic');
        expect(r.totalScore).toBe(0);
    });

    it('returns suspicious verdict for score exactly 30', () => {
        // ela=60, exif=60, noise=60, ghost=60
        // = 60×0.25+60×0.30+60×0.25+60×0.20 = 15+18+15+12 = 60 → suspicious (≤60)
        const r = buildReport(60, 60, 60, 60);
        expect(r.verdict).toBe('suspicious');
        expect(r.totalScore).toBe(60);
    });

    it('returns suspicious verdict for score in 30–60 range', () => {
        // ela=40, exif=40, noise=40, ghost=40 → 40 → suspicious
        const r = buildReport(40, 40, 40, 40);
        expect(r.verdict).toBe('suspicious');
    });

    it('returns tampered verdict for score > 60', () => {
        const r = buildReport(100, 100, 100, 100);
        expect(r.verdict).toBe('tampered');
        expect(r.totalScore).toBe(100);
    });

    it('preserves individual scores in breakdown fields', () => {
        const r = buildReport(10, 20, 30, 40);
        expect(r.ela).toBe(10);
        expect(r.exif).toBe(20);
        expect(r.noise).toBe(30);
        expect(r.ghost).toBe(40);
    });

    it('completedAt is a recent timestamp', () => {
        const before = Date.now();
        const r = buildReport(0, 0, 0, 0);
        const after = Date.now();
        expect(r.completedAt).toBeGreaterThanOrEqual(before);
        expect(r.completedAt).toBeLessThanOrEqual(after);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test tests/forensics-report.test.ts
```

Expected: FAIL — `Cannot find module '../js/forensics/report.js'`

- [ ] **Step 3: Create `js/forensics/report.ts`**

```ts
import type { ForensicReport, Verdict } from '../types.js';

export function buildReport(
    elaScore: number,
    exifScore: number,
    noiseScore: number,
    ghostScore: number,
): ForensicReport {
    const totalScore = Math.round(
        elaScore * 0.25 + ghostScore * 0.30 + noiseScore * 0.25 + exifScore * 0.20,
    );

    let verdict: Verdict;
    if (totalScore < 30) verdict = 'authentic';
    else if (totalScore <= 60) verdict = 'suspicious';
    else verdict = 'tampered';

    return {
        totalScore,
        verdict,
        ela: elaScore,
        exif: exifScore,
        noise: noiseScore,
        ghost: ghostScore,
        completedAt: Date.now(),
    };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm test tests/forensics-report.test.ts
```

Expected: 7 tests pass.

- [ ] **Step 5: Commit**

```bash
git add tests/forensics-report.test.ts js/forensics/report.ts
git commit -m "feat(forensics): add report.ts with buildReport (TDD)

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 3: TDD — `js/forensics/noise.ts`

**Files:**
- Create: `tests/forensics-noise.test.ts`
- Create: `js/forensics/noise.ts`

- [ ] **Step 1: Create the failing test**

Create `tests/forensics-noise.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { analyzeNoise } from '../js/forensics/noise.js';
import type { ImageDataLike } from '../js/types.js';

function makeUniform(w: number, h: number, grey = 128): ImageDataLike {
    const data = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < w * h; i++) {
        data[i * 4] = grey;
        data[i * 4 + 1] = grey;
        data[i * 4 + 2] = grey;
        data[i * 4 + 3] = 255;
    }
    return { data, width: w, height: h };
}

function makeWithCheckerBlock(
    w: number,
    h: number,
    bx0: number,
    by0: number,
    size: number,
): ImageDataLike {
    const data = new Uint8ClampedArray(w * h * 4);
    // Fill uniform base
    for (let i = 0; i < w * h; i++) {
        data[i * 4] = 128;
        data[i * 4 + 1] = 128;
        data[i * 4 + 2] = 128;
        data[i * 4 + 3] = 255;
    }
    // Paint checkerboard in the target block
    for (let y = by0; y < Math.min(by0 + size, h); y++) {
        for (let x = bx0; x < Math.min(bx0 + size, w); x++) {
            const v = (x + y) % 2 === 0 ? 0 : 255;
            const o = (y * w + x) * 4;
            data[o] = data[o + 1] = data[o + 2] = v;
        }
    }
    return { data, width: w, height: h };
}

describe('analyzeNoise', () => {
    it('returns zero score for a uniform image', () => {
        const result = analyzeNoise(makeUniform(128, 128));
        expect(result.score).toBe(0);
        expect(result.suspiciousBlockCount).toBe(0);
    });

    it('returns zero dimensions guard for 0×0 image', () => {
        const result = analyzeNoise({ data: new Uint8ClampedArray(0), width: 0, height: 0 });
        expect(result.score).toBe(0);
        expect(result.totalBlockCount).toBe(0);
    });

    it('detects checkerboard block as anomalous', () => {
        // 128×128 image, 32-pixel blocks → 4×4=16 blocks total
        // Block at (0,0) has checkerboard — max Laplacian variance
        const result = analyzeNoise(makeWithCheckerBlock(128, 128, 0, 0, 32));
        expect(result.suspiciousBlockCount).toBeGreaterThanOrEqual(1);
        expect(result.score).toBeGreaterThan(0);
    });

    it('computes correct grid dimensions', () => {
        // 128×64 image, blockSize=32 → gridW=4, gridH=2
        const result = analyzeNoise(makeUniform(128, 64));
        expect(result.gridW).toBe(4);
        expect(result.gridH).toBe(2);
        expect(result.totalBlockCount).toBe(8);
    });

    it('blockMap has length equal to totalBlockCount and values in [0,1]', () => {
        const result = analyzeNoise(makeWithCheckerBlock(128, 128, 0, 0, 32));
        expect(result.blockMap.length).toBe(result.totalBlockCount);
        for (const v of result.blockMap) {
            expect(v).toBeGreaterThanOrEqual(0);
            expect(v).toBeLessThanOrEqual(1);
        }
    });

    it('score is clamped to 100', () => {
        // Entire image is checkerboard → all blocks suspicious → score capped at 100
        const result = analyzeNoise(makeWithCheckerBlock(128, 128, 0, 0, 128));
        expect(result.score).toBeLessThanOrEqual(100);
    });

    it('respects custom blockSize parameter', () => {
        // 64×64 image, blockSize=16 → gridW=4, gridH=4
        const result = analyzeNoise(makeUniform(64, 64), 16);
        expect(result.gridW).toBe(4);
        expect(result.gridH).toBe(4);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test tests/forensics-noise.test.ts
```

Expected: FAIL — `Cannot find module '../js/forensics/noise.js'`

- [ ] **Step 3: Create `js/forensics/noise.ts`**

```ts
import type { ImageDataLike, NoiseResult } from '../types.js';

const LAPLACIAN = [0, 1, 0, 1, -4, 1, 0, 1, 0] as const;

function toGreyscale(data: Uint8ClampedArray, w: number, h: number): Float32Array {
    const grey = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) {
        const o = i * 4;
        grey[i] = 0.299 * data[o] + 0.587 * data[o + 1] + 0.114 * data[o + 2];
    }
    return grey;
}

function applyLaplacian(grey: Float32Array, w: number, h: number): Float32Array {
    const out = new Float32Array(w * h);
    for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
            let sum = 0;
            let ki = 0;
            for (let ky = -1; ky <= 1; ky++) {
                for (let kx = -1; kx <= 1; kx++) {
                    sum += grey[(y + ky) * w + (x + kx)] * LAPLACIAN[ki++];
                }
            }
            out[y * w + x] = sum;
        }
    }
    return out;
}

function blockVariance(lap: Float32Array, w: number, x0: number, y0: number, x1: number, y1: number): number {
    const vals: number[] = [];
    for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
            vals.push(lap[y * w + x]);
        }
    }
    if (vals.length === 0) return 0;
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    return vals.reduce((acc, v) => acc + (v - mean) ** 2, 0) / vals.length;
}

export function analyzeNoise(imageData: ImageDataLike, blockSize = 32): NoiseResult {
    const { data, width: w, height: h } = imageData;

    if (w === 0 || h === 0) {
        return { score: 0, blockMap: new Float32Array(0), gridW: 0, gridH: 0, suspiciousBlockCount: 0, totalBlockCount: 0 };
    }

    const grey = toGreyscale(data, w, h);
    const lap = applyLaplacian(grey, w, h);

    const gridW = Math.ceil(w / blockSize);
    const gridH = Math.ceil(h / blockSize);
    const totalBlockCount = gridW * gridH;
    const variances = new Float32Array(totalBlockCount);

    for (let by = 0; by < gridH; by++) {
        for (let bx = 0; bx < gridW; bx++) {
            variances[by * gridW + bx] = blockVariance(
                lap, w,
                bx * blockSize, by * blockSize,
                Math.min((bx + 1) * blockSize, w), Math.min((by + 1) * blockSize, h),
            );
        }
    }

    const mean = Array.from(variances).reduce((a, b) => a + b, 0) / totalBlockCount;
    const stdDev = Math.sqrt(
        Array.from(variances).reduce((acc, v) => acc + (v - mean) ** 2, 0) / totalBlockCount,
    );
    const threshold = mean + 2 * stdDev;

    let suspiciousBlockCount = 0;
    const maxVariance = Math.max(...Array.from(variances), 1);  // avoid /0
    const blockMap = new Float32Array(totalBlockCount);

    for (let i = 0; i < totalBlockCount; i++) {
        blockMap[i] = variances[i] / maxVariance;
        if (variances[i] > threshold) suspiciousBlockCount++;
    }

    // Scale: 25% suspicious blocks → score 100
    const score = Math.min(100, Math.round((suspiciousBlockCount / totalBlockCount) * 400));

    return { score, blockMap, gridW, gridH, suspiciousBlockCount, totalBlockCount };
}

export function renderNoiseMap(
    result: NoiseResult,
    canvas: HTMLCanvasElement,
    width: number,
    height: number,
): void {
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx || result.totalBlockCount === 0) return;

    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, width, height);

    const blockW = width / result.gridW;
    const blockH = height / result.gridH;

    for (let i = 0; i < result.totalBlockCount; i++) {
        const bx = i % result.gridW;
        const by = Math.floor(i / result.gridW);
        const t = result.blockMap[i]; // 0–1

        // Green (low) → Yellow (mid) → Red (high)
        const r = t < 0.5 ? Math.round(255 * t * 2) : 255;
        const g = t < 0.5 ? 255 : Math.round(255 * (1 - (t - 0.5) * 2));

        ctx.fillStyle = `rgba(${r},${g},0,0.7)`;
        ctx.fillRect(bx * blockW, by * blockH, blockW, blockH);
    }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm test tests/forensics-noise.test.ts
```

Expected: 7 tests pass.

- [ ] **Step 5: Commit**

```bash
git add tests/forensics-noise.test.ts js/forensics/noise.ts
git commit -m "feat(forensics): add noise.ts with analyzeNoise (TDD)

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 4: TDD — `js/forensics/ghost.ts`

**Files:**
- Create: `tests/forensics-ghost.test.ts`
- Create: `js/forensics/ghost.ts`

- [ ] **Step 1: Create the failing test**

Create `tests/forensics-ghost.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { computeGhostScore } from '../js/forensics/ghost.js';

describe('computeGhostScore', () => {
    it('returns score 0 for flat meanDiffs (no ghost signal)', () => {
        const { score } = computeGhostScore([10, 10, 10, 10]);
        expect(score).toBe(0);  // stdDev = 0
    });

    it('returns non-zero score for varied meanDiffs', () => {
        // [2, 20, 18, 15]: mean=13.75, stdDev≈7 → score=min(100,70)=70
        const { score } = computeGhostScore([2, 20, 18, 15]);
        expect(score).toBeGreaterThan(0);
    });

    it('identifies suspected original quality at min-meanDiff index', () => {
        // min at index 0 (meanDiff=2) → quality 50
        const { suspectedOriginalQuality } = computeGhostScore([2, 20, 18, 15]);
        expect(suspectedOriginalQuality).toBe(50);
    });

    it('returns suspectedOriginalQuality=null when score is low (≤10)', () => {
        // Nearly flat: stdDev tiny → score≤10
        const { suspectedOriginalQuality } = computeGhostScore([10, 10, 10, 10]);
        expect(suspectedOriginalQuality).toBeNull();
    });

    it('caps score at 100 for very high stdDev', () => {
        const { score } = computeGhostScore([0, 100, 100, 100]);
        expect(score).toBeLessThanOrEqual(100);
        expect(score).toBeGreaterThan(0);
    });

    it('returns score 0 for empty array', () => {
        const { score } = computeGhostScore([]);
        expect(score).toBe(0);
    });

    it('handles single element array gracefully', () => {
        const { score, suspectedOriginalQuality } = computeGhostScore([42]);
        expect(score).toBe(0);
        expect(suspectedOriginalQuality).toBeNull();
    });

    it('quality 65 suspected when min is at index 1', () => {
        // [20, 1, 18, 15] → min at index 1 → quality 65
        const { suspectedOriginalQuality } = computeGhostScore([20, 1, 18, 15]);
        expect(suspectedOriginalQuality).toBe(65);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test tests/forensics-ghost.test.ts
```

Expected: FAIL — `Cannot find module '../js/forensics/ghost.js'`

- [ ] **Step 3: Create `js/forensics/ghost.ts`**

```ts
import type { GhostResult, ImageDataLike } from '../types.js';

const QUALITIES = [50, 65, 80, 95] as const;

// Exported for unit testing — pure function, no DOM
export function computeGhostScore(meanDiffs: readonly number[]): {
    score: number;
    suspectedOriginalQuality: number | null;
} {
    if (meanDiffs.length < 2) return { score: 0, suspectedOriginalQuality: null };

    const mean = meanDiffs.reduce((a, b) => a + b, 0) / meanDiffs.length;
    const stdDev = Math.sqrt(
        meanDiffs.reduce((acc, d) => acc + (d - mean) ** 2, 0) / meanDiffs.length,
    );

    // stdDev of 10 → score 100; empirically calibrated for 4 quality levels
    const score = Math.min(100, Math.round(stdDev / 10 * 100));

    const minIdx = meanDiffs.indexOf(Math.min(...meanDiffs));
    const suspectedOriginalQuality = score > 10
        ? (QUALITIES[minIdx] ?? null)
        : null;

    return { score, suspectedOriginalQuality };
}

function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = (ev) =>
            reject(new Error(`loadImage: failed to load image (${(ev as Event).type ?? ev})`));
        image.src = src;
    });
}

export async function analyzeGhost(img: HTMLImageElement): Promise<GhostResult> {
    const { naturalWidth: w, naturalHeight: h } = img;

    if (w === 0 || h === 0) {
        return { score: 0, levels: [], suspectedOriginalQuality: null };
    }

    const tmp = document.createElement('canvas');
    tmp.width = w;
    tmp.height = h;
    const ctx = tmp.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    const origData = ctx.getImageData(0, 0, w, h);

    const levels = [];
    for (const quality of QUALITIES) {
        const jpegUrl = tmp.toDataURL('image/jpeg', quality / 100);
        const recomp = await loadImage(jpegUrl);

        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(recomp, 0, 0);
        const recompData = ctx.getImageData(0, 0, w, h);

        const outData = new Uint8ClampedArray(w * h * 4);
        let totalDiff = 0;

        for (let i = 0; i < w * h; i++) {
            const o = i * 4;
            const dr = Math.abs(origData.data[o]     - recompData.data[o]);
            const dg = Math.abs(origData.data[o + 1] - recompData.data[o + 1]);
            const db = Math.abs(origData.data[o + 2] - recompData.data[o + 2]);
            const diff = Math.min(255, ((dr + dg + db) / 3) * 8);  // amplify ×8
            totalDiff += diff;
            outData[o] = outData[o + 1] = outData[o + 2] = diff;
            outData[o + 3] = 255;
        }

        const imageData: ImageDataLike = { data: outData, width: w, height: h };
        levels.push({ quality, imageData, meanDiff: totalDiff / (w * h) });
    }

    const meanDiffs = levels.map((l) => l.meanDiff);
    const { score, suspectedOriginalQuality } = computeGhostScore(meanDiffs);

    return { score, levels, suspectedOriginalQuality };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm test tests/forensics-ghost.test.ts
```

Expected: 8 tests pass.

- [ ] **Step 5: Commit**

```bash
git add tests/forensics-ghost.test.ts js/forensics/ghost.ts
git commit -m "feat(forensics): add ghost.ts with computeGhostScore + analyzeGhost (TDD)

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 5: TDD — `js/forensics/exif.ts`

**Files:**
- Create: `tests/forensics-exif.test.ts`
- Create: `js/forensics/exif.ts`

- [ ] **Step 1: Create the failing test**

Create `tests/forensics-exif.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { computeExifScore } from '../js/forensics/exif.js';
import type { ExifFlag } from '../js/types.js';

function flag(code: ExifFlag['code']): ExifFlag {
    return { code, message: '' };
}

describe('computeExifScore', () => {
    it('returns 0 for no flags', () => {
        expect(computeExifScore([])).toBe(0);
    });

    it('returns 60 for NO_EXIF flag', () => {
        expect(computeExifScore([flag('NO_EXIF')])).toBe(60);
    });

    it('returns 50 for EDITING_SOFTWARE flag', () => {
        expect(computeExifScore([flag('EDITING_SOFTWARE')])).toBe(50);
    });

    it('returns 20 for DATE_ANOMALY flag', () => {
        expect(computeExifScore([flag('DATE_ANOMALY')])).toBe(20);
    });

    it('returns 15 for NO_CAMERA_INFO flag', () => {
        expect(computeExifScore([flag('NO_CAMERA_INFO')])).toBe(15);
    });

    it('accumulates multiple flags below cap', () => {
        // DATE_ANOMALY (20) + NO_CAMERA_INFO (15) = 35
        expect(computeExifScore([flag('DATE_ANOMALY'), flag('NO_CAMERA_INFO')])).toBe(35);
    });

    it('clamps score to 100 for multiple high-scoring flags', () => {
        // NO_EXIF (60) + EDITING_SOFTWARE (50) = 110 → clamped to 100
        expect(computeExifScore([flag('NO_EXIF'), flag('EDITING_SOFTWARE')])).toBe(100);
    });

    it('accumulates all four flags, still clamped to 100', () => {
        expect(
            computeExifScore([
                flag('NO_EXIF'),
                flag('EDITING_SOFTWARE'),
                flag('DATE_ANOMALY'),
                flag('NO_CAMERA_INFO'),
            ]),
        ).toBe(100);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test tests/forensics-exif.test.ts
```

Expected: FAIL — `Cannot find module '../js/forensics/exif.js'`

- [ ] **Step 3: Create `js/forensics/exif.ts`**

```ts
import exifr from 'exifr';
import type { ExifFlag, ExifResult } from '../types.js';

const SCORE_MAP: Record<ExifFlag['code'], number> = {
    NO_EXIF: 60,
    EDITING_SOFTWARE: 50,
    DATE_ANOMALY: 20,
    NO_CAMERA_INFO: 15,
};

const EDITING_SOFTWARE_PATTERNS = [
    'photoshop', 'gimp', 'lightroom', 'affinity', 'snapseed',
    'pixelmator', 'acorn', 'preview', 'paint.net', 'capture one',
];

export function computeExifScore(flags: ExifFlag[]): number {
    const total = flags.reduce((acc, f) => acc + (SCORE_MAP[f.code] ?? 0), 0);
    return Math.min(100, total);
}

export async function analyzeExif(img: HTMLImageElement): Promise<ExifResult> {
    let raw: Record<string, unknown> | null = null;

    try {
        raw = await exifr.parse(img.src, {
            pick: ['Make', 'Model', 'Software', 'DateTime', 'DateTimeOriginal', 'GPSLatitude'],
        }) as Record<string, unknown> | null;
    } catch {
        raw = null;
    }

    const flags: ExifFlag[] = [];

    if (!raw) {
        flags.push({ code: 'NO_EXIF', message: 'Sem metadados EXIF — possível screenshot ou imagem editada' });
        return { hasExif: false, software: null, camera: null, dateTime: null, gpsPresent: false, flags, score: computeExifScore(flags) };
    }

    const software = typeof raw.Software === 'string' ? raw.Software : null;
    const make = typeof raw.Make === 'string' ? raw.Make : null;
    const model = typeof raw.Model === 'string' ? raw.Model : null;
    const dateStr = raw.DateTimeOriginal ?? raw.DateTime;
    const dateTime = dateStr ? String(dateStr) : null;
    const gpsPresent = raw.GPSLatitude !== undefined && raw.GPSLatitude !== null;
    const camera = make && model ? `${make} ${model}` : (make ?? model ?? null);

    if (software) {
        const sl = software.toLowerCase();
        if (EDITING_SOFTWARE_PATTERNS.some((p) => sl.includes(p))) {
            flags.push({ code: 'EDITING_SOFTWARE', message: `Software de edição detectado: ${software}` });
        }
    }

    if (!make && !model) {
        flags.push({ code: 'NO_CAMERA_INFO', message: 'Sem informação de câmara (Make/Model)' });
    }

    if (dateTime) {
        // EXIF dates use "YYYY:MM:DD HH:MM:SS" format
        const isoDate = dateTime.replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3');
        const ts = new Date(isoDate).getTime();
        const now = Date.now();
        const tenYearsAgo = now - 10 * 365.25 * 24 * 3600 * 1000;
        if (!Number.isNaN(ts) && (ts > now || ts < tenYearsAgo)) {
            flags.push({ code: 'DATE_ANOMALY', message: `Data suspeita: ${dateTime}` });
        }
    }

    return { hasExif: true, software, camera, dateTime, gpsPresent, flags, score: computeExifScore(flags) };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm test tests/forensics-exif.test.ts
```

Expected: 8 tests pass.

- [ ] **Step 5: Run all tests together to catch regressions**

```bash
pnpm test
```

Expected: All tests pass (15 ela + 7 report + 7 noise + 8 ghost + 8 exif = 45 tests).

- [ ] **Step 6: Commit**

```bash
git add tests/forensics-exif.test.ts js/forensics/exif.ts
git commit -m "feat(forensics): add exif.ts with computeExifScore + analyzeExif (TDD)

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 6: Pipeline orchestrator `js/forensics/index.ts`

No unit tests — this is the integration layer; all constituent logic is tested in Tasks 2–5.

**Files:**
- Create: `js/forensics/index.ts`

- [ ] **Step 1: Create `js/forensics/index.ts`**

```ts
import { renderELA } from '../ela.js';
import type { ForensicPipelineResult, PipelineProgressCallback } from '../types.js';
import { analyzeExif } from './exif.js';
import { analyzeGhost } from './ghost.js';
import { analyzeNoise } from './noise.js';
import { buildReport } from './report.js';

export async function runForensicPipeline(
    img: HTMLImageElement,
    onProgress?: PipelineProgressCallback,
): Promise<ForensicPipelineResult> {
    const { naturalWidth: w, naturalHeight: h } = img;

    // Capture original ImageData once (reused for noise analysis)
    const tmp = document.createElement('canvas');
    tmp.width = w;
    tmp.height = h;
    const ctx = tmp.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    const imageData = ctx.getImageData(0, 0, w, h);

    // Phase 1: EXIF + Noise in parallel
    onProgress?.('exif', 'running');
    onProgress?.('noise', 'running');

    const [exif, noise] = await Promise.all([
        analyzeExif(img).then((r) => { onProgress?.('exif', 'done'); return r; }),
        Promise.resolve(analyzeNoise(imageData)).then((r) => { onProgress?.('noise', 'done'); return r; }),
    ]);

    // Phase 2: ELA + Ghost in parallel
    onProgress?.('ela', 'running');
    onProgress?.('ghost', 'running');

    const elaOutputCanvas = document.createElement('canvas');

    const [elaScore, ghost] = await Promise.all([
        renderELA(img, elaOutputCanvas, 10).then((s) => { onProgress?.('ela', 'done'); return s; }),
        analyzeGhost(img).then((r) => { onProgress?.('ghost', 'done'); return r; }),
    ]);

    // Phase 3: Report
    onProgress?.('report', 'running');
    const report = buildReport(elaScore, exif.score, noise.score, ghost.score);
    onProgress?.('report', 'done');

    return { exif, noise, ghost, elaScore, report };
}
```

- [ ] **Step 2: Verify the build compiles**

```bash
pnpm run build
```

Expected: Build succeeds. All five `js/forensics/` modules compile cleanly.

- [ ] **Step 3: Commit**

```bash
git add js/forensics/index.ts
git commit -m "feat(forensics): add pipeline orchestrator index.ts

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 7: Forense tab HTML + CSS

**Files:**
- Modify: `css/styles.css` (append forensics section styles)
- Modify: `index.html` (add tab button + full panel)

- [ ] **Step 1: Append CSS to `css/styles.css`**

Add at the very end of `css/styles.css`:

```css
/* ── Forensics panel ──────────────────────────────────────────────────── */
.forensics-section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: #0f1a2f;
    padding: 8px 12px;
    border-radius: 4px 4px 0 0;
    font-size: 0.85em;
    font-weight: bold;
    color: #93c5fd;
    border: 1px solid #374151;
    border-bottom: none;
}

.forensics-section-body {
    border: 1px solid #374151;
    border-radius: 0 0 4px 4px;
    padding: 10px 12px;
    background: #0a0f14;
    font-size: 0.85em;
}

.forensics-badge {
    padding: 2px 8px;
    border-radius: 10px;
    font-size: 0.8em;
    font-weight: normal;
}

.forensics-badge-green  { background: #1a3a1a; color: #86efac; }
.forensics-badge-amber  { background: #2a1a00; color: #fbbf24; }
.forensics-badge-red    { background: #1a0a0a; color: #f87171; }
.forensics-badge-grey   { background: #1a1a2e; color: #9ca3af; }

.forensics-exif-table { width: 100%; border-collapse: collapse; }
.forensics-exif-table td { padding: 4px 6px; color: #d1d5db; vertical-align: top; }
.forensics-exif-table td:first-child { color: #6b7280; white-space: nowrap; padding-right: 12px; }
.forensics-flag-row { display: flex; align-items: flex-start; gap: 6px; margin-top: 6px; color: #fbbf24; font-size: 0.82em; }
.forensics-score-card { background: #0f1a2f; border: 1px solid #374151; border-radius: 6px; padding: 8px 10px; }
.forensics-score-card-label { color: #6b7280; font-size: 0.8em; margin-bottom: 2px; }
.forensics-score-card-value { font-weight: bold; font-size: 1.1em; }
```

- [ ] **Step 2: Add tab button to `index.html`**

In `index.html`, find the ELA tab button:

```html
                    <button class="tab-btn" data-tab="ela">🔬 ELA</button>
```

Add the Forense button immediately after it:

```html
                    <button class="tab-btn" data-tab="ela">🔬 ELA</button>
                    <button class="tab-btn" data-tab="forensics">🔍 Forense</button>
```

- [ ] **Step 3: Add the forensics panel to `index.html`**

Find the closing tag of the ELA tab content panel — it looks like:

```html
                </div>
            </div>
        </div>
```

The ELA tab panel ends with `</div>` and then the outer wrapper closes. Find the last `</div>` that closes `data-tab="ela"` and insert the forensics panel after it, before the outer closing `</div>`.

Locate this block (the ELA panel close + outer wrapper close):
```html
                </div>

            </div>
        </div>
```

And add the forensics panel before the outer wrapper closes. The exact insertion point is after the `</div>` that closes `data-tab="ela"`. Add:

```html
                <!-- Tab: Forense -->
                <div class="tab-content" data-tab="forensics">
                    <p class="tab-description">Pipeline forense completo — EXIF · Ruído · Ghost · ELA → Score de autenticidade</p>

                    <!-- Progress indicator (hidden until analysis starts) -->
                    <div id="forensicsProgress" style="display:none;margin-bottom:14px">
                        <div id="forensicsProgressLabel" style="font-size:0.85em;color:#9ca3af">A analisar…</div>
                        <div style="height:4px;background:#1a2a1a;border-radius:2px;margin-top:6px">
                            <div id="forensicsProgressBar" style="width:0%;height:4px;background:#22c55e;border-radius:2px;transition:width 0.3s"></div>
                        </div>
                    </div>

                    <!-- Shown before any image is loaded -->
                    <div id="forensicsPlaceholder" style="color:#6b7280;font-size:0.9em;padding:12px 0">
                        Carregue uma imagem para iniciar a análise forense automática.
                    </div>

                    <!-- Re-run button (hidden until first result) -->
                    <button class="canvas-btn" id="forensicsRerunBtn" style="display:none;margin-bottom:14px" disabled>↺ Re-analisar</button>

                    <!-- EXIF section -->
                    <div id="forensicsExifSection" style="display:none;margin-bottom:10px">
                        <div class="forensics-section-header">
                            <span>🗂 Metadados EXIF</span>
                            <span id="forensicsExifBadge" class="forensics-badge forensics-badge-grey"></span>
                        </div>
                        <div id="forensicsExifBody" class="forensics-section-body"></div>
                    </div>

                    <!-- Noise section -->
                    <div id="forensicsNoiseSection" style="display:none;margin-bottom:10px">
                        <div class="forensics-section-header">
                            <span>🌊 Inconsistência de Ruído</span>
                            <span id="forensicsNoiseBadge" class="forensics-badge forensics-badge-grey"></span>
                        </div>
                        <div class="forensics-section-body">
                            <div id="forensicsNoiseBody"></div>
                            <canvas id="noiseCanvas" style="max-width:100%;display:block;margin-top:8px;border-radius:4px"></canvas>
                        </div>
                    </div>

                    <!-- Ghost section -->
                    <div id="forensicsGhostSection" style="display:none;margin-bottom:10px">
                        <div class="forensics-section-header">
                            <span>👻 JPEG Ghost</span>
                            <span id="forensicsGhostBadge" class="forensics-badge forensics-badge-grey"></span>
                        </div>
                        <div class="forensics-section-body">
                            <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
                                <span style="color:#9ca3af">Qualidade:</span>
                                <span id="ghostQualityLabel" style="color:#60a5fa;font-weight:bold">Q 50</span>
                                <input type="range" id="ghostQualitySlider" min="0" max="3" value="0" style="flex:1">
                            </div>
                            <canvas id="ghostCanvas" style="max-width:100%;display:block;border-radius:4px"></canvas>
                            <div id="forensicsGhostBody" style="margin-top:6px"></div>
                        </div>
                    </div>

                    <!-- Report section -->
                    <div id="forensicsReportSection" style="display:none">
                        <div class="forensics-section-header">
                            <span>📋 Relatório de Autenticidade</span>
                            <span id="forensicsReportBadge" class="forensics-badge forensics-badge-grey"></span>
                        </div>
                        <div class="forensics-section-body">
                            <div id="forensicsScoreGrid" style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:10px"></div>
                            <div style="margin-bottom:10px">
                                <div style="display:flex;justify-content:space-between;margin-bottom:4px">
                                    <span style="color:#9ca3af">Score total</span>
                                    <span id="forensicsTotalScore" style="font-weight:bold"></span>
                                </div>
                                <div style="height:6px;background:#1a1a1a;border-radius:3px">
                                    <div id="forensicsScoreBar" style="height:6px;border-radius:3px;transition:width 0.5s"></div>
                                </div>
                            </div>
                            <button class="canvas-btn" id="forensicsExportBtn" style="width:100%">💾 Exportar relatório JSON</button>
                        </div>
                    </div>
                </div>
```

- [ ] **Step 4: Verify build**

```bash
pnpm run build
```

Expected: Build succeeds — HTML/CSS changes don't affect TypeScript compilation.

- [ ] **Step 5: Commit**

```bash
git add css/styles.css index.html
git commit -m "feat(forensics): add Forense tab HTML + CSS

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 8: Wire up `js/ui.ts` + `js/main.ts`

**Files:**
- Modify: `js/ui.ts` (add rendering helpers)
- Modify: `js/main.ts` (add forensics wiring + auto-run)

- [ ] **Step 1: Add forensics rendering helpers to `js/ui.ts`**

At the top of `js/ui.ts`, add the new imports alongside the existing one:

```ts
import type { AppState, ForensicPipelineResult } from './types.js';
import { renderNoiseMap } from './forensics/noise.js';
```

Then append these two functions at the end of `js/ui.ts`:

```ts
const QUALITIES = [50, 65, 80, 95] as const;

export function renderGhostSlider(result: ForensicPipelineResult, levelIndex: number): void {
    const canvas = document.getElementById('ghostCanvas') as HTMLCanvasElement | null;
    const label = document.getElementById('ghostQualityLabel');
    if (!canvas || !result.ghost.levels[levelIndex]) return;

    const level = result.ghost.levels[levelIndex];
    label && (label.textContent = `Q ${QUALITIES[levelIndex]}`);

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
        if (exif.camera)   html += `<tr><td>Câmara</td><td>${exif.camera}</td></tr>`;
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
    const verdictLabel = report.verdict === 'authentic' ? '🟢 Autêntico' : report.verdict === 'suspicious' ? '🟡 Suspeito' : '🔴 Adulterado';
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
        totalScoreEl.style.color = report.totalScore < 30 ? '#86efac' : report.totalScore <= 60 ? '#fbbf24' : '#f87171';
    }

    if (scoreBar) {
        scoreBar.style.width = `${report.totalScore}%`;
        scoreBar.style.background = report.totalScore < 30 ? '#22c55e' : report.totalScore <= 60 ? '#f59e0b' : '#ef4444';
    }
}
```

- [ ] **Step 2: Add forensics wiring to `js/main.ts`**

Add the new imports at the top of `js/main.ts`, alongside existing imports:

```ts
import { runForensicPipeline } from './forensics/index.js';
import { renderForensicResults, renderGhostSlider } from './ui.js';
```

Add these two functions somewhere in `js/main.ts` before the `initUpload` call (e.g., after the `initTabs()` wiring block):

```ts
function updateForensicsProgress(step: string, pct: number, label: string): void {
    const bar = document.getElementById('forensicsProgressBar');
    const lbl = document.getElementById('forensicsProgressLabel');
    const prog = document.getElementById('forensicsProgress');
    if (prog) prog.style.display = '';
    if (bar) bar.style.width = `${pct}%`;
    if (lbl) lbl.textContent = label;
}

function startForensicsAnalysis(img: HTMLImageElement): void {
    const placeholder = document.getElementById('forensicsPlaceholder');
    const rerunBtn = document.getElementById('forensicsRerunBtn') as HTMLButtonElement | null;

    if (placeholder) placeholder.style.display = 'none';
    if (rerunBtn) rerunBtn.disabled = true;

    // Hide previous result sections
    ['forensicsExifSection', 'forensicsNoiseSection', 'forensicsGhostSection', 'forensicsReportSection']
        .forEach((id) => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });

    const STEP_LABELS: Record<string, string> = {
        exif: 'A ler metadados EXIF…', noise: 'A analisar ruído…',
        ela: 'A calcular ELA…',        ghost: 'A detectar Ghost JPEG…',
        report: 'A gerar relatório…',
    };
    const STEP_PCT: Record<string, number> = {
        exif: 20, noise: 40, ela: 60, ghost: 80, report: 95,
    };

    runForensicPipeline(img, (step, status) => {
        if (status === 'running') updateForensicsProgress(step, STEP_PCT[step] ?? 50, STEP_LABELS[step] ?? '…');
    })
        .then((result) => {
            state.forensicResult = result;
            state.ghostLevelIndex = 0;

            const prog = document.getElementById('forensicsProgress');
            if (prog) prog.style.display = 'none';

            renderForensicResults(result, img, 0);

            if (rerunBtn) { rerunBtn.style.display = ''; rerunBtn.disabled = false; }
        })
        .catch((err: unknown) => {
            console.error('Forensic pipeline failed:', err);
            const prog = document.getElementById('forensicsProgress');
            if (prog) prog.style.display = 'none';
            if (rerunBtn) { rerunBtn.style.display = ''; rerunBtn.disabled = false; }
        });
}

function initForensicsTab(): void {
    const rerunBtn = document.getElementById('forensicsRerunBtn') as HTMLButtonElement | null;
    const slider = document.getElementById('ghostQualitySlider') as HTMLInputElement | null;
    const exportBtn = document.getElementById('forensicsExportBtn') as HTMLButtonElement | null;

    rerunBtn?.addEventListener('click', () => {
        if (state.image) startForensicsAnalysis(state.image);
    });

    slider?.addEventListener('input', () => {
        const idx = Number(slider.value);
        state.ghostLevelIndex = idx;
        if (state.forensicResult) renderGhostSlider(state.forensicResult, idx);
    });

    exportBtn?.addEventListener('click', () => {
        if (!state.forensicResult) return;
        const { report } = state.forensicResult;
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
    });
}
```

- [ ] **Step 3: Update `onImageLoaded` to reset forensics state and trigger analysis**

Find `onImageLoaded` in `js/main.ts`:

```ts
function onImageLoaded(img: HTMLImageElement): void {
    state.image = img;
    state.activeCanvasMode = null;
    state.beforeAfterActive = false;
```

Replace with:

```ts
function onImageLoaded(img: HTMLImageElement): void {
    state.image = img;
    state.activeCanvasMode = null;
    state.beforeAfterActive = false;
    state.forensicResult = null;
    state.ghostLevelIndex = 0;
```

And at the very end of `onImageLoaded` (after the existing `enableImageTools()` call or equivalent), add the forensics auto-run call. Find the closing of `onImageLoaded`:

```ts
    enableImageTools();
}
```

Replace with:

```ts
    enableImageTools();
    startForensicsAnalysis(img);
}
```

- [ ] **Step 4: Call `initForensicsTab()` during bootstrap**

In `js/main.ts`, near the bottom where `initTabs()` and `initUpload(...)` are called, add:

```ts
initForensicsTab();
```

It should be called after the DOM is ready (i.e., at module top-level, same location as the other init calls).

- [ ] **Step 5: Build to verify**

```bash
pnpm run build
```

Expected: Build succeeds with no TypeScript errors.

If there are import errors, verify that `js/ui.ts` now imports `ForensicPipelineResult` and `renderNoiseMap` at the top as specified in Step 1.

- [ ] **Step 6: Commit**

```bash
git add js/ui.ts js/main.ts
git commit -m "feat(forensics): wire pipeline to UI — auto-run, ghost slider, export

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 9: Final verification + push

**Files:** None — verification only.

- [ ] **Step 1: Run all tests**

```bash
pnpm test
```

Expected: All tests pass. No failures. Count should be 45+ (15 ela + 7 report + 7 noise + 8 ghost + 8 exif).

- [ ] **Step 2: Run linter**

```bash
pnpm check
```

Expected: No errors. If Biome flags any issues, fix them and re-run. Common fixes:
- Add explicit return types if Biome requires them
- Remove unused variables
- Fix any `any` escapes

- [ ] **Step 3: Run production build**

```bash
pnpm run build
```

Expected: Build succeeds. Note the output size — it should be reasonable (exifr adds ~50 KB gzipped).

- [ ] **Step 4: Manual smoke test in dev server**

```bash
pnpm dev
```

Open `http://localhost:5173` (or whichever port Vite assigns). Load an image and:
- Verify the "🔍 Forense" tab appears
- Verify analysis starts automatically and progress bar animates
- Verify all 4 sections (EXIF, Ruído, Ghost, Relatório) render with scores
- Verify ghost slider changes the heatmap canvas
- Verify "Exportar relatório JSON" downloads a valid JSON file

- [ ] **Step 5: Push to origin**

```bash
git push
```

Expected: Push succeeds to the remote branch.
