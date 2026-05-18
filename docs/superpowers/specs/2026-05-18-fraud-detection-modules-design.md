# Fraud Detection Modules — Design Spec

**Date:** 2026-05-18  
**Status:** Approved  
**Scope:** 4 new forensic analysis modules for European document authentication

---

## 1. Problem & Goal

The current pipeline has 4 modules (EXIF, ELA, Noise, Ghost). To improve professional-grade document fraud detection — specifically for **European identity documents** (EU IDs, passports, driving licences) — we are adding 4 new modules:

- **Copy-Move Detection** — detects duplicated/cloned regions
- **Resampling Detection** — detects interpolation artifacts from scaling/rotation
- **Histogram Forensic Analysis** — detects quantisation artifacts and colour gaps
- **Document Structure Analysis** — validates MRZ zone and photo zone integrity

Score scale: **100 = authentic, 0 = tampered** (consistent with existing pipeline).

---

## 2. Architecture: 3-Phase Pipeline

```
Phase 1 (parallel)         Phase 2 (parallel)          Phase 3 (parallel, after Ph2)
──────────────────         ──────────────────          ──────────────────────────────
EXIF                       ELA                          Copy-Move
Noise                      Ghost                        Resampling
                                                        Histogram Forensic
                                                        Doc Structure
```

- Phase 3 starts only after Phase 2 completes (`Promise.all([ela, ghost])`).
- All phases run on the main thread with chunked/yield-based processing (no Web Workers initially).
- Progress bar grows from 6 → 10 steps.

---

## 3. New Types (`js/types.ts`)

```ts
interface CopyMoveResult {
  score: number;           // 0–100, suspicion direction (inverted at report layer)
  matchCount: number;      // number of DCT block pairs matched
  heatmapData: ImageData | null;
}

interface ResamplingResult {
  score: number;           // 0–100, suspicion direction
  affectedRatio: number;   // 0.0–1.0 fraction of pixels flagged
  heatmapData: ImageData | null;
}

interface HistogramForensicResult {
  score: number;           // 0–100, suspicion direction
  r: Uint32Array;          // 256-bin red channel histogram
  g: Uint32Array;          // 256-bin green channel histogram
  b: Uint32Array;          // 256-bin blue channel histogram
  holes: number;           // count of empty bins in mid-range (16–240)
  combStrength: number;    // 0.0–1.0 regularity of gap pattern
}

interface DocStructureResult {
  score: number;           // 0–100, suspicion direction; neutral 50 if no doc detected
  mrzDetected: boolean;
  regionConsistency: number;   // 0.0–1.0 uniformity match for MRZ zone
  photoZoneIntegrity: number;  // 0.0–1.0 edge coherence in photo region
}
```

**PipelineStep additions:**
```ts
type PipelineStep = ... | 'copy-move' | 'resampling' | 'histogram' | 'doc-structure';
```

**ForensicReport additions:**
```ts
interface ForensicReport {
  // existing: totalScore, verdict, ela, exif, noise, ghost
  copyMove: number;       // inverted score (100=authentic)
  resampling: number;
  histogram: number;
  docStructure: number;
}
```

**ForensicPipelineResult additions:**
```ts
interface ForensicPipelineResult {
  // existing fields...
  copyMoveResult: CopyMoveResult;
  resamplingResult: ResamplingResult;
  histogramResult: HistogramForensicResult;
  docStructureResult: DocStructureResult;
}
```

---

## 4. Module Algorithms

### 4.1 Copy-Move (`js/forensics/copy-move.ts`)

- Divide image into non-overlapping **16×16 DCT blocks**.
- Compute 64-coefficient DCT vector per block; reduce to 16-element feature vector.
- Sort vectors lexicographically; compare adjacent pairs — match if Euclidean distance < threshold (empirically ~8.0).
- `matchCount` = number of matched pairs. Score = `clamp(matchCount / (W*H/256) * 100, 0, 100)`.
- Heatmap: red overlay on matched block coordinates.

### 4.2 Resampling (`js/forensics/resampling.ts`)

- Compute horizontal and vertical gradient maps (Sobel-style simple differences).
- For each row/column, compute autocorrelation of the gradient signal at lags 1–32.
- Periodic peaks in autocorrelation → resampling artifact. `affectedRatio` = fraction of rows/columns with periodic peaks.
- Score = `clamp(affectedRatio * 100, 0, 100)`.
- Heatmap: orange overlay on flagged rows/columns.

### 4.3 Histogram Forensic (`js/forensics/histogram-forensic.ts`)

- Build 256-bin R, G, B histograms from ImageData.
- Count `holes` = empty bins (value = 0) in range [16, 240] across all 3 channels.
- Compute `combStrength` = regularity of spacing between holes (FFT of hole-indicator signal, peak frequency power).
- Score = `clamp((holes / 15 + combStrength) * 50, 0, 100)`.
- Output: inline histogram bars rendered in ModuleCard.

### 4.4 Document Structure (`js/forensics/doc-structure.ts`)

- **MRZ zone:** examine bottom 15% of image. Compute mean luminance variance. Low variance + horizontal stripe pattern → `mrzDetected = true`.
- **Photo zone:** examine top-left 30% of image. Compute edge coherence using Laplacian variance. Authentic photo zone has consistent edge distribution.
- If neither zone detected → `score = 50` (neutral), `mrzDetected = false`.
- Score based on `regionConsistency` × 0.5 + `photoZoneIntegrity` × 0.5. No OCR, pixel analysis only.

---

## 5. Report Weights (8 modules)

| Module         | Weight |
|----------------|--------|
| Copy-Move      | 20%    |
| Ghost          | 15%    |
| ELA            | 15%    |
| Resampling     | 15%    |
| Noise          | 15%    |
| EXIF           | 10%    |
| Histogram      | 5%     |
| Doc Structure  | 5%     |

`totalScore = Σ (invertedScore × weight)` where invertedScore = `100 - rawSuspicionScore`.

---

## 6. UI Changes

### 6.1 ForensicsContent (left panel)
- 4 new `ModuleCard` components appended after existing 4.
- Histogram module card: inline RGB bar chart (compact, 80px tall).
- DocStructure module card: shows `mrzDetected` badge + `regionConsistency` / `photoZoneIntegrity` bars.

### 6.2 RightPanel (heatmap tabs)
- New tab: **Copy-Move** — renders `heatmapData` as red overlay on original image (same pattern as ElaTab).
- New tab: **Resampling** — renders `heatmapData` as orange overlay.
- Both tabs are disabled (greyed out) until Phase 3 completes.

### 6.3 Progress bar
- Grows from 6 → 10 steps.
- Phase 3 label: "Análise avançada…"

---

## 7. Testing Strategy

### Unit tests (TDD — tests written before implementation)

| Test file                          | Key assertions                                                   |
|------------------------------------|------------------------------------------------------------------|
| `tests/copy-move.test.ts`          | Cloned-region image → `matchCount > 0`, score < 50. Clean image → score > 70. |
| `tests/resampling.test.ts`         | Resized canvas → `affectedRatio > 0.3`. Raw ImageData → `affectedRatio < 0.1`. |
| `tests/histogram-forensic.test.ts` | ImageData with injected empty bins → `holes > 5`. Natural distribution → `holes < 3`. |
| `tests/doc-structure.test.ts`      | Uniform bottom band → `mrzDetected: true`. Random image → `mrzDetected: false`, score ~50. |

### Integration test updates

| Test file                          | Change                                         |
|------------------------------------|------------------------------------------------|
| `tests/forensics-report.test.ts`   | Update `buildReport` call to 8 score params; verify new weights. |
| `tests/forensics-content.test.tsx` | Add 4 new ModuleCard assertions to fixture.    |
| `tests/app-state.test.ts`          | ANALYSIS_DONE fixture: add new result fields.  |

---

## 8. Files Summary

### New files
- `js/forensics/copy-move.ts`
- `js/forensics/resampling.ts`
- `js/forensics/histogram-forensic.ts`
- `js/forensics/doc-structure.ts`
- `src/components/tabs/CopyMoveTab.tsx`
- `src/components/tabs/ResamplingTab.tsx`
- `src/components/forensics/modules/HistogramForensicModule.tsx`
- `src/components/forensics/modules/DocStructureModule.tsx`
- `tests/copy-move.test.ts`
- `tests/resampling.test.ts`
- `tests/histogram-forensic.test.ts`
- `tests/doc-structure.test.ts`

### Modified files
- `js/types.ts` — new interfaces, extended PipelineStep/ForensicReport/ForensicPipelineResult
- `js/forensics/index.ts` — Phase 3 parallel execution
- `js/forensics/report.ts` — 8-module weights, new score parameters
- `src/types.ts` — AppState/ANALYSIS_DONE with new fields
- `src/components/forensics/ForensicsContent.tsx` — 4 new ModuleCards
- `src/components/RightPanel.tsx` — 2 new tabs
- `tests/forensics-report.test.ts` — updated for 8-module signature
- `tests/forensics-content.test.tsx` — new ModuleCard assertions
- `tests/app-state.test.ts` — ANALYSIS_DONE fixture extended
