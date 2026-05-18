# ELA Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an Error Level Analysis (ELA) tab to the watermark detector that recompresses images as JPEG q=95, subtracts pixel-by-pixel from the original, applies a thermal heatmap, and displays a 0–100% suspicion score.

**Architecture:** Pure function `computeELA(original, recompressed, amplification)` in `js/ela.ts` receives two `ImageDataLike` objects and returns the thermal heatmap plus a score; `renderELA(img, canvas, amplification)` handles canvas I/O and calls `computeELA`; `initElaTab()` in `main.ts` wires up the DOM. ELA lives in its own top-level tab separate from the existing Filtros / Canvas / Tools tabs.

**Tech Stack:** TypeScript 5 strict, Vite 5, Vitest 1, pnpm, Biome 2. No new dependencies.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `js/types.ts` | Modify | Add `'ela'` to `activeCanvasMode` union |
| `js/ui.ts` | Modify | Add ELA label to `canvasModeLabels`; add `'elaBtn'` to `enableImageTools` |
| `js/ela.ts` | Create | `thermalPalette`, `ELAResult`, `computeELA`, `renderELA` |
| `tests/ela.test.ts` | Create | Vitest unit tests for pure functions |
| `index.html` | Modify | New ELA tab button + ELA panel |
| `js/main.ts` | Modify | Import `renderELA`; add `initElaTab()`; update `onImageLoaded`; call `initElaTab()` |

---

## Task 1: Extend types and analysis panel

**Files:**
- Modify: `js/types.ts:5`
- Modify: `js/ui.ts:88-92` and `js/ui.ts:131-147`

- [ ] **Step 1: Add `'ela'` to `activeCanvasMode` in `js/types.ts`**

  Replace line 5 (the `activeCanvasMode` field):

  ```typescript
  // Before:
      activeCanvasMode: 'histogram' | 'sobel' | 'amplify' | null;
  // After:
      activeCanvasMode: 'histogram' | 'sobel' | 'amplify' | 'ela' | null;
  ```

- [ ] **Step 2: Update `canvasModeLabels` and `recommendation` in `js/ui.ts`**

  In `updateAnalysisPanel`, add `ela` to `canvasModeLabels`:

  ```typescript
  // Before:
      const canvasModeLabels: Record<string, string> = {
          histogram: 'Histograma RGB',
          sobel: 'Detecção de Bordas (Sobel)',
          amplify: 'Amplificação de Diferenças',
      };
  // After:
      const canvasModeLabels: Record<string, string> = {
          histogram: 'Histograma RGB',
          sobel: 'Detecção de Bordas (Sobel)',
          amplify: 'Amplificação de Diferenças',
          ela: 'Error Level Analysis (ELA)',
      };
  ```

  Also add an ELA recommendation after the existing ones (around line 127):

  ```typescript
  // Before:
      else if (state.activeCanvasMode === 'histogram')
          rec = 'Veja a distribuição de cores no histograma';
  // After:
      else if (state.activeCanvasMode === 'histogram')
          rec = 'Veja a distribuição de cores no histograma';
      else if (state.activeCanvasMode === 'ela')
          rec = 'Regiões quentes (vermelho/branco) indicam adulteração';
  ```

  In `enableImageTools`, add `'elaBtn'` to the `toolIds` array:

  ```typescript
  // Before:
      const toolIds = [
          'histogramBtn',
          'sobelBtn',
          'amplifyBtn',
          'clearCanvasBtn',
          'zoomInBtn',
          'zoomOutBtn',
          'zoomResetBtn',
          'beforeAfterBtn',
          'exportBtn',
      ];
  // After:
      const toolIds = [
          'histogramBtn',
          'sobelBtn',
          'amplifyBtn',
          'clearCanvasBtn',
          'elaBtn',
          'zoomInBtn',
          'zoomOutBtn',
          'zoomResetBtn',
          'beforeAfterBtn',
          'exportBtn',
      ];
  ```

- [ ] **Step 3: Commit**

  ```bash
  cd /home/taynam/watermaker-check
  git add js/types.ts js/ui.ts
  git commit -m "feat(ela): extend types and analysis panel for ELA mode

  Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
  ```

---

## Task 2: TDD — `computeELA` + `thermalPalette` pure functions

**Files:**
- Create: `tests/ela.test.ts`
- Create: `js/ela.ts`

- [ ] **Step 1: Write the failing tests in `tests/ela.test.ts`**

  Create the file with this exact content:

  ```typescript
  import { describe, expect, it } from 'vitest';
  import { computeELA } from '../js/ela.js';
  import type { ImageDataLike } from '../js/types.js';

  function img(pixels: number[], width: number, height: number): ImageDataLike {
      return { data: new Uint8ClampedArray(pixels), width, height };
  }

  describe('computeELA', () => {
      it('identical images → score=0 and all pixels blue', () => {
          const pixels = [128, 64, 32, 255, 200, 100, 50, 255];
          const { imageData, score } = computeELA(img(pixels, 2, 1), img(pixels, 2, 1), 10);
          expect(score).toBe(0);
          // Both pixels should be blue (thermal cold: R=0, G=0, B=255)
          expect(imageData.data[0]).toBe(0);   // px0 R
          expect(imageData.data[1]).toBe(0);   // px0 G
          expect(imageData.data[2]).toBe(255); // px0 B
          expect(imageData.data[4]).toBe(0);   // px1 R
          expect(imageData.data[6]).toBe(255); // px1 B
      });

      it('amplification scales magnitude (diff=10, amp=5 → magnitude=50 → blue)', () => {
          // Single channel diff of 10; amp=5 → magnitude=50 (< 64, stays in blue zone)
          const orig = img([100, 0, 0, 255], 1, 1);
          const recomp = img([90, 0, 0, 255], 1, 1);
          const { imageData } = computeELA(orig, recomp, 5);
          // magnitude=50 → thermal blue [0, 0, 255]
          expect(imageData.data[0]).toBe(0);
          expect(imageData.data[1]).toBe(0);
          expect(imageData.data[2]).toBe(255);
      });

      it('magnitude is clamped at 255 → white output (thermal hot)', () => {
          // diff=765 (255+255+255), amp=100 → clamped to 255 → thermal white [255,255,255]
          const orig = img([255, 255, 255, 255], 1, 1);
          const recomp = img([0, 0, 0, 255], 1, 1);
          const { imageData } = computeELA(orig, recomp, 100);
          expect(imageData.data[0]).toBe(255); // R
          expect(imageData.data[1]).toBe(255); // G
          expect(imageData.data[2]).toBe(255); // B
      });

      it('magnitude=128 → green pixel (thermal mid)', () => {
          // diff = |138-10| = 128, amp=1 → magnitude=128
          // thermal(128): m<192, t=(128-128)/64=0 → [0, 255, 0] pure green
          const orig = img([138, 0, 0, 255], 1, 1);
          const recomp = img([10, 0, 0, 255], 1, 1);
          const { imageData } = computeELA(orig, recomp, 1);
          expect(imageData.data[0]).toBe(0);   // R
          expect(imageData.data[1]).toBe(255); // G
          expect(imageData.data[2]).toBe(0);   // B
      });

      it('score=100 for maximum pixel difference', () => {
          // diff=765, amp=1, magnitude=255 → mean=255 → score=round(255/255*100)=100
          const { score } = computeELA(
              img([255, 255, 255, 255], 1, 1),
              img([0, 0, 0, 255], 1, 1),
              1,
          );
          expect(score).toBe(100);
      });
  });
  ```

- [ ] **Step 2: Run test to confirm it fails**

  ```bash
  cd /home/taynam/watermaker-check && pnpm test -- --reporter=verbose 2>&1 | tail -20
  ```

  Expected: FAIL — `Cannot find module '../js/ela.js'`

- [ ] **Step 3: Create `js/ela.ts` with `thermalPalette`, `ELAResult`, and `computeELA`**

  Create the file with this exact content (only the pure functions — `renderELA` comes in Task 3):

  ```typescript
  import type { ImageDataLike } from './types.js';

  export interface ELAResult {
      imageData: ImageDataLike;
      /** Suspicion score: 0 (no manipulation) to 100 (high manipulation). */
      score: number;
  }

  /**
   * Maps a magnitude (0–255) to an RGB thermal colour:
   *   0–63   → blue
   *   64–127 → blue → green (lerp)
   *   128–191 → green → red (lerp)
   *   192–255 → red → white (lerp)
   */
  function thermalPalette(magnitude: number): [number, number, number] {
      const m = Math.max(0, Math.min(255, magnitude));
      if (m < 64) {
          return [0, 0, 255];
      } else if (m < 128) {
          const t = (m - 64) / 64;
          return [0, Math.round(255 * t), Math.round(255 * (1 - t))];
      } else if (m < 192) {
          const t = (m - 128) / 64;
          return [Math.round(255 * t), Math.round(255 * (1 - t)), 0];
      } else {
          const t = (m - 192) / 63;
          return [255, Math.round(255 * t), Math.round(255 * t)];
      }
  }

  /**
   * Pure ELA computation. No DOM access — safe to call from Vitest.
   *
   * Algorithm:
   *   For each pixel: diff = |origR−recompR| + |origG−recompG| + |origB−recompB|
   *                   magnitude = clamp(diff * amplification, 0, 255)
   *   Score = round(mean(magnitudes) / 255 * 100)
   *   Output = thermal palette applied to each magnitude
   */
  export function computeELA(
      original: ImageDataLike,
      recompressed: ImageDataLike,
      amplification: number = 10,
  ): ELAResult {
      const numPixels = original.width * original.height;
      const out = new Uint8ClampedArray(numPixels * 4);
      let totalMagnitude = 0;

      for (let i = 0; i < numPixels; i++) {
          const o = i * 4;
          const dr = Math.abs(original.data[o] - recompressed.data[o]);
          const dg = Math.abs(original.data[o + 1] - recompressed.data[o + 1]);
          const db = Math.abs(original.data[o + 2] - recompressed.data[o + 2]);
          const magnitude = Math.min(255, (dr + dg + db) * amplification);
          totalMagnitude += magnitude;
          const [r, g, b] = thermalPalette(magnitude);
          out[o] = r;
          out[o + 1] = g;
          out[o + 2] = b;
          out[o + 3] = 255;
      }

      const score = Math.round((totalMagnitude / numPixels / 255) * 100);
      return {
          imageData: { data: out, width: original.width, height: original.height },
          score,
      };
  }
  ```

- [ ] **Step 4: Run tests to confirm they pass**

  ```bash
  cd /home/taynam/watermaker-check && pnpm test -- --reporter=verbose 2>&1 | tail -25
  ```

  Expected: All ELA tests PASS (5 new tests + 7 existing = 12 total passing).

- [ ] **Step 5: Commit**

  ```bash
  cd /home/taynam/watermaker-check
  git add js/ela.ts tests/ela.test.ts
  git commit -m "feat(ela): add computeELA pure function with thermal palette (TDD)

  Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
  ```

---

## Task 3: Add `renderELA` DOM function to `js/ela.ts`

**Files:**
- Modify: `js/ela.ts` (append to end of file)

- [ ] **Step 1: Append `loadImage` helper and `renderELA` to `js/ela.ts`**

  Append the following to the end of `js/ela.ts` (after the `computeELA` function):

  ```typescript
  function loadImage(src: string): Promise<HTMLImageElement> {
      return new Promise((resolve, reject) => {
          const image = new Image();
          image.onload = () => resolve(image);
          image.onerror = reject;
          image.src = src;
      });
  }

  /**
   * Canvas-level orchestrator. Calls computeELA and renders the result.
   * @returns Suspicion score 0–100.
   * @throws SecurityError if the image is cross-origin.
   */
  export async function renderELA(
      img: HTMLImageElement,
      outputCanvas: HTMLCanvasElement,
      amplification: number,
  ): Promise<number> {
      const { naturalWidth: w, naturalHeight: h } = img;

      // Step 1: Capture original ImageData
      const tmp = document.createElement('canvas');
      tmp.width = w;
      tmp.height = h;
      const ctx = tmp.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      const originalData = ctx.getImageData(0, 0, w, h);

      // Step 2: Recompress at JPEG q=95
      const jpegUrl = tmp.toDataURL('image/jpeg', 0.95);
      const recompImg = await loadImage(jpegUrl);

      // Step 3: Capture recompressed ImageData (reuse same temp canvas)
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(recompImg, 0, 0);
      const recompData = ctx.getImageData(0, 0, w, h);

      // Step 4: Compute ELA
      const { imageData, score } = computeELA(originalData, recompData, amplification);

      // Step 5: Paint heatmap to output canvas
      outputCanvas.width = w;
      outputCanvas.height = h;
      const outCtx = outputCanvas.getContext('2d')!;
      const outImageData = outCtx.createImageData(w, h);
      outImageData.data.set(imageData.data);
      outCtx.putImageData(outImageData, 0, 0);

      return score;
  }
  ```

- [ ] **Step 2: Run tests to confirm nothing broke**

  ```bash
  cd /home/taynam/watermaker-check && pnpm test 2>&1 | tail -10
  ```

  Expected: 12 passing.

- [ ] **Step 3: Commit**

  ```bash
  cd /home/taynam/watermaker-check
  git add js/ela.ts
  git commit -m "feat(ela): add renderELA canvas orchestrator

  Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
  ```

---

## Task 4: Add ELA tab to `index.html`

**Files:**
- Modify: `index.html:38-42` (tab-nav) and `index.html:121` (after Tools tab-content)

- [ ] **Step 1: Add the ELA tab button to `.tab-nav`**

  In `index.html`, find the `.tab-nav` div (around line 38). Add the ELA button after the Tools button:

  ```html
  <!-- Before: -->
                  <button class="tab-btn" data-tab="tools">🛠 Tools</button>
              </div>
  <!-- After: -->
                  <button class="tab-btn" data-tab="tools">🛠 Tools</button>
                  <button class="tab-btn" data-tab="ela">🔬 ELA</button>
              </div>
  ```

- [ ] **Step 2: Add the ELA tab content panel**

  In `index.html`, find the closing `</div>` of the Tools tab-content (around line 121, after `</div>` closing the tools section). Add the ELA panel immediately after it, before the closing `</div>` of `.controls-panel`:

  ```html
              <!-- Tab: ELA — Error Level Analysis -->
              <div class="tab-content" data-tab="ela">
                  <p class="tab-description">Error Level Analysis — detecta regiões adulteradas por diferenças de compressão JPEG</p>
                  <div class="canvas-controls">
                      <button class="canvas-btn" id="elaBtn" disabled>🔬 Analisar ELA</button>
                  </div>
                  <div class="control-group" style="margin-top: 16px;">
                      <label>
                          🎚 Sensibilidade: <span class="value-display" id="elaAmplificationValue">10</span>
                      </label>
                      <input type="range" class="slider" id="elaAmplification" min="1" max="30" value="10">
                  </div>
                  <div id="elaSuspicionScore" style="display:none; margin-top: 12px; font-size: 1.1em;">
                      Score de suspeita: <span id="elaScoreValue" style="font-weight: bold;">0%</span>
                  </div>
                  <div id="elaCanvasContainer" style="display:none; margin-top: 16px; overflow:auto;">
                      <canvas id="elaCanvas" style="max-width:100%; display:block;"></canvas>
                  </div>
              </div>
  ```

  The exact insertion point is between the closing `</div>` of the tools tab-content and the closing `</div>` of `.controls-panel` (which itself closes before `</div>` of `.main-content`).

- [ ] **Step 3: Commit**

  ```bash
  cd /home/taynam/watermaker-check
  git add index.html
  git commit -m "feat(ela): add ELA tab and panel to index.html

  Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
  ```

---

## Task 5: Wire up ELA in `js/main.ts`

**Files:**
- Modify: `js/main.ts:1` (import)
- Modify: `js/main.ts:31-44` (`onImageLoaded`)
- Modify: `js/main.ts:222-230` (bootstrap section)

- [ ] **Step 1: Add import for `renderELA` at the top of `js/main.ts`**

  ```typescript
  // Before (line 1):
  import { clearOverlay, renderAmplify, renderHistogram, renderSobel } from './canvas.js';
  // After:
  import { clearOverlay, renderAmplify, renderHistogram, renderSobel } from './canvas.js';
  import { renderELA } from './ela.js';
  ```

- [ ] **Step 2: Add `initElaTab()` function**

  Add the following function to `js/main.ts`, after the `initExport()` function (before the `// Bootstrap` comment):

  ```typescript
  function initElaTab(): void {
      const elaBtn = getEl<HTMLButtonElement>('elaBtn');
      const elaSlider = getEl<HTMLInputElement>('elaAmplification');
      const elaSliderValue = getEl<HTMLElement>('elaAmplificationValue');
      const elaScore = getEl<HTMLElement>('elaSuspicionScore');
      const elaScoreValue = getEl<HTMLElement>('elaScoreValue');
      const elaCanvasContainer = getEl<HTMLElement>('elaCanvasContainer');
      const elaCanvas = getEl<HTMLCanvasElement>('elaCanvas');

      elaSlider.addEventListener('input', () => {
          elaSliderValue.textContent = elaSlider.value;
      });

      elaBtn.addEventListener('click', () => {
          if (!state.image) return;
          elaBtn.disabled = true;
          elaBtn.textContent = '⏳ Analisando...';
          renderELA(state.image, elaCanvas, parseInt(elaSlider.value, 10))
              .then((score) => {
                  elaCanvasContainer.style.display = '';
                  elaScore.style.display = '';
                  const label =
                      score < 30 ? `🟢 ${score}%` : score < 60 ? `🟡 ${score}%` : `🔴 ${score}%`;
                  elaScoreValue.textContent = label;
                  state.activeCanvasMode = 'ela';
                  updateAnalysisPanel(state);
              })
              .catch((e: unknown) => {
                  if (e instanceof Error && e.name === 'SecurityError')
                      alert('ELA não disponível para imagens de origem externa');
                  else
                      alert(
                          `Erro ao analisar: ${e instanceof Error ? e.message : String(e)}`,
                      );
              })
              .finally(() => {
                  elaBtn.disabled = false;
                  elaBtn.textContent = '🔬 Analisar ELA';
              });
      });
  }
  ```

- [ ] **Step 3: Reset ELA state in `onImageLoaded`**

  In `onImageLoaded`, add ELA reset lines after `clearOverlay(overlay)`:

  ```typescript
  // Before:
      clearOverlay(overlay);
      getEl<HTMLElement>('histogramContainer').style.display = 'none';
  // After:
      clearOverlay(overlay);
      getEl<HTMLElement>('histogramContainer').style.display = 'none';
      getEl<HTMLElement>('elaCanvasContainer').style.display = 'none';
      getEl<HTMLElement>('elaSuspicionScore').style.display = 'none';
  ```

- [ ] **Step 4: Add `initElaTab()` to the bootstrap section**

  ```typescript
  // Before:
  initExport();
  updateAnalysisPanel(state);
  // After:
  initExport();
  initElaTab();
  updateAnalysisPanel(state);
  ```

- [ ] **Step 5: Run tests to confirm nothing broke**

  ```bash
  cd /home/taynam/watermaker-check && pnpm test 2>&1 | tail -10
  ```

  Expected: 12 passing.

- [ ] **Step 6: Commit**

  ```bash
  cd /home/taynam/watermaker-check
  git add js/main.ts
  git commit -m "feat(ela): wire up ELA tab in main.ts with renderELA integration

  Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
  ```

---

## Task 6: Final verification and push

**Files:** None (verification only)

- [ ] **Step 1: Run full test suite**

  ```bash
  cd /home/taynam/watermaker-check && pnpm test -- --reporter=verbose 2>&1
  ```

  Expected: 12 tests pass (7 canvas + 5 ela). Zero failures.

- [ ] **Step 2: Run Biome check**

  ```bash
  cd /home/taynam/watermaker-check && pnpm check 2>&1
  ```

  Expected: no errors, no warnings.
  If there are warnings, run `pnpm run check -- --write` then `pnpm check` again.

- [ ] **Step 3: Run build**

  ```bash
  cd /home/taynam/watermaker-check && pnpm run build 2>&1 | tail -20
  ```

  Expected: `✓ built in ...ms` with no TypeScript errors.

- [ ] **Step 4: Push to remote**

  ```bash
  cd /home/taynam/watermaker-check && git push
  ```

  Expected: All commits pushed successfully.
