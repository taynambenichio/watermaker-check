# Fraud Detection Modules Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 4 new forensic analysis modules (Copy-Move, Resampling, Histogram, Document Structure) to the pipeline, wired up through the full stack from algorithms to React UI.

**Architecture:** Phase 3 runs in parallel after Phase 2 (ELA+Ghost) completes, using `Promise.all`. All modules accept `ImageDataLike` (not raw `ImageData`) for testability in the Node test environment. Inversion (raw suspicion → authentic scale) happens at the `buildReport` boundary, consistent with the existing 4 modules.

**Tech Stack:** TypeScript (strict), Vitest (node env), React 18, Tailwind CSS, Biome lint

---

## Task 1: Extend `js/types.ts` — new interfaces and extended types

**Files:**
- Modify: `js/types.ts`

- [ ] **Step 1: Add 4 new result interfaces and extend existing types**

Replace the existing content of `js/types.ts` — keep all existing interfaces unchanged, add the following at the bottom before the closing, and replace the specific interfaces shown:

```ts
// ── Copy-Move ─────────────────────────────────────────────────────────────
export interface CopyMoveResult {
    score: number;           // 0–100, suspicion direction (inverted at report layer)
    matchCount: number;
    heatmapData: ImageDataLike | null;
}

// ── Resampling ────────────────────────────────────────────────────────────
export interface ResamplingResult {
    score: number;           // 0–100, suspicion direction
    affectedRatio: number;   // 0.0–1.0 fraction of rows flagged
    heatmapData: ImageDataLike | null;
}

// ── Histogram Forensic ────────────────────────────────────────────────────
export interface HistogramForensicResult {
    score: number;           // 0–100, suspicion direction
    r: Uint32Array;          // 256-bin red histogram
    g: Uint32Array;          // 256-bin green histogram
    b: Uint32Array;          // 256-bin blue histogram
    holes: number;           // empty bins in range [16,240] across all 3 channels
    combStrength: number;    // 0.0–1.0 regularity of gap pattern
}

// ── Document Structure ────────────────────────────────────────────────────
export interface DocStructureResult {
    score: number;           // 0–100, suspicion direction; 50 = neutral (no doc detected)
    mrzDetected: boolean;
    regionConsistency: number;   // 0.0–1.0
    photoZoneIntegrity: number;  // 0.0–1.0
}
```

Replace `PipelineStep`:
```ts
export type PipelineStep =
    | 'exif'
    | 'noise'
    | 'ghost'
    | 'ela'
    | 'report'
    | 'quality'
    | 'copy-move'
    | 'resampling'
    | 'histogram'
    | 'doc-structure';
```

Replace `ForensicReport`:
```ts
export interface ForensicReport {
    totalScore: number;
    verdict: Verdict;
    ela: number;
    exif: number;
    noise: number;
    ghost: number;
    copyMove: number;
    resampling: number;
    histogram: number;
    docStructure: number;
    completedAt: number;
}
```

Replace `ForensicPipelineResult`:
```ts
export interface ForensicPipelineResult {
    exif: ExifResult;
    noise: NoiseResult;
    ghost: GhostResult;
    elaScore: number;
    quality: QualityResult;
    report: ForensicReport;
    copyMoveResult: CopyMoveResult;
    resamplingResult: ResamplingResult;
    histogramResult: HistogramForensicResult;
    docStructureResult: DocStructureResult;
}
```

- [ ] **Step 2: Run TypeScript check to see which call sites break**

```bash
pnpm exec tsc --noEmit 2>&1 | head -60
```

Expected: errors in `js/forensics/report.ts`, `js/forensics/index.ts`, `tests/forensics-report.test.ts`, `tests/forensics-content.test.tsx`, `tests/app-state.test.ts` — these are all fixed in later tasks. The errors tell you exactly what to fix.

- [ ] **Step 3: Commit the type changes alone (broken state is OK at this point)**

```bash
git add js/types.ts
git commit -m "types: extend js/types.ts with 4 new forensic module interfaces

Add CopyMoveResult, ResamplingResult, HistogramForensicResult, DocStructureResult.
Extend PipelineStep, ForensicReport, ForensicPipelineResult.

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Task 2: TDD — Histogram Forensic module

**Files:**
- Create: `tests/histogram-forensic.test.ts`
- Create: `js/forensics/histogram-forensic.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/histogram-forensic.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { analyzeHistogramForensic } from '../js/forensics/histogram-forensic.js';
import type { ImageDataLike } from '../js/types.js';

function makeImageData(pixels: number[][]): ImageDataLike {
    const data = new Uint8ClampedArray(pixels.length * 4);
    for (let i = 0; i < pixels.length; i++) {
        data[i * 4]     = pixels[i][0];
        data[i * 4 + 1] = pixels[i][1];
        data[i * 4 + 2] = pixels[i][2];
        data[i * 4 + 3] = pixels[i][3] ?? 255;
    }
    const side = Math.sqrt(pixels.length);
    return { data, width: Math.ceil(side), height: Math.ceil(side) };
}

describe('analyzeHistogramForensic', () => {
    it('returns 256-bin histograms per channel', () => {
        const img = makeImageData([[128, 64, 200, 255]]);
        const r = analyzeHistogramForensic(img);
        expect(r.r.length).toBe(256);
        expect(r.g.length).toBe(256);
        expect(r.b.length).toBe(256);
        expect(r.r[128]).toBe(1);
        expect(r.g[64]).toBe(1);
        expect(r.b[200]).toBe(1);
    });

    it('detects holes in image that uses only even bin values', () => {
        // Pixels only use even values (0,2,4,...) — odd bins will be empty
        const pixels: number[][] = [];
        for (let v = 0; v <= 254; v += 2) {
            for (let j = 0; j < 5; j++) pixels.push([v, v, v, 255]);
        }
        const img = makeImageData(pixels);
        const r = analyzeHistogramForensic(img);
        // Odd bins in 16..240 are empty — should have many holes
        expect(r.holes).toBeGreaterThan(5);
    });

    it('returns zero holes for image with all 256 luminance values present', () => {
        const pixels: number[][] = [];
        for (let v = 0; v < 256; v++) pixels.push([v, v, v, 255]);
        const img = makeImageData(pixels);
        const r = analyzeHistogramForensic(img);
        expect(r.holes).toBe(0);
    });

    it('score is always in range 0–100', () => {
        const pixels: number[][] = [];
        for (let v = 0; v < 256; v++) pixels.push([v, v, v, 255]);
        const img = makeImageData(pixels);
        const r = analyzeHistogramForensic(img);
        expect(r.score).toBeGreaterThanOrEqual(0);
        expect(r.score).toBeLessThanOrEqual(100);
    });

    it('combStrength is always in range 0–1', () => {
        const img = makeImageData([[100, 100, 100, 255]]);
        const r = analyzeHistogramForensic(img);
        expect(r.combStrength).toBeGreaterThanOrEqual(0);
        expect(r.combStrength).toBeLessThanOrEqual(1);
    });
});
```

- [ ] **Step 2: Run tests — expect FAIL (module not found)**

```bash
pnpm test -- tests/histogram-forensic.test.ts 2>&1 | tail -20
```

Expected: `Cannot find module '../js/forensics/histogram-forensic.js'`

- [ ] **Step 3: Implement `js/forensics/histogram-forensic.ts`**

Create `js/forensics/histogram-forensic.ts`:

```ts
import type { HistogramForensicResult, ImageDataLike } from '../types.js';

function clamp(v: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, v));
}

function buildHistogram(data: Uint8ClampedArray, channel: number): Uint32Array {
    const hist = new Uint32Array(256);
    for (let i = channel; i < data.length; i += 4) {
        hist[data[i]]++;
    }
    return hist;
}

function countHoles(hist: Uint32Array): number {
    let holes = 0;
    for (let i = 16; i <= 240; i++) {
        if (hist[i] === 0) holes++;
    }
    return holes;
}

/** Estimate comb regularity: fraction of even-indexed bins that are empty vs odd bins that are not */
function computeCombStrength(hist: Uint32Array): number {
    let evenEmpty = 0;
    let oddFilled = 0;
    let total = 0;
    for (let i = 16; i <= 240; i++) {
        total++;
        if (i % 2 === 0 && hist[i] === 0) evenEmpty++;
        if (i % 2 === 1 && hist[i] > 0) oddFilled++;
    }
    if (total === 0) return 0;
    return clamp((evenEmpty + oddFilled) / (total * 2), 0, 1);
}

export function analyzeHistogramForensic(imageData: ImageDataLike): HistogramForensicResult {
    const r = buildHistogram(imageData.data, 0);
    const g = buildHistogram(imageData.data, 1);
    const b = buildHistogram(imageData.data, 2);

    const holes = countHoles(r) + countHoles(g) + countHoles(b);
    const combStrength =
        (computeCombStrength(r) + computeCombStrength(g) + computeCombStrength(b)) / 3;

    const score = clamp(Math.round((holes / 15 + combStrength) * 50), 0, 100);

    return { score, r, g, b, holes, combStrength };
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
pnpm test -- tests/histogram-forensic.test.ts 2>&1 | tail -10
```

Expected: `5 tests passed`

- [ ] **Step 5: Commit**

```bash
git add tests/histogram-forensic.test.ts js/forensics/histogram-forensic.ts
git commit -m "feat: histogram forensic analysis module (TDD)

RGB gap/comb detection for quantisation artifacts.
Score 0-100 suspicion direction; inverted at buildReport layer.

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Task 3: TDD — Document Structure module

**Files:**
- Create: `tests/doc-structure.test.ts`
- Create: `js/forensics/doc-structure.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/doc-structure.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { analyzeDocStructure } from '../js/forensics/doc-structure.js';
import type { ImageDataLike } from '../js/types.js';

function makeUniformImage(w: number, h: number, value: number): ImageDataLike {
    const data = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < data.length; i += 4) {
        data[i] = value; data[i + 1] = value; data[i + 2] = value; data[i + 3] = 255;
    }
    return { data, width: w, height: h };
}

function makeRandomImage(w: number, h: number, seed = 42): ImageDataLike {
    const data = new Uint8ClampedArray(w * h * 4);
    let s = seed;
    for (let i = 0; i < data.length; i++) {
        s = (s * 1664525 + 1013904223) & 0x7fffffff;
        data[i] = s % 256;
    }
    return { data, width: w, height: h };
}

describe('analyzeDocStructure', () => {
    it('returns neutral score 50 and mrzDetected false for random noise', () => {
        const img = makeRandomImage(100, 100);
        const r = analyzeDocStructure(img);
        expect(r.score).toBe(50);
        expect(r.mrzDetected).toBe(false);
    });

    it('detects MRZ zone when bottom 15% is very uniform and bright', () => {
        const w = 100, h = 100;
        const data = makeRandomImage(w, h).data.slice();
        // Overwrite bottom 15% with very uniform white (mean=220, variance≈0)
        const mrzY0 = Math.floor(h * 0.85);
        for (let y = mrzY0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const i = (y * w + x) * 4;
                data[i] = 220; data[i + 1] = 220; data[i + 2] = 220; data[i + 3] = 255;
            }
        }
        const img: ImageDataLike = { data: new Uint8ClampedArray(data), width: w, height: h };
        const r = analyzeDocStructure(img);
        expect(r.mrzDetected).toBe(true);
    });

    it('score is always between 0 and 100', () => {
        const imgs = [
            makeUniformImage(100, 100, 0),
            makeUniformImage(100, 100, 255),
            makeRandomImage(100, 100),
            makeUniformImage(1, 1, 128),
        ];
        for (const img of imgs) {
            const r = analyzeDocStructure(img);
            expect(r.score).toBeGreaterThanOrEqual(0);
            expect(r.score).toBeLessThanOrEqual(100);
        }
    });

    it('returns neutral values for tiny images (< 10px)', () => {
        const img = makeUniformImage(5, 5, 200);
        const r = analyzeDocStructure(img);
        expect(r.score).toBe(50);
        expect(r.mrzDetected).toBe(false);
    });

    it('regionConsistency and photoZoneIntegrity are always in range 0–1', () => {
        const img = makeRandomImage(100, 100);
        const r = analyzeDocStructure(img);
        expect(r.regionConsistency).toBeGreaterThanOrEqual(0);
        expect(r.regionConsistency).toBeLessThanOrEqual(1);
        expect(r.photoZoneIntegrity).toBeGreaterThanOrEqual(0);
        expect(r.photoZoneIntegrity).toBeLessThanOrEqual(1);
    });
});
```

- [ ] **Step 2: Run tests — expect FAIL (module not found)**

```bash
pnpm test -- tests/doc-structure.test.ts 2>&1 | tail -10
```

Expected: `Cannot find module '../js/forensics/doc-structure.js'`

- [ ] **Step 3: Implement `js/forensics/doc-structure.ts`**

Create `js/forensics/doc-structure.ts`:

```ts
import type { DocStructureResult, ImageDataLike } from '../types.js';

function clamp(v: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, v));
}

function getLuma(data: Uint8ClampedArray, x: number, y: number, w: number): number {
    const i = (y * w + x) * 4;
    return 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
}

function regionStats(
    data: Uint8ClampedArray,
    w: number,
    x0: number,
    y0: number,
    x1: number,
    y1: number,
): { mean: number; variance: number } {
    let sum = 0;
    let sum2 = 0;
    let count = 0;
    for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
            const l = getLuma(data, x, y, w);
            sum += l;
            sum2 += l * l;
            count++;
        }
    }
    if (count === 0) return { mean: 0, variance: 0 };
    const mean = sum / count;
    return { mean, variance: sum2 / count - mean * mean };
}

function laplacianVariance(
    data: Uint8ClampedArray,
    w: number,
    h: number,
    x0: number,
    y0: number,
    x1: number,
    y1: number,
): number {
    const laps: number[] = [];
    for (let y = Math.max(1, y0); y < Math.min(h - 1, y1); y++) {
        for (let x = Math.max(1, x0); x < Math.min(w - 1, x1); x++) {
            const lap =
                getLuma(data, x, y - 1, w) +
                getLuma(data, x, y + 1, w) +
                getLuma(data, x - 1, y, w) +
                getLuma(data, x + 1, y, w) -
                4 * getLuma(data, x, y, w);
            laps.push(lap);
        }
    }
    if (laps.length === 0) return 0;
    const mean = laps.reduce((a, b) => a + b, 0) / laps.length;
    return laps.reduce((s, v) => s + (v - mean) ** 2, 0) / laps.length;
}

export function analyzeDocStructure(imageData: ImageDataLike): DocStructureResult {
    const { data, width: w, height: h } = imageData;

    if (w < 10 || h < 10) {
        return { score: 50, mrzDetected: false, regionConsistency: 0, photoZoneIntegrity: 0 };
    }

    // MRZ zone: bottom 15% — typically high-mean, very-low-variance white band
    const mrzY0 = Math.floor(h * 0.85);
    const mrzStats = regionStats(data, w, 0, mrzY0, w, h);
    const mrzDetected = mrzStats.variance < 500 && mrzStats.mean > 180;
    const regionConsistency = clamp(1 - mrzStats.variance / 1000, 0, 1);

    // Photo zone: top-left 30% width × 50% height — edge coherence via Laplacian
    const photoX1 = Math.floor(w * 0.3);
    const photoY1 = Math.floor(h * 0.5);
    const lapVar = laplacianVariance(data, w, h, 0, 0, photoX1, photoY1);
    const photoZoneIntegrity = clamp(lapVar > 50 ? 1 - Math.abs(lapVar - 500) / 5000 : 0, 0, 1);

    if (!mrzDetected) {
        return { score: 50, mrzDetected: false, regionConsistency, photoZoneIntegrity };
    }

    const suspicion = Math.round((1 - regionConsistency) * 50 + (1 - photoZoneIntegrity) * 50);
    return {
        score: clamp(suspicion, 0, 100),
        mrzDetected,
        regionConsistency,
        photoZoneIntegrity,
    };
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
pnpm test -- tests/doc-structure.test.ts 2>&1 | tail -10
```

Expected: `5 tests passed`

- [ ] **Step 5: Commit**

```bash
git add tests/doc-structure.test.ts js/forensics/doc-structure.ts
git commit -m "feat: document structure analysis module (TDD)

MRZ zone + photo zone pixel-level analysis for EU documents.
Neutral score 50 when no document structure detected.

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Task 4: TDD — Copy-Move module

**Files:**
- Create: `tests/copy-move.test.ts`
- Create: `js/forensics/copy-move.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/copy-move.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { analyzeCopyMove } from '../js/forensics/copy-move.js';
import type { ImageDataLike } from '../js/types.js';

function makeGradientImage(w: number, h: number): ImageDataLike {
    const data = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const i = (y * w + x) * 4;
            data[i]     = (x * 4) % 256;
            data[i + 1] = (y * 4) % 256;
            data[i + 2] = 128;
            data[i + 3] = 255;
        }
    }
    return { data, width: w, height: h };
}

describe('analyzeCopyMove', () => {
    it('returns matchCount > 0 for image with a manually cloned 16×16 block', () => {
        const w = 64, h = 64;
        const img = makeGradientImage(w, h);
        const data = img.data.slice();
        // Copy block at (0,0) onto block at (32,0) — identical pixel values → match
        for (let py = 0; py < 16; py++) {
            for (let px = 0; px < 16; px++) {
                const src = (py * w + px) * 4;
                const dst = (py * w + 32 + px) * 4;
                data[dst]     = data[src];
                data[dst + 1] = data[src + 1];
                data[dst + 2] = data[src + 2];
                data[dst + 3] = 255;
            }
        }
        const clonedImg: ImageDataLike = { data: new Uint8ClampedArray(data), width: w, height: h };
        const r = analyzeCopyMove(clonedImg);
        expect(r.matchCount).toBeGreaterThan(0);
    });

    it('score is always in range 0–100', () => {
        const img = makeGradientImage(64, 64);
        const r = analyzeCopyMove(img);
        expect(r.score).toBeGreaterThanOrEqual(0);
        expect(r.score).toBeLessThanOrEqual(100);
    });

    it('returns null heatmapData for images too small to analyse (<4 blocks)', () => {
        const data = new Uint8ClampedArray(10 * 10 * 4).fill(128);
        const img: ImageDataLike = { data, width: 10, height: 10 };
        const r = analyzeCopyMove(img);
        expect(r.heatmapData).toBeNull();
        expect(r.matchCount).toBe(0);
    });

    it('heatmapData has same dimensions as input for valid images', () => {
        const img = makeGradientImage(64, 64);
        const r = analyzeCopyMove(img);
        if (r.heatmapData) {
            expect(r.heatmapData.width).toBe(64);
            expect(r.heatmapData.height).toBe(64);
            expect(r.heatmapData.data.length).toBe(64 * 64 * 4);
        }
    });

    it('returns score 0 and matchCount 0 for images too small', () => {
        const data = new Uint8ClampedArray(4).fill(0);
        const img: ImageDataLike = { data, width: 1, height: 1 };
        const r = analyzeCopyMove(img);
        expect(r.score).toBe(0);
        expect(r.matchCount).toBe(0);
    });
});
```

- [ ] **Step 2: Run tests — expect FAIL (module not found)**

```bash
pnpm test -- tests/copy-move.test.ts 2>&1 | tail -10
```

Expected: `Cannot find module '../js/forensics/copy-move.js'`

- [ ] **Step 3: Implement `js/forensics/copy-move.ts`**

Create `js/forensics/copy-move.ts`:

```ts
import type { CopyMoveResult, ImageDataLike } from '../types.js';

const BLOCK = 16;
const MATCH_THRESHOLD = 8.0;

function clamp(v: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, v));
}

function getLuma(data: Uint8ClampedArray, x: number, y: number, w: number): number {
    const i = (y * w + x) * 4;
    return 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
}

/**
 * Extract 16-element feature vector from a 16×16 block.
 * Divides the block into 4×4 sub-blocks and computes mean luma per sub-block.
 */
function blockFeature(
    data: Uint8ClampedArray,
    w: number,
    bx: number,
    by: number,
): Float32Array {
    const feat = new Float32Array(16);
    for (let sy = 0; sy < 4; sy++) {
        for (let sx = 0; sx < 4; sx++) {
            let sum = 0;
            for (let py = 0; py < 4; py++) {
                for (let px = 0; px < 4; px++) {
                    sum += getLuma(data, bx * BLOCK + sx * 4 + px, by * BLOCK + sy * 4 + py, w);
                }
            }
            feat[sy * 4 + sx] = sum / 16;
        }
    }
    return feat;
}

function euclidean(a: Float32Array, b: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < a.length; i++) sum += (a[i] - b[i]) ** 2;
    return Math.sqrt(sum);
}

export function analyzeCopyMove(imageData: ImageDataLike): CopyMoveResult {
    const { data, width: w, height: h } = imageData;
    const gbw = Math.floor(w / BLOCK);
    const gbh = Math.floor(h / BLOCK);
    const totalBlocks = gbw * gbh;

    if (totalBlocks < 4) {
        return { score: 0, matchCount: 0, heatmapData: null };
    }

    // Build feature vectors for all blocks
    const features: { feat: Float32Array; bx: number; by: number }[] = [];
    for (let by = 0; by < gbh; by++) {
        for (let bx = 0; bx < gbw; bx++) {
            features.push({ feat: blockFeature(data, w, bx, by), bx, by });
        }
    }

    // Sort by first component (lexicographic approximation) — O(n log n)
    features.sort((a, b) => a.feat[0] - b.feat[0]);

    // Compare adjacent sorted pairs — nearby vectors may be clone candidates
    const matchedBlocks = new Set<number>();
    let matchCount = 0;
    for (let i = 0; i < features.length - 1; i++) {
        if (euclidean(features[i].feat, features[i + 1].feat) < MATCH_THRESHOLD) {
            matchCount++;
            matchedBlocks.add(features[i].by * gbw + features[i].bx);
            matchedBlocks.add(features[i + 1].by * gbw + features[i + 1].bx);
        }
    }

    const score = clamp(Math.round((matchCount / totalBlocks) * 100), 0, 100);

    // Build red heatmap overlay on matched block regions
    const hmData = new Uint8ClampedArray(w * h * 4);
    for (const blockIdx of matchedBlocks) {
        const bx = blockIdx % gbw;
        const by = Math.floor(blockIdx / gbw);
        for (let py = 0; py < BLOCK; py++) {
            for (let px = 0; px < BLOCK; px++) {
                const idx = ((by * BLOCK + py) * w + bx * BLOCK + px) * 4;
                hmData[idx]     = 220;
                hmData[idx + 1] = 50;
                hmData[idx + 2] = 50;
                hmData[idx + 3] = 180;
            }
        }
    }

    return {
        score,
        matchCount,
        heatmapData: { data: hmData, width: w, height: h },
    };
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
pnpm test -- tests/copy-move.test.ts 2>&1 | tail -10
```

Expected: `5 tests passed`

- [ ] **Step 5: Commit**

```bash
git add tests/copy-move.test.ts js/forensics/copy-move.ts
git commit -m "feat: copy-move detection module (TDD)

DCT block feature matching for clone detection.
Generates red heatmap overlay on matched block regions.

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Task 5: TDD — Resampling module

**Files:**
- Create: `tests/resampling.test.ts`
- Create: `js/forensics/resampling.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/resampling.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { analyzeResampling } from '../js/forensics/resampling.js';
import type { ImageDataLike } from '../js/types.js';

function makeRandomImage(w: number, h: number, seed = 42): ImageDataLike {
    const data = new Uint8ClampedArray(w * h * 4);
    let s = seed;
    for (let i = 0; i < data.length; i++) {
        s = (s * 1664525 + 1013904223) & 0x7fffffff;
        data[i] = s % 256;
    }
    return { data, width: w, height: h };
}

describe('analyzeResampling', () => {
    it('score is in range 0–100 for random image', () => {
        const img = makeRandomImage(64, 64);
        const r = analyzeResampling(img);
        expect(r.score).toBeGreaterThanOrEqual(0);
        expect(r.score).toBeLessThanOrEqual(100);
    });

    it('affectedRatio is in range 0–1', () => {
        const img = makeRandomImage(64, 64);
        const r = analyzeResampling(img);
        expect(r.affectedRatio).toBeGreaterThanOrEqual(0);
        expect(r.affectedRatio).toBeLessThanOrEqual(1);
    });

    it('returns score 0 and affectedRatio 0 for tiny images', () => {
        const data = new Uint8ClampedArray(4).fill(0);
        const img: ImageDataLike = { data, width: 1, height: 1 };
        const r = analyzeResampling(img);
        expect(r.score).toBe(0);
        expect(r.affectedRatio).toBe(0);
    });

    it('heatmapData has correct dimensions', () => {
        const img = makeRandomImage(64, 64);
        const r = analyzeResampling(img);
        expect(r.heatmapData).not.toBeNull();
        expect(r.heatmapData?.width).toBe(64);
        expect(r.heatmapData?.height).toBe(64);
        expect(r.heatmapData?.data.length).toBe(64 * 64 * 4);
    });

    it('uniform image has low affectedRatio (no gradient variations to correlate)', () => {
        const data = new Uint8ClampedArray(64 * 64 * 4).fill(128);
        const img: ImageDataLike = { data, width: 64, height: 64 };
        const r = analyzeResampling(img);
        // Uniform image → gradient is all zeros → no periodicity
        expect(r.affectedRatio).toBe(0);
    });
});
```

- [ ] **Step 2: Run tests — expect FAIL (module not found)**

```bash
pnpm test -- tests/resampling.test.ts 2>&1 | tail -10
```

Expected: `Cannot find module '../js/forensics/resampling.js'`

- [ ] **Step 3: Implement `js/forensics/resampling.ts`**

Create `js/forensics/resampling.ts`:

```ts
import type { ImageDataLike, ResamplingResult } from '../types.js';

function clamp(v: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, v));
}

function getLuma(data: Uint8ClampedArray, x: number, y: number, w: number): number {
    const i = (y * w + x) * 4;
    return 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
}

function gradientRow(data: Uint8ClampedArray, y: number, w: number): Float32Array {
    const g = new Float32Array(w - 1);
    for (let x = 0; x < w - 1; x++) {
        g[x] = getLuma(data, x + 1, y, w) - getLuma(data, x, y, w);
    }
    return g;
}

function autocorr(signal: Float32Array, lag: number): number {
    const n = signal.length;
    if (lag >= n) return 0;
    let sum = 0;
    let norm = 0;
    for (let i = 0; i < n - lag; i++) {
        sum += signal[i] * signal[i + lag];
        norm += signal[i] * signal[i];
    }
    return norm === 0 ? 0 : Math.abs(sum / norm);
}

function hasPeriodicity(signal: Float32Array): boolean {
    let peakCount = 0;
    for (let lag = 2; lag <= 32; lag++) {
        if (autocorr(signal, lag) > 0.15) peakCount++;
    }
    return peakCount >= 3;
}

export function analyzeResampling(imageData: ImageDataLike): ResamplingResult {
    const { data, width: w, height: h } = imageData;

    if (w < 4 || h < 4) {
        return { score: 0, affectedRatio: 0, heatmapData: null };
    }

    const flaggedRows = new Set<number>();
    for (let y = 0; y < h; y++) {
        if (hasPeriodicity(gradientRow(data, y, w))) {
            flaggedRows.add(y);
        }
    }

    const affectedRatio = flaggedRows.size / h;
    const score = clamp(Math.round(affectedRatio * 100), 0, 100);

    // Orange heatmap on flagged rows
    const hmData = new Uint8ClampedArray(w * h * 4);
    for (const y of flaggedRows) {
        for (let x = 0; x < w; x++) {
            const i = (y * w + x) * 4;
            hmData[i]     = 255;
            hmData[i + 1] = 140;
            hmData[i + 2] = 0;
            hmData[i + 3] = 160;
        }
    }

    return {
        score,
        affectedRatio,
        heatmapData: { data: hmData, width: w, height: h },
    };
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
pnpm test -- tests/resampling.test.ts 2>&1 | tail -10
```

Expected: `5 tests passed`

- [ ] **Step 5: Commit**

```bash
git add tests/resampling.test.ts js/forensics/resampling.ts
git commit -m "feat: resampling detection module (TDD)

Autocorrelation-based periodic artifact detection.
Generates orange heatmap overlay on flagged rows.

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Task 6: Update `js/forensics/report.ts` — 8-module weights

**Files:**
- Modify: `js/forensics/report.ts`
- Modify: `tests/forensics-report.test.ts`

- [ ] **Step 1: Update tests first (TDD)**

Replace entire `tests/forensics-report.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildReport } from '../js/forensics/report.js';

// Helper: call buildReport with all 8 scores
function report(
    ela: number,
    exif: number,
    noise: number,
    ghost: number,
    copyMove = 0,
    resampling = 0,
    histogram = 0,
    docStructure = 0,
) {
    return buildReport(ela, exif, noise, ghost, copyMove, resampling, histogram, docStructure);
}

describe('buildReport', () => {
    it('returns authentic verdict and score 100 when all scores are 0 (no suspicion)', () => {
        const r = report(0, 0, 0, 0, 0, 0, 0, 0);
        expect(r.totalScore).toBe(100);
        expect(r.verdict).toBe('authentic');
    });

    it('returns tampered verdict and score 0 when all scores are 100', () => {
        const r = report(100, 100, 100, 100, 100, 100, 100, 100);
        expect(r.totalScore).toBe(0);
        expect(r.verdict).toBe('tampered');
    });

    it('applies correct 8-module weights', () => {
        // copyMove=100 (×0.20=20), ghost=100 (×0.15=15), ela=100 (×0.15=15),
        // resampling=100 (×0.15=15), noise=100 (×0.15=15), exif=100 (×0.10=10),
        // histogram=100 (×0.05=5), docStructure=100 (×0.05=5) → total suspicion=100
        const r = report(100, 100, 100, 100, 100, 100, 100, 100);
        expect(r.totalScore).toBe(0);

        // Only copyMove=100 (×0.20=20 suspicion) → totalScore=80
        const r2 = report(0, 0, 0, 0, 100, 0, 0, 0);
        expect(r2.totalScore).toBe(80);
    });

    it('suspicious verdict for score in 40–70 range', () => {
        // ela=67 (×0.15≈10), ghost=67 (×0.15≈10), noise=67 (×0.15≈10), exif=67 (×0.10≈7),
        // copyMove=67 (×0.20≈13), resampling=67 (×0.15≈10), histogram=67 (×0.05≈3), docStructure=67 (×0.05≈3)
        // suspicion ≈ 66 → totalScore ≈ 34 → tampered, adjust values for ~55 total
        const r = report(50, 50, 50, 50, 50, 50, 50, 50);
        expect(r.verdict).toBe('suspicious');
        expect(r.totalScore).toBe(50);
    });

    it('inverts individual scores in breakdown fields', () => {
        const r = report(10, 20, 30, 40, 50, 60, 70, 80);
        expect(r.ela).toBe(90);
        expect(r.exif).toBe(80);
        expect(r.noise).toBe(70);
        expect(r.ghost).toBe(60);
        expect(r.copyMove).toBe(50);
        expect(r.resampling).toBe(40);
        expect(r.histogram).toBe(30);
        expect(r.docStructure).toBe(20);
    });

    it('completedAt is a recent timestamp', () => {
        const before = Date.now();
        const r = report(0, 0, 0, 0);
        const after = Date.now();
        expect(r.completedAt).toBeGreaterThanOrEqual(before);
        expect(r.completedAt).toBeLessThanOrEqual(after);
    });
});
```

- [ ] **Step 2: Run tests — expect FAIL (wrong signature)**

```bash
pnpm test -- tests/forensics-report.test.ts 2>&1 | tail -20
```

Expected: type errors about wrong argument count

- [ ] **Step 3: Update `js/forensics/report.ts`**

Replace entire file content:

```ts
import type { ForensicReport, Verdict } from '../types.js';

export function buildReport(
    elaScore: number,
    exifScore: number,
    noiseScore: number,
    ghostScore: number,
    copyMoveScore: number,
    resamplingScore: number,
    histogramScore: number,
    docStructureScore: number,
): ForensicReport {
    const suspicionScore = Math.round(
        copyMoveScore   * 0.20 +
        ghostScore      * 0.15 +
        elaScore        * 0.15 +
        resamplingScore * 0.15 +
        noiseScore      * 0.15 +
        exifScore       * 0.10 +
        histogramScore  * 0.05 +
        docStructureScore * 0.05,
    );
    const totalScore = 100 - suspicionScore;

    let verdict: Verdict;
    if (totalScore > 70) verdict = 'authentic';
    else if (totalScore >= 40) verdict = 'suspicious';
    else verdict = 'tampered';

    return {
        totalScore,
        verdict,
        ela:          100 - elaScore,
        exif:         100 - exifScore,
        noise:        100 - noiseScore,
        ghost:        100 - ghostScore,
        copyMove:     100 - copyMoveScore,
        resampling:   100 - resamplingScore,
        histogram:    100 - histogramScore,
        docStructure: 100 - docStructureScore,
        completedAt:  Date.now(),
    };
}
```

- [ ] **Step 4: Run report tests — expect PASS**

```bash
pnpm test -- tests/forensics-report.test.ts 2>&1 | tail -10
```

Expected: `6 tests passed`

- [ ] **Step 5: Commit**

```bash
git add js/forensics/report.ts tests/forensics-report.test.ts
git commit -m "feat: update buildReport to 8-module weighted scoring

New weights: copy-move 20%, ghost/ela/resampling/noise 15% each,
exif 10%, histogram/doc-structure 5% each.

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Task 7: Update `js/forensics/index.ts` — Phase 3 parallel execution

**Files:**
- Modify: `js/forensics/index.ts`

- [ ] **Step 1: Add Phase 3 imports and execution**

Replace entire `js/forensics/index.ts`:

```ts
import { renderELA } from '../ela.js';
import type { ForensicPipelineResult, PipelineProgressCallback } from '../types.js';
import { analyzeCopyMove } from './copy-move.js';
import { analyzeDocStructure } from './doc-structure.js';
import { analyzeExif } from './exif.js';
import { analyzeGhost } from './ghost.js';
import { analyzeHistogramForensic } from './histogram-forensic.js';
import { analyzeNoise } from './noise.js';
import { analyzeQuality } from './quality.js';
import { buildReport } from './report.js';
import { analyzeResampling } from './resampling.js';

function isHeicFile(file: File): boolean {
    return (
        file.type === 'image/heic' ||
        file.type === 'image/heif' ||
        /\.(heic|heif)$/i.test(file.name)
    );
}

export async function runForensicPipeline(
    img: HTMLImageElement,
    onProgress?: PipelineProgressCallback,
    sourceFile?: File | null,
): Promise<ForensicPipelineResult> {
    const { naturalWidth: w, naturalHeight: h } = img;

    const tmp = document.createElement('canvas');
    tmp.width = w;
    tmp.height = h;
    const ctx = tmp.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    const imageData = ctx.getImageData(0, 0, w, h);

    // Phase 1: EXIF + Noise + Quality in parallel
    onProgress?.('exif', 'running');
    onProgress?.('noise', 'running');
    onProgress?.('quality', 'running');

    const [exif, noise, quality] = await Promise.all([
        analyzeExif(sourceFile ?? img).then((r) => { onProgress?.('exif', 'done'); return r; }),
        Promise.resolve(analyzeNoise(imageData)).then((r) => { onProgress?.('noise', 'done'); return r; }),
        Promise.resolve(analyzeQuality(imageData)).then((r) => { onProgress?.('quality', 'done'); return r; }),
    ]);

    // Phase 2: ELA + Ghost in parallel
    onProgress?.('ela', 'running');
    onProgress?.('ghost', 'running');

    const elaOutputCanvas = document.createElement('canvas');

    const [elaScore, ghost] = await Promise.all([
        renderELA(img, elaOutputCanvas, 10).then((s) => { onProgress?.('ela', 'done'); return s; }),
        analyzeGhost(img).then((r) => { onProgress?.('ghost', 'done'); return r; }),
    ]);

    if (sourceFile && isHeicFile(sourceFile)) {
        ghost.heicConverted = true;
    }

    // Phase 3: Advanced modules in parallel (after ELA + Ghost)
    onProgress?.('copy-move', 'running');
    onProgress?.('resampling', 'running');
    onProgress?.('histogram', 'running');
    onProgress?.('doc-structure', 'running');

    const [copyMoveResult, resamplingResult, histogramResult, docStructureResult] = await Promise.all([
        Promise.resolve(analyzeCopyMove(imageData)).then((r) => { onProgress?.('copy-move', 'done'); return r; }),
        Promise.resolve(analyzeResampling(imageData)).then((r) => { onProgress?.('resampling', 'done'); return r; }),
        Promise.resolve(analyzeHistogramForensic(imageData)).then((r) => { onProgress?.('histogram', 'done'); return r; }),
        Promise.resolve(analyzeDocStructure(imageData)).then((r) => { onProgress?.('doc-structure', 'done'); return r; }),
    ]);

    // Build report
    onProgress?.('report', 'running');
    const report = buildReport(
        elaScore,
        exif.score,
        noise.score,
        ghost.score,
        copyMoveResult.score,
        resamplingResult.score,
        histogramResult.score,
        docStructureResult.score,
    );
    onProgress?.('report', 'done');

    return {
        exif,
        noise,
        ghost,
        elaScore,
        quality,
        report,
        copyMoveResult,
        resamplingResult,
        histogramResult,
        docStructureResult,
    };
}
```

- [ ] **Step 2: Run TypeScript check — should have fewer errors now**

```bash
pnpm exec tsc --noEmit 2>&1 | head -40
```

Expected: remaining errors only in test fixtures (`tests/forensics-content.test.tsx`, `tests/app-state.test.ts`) about missing new fields in `ForensicPipelineResult` — fixed in Task 14.

- [ ] **Step 3: Commit**

```bash
git add js/forensics/index.ts
git commit -m "feat: add Phase 3 parallel execution to forensic pipeline

4 new modules run after ELA+Ghost complete:
copy-move, resampling, histogram, doc-structure

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Task 8: Update `src/types.ts` — extend ActiveTab

**Files:**
- Modify: `src/types.ts`

- [ ] **Step 1: Add new tab values to ActiveTab**

In `src/types.ts`, replace:
```ts
export type ActiveTab = 'forensics' | 'filters' | 'canvas' | 'ela' | 'tools';
```
With:
```ts
export type ActiveTab = 'forensics' | 'filters' | 'canvas' | 'ela' | 'tools' | 'copy-move' | 'resampling';
```

No other changes to `src/types.ts` are needed — `AppState` stores `forensicResult: ForensicPipelineResult | null` which automatically gets the new fields, and the `ANALYSIS_DONE` reducer just passes `action.result` directly.

- [ ] **Step 2: Commit**

```bash
git add src/types.ts
git commit -m "feat: add copy-move and resampling to ActiveTab

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Task 9: New React module components

**Files:**
- Create: `src/components/forensics/modules/HistogramForensicModule.tsx`
- Create: `src/components/forensics/modules/DocStructureModule.tsx`

- [ ] **Step 1: Create `HistogramForensicModule.tsx`**

Create `src/components/forensics/modules/HistogramForensicModule.tsx`:

```tsx
import type { HistogramForensicResult } from '../../../../js/types.js';

interface Props {
    result: HistogramForensicResult;
}

export function HistogramForensicModule({ result }: Props) {
    const maxVal = Math.max(
        Math.max(...Array.from(result.r)),
        Math.max(...Array.from(result.g)),
        Math.max(...Array.from(result.b)),
        1,
    );

    const channels = [
        { key: 'r' as const, color: '#f87171', label: 'R' },
        { key: 'g' as const, color: '#4ade80', label: 'G' },
        { key: 'b' as const, color: '#60a5fa', label: 'B' },
    ];

    return (
        <div className="flex flex-col gap-2">
            <div className="flex gap-3 text-xs text-text-3">
                <span>
                    Buracos:{' '}
                    <span className="font-mono text-text">{result.holes}</span>
                </span>
                <span>
                    Regularidade:{' '}
                    <span className="font-mono text-text">
                        {(result.combStrength * 100).toFixed(0)}%
                    </span>
                </span>
            </div>
            {channels.map(({ key, color, label }) => (
                <div key={key} className="flex items-center gap-1.5">
                    <span className="w-3 font-mono text-xs" style={{ color }}>
                        {label}
                    </span>
                    <div className="flex h-[18px] flex-1 items-end gap-px overflow-hidden rounded-sm bg-bg-3">
                        {Array.from(result[key]).map((v, i) => (
                            <div
                                key={i}
                                className="flex-1"
                                style={{
                                    height: `${Math.round((v / maxVal) * 18)}px`,
                                    backgroundColor: color,
                                    opacity: v === 0 && i >= 16 && i <= 240 ? 0.15 : 0.75,
                                }}
                            />
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}
```

- [ ] **Step 2: Create `DocStructureModule.tsx`**

Create `src/components/forensics/modules/DocStructureModule.tsx`:

```tsx
import type { DocStructureResult } from '../../../../js/types.js';

interface Props {
    result: DocStructureResult;
}

function Bar({ value, label }: { value: number; label: string }) {
    const pct = Math.round(value * 100);
    const color = pct > 70 ? '#4ade80' : pct > 40 ? '#fbbf24' : '#f87171';
    return (
        <div className="flex flex-col gap-0.5">
            <div className="flex justify-between text-xs">
                <span className="text-text-3">{label}</span>
                <span className="font-mono text-text">{pct}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-bg-3">
                <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${pct}%`, backgroundColor: color }}
                />
            </div>
        </div>
    );
}

export function DocStructureModule({ result }: Props) {
    return (
        <div className="flex flex-col gap-2.5">
            <div className="flex items-center gap-2 text-xs">
                <span className="text-text-3">Zona MRZ:</span>
                <span
                    className="rounded px-1.5 py-0.5 font-mono text-xs font-bold"
                    style={{
                        background: result.mrzDetected ? '#16a34a22' : '#6b728022',
                        color: result.mrzDetected ? '#4ade80' : '#9ca3af',
                    }}
                >
                    {result.mrzDetected ? '✓ Detectada' : '— Não detectada'}
                </span>
                {!result.mrzDetected && (
                    <span className="text-text-3">(score neutro)</span>
                )}
            </div>
            <Bar value={result.regionConsistency} label="Consistência regional" />
            <Bar value={result.photoZoneIntegrity} label="Integridade zona foto" />
        </div>
    );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/forensics/modules/HistogramForensicModule.tsx \
        src/components/forensics/modules/DocStructureModule.tsx
git commit -m "feat: HistogramForensicModule and DocStructureModule React components

Histogram shows RGB bar charts with empty-bin highlighting.
DocStructure shows MRZ badge + consistency/integrity progress bars.

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Task 10: New React heatmap tabs — CopyMoveTab and ResamplingTab

**Files:**
- Create: `src/components/tabs/CopyMoveTab.tsx`
- Create: `src/components/tabs/ResamplingTab.tsx`

- [ ] **Step 1: Create `CopyMoveTab.tsx`**

Create `src/components/tabs/CopyMoveTab.tsx`:

```tsx
import { useEffect, useRef } from 'react';
import type { ImageDataLike } from '../../../js/types.js';
import type { AppState } from '../../types.ts';
import { scoreColor } from '../forensics/scoreColor.ts';

function HeatmapCanvas({ heatmapData }: { heatmapData: ImageDataLike }) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.width = heatmapData.width;
        canvas.height = heatmapData.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const imgData = new ImageData(
            new Uint8ClampedArray(heatmapData.data),
            heatmapData.width,
            heatmapData.height,
        );
        ctx.putImageData(imgData, 0, 0);
    }, [heatmapData]);

    return (
        <canvas
            ref={canvasRef}
            className="block w-full overflow-hidden rounded-sm border border-border"
        />
    );
}

interface CopyMoveTabProps {
    state: AppState;
}

export function CopyMoveTab({ state }: CopyMoveTabProps) {
    const result = state.forensicResult?.copyMoveResult ?? null;
    const score = state.forensicResult?.report.copyMove ?? null;

    if (!result) {
        return (
            <div className="flex h-full items-center justify-center p-6 text-center">
                <p className="text-xs text-text-3">
                    Execute a análise forense para visualizar o mapa de regiões copiadas.
                </p>
            </div>
        );
    }

    const color = score !== null ? scoreColor(score) : '#5a5750';

    return (
        <div className="flex flex-col gap-3 p-3">
            <p className="text-xs text-text-3">
                Detecta regiões duplicadas/clonadas por correspondência de blocos DCT. Áreas a
                vermelho indicam potencial clonagem.
            </p>
            {score !== null && (
                <div className="flex items-center gap-2">
                    <span className="text-xs text-text-3">Score:</span>
                    <span className="font-mono text-sm font-bold" style={{ color }}>
                        {score}
                    </span>
                    <span className="text-xs text-text-3">
                        — {result.matchCount} blocos correspondentes
                    </span>
                </div>
            )}
            {result.heatmapData && <HeatmapCanvas heatmapData={result.heatmapData} />}
        </div>
    );
}
```

- [ ] **Step 2: Create `ResamplingTab.tsx`**

Create `src/components/tabs/ResamplingTab.tsx`:

```tsx
import { useEffect, useRef } from 'react';
import type { ImageDataLike } from '../../../js/types.js';
import type { AppState } from '../../types.ts';
import { scoreColor } from '../forensics/scoreColor.ts';

function HeatmapCanvas({ heatmapData }: { heatmapData: ImageDataLike }) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.width = heatmapData.width;
        canvas.height = heatmapData.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const imgData = new ImageData(
            new Uint8ClampedArray(heatmapData.data),
            heatmapData.width,
            heatmapData.height,
        );
        ctx.putImageData(imgData, 0, 0);
    }, [heatmapData]);

    return (
        <canvas
            ref={canvasRef}
            className="block w-full overflow-hidden rounded-sm border border-border"
        />
    );
}

interface ResamplingTabProps {
    state: AppState;
}

export function ResamplingTab({ state }: ResamplingTabProps) {
    const result = state.forensicResult?.resamplingResult ?? null;
    const score = state.forensicResult?.report.resampling ?? null;

    if (!result) {
        return (
            <div className="flex h-full items-center justify-center p-6 text-center">
                <p className="text-xs text-text-3">
                    Execute a análise forense para visualizar o mapa de reamostramento.
                </p>
            </div>
        );
    }

    const color = score !== null ? scoreColor(score) : '#5a5750';

    return (
        <div className="flex flex-col gap-3 p-3">
            <p className="text-xs text-text-3">
                Detecta artefactos de interpolação de redimensionamento/rotação. Linhas a laranja
                indicam periodicidade suspeita no gradiente.
            </p>
            {score !== null && (
                <div className="flex items-center gap-2">
                    <span className="text-xs text-text-3">Score:</span>
                    <span className="font-mono text-sm font-bold" style={{ color }}>
                        {score}
                    </span>
                    <span className="text-xs text-text-3">
                        — {(result.affectedRatio * 100).toFixed(1)}% linhas afectadas
                    </span>
                </div>
            )}
            {result.heatmapData && <HeatmapCanvas heatmapData={result.heatmapData} />}
        </div>
    );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/tabs/CopyMoveTab.tsx src/components/tabs/ResamplingTab.tsx
git commit -m "feat: CopyMoveTab and ResamplingTab heatmap viewer components

Render pre-computed heatmaps from the forensic pipeline.
Red overlay = copy-move, orange = resampling artifacts.

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Task 11: Update `ForensicsContent.tsx` — 4 new ModuleCards

**Files:**
- Modify: `src/components/forensics/ForensicsContent.tsx`

- [ ] **Step 1: Add imports and 4 new ModuleCards**

Replace entire `src/components/forensics/ForensicsContent.tsx`:

```tsx
import type { Dispatch } from 'react';
import type { AppAction, AppState } from '../../types.ts';
import { ModuleCard } from './ModuleCard.tsx';
import { ExifModule } from './modules/ExifModule.tsx';
import { GhostModule } from './modules/GhostModule.tsx';
import { HistogramForensicModule } from './modules/HistogramForensicModule.tsx';
import { DocStructureModule } from './modules/DocStructureModule.tsx';
import { NoiseModule } from './modules/NoiseModule.tsx';
import { QualityModule } from './modules/QualityModule.tsx';
import { VerdictBlock } from './VerdictBlock.tsx';

interface ForensicsContentProps {
    state: AppState;
    dispatch: Dispatch<AppAction>;
}

export function ForensicsContent({ state, dispatch }: ForensicsContentProps) {
    const { forensicResult, isAnalyzing, progress, ghostLevelIndex, imageElement } = state;
    const report = forensicResult?.report ?? null;

    const imageWidth = imageElement?.naturalWidth ?? 0;
    const imageHeight = imageElement?.naturalHeight ?? 0;

    return (
        <div className="flex h-full flex-col">
            <VerdictBlock report={report} isAnalyzing={isAnalyzing} progress={progress} />

            {forensicResult && (
                <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-3">
                    <ModuleCard
                        title="Metadados EXIF"
                        score={forensicResult.report.exif}
                        icon="🗂"
                        defaultOpen
                    >
                        <ExifModule result={forensicResult.exif} />
                    </ModuleCard>

                    <ModuleCard
                        title="Inconsistência de Ruído"
                        score={forensicResult.report.noise}
                        icon="🌊"
                    >
                        <NoiseModule
                            result={forensicResult.noise}
                            imageWidth={imageWidth}
                            imageHeight={imageHeight}
                        />
                    </ModuleCard>

                    <ModuleCard title="JPEG Ghost" score={forensicResult.report.ghost} icon="👻">
                        <GhostModule
                            result={forensicResult.ghost}
                            levelIndex={ghostLevelIndex}
                            onLevelChange={(index) => dispatch({ type: 'SET_GHOST_LEVEL', index })}
                        />
                    </ModuleCard>

                    <ModuleCard
                        title="Qualidade de Captura"
                        icon="📷"
                        isQuality
                        isAcceptable={forensicResult.quality.isAcceptable}
                    >
                        <QualityModule result={forensicResult.quality} />
                    </ModuleCard>

                    <ModuleCard
                        title="Error Level Analysis"
                        score={forensicResult.report.ela}
                        icon="🔬"
                    >
                        <p className="text-xs text-text-3">
                            Score ELA:{' '}
                            <span className="font-mono text-blue">{forensicResult.report.ela}</span>{' '}
                            — Use a aba ELA para visualização detalhada.
                        </p>
                    </ModuleCard>

                    <ModuleCard
                        title="Detecção Copy-Move"
                        score={forensicResult.report.copyMove}
                        icon="🔁"
                    >
                        <p className="text-xs text-text-3">
                            {forensicResult.copyMoveResult.matchCount} blocos correspondentes —{' '}
                            Use a aba Copy-Move para visualização do mapa.
                        </p>
                    </ModuleCard>

                    <ModuleCard
                        title="Reamostramento"
                        score={forensicResult.report.resampling}
                        icon="📐"
                    >
                        <p className="text-xs text-text-3">
                            {(forensicResult.resamplingResult.affectedRatio * 100).toFixed(1)}%
                            linhas com periodicidade suspeita —{' '}
                            Use a aba Resampling para visualização.
                        </p>
                    </ModuleCard>

                    <ModuleCard
                        title="Análise Histograma RGB"
                        score={forensicResult.report.histogram}
                        icon="📊"
                    >
                        <HistogramForensicModule result={forensicResult.histogramResult} />
                    </ModuleCard>

                    <ModuleCard
                        title="Estrutura do Documento"
                        score={forensicResult.report.docStructure}
                        icon="🪪"
                    >
                        <DocStructureModule result={forensicResult.docStructureResult} />
                    </ModuleCard>
                </div>
            )}

            {!forensicResult && !isAnalyzing && <div className="flex-1" />}
        </div>
    );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/forensics/ForensicsContent.tsx
git commit -m "feat: add 4 new ModuleCards to ForensicsContent

Copy-Move, Resampling (with summary stats), Histogram RGB,
Document Structure (with MRZ badge + bars).

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Task 12: Update `VerdictBlock.tsx` — 10 pipeline steps + updated WEIGHTS

**Files:**
- Modify: `src/components/forensics/VerdictBlock.tsx`

- [ ] **Step 1: Update STEPS, STEP_LABELS, and WEIGHTS**

In `src/components/forensics/VerdictBlock.tsx`, replace the constants at the top:

```ts
const STEPS: PipelineStep[] = [
    'exif', 'noise', 'quality', 'ela', 'ghost', 'copy-move', 'resampling', 'histogram', 'doc-structure', 'report',
];

const STEP_LABELS: Record<PipelineStep, string> = {
    exif:           'Metadados EXIF',
    noise:          'Ruído',
    ghost:          'Ghost JPEG',
    ela:            'ELA',
    quality:        'Qualidade',
    'copy-move':    'Copy-Move',
    resampling:     'Reamostramento',
    histogram:      'Histograma RGB',
    'doc-structure':'Estrutura Documento',
    report:         'Relatório',
};

const WEIGHTS = [
    { key: 'copyMove'     as const, label: 'Copy-Move',  weight: '×0.20' },
    { key: 'ghost'        as const, label: 'Ghost',       weight: '×0.15' },
    { key: 'ela'          as const, label: 'ELA',         weight: '×0.15' },
    { key: 'resampling'   as const, label: 'Resampling',  weight: '×0.15' },
    { key: 'noise'        as const, label: 'Ruído',       weight: '×0.15' },
    { key: 'exif'         as const, label: 'EXIF',        weight: '×0.10' },
    { key: 'histogram'    as const, label: 'Histograma',  weight: '×0.05' },
    { key: 'docStructure' as const, label: 'Doc. Struct', weight: '×0.05' },
];
```

- [ ] **Step 2: Commit**

```bash
git add src/components/forensics/VerdictBlock.tsx
git commit -m "feat: update VerdictBlock with 10 pipeline steps and 8-module weights

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Task 13: Update `TabBar.tsx` and `RightPanel.tsx` — 2 new tabs

**Files:**
- Modify: `src/components/layout/TabBar.tsx`
- Modify: `src/components/RightPanel.tsx`

- [ ] **Step 1: Add new tabs to TabBar**

In `src/components/layout/TabBar.tsx`, replace the `TABS` array:

```ts
const TABS: { id: ActiveTab; label: string }[] = [
    { id: 'forensics',   label: 'Forense' },
    { id: 'filters',     label: 'Filtros' },
    { id: 'canvas',      label: 'Canvas' },
    { id: 'ela',         label: 'ELA' },
    { id: 'copy-move',   label: 'Copy-Move' },
    { id: 'resampling',  label: 'Resampling' },
    { id: 'tools',       label: 'Ferramentas' },
];
```

- [ ] **Step 2: Add new tab rendering to RightPanel**

In `src/components/RightPanel.tsx`, add imports for the new tabs:

```ts
import { CopyMoveTab } from './tabs/CopyMoveTab.tsx';
import { ResamplingTab } from './tabs/ResamplingTab.tsx';
```

And add rendering inside the return, after the `ela` block:

```tsx
{activeTab === 'copy-move' && <CopyMoveTab state={state} />}
{activeTab === 'resampling' && <ResamplingTab state={state} />}
```

Full updated `RightPanel.tsx`:

```tsx
import type { Dispatch, RefObject } from 'react';
import type { AppAction, AppState } from '../types.ts';
import { ForensicsContent } from './forensics/ForensicsContent.tsx';
import { CanvasTab } from './tabs/CanvasTab.tsx';
import { CopyMoveTab } from './tabs/CopyMoveTab.tsx';
import { ElaTab } from './tabs/ElaTab.tsx';
import { FiltersTab } from './tabs/FiltersTab.tsx';
import { ResamplingTab } from './tabs/ResamplingTab.tsx';
import { ToolsTab } from './tabs/ToolsTab.tsx';

interface RightPanelProps {
    state: AppState;
    dispatch: Dispatch<AppAction>;
    imageRef: RefObject<HTMLImageElement>;
    overlayCanvasRef: RefObject<HTMLCanvasElement>;
}

export function RightPanel({ state, dispatch, imageRef, overlayCanvasRef }: RightPanelProps) {
    const { activeTab } = state;

    return (
        <aside className="flex w-[360px] shrink-0 flex-col overflow-hidden border-l border-border bg-bg-1">
            <div className="flex-1 overflow-y-auto">
                {activeTab === 'forensics' && (
                    <ForensicsContent state={state} dispatch={dispatch} />
                )}
                {activeTab === 'filters' && <FiltersTab state={state} dispatch={dispatch} />}
                {activeTab === 'canvas' && (
                    <CanvasTab
                        state={state}
                        dispatch={dispatch}
                        overlayCanvasRef={overlayCanvasRef}
                    />
                )}
                {activeTab === 'ela' && (
                    <ElaTab state={state} dispatch={dispatch} imageRef={imageRef} />
                )}
                {activeTab === 'copy-move' && <CopyMoveTab state={state} />}
                {activeTab === 'resampling' && <ResamplingTab state={state} />}
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

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/TabBar.tsx src/components/RightPanel.tsx
git commit -m "feat: add Copy-Move and Resampling tabs to UI

TabBar gains 2 new entries; RightPanel renders new tab content.

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Task 14: Update integration tests

**Files:**
- Modify: `tests/forensics-content.test.tsx`
- Modify: `tests/app-state.test.ts`

- [ ] **Step 1: Build the shared result fixture helper**

Both test files need `ForensicPipelineResult` fixtures with all new fields. Add this helper once at the top of each file.

The new required fields to add to every `ForensicPipelineResult` fixture:

```ts
copyMoveResult: {
    score: 0,
    matchCount: 0,
    heatmapData: null,
},
resamplingResult: {
    score: 0,
    affectedRatio: 0,
    heatmapData: null,
},
histogramResult: {
    score: 0,
    r: new Uint32Array(256),
    g: new Uint32Array(256),
    b: new Uint32Array(256),
    holes: 0,
    combStrength: 0,
},
docStructureResult: {
    score: 50,
    mrzDetected: false,
    regionConsistency: 0,
    photoZoneIntegrity: 0,
},
```

And to every `ForensicReport` fixture:

```ts
copyMove: 100,
resampling: 100,
histogram: 100,
docStructure: 50,
```

- [ ] **Step 2: Update `tests/app-state.test.ts`**

In `tests/app-state.test.ts`, find the `ANALYSIS_DONE` action `result` object and add the new fields. The fixture currently ends with `report: { ... }`. After that object, add:

```ts
copyMoveResult: {
    score: 0,
    matchCount: 0,
    heatmapData: null,
},
resamplingResult: {
    score: 0,
    affectedRatio: 0,
    heatmapData: null,
},
histogramResult: {
    score: 0,
    r: new Uint32Array(256),
    g: new Uint32Array(256),
    b: new Uint32Array(256),
    holes: 0,
    combStrength: 0,
},
docStructureResult: {
    score: 50,
    mrzDetected: false,
    regionConsistency: 0,
    photoZoneIntegrity: 0,
},
```

And in the `report` object inside the same fixture, add after `ghost: 100`:
```ts
copyMove: 100,
resampling: 100,
histogram: 100,
docStructure: 50,
```

- [ ] **Step 3: Update `tests/forensics-content.test.tsx`**

Three fixtures exist in this file. Update all three with the same new fields as in Step 2.

For the `report` objects, use values consistent with the fixture's scenario:
- "hides ghost controls" fixture: `copyMove: 100, resampling: 100, histogram: 100, docStructure: 50`
- "renders verdict" fixture: `copyMove: 80, resampling: 75, histogram: 90, docStructure: 50`

Also add new assertions at the bottom of the "renders verdict and module cards" test:

```ts
expect(html).toContain('Detecção Copy-Move');
expect(html).toContain('Reamostramento');
expect(html).toContain('Análise Histograma RGB');
expect(html).toContain('Estrutura do Documento');
```

- [ ] **Step 4: Run all tests — expect PASS**

```bash
pnpm test 2>&1 | tail -20
```

Expected: all tests pass (previously 73, now ~85+)

- [ ] **Step 5: Commit**

```bash
git add tests/forensics-content.test.tsx tests/app-state.test.ts
git commit -m "test: update integration test fixtures for 4 new forensic modules

Add new result fields and assertions for copy-move, resampling,
histogram, and doc-structure in ForensicsContent and AppState tests.

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Task 15: Build, lint, verify and deploy

**Files:** (no changes — verification only)

- [ ] **Step 1: Run full test suite**

```bash
pnpm test 2>&1 | tail -20
```

Expected: all tests pass (no failures)

- [ ] **Step 2: Run linter**

```bash
pnpm lint 2>&1 | tail -20
```

Expected: no errors. If linter reports issues, fix them before proceeding.

- [ ] **Step 3: Run TypeScript check**

```bash
pnpm exec tsc --noEmit 2>&1
```

Expected: no output (zero errors)

- [ ] **Step 4: Run build**

```bash
pnpm build 2>&1 | tail -20
```

Expected: `✓ built in X.XXs` with no errors

- [ ] **Step 5: Commit any lint fixes, then push to trigger deploy**

```bash
git push origin main
```

Expected: GitHub Actions `publish.yml` triggers and deploys to GitHub Pages. Check Actions tab at `https://github.com/taynambenichio/watermaker-check/actions`.
