# ELA (Error Level Analysis) — Design Spec

**Date:** 2026-05-18  
**Status:** Approved  

---

## Problem

The watermaker-check tool currently detects watermarks through histogram, Sobel edge, and amplification analysis. To detect image tampering (forged documents, spliced photos), we need ELA: a technique used by companies like Onfido and Jumio to reveal regions that have been digitally altered.

---

## Approach

Canvas-based ELA in the browser thread (no Web Worker). Pure TypeScript functions, fully testable with Vitest, no external dependencies.

---

## Algorithm

1. Draw the original image to a temporary canvas → capture `ImageData` (originalData)
2. Export the canvas as JPEG at quality=95 via `canvas.toDataURL('image/jpeg', 0.95)`
3. Load the JPEG back as an `HTMLImageElement`
4. Draw the recompressed image to the same temp canvas → capture `ImageData` (recompData)
5. For each pixel `i`:
   ```
   diff = |orig.R - recomp.R| + |orig.G - recomp.G| + |orig.B - recomp.B|
   magnitude = clamp(diff * amplification, 0, 255)
   ```
6. Apply the thermal palette to each magnitude value:
   - 0–64: blue
   - 64–128: blue → green (lerp)
   - 128–192: green → red (lerp)
   - 192–255: red → white (lerp)
7. Return the resulting `ImageData` as the heatmap

**Why JPEG q=95?** Forensic standard. Unaltered areas recompress uniformly and show low ELA signal. Edited regions have inconsistent JPEG artifacts → higher difference magnitude.

---

## Architecture & Files

| File | Change |
|---|---|
| `js/ela.ts` | **New** — `computeELA()` and `renderELA()` pure functions |
| `tests/ela.test.ts` | **New** — Vitest unit tests (synthetic ImageData, no DOM) |
| `index.html` | Add "ELA" tab button and ELA panel |
| `js/types.ts` | Extend `activeCanvasMode` union with `'ela'` |
| `js/main.ts` | Add `initElaTab()` wiring function |

`ela.ts` has no imports from `canvas.ts`, `filters.ts`, or `ui.ts`. It is a self-contained module. `main.ts` calls it with `HTMLImageElement` and `HTMLCanvasElement` references.

---

## API

```typescript
// js/ela.ts

/**
 * Pure function. No DOM access. Testable with synthetic ImageData.
 * @param original  ImageData from the original image
 * @param recompressed  ImageData from the JPEG-recompressed version
 * @param amplification  Multiplier for differences (1–30, default 10)
 * @returns  ImageData with thermal heatmap
 */
export function computeELA(
  original: ImageData,
  recompressed: ImageData,
  amplification: number = 10
): ImageData

/**
 * Orchestrates canvas I/O. Calls computeELA internally.
 * @param img  The loaded HTMLImageElement
 * @param outputCanvas  Canvas element where the heatmap is rendered
 * @param amplification  Passed through to computeELA
 * @returns  Suspicion score (0–100)
 */
export async function renderELA(
  img: HTMLImageElement,
  outputCanvas: HTMLCanvasElement,
  amplification: number
): Promise<number>
```

---

## UI Panel

The ELA panel is a new tab alongside the existing Histograma / Sobel / Amplify tabs.

```
[ Histograma ] [ Sobel ] [ Amplify ] [ ELA ]

┌─────────────────────────────────────┐
│  [ Analisar ELA ]                   │
│                                     │
│  Sensibilidade: 1 ──●────── 30      │
│                     10              │
│                                     │
│  Score de suspeita:  ██ 42%         │
│  (verde <30% / amarelo 30–60% /     │
│   vermelho >60%)                    │
│                                     │
│  ┌───────────────────────────────┐  │
│  │   heatmap thermal aqui        │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
```

**Slider:** range 1–30, step 1, default 10.  
**Score:** `mean(magnitudes) / 255 * 100`, rounded to integer.  
**Score colour:** `<30%` → green; `30–60%` → amber; `>60%` → red.  
**Heatmap canvas:** a dedicated `<canvas id="ela-canvas">` inside the ELA panel (not the main preview canvas, to avoid state conflicts).

---

## Suspicion Score

```
score = round( mean(magnitude[i] for all pixels) / 255 * 100 )
```

`renderELA` returns this value. `initElaTab()` in `main.ts` reads the return value and updates the score element in the DOM.

---

## Testing

`tests/ela.test.ts` uses synthetic `ImageData` (no real canvas, no DOM).

| Test | Input | Expected |
|---|---|---|
| `identical images` | original === recompressed (all zeros diff) | all output pixels ≈ 0 |
| `amplification scaling` | known diff=10, amplification=5 | magnitude = 50 |
| `clamp at 255` | large diff, amplification=100 | magnitude ≤ 255 |
| `thermal palette – cold` | magnitude=0 | output pixel is blue `(0, 0, 255)` |
| `thermal palette – hot` | magnitude=255 | output pixel is white `(255, 255, 255)` |

---

## Out of Scope

- Web Worker offloading (not needed for typical document images <5 MB)
- PNG re-save comparison (ELA only applies to JPEG artifacts)
- Region selection / masking
- Export of the heatmap as a separate file
