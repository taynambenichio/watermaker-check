# Dual-Side Document Analysis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow the forensics pipeline to analyse one OR two sides (front+back) of a document so the MRZ module no longer false-flags a missing MRZ on document fronts.

**Architecture:** Introduce a `mode` (`front-only` | `back-only` | `both`) plus per-side state (`sides.front`, `sides.back`) in `AppState`. Pipeline gains a `side` parameter; when `side === 'front'` the MRZ step short-circuits and emits `notApplicable: true`. UI renders one or two drop-zones and, in `both` mode, a tab bar between Frente/Verso plus an aggregated score header.

**Tech Stack:** React 18 + TypeScript, Vite, Vitest, Tesseract.js (existing MRZ OCR), Tailwind. Build/test commands: `npm test --run`, `npm run build`, `npx tsc --noEmit` (per repo memory — uses **npm**, not pnpm).

**Spec reference:** [`docs/superpowers/specs/2026-05-20-dual-side-analysis-design.md`](../specs/2026-05-20-dual-side-analysis-design.md)

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `js/forensics/mrz.ts` | Modify | Add `notApplicable?: boolean` to `MrzResult`; export `emptyMrzResult()` helper |
| `js/forensics/mrz-authenticity.ts` | Modify | Short-circuit `validateMrzAuthenticity` when `mrz.notApplicable` |
| `js/forensics/index.ts` | Modify | Add `side: Side` parameter to `runForensicPipeline`, short-circuit MRZ on `'front'` |
| `js/types.ts` | Modify | Export `Side`, `AnalysisMode` |
| `js/forensics/report.ts` | Modify | Skip MRZ scoring contribution when `mrzResult.notApplicable` |
| `src/types.ts` | Modify | New `AppState` shape (`mode`, `sides`, `activeSide`); new actions; reducer rewrite |
| `src/hooks/useForensics.ts` | Modify | Accept `side` argument; dispatch side-aware actions |
| `src/hooks/useImageLoader.ts` | Modify | Caller now passes `side`; emit side-aware payload |
| `src/App.tsx` | Modify | Wire mode selector + multi-side load + parallel analysis |
| `src/components/DocPane.tsx` | Modify | Single vs dual drop-zone layout based on `mode` |
| `src/components/forensics/ForensicsContent.tsx` | Modify | Read per-side result via `activeSide`; show tab bar in `both` mode |
| `src/components/forensics/modules/MrzModule.tsx` | Modify | Render `Não aplicável` neutral state when result has `notApplicable: true` |
| `src/components/layout/ModeSelector.tsx` | Create | Segmented control (Só Frente / Só Verso / Frente + Verso) |
| `src/components/layout/SideTabs.tsx` | Create | Frente / Verso tab bar shown only in `both` mode |
| `src/components/forensics/AggregatedScore.tsx` | Create | Mean-of-two header with `⚠ inconsistência` badge when |Δ| ≥ 25 |
| `tests/app-state.test.ts` | Modify | New mode/side reducer tests |
| `tests/forensics-pipeline.test.ts` | Create | Pipeline `side: 'front'` short-circuits MRZ |
| `tests/mrz-authenticity.test.ts` | Modify | `notApplicable` skipped in score |
| `tests/forensics-content.test.tsx` | Modify | `notApplicable` MRZ render; `both` mode tab swap |
| `tests/aggregated-score.test.tsx` | Create | Mean + inconsistency badge logic |

---

## Task 1: Add `notApplicable` to MrzResult and emptyMrzResult helper

**Files:**
- Modify: `js/forensics/mrz.ts:10-27` (interface), add export at bottom
- Test: `tests/mrz.test.ts` (existing)

- [ ] **Step 1: Write the failing test**

Add to `tests/mrz.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { emptyMrzResult, parseMrz } from '../js/forensics/mrz.js';

describe('emptyMrzResult', () => {
    it('returns a non-valid MrzResult shape with no errors', () => {
        const r = emptyMrzResult();
        expect(r.valid).toBe(false);
        expect(r.documentType).toBeNull();
        expect(r.errors).toEqual([]);
        expect(r.checks).toEqual([]);
        expect(r.fields.documentNumber).toBeNull();
        expect(r.normalizedLines).toEqual([]);
    });

    it('supports the optional notApplicable flag', () => {
        const r = { ...emptyMrzResult(), notApplicable: true };
        expect(r.notApplicable).toBe(true);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test --run -- tests/mrz.test.ts`
Expected: FAIL — `emptyMrzResult` is not exported.

- [ ] **Step 3: Add `notApplicable` to interface and export helper**

In `js/forensics/mrz.ts`, change interface (around line 10-27) to add the flag:

```typescript
export interface MrzResult {
    valid: boolean;
    documentType: MrzDocumentType | null;
    errors: string[];
    checks: MrzCheck[];
    fields: {
        documentCode: string | null;
        issuingState: string | null;
        documentNumber: string | null;
        nationality: string | null;
        birthDate: string | null;
        sex: string | null;
        expiryDate: string | null;
        surname: string | null;
        givenNames: string[];
    };
    normalizedLines: string[];
    /** True when MRZ analysis is not applicable for this image (e.g. front side of a TD1 card). */
    notApplicable?: boolean;
}
```

Then append at the end of the file:

```typescript
export function emptyMrzResult(): MrzResult {
    return baseResult([]);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test --run -- tests/mrz.test.ts`
Expected: PASS (all existing tests + new ones).

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add js/forensics/mrz.ts tests/mrz.test.ts
git commit -m "feat(mrz): add notApplicable flag and emptyMrzResult helper"
```

---

## Task 2: MRZ authenticity short-circuits on notApplicable

**Files:**
- Modify: `js/forensics/mrz-authenticity.ts:432` (`validateMrzAuthenticity`)
- Test: `tests/mrz-authenticity.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `tests/mrz-authenticity.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { emptyMrzResult } from '../js/forensics/mrz.js';
import { validateMrzAuthenticity } from '../js/forensics/mrz-authenticity.js';

describe('validateMrzAuthenticity — notApplicable', () => {
    it('returns authentic with suspicionScore 0 and empty checks when notApplicable', () => {
        const result = validateMrzAuthenticity({ ...emptyMrzResult(), notApplicable: true });
        expect(result.authentic).toBe(true);
        expect(result.suspicionScore).toBe(0);
        expect(result.checks).toEqual([]);
        expect(result.recommendation).toMatch(/não aplicável/i);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test --run -- tests/mrz-authenticity.test.ts`
Expected: FAIL — the function currently runs all checks regardless.

- [ ] **Step 3: Add the short-circuit**

In `js/forensics/mrz-authenticity.ts`, at the very top of `validateMrzAuthenticity` (around line 432), insert:

```typescript
export function validateMrzAuthenticity(mrz: MrzResult): MrzAuthenticityResult {
    if (mrz.notApplicable) {
        return {
            authentic: true,
            suspicionScore: 0,
            checks: [],
            recommendation: 'MRZ não aplicável para esta face do documento.',
        };
    }
    // ... existing body unchanged
```

(Keep the rest of the function as-is.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test --run -- tests/mrz-authenticity.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add js/forensics/mrz-authenticity.ts tests/mrz-authenticity.test.ts
git commit -m "feat(mrz-authenticity): short-circuit when notApplicable"
```

---

## Task 3: Report skips MRZ scoring when notApplicable

**Files:**
- Modify: `js/forensics/report.ts:14-22` (mrzScore branch)
- Test: `tests/forensics-report.test.ts` (existing)

- [ ] **Step 1: Write the failing test**

Add to `tests/forensics-report.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { emptyMrzResult } from '../js/forensics/mrz.js';
import { buildReport } from '../js/forensics/report.js';

describe('buildReport — notApplicable MRZ', () => {
    it('treats a notApplicable MRZ as neutral (does not change suspicion vs. null)', () => {
        const args = [10, 10, 10, 10, 10, 10, 10, 10] as const;
        const withoutMrz = buildReport(...args, null);
        const withNa = buildReport(...args, { ...emptyMrzResult(), notApplicable: true });
        expect(withNa.suspicionScore).toBe(withoutMrz.suspicionScore);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test --run -- tests/forensics-report.test.ts`
Expected: FAIL — currently a non-null `mrzResult` runs through `validateMrzAuthenticity`.

- [ ] **Step 3: Update buildReport**

In `js/forensics/report.ts`, replace lines 15-22 with:

```typescript
    let mrzScore = 50; // Neutral if no MRZ or if MRZ is not applicable
    if (mrzResult && !mrzResult.notApplicable) {
        const auth = validateMrzAuthenticity(mrzResult);
        mrzScore = 100 - auth.suspicionScore;
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test --run -- tests/forensics-report.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add js/forensics/report.ts tests/forensics-report.test.ts
git commit -m "feat(report): treat notApplicable MRZ as neutral"
```

---

## Task 4: Export Side and AnalysisMode types

**Files:**
- Modify: `js/types.ts`

- [ ] **Step 1: Add types**

Append to `js/types.ts`:

```typescript
export type Side = 'front' | 'back';
export type AnalysisMode = 'front-only' | 'back-only' | 'both';
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add js/types.ts
git commit -m "feat(types): export Side and AnalysisMode"
```

---

## Task 5: Add `side` parameter to runForensicPipeline (MRZ short-circuit)

**Files:**
- Modify: `js/forensics/index.ts:23-114`
- Create: `tests/forensics-pipeline.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/forensics-pipeline.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../js/forensics/mrz-ocr.js', () => ({
    recognizeMrzFromImage: vi.fn(),
}));

import { recognizeMrzFromImage } from '../js/forensics/mrz-ocr.js';
import { runForensicPipeline } from '../js/forensics/index.js';

function fakeImage(): HTMLImageElement {
    const c = document.createElement('canvas');
    c.width = 16;
    c.height = 16;
    const img = new Image();
    Object.defineProperty(img, 'naturalWidth', { value: 16 });
    Object.defineProperty(img, 'naturalHeight', { value: 16 });
    Object.defineProperty(img, 'complete', { value: true });
    img.src = c.toDataURL();
    return img;
}

describe('runForensicPipeline — side parameter', () => {
    beforeEach(() => {
        (recognizeMrzFromImage as ReturnType<typeof vi.fn>).mockReset();
    });

    it("does NOT call recognizeMrzFromImage when side='front' and marks result notApplicable", async () => {
        const img = fakeImage();
        const result = await runForensicPipeline(img, undefined, null, 'front');
        expect(recognizeMrzFromImage).not.toHaveBeenCalled();
        expect(result.mrzResult).not.toBeNull();
        expect(result.mrzResult?.notApplicable).toBe(true);
    });

    it("DOES call recognizeMrzFromImage when side='back'", async () => {
        (recognizeMrzFromImage as ReturnType<typeof vi.fn>).mockResolvedValue({
            rawText: '',
            parsed: { valid: false, documentType: null, errors: [], checks: [], fields: {
                documentCode: null, issuingState: null, documentNumber: null, nationality: null,
                birthDate: null, sex: null, expiryDate: null, surname: null, givenNames: [],
            }, normalizedLines: [] },
        });
        const img = fakeImage();
        await runForensicPipeline(img, undefined, null, 'back');
        expect(recognizeMrzFromImage).toHaveBeenCalledOnce();
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test --run -- tests/forensics-pipeline.test.ts`
Expected: FAIL — pipeline does not yet accept a `side` argument.

- [ ] **Step 3: Update pipeline signature**

In `js/forensics/index.ts`:

1. Add import at top:

```typescript
import { emptyMrzResult } from './mrz.js';
import type { Side } from '../types.js';
```

2. Change signature (line 23-27) and MRZ block (line 104-114) to:

```typescript
export async function runForensicPipeline(
    img: HTMLImageElement,
    onProgress?: PipelineProgressCallback,
    sourceFile?: File | null,
    side: Side = 'back',
): Promise<ForensicPipelineResult> {
```

Replace the MRZ block (currently lines 104-114) with:

```typescript
    // Phase 3 (continued): MRZ OCR + parsing (skipped on the document front)
    let mrzResult: MrzResult | null = null;
    if (side === 'front') {
        mrzResult = { ...emptyMrzResult(), notApplicable: true };
    } else if (img) {
        try {
            const ocrResult = await recognizeMrzFromImage(img);
            mrzResult = ocrResult.parsed;
        } catch (error) {
            console.warn('[Pipeline] MRZ OCR failed:', error);
            mrzResult = parseMrz('');
        }
    }
```

(`MrzResult` is already imported transitively; add `import type { MrzResult } from '../types.js';` if `tsc --noEmit` complains.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test --run -- tests/forensics-pipeline.test.ts`
Expected: PASS (both cases).

- [ ] **Step 5: Run full suite**

Run: `npm test --run`
Expected: ALL pass. Existing pipeline callers default to `side='back'`, so behaviour is unchanged.

- [ ] **Step 6: Commit**

```bash
git add js/forensics/index.ts tests/forensics-pipeline.test.ts
git commit -m "feat(pipeline): add side parameter, skip MRZ on front"
```

---

## Task 6: New `AppState` shape — mode, sides, activeSide

**Files:**
- Modify: `src/types.ts` (entire file rewrite of state shape)
- Test: `tests/app-state.test.ts`

- [ ] **Step 1: Write failing tests**

Replace the body of `tests/app-state.test.ts` with (or append, keeping existing tests passing — see step 3 for migration helper):

```typescript
import { describe, it, expect } from 'vitest';
import { appReducer, initialAppState, type AppState } from '../src/types.ts';

function fakeImg(): HTMLImageElement {
    return document.createElement('img');
}

describe('appReducer — mode & sides', () => {
    it('defaults to mode="both" with both sides empty and activeSide="back"', () => {
        expect(initialAppState.mode).toBe('both');
        expect(initialAppState.sides.front).toBeNull();
        expect(initialAppState.sides.back).toBeNull();
        expect(initialAppState.activeSide).toBe('back');
    });

    it('SET_MODE clears sides and updates activeSide', () => {
        const loaded: AppState = {
            ...initialAppState,
            sides: {
                front: {
                    sourceFile: new File([''], 'f.png'),
                    imageElement: fakeImg(),
                    objectUrl: 'blob:f',
                    forensicResult: null,
                    progress: {},
                    isAnalyzing: false,
                },
                back: null,
            },
        };
        const next = appReducer(loaded, { type: 'SET_MODE', mode: 'back-only' });
        expect(next.mode).toBe('back-only');
        expect(next.sides.front).toBeNull();
        expect(next.sides.back).toBeNull();
        expect(next.activeSide).toBe('back');
    });

    it('SET_SIDE_IMAGE populates the requested side only', () => {
        const img = fakeImg();
        const file = new File([''], 'b.png');
        const next = appReducer(initialAppState, {
            type: 'SET_SIDE_IMAGE',
            side: 'back',
            imageElement: img,
            sourceFile: file,
            objectUrl: 'blob:b',
        });
        expect(next.sides.back?.imageElement).toBe(img);
        expect(next.sides.back?.sourceFile).toBe(file);
        expect(next.sides.front).toBeNull();
    });

    it('CLEAR_SIDE empties the slot', () => {
        const loaded = appReducer(initialAppState, {
            type: 'SET_SIDE_IMAGE',
            side: 'back',
            imageElement: fakeImg(),
            sourceFile: new File([''], 'b.png'),
            objectUrl: 'blob:b',
        });
        const cleared = appReducer(loaded, { type: 'CLEAR_SIDE', side: 'back' });
        expect(cleared.sides.back).toBeNull();
    });

    it('SET_ACTIVE_SIDE only toggles the UI flag', () => {
        const next = appReducer(initialAppState, { type: 'SET_ACTIVE_SIDE', side: 'front' });
        expect(next.activeSide).toBe('front');
        expect(next.sides).toEqual(initialAppState.sides);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test --run -- tests/app-state.test.ts`
Expected: FAIL — new actions / state shape missing.

- [ ] **Step 3: Rewrite `src/types.ts`**

Replace the bottom half of `src/types.ts` (everything from `export interface AppState` onwards) with:

```typescript
import type { AnalysisMode, Side } from '../js/types.js';
export type { AnalysisMode, Side };

export interface SideState {
    sourceFile: File;
    imageElement: HTMLImageElement;
    objectUrl: string;
    forensicResult: ForensicPipelineResult | null;
    progress: Partial<Record<PipelineStep, 'running' | 'done' | 'error'>>;
    isAnalyzing: boolean;
}

export interface AppState {
    mode: AnalysisMode;
    sides: {
        front: SideState | null;
        back: SideState | null;
    };
    activeSide: Side;
    ghostLevelIndex: number;
    activeTab: ActiveTab;
    canvasMode: CanvasMode;
    beforeAfterActive: boolean;
    zoom: number;
    filters: FilterState;
    elaAmplification: number;
    elaScore: number | null;
}

function defaultActiveSide(mode: AnalysisMode): Side {
    return mode === 'front-only' ? 'front' : 'back';
}

export const initialAppState: AppState = {
    mode: 'both',
    sides: { front: null, back: null },
    activeSide: 'back',
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
    | { type: 'SET_MODE'; mode: AnalysisMode }
    | {
          type: 'SET_SIDE_IMAGE';
          side: Side;
          imageElement: HTMLImageElement;
          sourceFile: File;
          objectUrl: string;
      }
    | { type: 'CLEAR_SIDE'; side: Side }
    | { type: 'SET_ACTIVE_SIDE'; side: Side }
    | { type: 'SIDE_ANALYSIS_STARTED'; side: Side }
    | { type: 'SIDE_STEP_PROGRESS'; side: Side; step: PipelineStep; status: 'running' | 'done' | 'error' }
    | { type: 'SIDE_ANALYSIS_DONE'; side: Side; result: ForensicPipelineResult }
    | { type: 'SIDE_ANALYSIS_ERROR'; side: Side }
    | { type: 'SET_TAB'; tab: ActiveTab }
    | { type: 'SET_GHOST_LEVEL'; index: number }
    | { type: 'SET_ZOOM'; zoom: number }
    | { type: 'ADJUST_ZOOM'; delta: number }
    | { type: 'SET_CANVAS_MODE'; mode: CanvasMode }
    | { type: 'TOGGLE_BEFORE_AFTER' }
    | { type: 'SET_FILTER'; key: keyof Omit<FilterState, 'preset'>; value: number }
    | { type: 'SET_PRESET'; preset: string; values: Omit<FilterState, 'preset'> }
    | { type: 'RESET_FILTERS' }
    | { type: 'SET_ELA_AMP'; value: number }
    | { type: 'SET_ELA_SCORE'; score: number | null };

function updateSide(
    state: AppState,
    side: Side,
    updater: (prev: SideState | null) => SideState | null,
): AppState {
    return { ...state, sides: { ...state.sides, [side]: updater(state.sides[side]) } };
}

export function appReducer(state: AppState, action: AppAction): AppState {
    switch (action.type) {
        case 'SET_MODE': {
            // Revoke object URLs we are about to drop
            if (state.sides.front?.objectUrl) URL.revokeObjectURL(state.sides.front.objectUrl);
            if (state.sides.back?.objectUrl) URL.revokeObjectURL(state.sides.back.objectUrl);
            return {
                ...state,
                mode: action.mode,
                sides: { front: null, back: null },
                activeSide: defaultActiveSide(action.mode),
            };
        }
        case 'SET_SIDE_IMAGE': {
            const prev = state.sides[action.side];
            if (prev?.objectUrl) URL.revokeObjectURL(prev.objectUrl);
            return updateSide(state, action.side, () => ({
                sourceFile: action.sourceFile,
                imageElement: action.imageElement,
                objectUrl: action.objectUrl,
                forensicResult: null,
                progress: {},
                isAnalyzing: false,
            }));
        }
        case 'CLEAR_SIDE': {
            const prev = state.sides[action.side];
            if (prev?.objectUrl) URL.revokeObjectURL(prev.objectUrl);
            return updateSide(state, action.side, () => null);
        }
        case 'SET_ACTIVE_SIDE':
            return { ...state, activeSide: action.side };
        case 'SIDE_ANALYSIS_STARTED':
            return updateSide(state, action.side, (s) =>
                s ? { ...s, isAnalyzing: true, progress: {}, forensicResult: null } : s,
            );
        case 'SIDE_STEP_PROGRESS':
            return updateSide(state, action.side, (s) =>
                s ? { ...s, progress: { ...s.progress, [action.step]: action.status } } : s,
            );
        case 'SIDE_ANALYSIS_DONE':
            return updateSide(state, action.side, (s) =>
                s
                    ? { ...s, isAnalyzing: false, progress: {}, forensicResult: action.result }
                    : s,
            );
        case 'SIDE_ANALYSIS_ERROR':
            return updateSide(state, action.side, (s) =>
                s ? { ...s, isAnalyzing: false, progress: {} } : s,
            );
        case 'SET_TAB':
            return { ...state, activeTab: action.tab };
        case 'SET_GHOST_LEVEL':
            return { ...state, ghostLevelIndex: action.index };
        case 'SET_ZOOM':
            return {
                ...state,
                zoom: Math.max(0.5, Math.min(4, Math.round(action.zoom * 100) / 100)),
            };
        case 'ADJUST_ZOOM':
            return {
                ...state,
                zoom: Math.max(
                    0.5,
                    Math.min(4, Math.round((state.zoom + action.delta) * 100) / 100),
                ),
            };
        case 'SET_CANVAS_MODE':
            return { ...state, canvasMode: action.mode };
        case 'TOGGLE_BEFORE_AFTER':
            return { ...state, beforeAfterActive: !state.beforeAfterActive };
        case 'SET_FILTER':
            return {
                ...state,
                filters: { ...state.filters, [action.key]: action.value, preset: null },
            };
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

/** Convenience: returns the SideState currently visible in the UI. */
export function getActiveSideState(state: AppState): SideState | null {
    return state.sides[state.activeSide];
}
```

(Keep the top of the file — imports, `ActiveTab`, `CanvasMode`, `FilterState`, `DEFAULT_FILTERS`, `filtersToCSS` — unchanged.)

- [ ] **Step 4: Run state tests**

Run: `npm test --run -- tests/app-state.test.ts`
Expected: PASS.

- [ ] **Step 5: Type-check (expect many failures from callers — fixed in next tasks)**

Run: `npx tsc --noEmit`
Expected: errors in `src/App.tsx`, `src/hooks/useForensics.ts`, `src/components/DocPane.tsx`, etc. — these are addressed by Tasks 7-11. **Do not commit yet** — bundle with Task 7.

---

## Task 7: Migrate `useForensics` hook to side-aware dispatch

**Files:**
- Modify: `src/hooks/useForensics.ts`

- [ ] **Step 1: Write the failing test**

Skip — covered indirectly by the pipeline integration tests. (Logic of the hook is a thin wrapper.)

- [ ] **Step 2: Rewrite hook**

Replace `src/hooks/useForensics.ts` with:

```typescript
import { type Dispatch, useCallback } from 'react';
import { runForensicPipeline } from '../../js/forensics/index.js';
import type { PipelineStep, Side } from '../../js/types.js';
import type { AppAction } from '../types.ts';

export function useForensics(dispatch: Dispatch<AppAction>) {
    const analyze = useCallback(
        async (
            side: Side,
            img: HTMLImageElement,
            sourceFile: File | null,
        ): Promise<void> => {
            dispatch({ type: 'SIDE_ANALYSIS_STARTED', side });
            try {
                const result = await runForensicPipeline(
                    img,
                    (step: PipelineStep, status: 'running' | 'done' | 'error') => {
                        dispatch({ type: 'SIDE_STEP_PROGRESS', side, step, status });
                    },
                    sourceFile,
                    side,
                );
                dispatch({ type: 'SIDE_ANALYSIS_DONE', side, result });
            } catch (err) {
                console.error(`Forensic pipeline failed for side=${side}:`, err);
                dispatch({ type: 'SIDE_ANALYSIS_ERROR', side });
            }
        },
        [dispatch],
    );

    return { analyze };
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: errors remaining ONLY in `src/App.tsx`, `src/components/DocPane.tsx`, `src/components/forensics/ForensicsContent.tsx`, `src/components/RightPanel.tsx`, `src/components/layout/TopBar.tsx` (which read `state.imageElement` / `state.forensicResult` / `state.sourceFile` / `state.isAnalyzing` / `state.progress`). Fix in following tasks.

---

## Task 8: Update `useImageLoader` and `App.tsx` for side-aware loading

**Files:**
- Modify: `src/hooks/useImageLoader.ts` — keep API; signature unchanged (it already returns just data, callback decides what to do).
- Modify: `src/App.tsx`

- [ ] **Step 1: Inspect existing `useImageLoader`**

Read `src/hooks/useImageLoader.ts`. The hook accepts an `onLoaded` callback receiving `{ imageElement, sourceFile, objectUrl }`. It is **side-agnostic** — App.tsx now decides which side a load belongs to.

- [ ] **Step 2: Rewrite `src/App.tsx`**

Replace entire file with:

```typescript
import {
    type ChangeEvent,
    useCallback,
    useEffect,
    useMemo,
    useRef,
} from 'react';
import { DocPane } from './components/DocPane.tsx';
import { TabBar } from './components/layout/TabBar.tsx';
import { TopBar } from './components/layout/TopBar.tsx';
import { RightPanel } from './components/RightPanel.tsx';
import { useForensics } from './hooks/useForensics.ts';
import { useImageLoader } from './hooks/useImageLoader.ts';
import {
    appReducer,
    initialAppState,
    getActiveSideState,
    type Side,
} from './types.ts';
import { useReducer, useState } from 'react';

export default function App() {
    const [state, dispatch] = useReducer(appReducer, initialAppState);
    const imageRef = useRef<HTMLImageElement>(null);
    const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
    const frontInputRef = useRef<HTMLInputElement>(null);
    const backInputRef = useRef<HTMLInputElement>(null);
    const [pendingSide, setPendingSide] = useState<Side>('back');

    const { analyze } = useForensics(dispatch);

    const handleImageLoaded = useCallback(
        (data: { imageElement: HTMLImageElement; sourceFile: File; objectUrl: string }) => {
            dispatch({
                type: 'SET_SIDE_IMAGE',
                side: pendingSide,
                imageElement: data.imageElement,
                sourceFile: data.sourceFile,
                objectUrl: data.objectUrl,
            });
        },
        [pendingSide],
    );

    const { loadFile, loadUrl } = useImageLoader(handleImageLoaded);

    // Auto-analyze each side when its image first appears and no result yet.
    useEffect(() => {
        const front = state.sides.front;
        if (front?.imageElement && !front.forensicResult && !front.isAnalyzing) {
            void analyze('front', front.imageElement, front.sourceFile ?? null);
        }
    }, [state.sides.front?.imageElement]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        const back = state.sides.back;
        if (back?.imageElement && !back.forensicResult && !back.isAnalyzing) {
            void analyze('back', back.imageElement, back.sourceFile ?? null);
        }
    }, [state.sides.back?.imageElement]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleReanalyze = useCallback(() => {
        const active = getActiveSideState(state);
        if (active?.imageElement) {
            void analyze(state.activeSide, active.imageElement, active.sourceFile ?? null);
        }
    }, [state, analyze]);

    const handleFileSelect = useCallback((side: Side) => {
        setPendingSide(side);
        (side === 'front' ? frontInputRef : backInputRef).current?.click();
    }, []);

    const handleSampleLoad = useCallback(() => {
        setPendingSide('back');
        loadUrl('example.png');
    }, [loadUrl]);

    const handleFileInputChange = useCallback(
        (side: Side) => (e: ChangeEvent<HTMLInputElement>) => {
            const file = e.target.files?.[0];
            if (!file) return;
            setPendingSide(side);
            void loadFile(file).catch((error) => {
                console.error('[App] Failed to load selected file:', error);
            });
            // Allow re-selecting the same file
            e.target.value = '';
        },
        [loadFile],
    );

    const handleFileDrop = useCallback(
        (side: Side, file: File) => {
            setPendingSide(side);
            return loadFile(file);
        },
        [loadFile],
    );

    const activeSideState = useMemo(() => getActiveSideState(state), [state]);

    return (
        <div className="h-screen w-screen flex flex-col overflow-hidden bg-bg font-sans text-text">
            <TopBar state={state} onReanalyze={handleReanalyze} />
            <TabBar
                activeTab={state.activeTab}
                onTabChange={(tab) => dispatch({ type: 'SET_TAB', tab })}
            />
            <main className="flex flex-1 overflow-hidden">
                <DocPane
                    state={state}
                    dispatch={dispatch}
                    imageRef={imageRef}
                    overlayCanvasRef={overlayCanvasRef}
                    activeSideState={activeSideState}
                    onFileDrop={handleFileDrop}
                    onSampleLoad={handleSampleLoad}
                    onFileSelect={handleFileSelect}
                    frontInputRef={frontInputRef}
                    backInputRef={backInputRef}
                    onFileInputChange={handleFileInputChange}
                />
                <RightPanel
                    state={state}
                    dispatch={dispatch}
                    imageRef={imageRef}
                    overlayCanvasRef={overlayCanvasRef}
                />
            </main>
        </div>
    );
}
```

- [ ] **Step 3: Commit Tasks 6+7+8 together**

(Type-check still has errors in DocPane/TopBar/etc., which are fixed below — but keep them isolated.)

Run: `npm test --run -- tests/app-state.test.ts`
Expected: PASS.

```bash
git add src/types.ts src/hooks/useForensics.ts src/App.tsx tests/app-state.test.ts
git commit -m "feat(state): per-side AppState with mode + activeSide"
```

(`npx tsc --noEmit` will still fail across UI files — fixed in Tasks 9-13.)

---

## Task 9: Update `TopBar` to read from active side

**Files:**
- Modify: `src/components/layout/TopBar.tsx`
- Test: `tests/top-bar.test.tsx`

- [ ] **Step 1: Open `src/components/layout/TopBar.tsx` and identify usages**

Run: `grep -n 'state\.' src/components/layout/TopBar.tsx`

For every direct access of `state.imageElement`, `state.sourceFile`, `state.isAnalyzing`, `state.progress`, `state.forensicResult` — replace with the equivalent from the active side via:

```typescript
import { getActiveSideState } from '../../types.ts';
// inside the component:
const active = getActiveSideState(state);
const imageElement = active?.imageElement ?? null;
const sourceFile = active?.sourceFile ?? null;
const isAnalyzing = active?.isAnalyzing ?? false;
const progress = active?.progress ?? {};
const forensicResult = active?.forensicResult ?? null;
```

Then use the local variables in the JSX where `state.X` was used before.

- [ ] **Step 2: Update `tests/top-bar.test.tsx`**

Where it constructs an `AppState`, switch to the new shape. Add a helper at the top of the test file:

```typescript
function makeSideState(overrides: Partial<import('../src/types.ts').SideState> = {}): import('../src/types.ts').SideState {
    return {
        sourceFile: new File([''], 'x.png'),
        imageElement: document.createElement('img'),
        objectUrl: 'blob:x',
        forensicResult: null,
        progress: {},
        isAnalyzing: false,
        ...overrides,
    };
}
```

Wherever a test used `imageElement: ...` directly in the state literal, switch to `sides: { front: null, back: makeSideState({ imageElement: img, ... }) }` and `activeSide: 'back'`.

- [ ] **Step 3: Run test**

Run: `npm test --run -- tests/top-bar.test.tsx`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/TopBar.tsx tests/top-bar.test.tsx
git commit -m "refactor(top-bar): read from active side state"
```

---

## Task 10: Update `RightPanel` and `ForensicsContent` to read from active side

**Files:**
- Modify: `src/components/RightPanel.tsx`
- Modify: `src/components/forensics/ForensicsContent.tsx`
- Test: `tests/right-panel.test.tsx`, `tests/forensics-content.test.tsx`, `tests/app-forensics-panel.test.tsx`

- [ ] **Step 1: Update `RightPanel.tsx` and `ForensicsContent.tsx`**

In each file, replace every `state.imageElement` / `state.forensicResult` / `state.sourceFile` / `state.isAnalyzing` / `state.progress` access with the active-side equivalent (same pattern as Task 9, using `getActiveSideState(state)`).

Any child component prop that was `state` and is only used to read these fields — pass `activeSide={getActiveSideState(state)}` instead, and update child types accordingly. Keep `state` itself only where global fields (filters, tabs, etc.) are read.

- [ ] **Step 2: Migrate dependent tests**

In `tests/right-panel.test.tsx`, `tests/forensics-content.test.tsx`, `tests/app-forensics-panel.test.tsx`: same migration as Task 9 — use the `makeSideState` helper. Add it inline at the top of each file (DRY across tests is acceptable to keep churn local; if more than three files need it, extract to `tests/helpers/state.ts`).

- [ ] **Step 3: Run affected tests**

Run: `npm test --run -- tests/right-panel.test.tsx tests/forensics-content.test.tsx tests/app-forensics-panel.test.tsx`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/RightPanel.tsx src/components/forensics/ForensicsContent.tsx tests/right-panel.test.tsx tests/forensics-content.test.tsx tests/app-forensics-panel.test.tsx
git commit -m "refactor(right-panel,forensics-content): read from active side"
```

---

## Task 11: Update `DocPane` for new props (still single-image render for now)

**Files:**
- Modify: `src/components/DocPane.tsx`
- Test: `tests/doc-pane.test.tsx`

- [ ] **Step 1: Update DocPane props and reads**

Change the props interface to:

```typescript
import type { Side, SideState } from '../types.ts';

interface DocPaneProps {
    state: AppState;
    dispatch: Dispatch<AppAction>;
    imageRef: RefObject<HTMLImageElement>;
    overlayCanvasRef: RefObject<HTMLCanvasElement>;
    activeSideState: SideState | null;
    onFileDrop: (side: Side, file: File) => Promise<void>;
    onSampleLoad: () => void;
    onFileSelect: (side: Side) => void;
    frontInputRef: RefObject<HTMLInputElement>;
    backInputRef: RefObject<HTMLInputElement>;
    onFileInputChange: (side: Side) => (e: ChangeEvent<HTMLInputElement>) => void;
}
```

Inside, replace every `state.imageElement` / `imageElement` derived from `state` with `activeSideState?.imageElement`, and `state.sourceFile` with `activeSideState?.sourceFile`.

In the upload zone (currently the `!imageElement` block, lines 186-216):
- For now, keep single-zone behavior but hardcode `side = state.activeSide` for the buttons:

```tsx
<button onClick={() => onFileSelect(state.activeSide)}>Selecionar arquivo</button>
<input
    ref={state.activeSide === 'front' ? frontInputRef : backInputRef}
    type="file"
    accept="image/*,.heic,.heif"
    className="hidden"
    onChange={onFileInputChange(state.activeSide)}
/>
```

In `onDrop`:

```tsx
const onDrop = useCallback(
    (e: DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);
        const file = e.dataTransfer?.files[0];
        if (file) {
            void onFileDrop(state.activeSide, file).catch((error) => {
                console.error('[DocPane] Failed to load dropped file:', error);
            });
        }
    },
    [onFileDrop, state.activeSide],
);
```

(The dual-zone layout is added in Task 14.)

- [ ] **Step 2: Update `tests/doc-pane.test.tsx`**

Migrate fixtures to the new state shape and pass the new props. Use the `makeSideState` helper.

- [ ] **Step 3: Run tests**

Run: `npm test --run -- tests/doc-pane.test.tsx`
Expected: PASS.

- [ ] **Step 4: Full type-check**

Run: `npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 5: Run full suite**

Run: `npm test --run`
Expected: ALL pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/DocPane.tsx tests/doc-pane.test.tsx
git commit -m "refactor(doc-pane): accept side-aware props"
```

---

## Task 12: MRZ module renders `Não aplicável` state

**Files:**
- Modify: `src/components/forensics/modules/MrzModule.tsx`
- Test: `tests/forensics-content.test.tsx` (add MRZ-specific cases)

- [ ] **Step 1: Write failing test**

Add to `tests/forensics-content.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react';
import { MrzModule } from '../src/components/forensics/modules/MrzModule.tsx';

describe('MrzModule — notApplicable', () => {
    it('renders Não aplicável copy when result.notApplicable is true', () => {
        render(<MrzModule imageElement={null} initialResult={{
            valid: false, documentType: null, errors: [], checks: [],
            fields: { documentCode: null, issuingState: null, documentNumber: null,
                nationality: null, birthDate: null, sex: null, expiryDate: null,
                surname: null, givenNames: [] },
            normalizedLines: [], notApplicable: true,
        }} />);
        expect(screen.getByText(/não aplicável/i)).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /ler mrz/i })).not.toBeInTheDocument();
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test --run -- tests/forensics-content.test.tsx`
Expected: FAIL — `initialResult` prop doesn't exist; "Não aplicável" not rendered.

- [ ] **Step 3: Update `MrzModule`**

Change the component to accept an optional `initialResult` prop. When the result (either from `initialResult` or computed from `text`) has `notApplicable: true`, render the neutral state and skip OCR.

Modify `MrzModuleProps`:

```typescript
import type { MrzResult } from '../../../../js/forensics/mrz.js';

interface MrzModuleProps {
    imageElement: HTMLImageElement | null;
    initialResult?: MrzResult | null;
}
```

At the very top of the component body, add:

```typescript
export function MrzModule({ imageElement, initialResult }: MrzModuleProps) {
    if (initialResult?.notApplicable) {
        return (
            <div className="flex flex-col gap-2 rounded-sm border border-border-soft bg-bg/40 px-3 py-3">
                <div className="flex items-center justify-between">
                    <span className="font-syne text-xs font-bold uppercase tracking-wide text-text-3">
                        Validação
                    </span>
                    <span className="font-mono text-xs font-bold text-text-3">
                        Não aplicável
                    </span>
                </div>
                <p className="text-xs text-text-3 italic">
                    O MRZ aparece tipicamente no verso de cartões de identidade.
                    Esta imagem foi marcada como "Frente do documento".
                </p>
            </div>
        );
    }
    // ... existing body
```

Also guard the auto-OCR `useEffect` so it does NOT run when `initialResult?.notApplicable`:

```typescript
useEffect(() => {
    if (!imageElement || initialResult?.notApplicable) return;
    runOcr(imageElement);
}, [imageElement, runOcr, initialResult?.notApplicable]);
```

Then in `ForensicsContent.tsx`, pass `initialResult={activeSideState?.forensicResult?.mrzResult ?? null}` to `<MrzModule>`.

- [ ] **Step 4: Run tests**

Run: `npm test --run -- tests/forensics-content.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/forensics/modules/MrzModule.tsx src/components/forensics/ForensicsContent.tsx tests/forensics-content.test.tsx
git commit -m "feat(mrz-module): render Não aplicável neutral state"
```

---

## Task 13: Create `ModeSelector` component

**Files:**
- Create: `src/components/layout/ModeSelector.tsx`
- Modify: `src/components/layout/TopBar.tsx` (mount the selector)
- Create: `tests/mode-selector.test.tsx`

- [ ] **Step 1: Write failing test**

Create `tests/mode-selector.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ModeSelector } from '../src/components/layout/ModeSelector.tsx';

describe('ModeSelector', () => {
    it('renders three options and reflects the active mode', () => {
        render(<ModeSelector mode="both" hasLoadedSides={false} onChange={() => {}} />);
        expect(screen.getByRole('button', { name: /só frente/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /só verso/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /frente \+ verso/i })).toHaveAttribute(
            'aria-pressed',
            'true',
        );
    });

    it('calls onChange when a different option is clicked', () => {
        const onChange = vi.fn();
        render(<ModeSelector mode="both" hasLoadedSides={false} onChange={onChange} />);
        fireEvent.click(screen.getByRole('button', { name: /só frente/i }));
        expect(onChange).toHaveBeenCalledWith('front-only');
    });

    it('prompts confirm when changing mode while sides are loaded; cancels on false', () => {
        const onChange = vi.fn();
        const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
        render(<ModeSelector mode="both" hasLoadedSides={true} onChange={onChange} />);
        fireEvent.click(screen.getByRole('button', { name: /só verso/i }));
        expect(confirmSpy).toHaveBeenCalled();
        expect(onChange).not.toHaveBeenCalled();
        confirmSpy.mockRestore();
    });

    it('proceeds when confirm returns true', () => {
        const onChange = vi.fn();
        const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
        render(<ModeSelector mode="both" hasLoadedSides={true} onChange={onChange} />);
        fireEvent.click(screen.getByRole('button', { name: /só verso/i }));
        expect(onChange).toHaveBeenCalledWith('back-only');
        confirmSpy.mockRestore();
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test --run -- tests/mode-selector.test.tsx`
Expected: FAIL — file does not exist.

- [ ] **Step 3: Create the component**

Create `src/components/layout/ModeSelector.tsx`:

```typescript
import type { AnalysisMode } from '../../types.ts';

const OPTIONS: { value: AnalysisMode; label: string }[] = [
    { value: 'front-only', label: 'Só Frente' },
    { value: 'back-only', label: 'Só Verso' },
    { value: 'both', label: 'Frente + Verso' },
];

interface ModeSelectorProps {
    mode: AnalysisMode;
    hasLoadedSides: boolean;
    onChange: (mode: AnalysisMode) => void;
}

export function ModeSelector({ mode, hasLoadedSides, onChange }: ModeSelectorProps) {
    const handleClick = (value: AnalysisMode) => {
        if (value === mode) return;
        if (hasLoadedSides) {
            const ok = window.confirm(
                'Trocar de modo vai limpar as imagens carregadas. Continuar?',
            );
            if (!ok) return;
        }
        onChange(value);
    };
    return (
        <div className="inline-flex rounded-sm border border-border overflow-hidden" role="group" aria-label="Modo de análise">
            {OPTIONS.map((opt) => {
                const active = mode === opt.value;
                return (
                    <button
                        key={opt.value}
                        type="button"
                        aria-pressed={active}
                        onClick={() => handleClick(opt.value)}
                        className={`px-3 h-7 font-syne text-[11px] font-bold uppercase tracking-wide transition-colors ${
                            active
                                ? 'bg-amber text-bg'
                                : 'text-text-2 hover:text-amber'
                        }`}
                    >
                        {opt.label}
                    </button>
                );
            })}
        </div>
    );
}
```

- [ ] **Step 4: Mount in TopBar**

In `src/components/layout/TopBar.tsx`, import `ModeSelector` and render it next to the title. Wire it as:

```tsx
import { ModeSelector } from './ModeSelector.tsx';
// inside component:
const hasLoadedSides = Boolean(state.sides.front || state.sides.back);
// in JSX, near the top of the bar:
<ModeSelector
    mode={state.mode}
    hasLoadedSides={hasLoadedSides}
    onChange={(mode) => dispatch({ type: 'SET_MODE', mode })}
/>
```

Note: `TopBar` must receive `dispatch` — if it does not already, thread it through from `App.tsx` (`<TopBar state={state} dispatch={dispatch} onReanalyze={handleReanalyze} />`) and update `TopBarProps` accordingly.

- [ ] **Step 5: Run tests**

Run: `npm test --run -- tests/mode-selector.test.tsx tests/top-bar.test.tsx`
Expected: PASS (update `top-bar.test.tsx` to pass `dispatch={vi.fn()}` if needed).

- [ ] **Step 6: Commit**

```bash
git add src/components/layout/ModeSelector.tsx src/components/layout/TopBar.tsx tests/mode-selector.test.tsx tests/top-bar.test.tsx
git commit -m "feat(mode-selector): segmented control wired to SET_MODE"
```

---

## Task 14: Dual drop-zone layout in `both` mode

**Files:**
- Modify: `src/components/DocPane.tsx`
- Test: `tests/doc-pane.test.tsx`

- [ ] **Step 1: Write failing test**

Add to `tests/doc-pane.test.tsx`:

```typescript
it('renders two drop zones labelled Frente and Verso in both mode', () => {
    const state = { ...initialAppState, mode: 'both' as const };
    render(
        <DocPane
            state={state}
            dispatch={vi.fn()}
            imageRef={createRef()}
            overlayCanvasRef={createRef()}
            activeSideState={null}
            onFileDrop={vi.fn(() => Promise.resolve())}
            onSampleLoad={vi.fn()}
            onFileSelect={vi.fn()}
            frontInputRef={createRef()}
            backInputRef={createRef()}
            onFileInputChange={() => vi.fn()}
        />,
    );
    expect(screen.getByText(/frente do documento/i)).toBeInTheDocument();
    expect(screen.getByText(/verso do documento/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test --run -- tests/doc-pane.test.tsx`
Expected: FAIL — only one zone today.

- [ ] **Step 3: Add dual-zone rendering**

In `DocPane.tsx`, factor the existing upload-zone JSX into a `DropZone({ side, label, isLoaded, ... })` inner component. Then in the render:

```tsx
{!activeSideState?.imageElement && state.mode !== 'both' && (
    <DropZone
        side={state.activeSide}
        label={state.activeSide === 'front' ? 'Frente do documento' : 'Verso do documento'}
        onFileDrop={onFileDrop}
        onFileSelect={onFileSelect}
        onFileInputChange={onFileInputChange}
        inputRef={state.activeSide === 'front' ? frontInputRef : backInputRef}
        onSampleLoad={onSampleLoad}
    />
)}

{state.mode === 'both' && (!state.sides.front || !state.sides.back) && (
    <div className="absolute inset-0 grid grid-cols-2 gap-3 p-3 z-10">
        <DropZone
            side="front"
            label="Frente do documento"
            isLoaded={Boolean(state.sides.front)}
            previewUrl={state.sides.front?.objectUrl}
            onFileDrop={onFileDrop}
            onFileSelect={onFileSelect}
            onFileInputChange={onFileInputChange}
            inputRef={frontInputRef}
        />
        <DropZone
            side="back"
            label="Verso do documento"
            isLoaded={Boolean(state.sides.back)}
            previewUrl={state.sides.back?.objectUrl}
            onFileDrop={onFileDrop}
            onFileSelect={onFileSelect}
            onFileInputChange={onFileInputChange}
            inputRef={backInputRef}
        />
    </div>
)}
```

Implement `DropZone` near the bottom of the file:

```tsx
interface DropZoneProps {
    side: Side;
    label: string;
    isLoaded?: boolean;
    previewUrl?: string | null;
    inputRef: RefObject<HTMLInputElement>;
    onFileDrop: (side: Side, file: File) => Promise<void>;
    onFileSelect: (side: Side) => void;
    onFileInputChange: (side: Side) => (e: ChangeEvent<HTMLInputElement>) => void;
    onSampleLoad?: () => void;
}

function DropZone({ side, label, isLoaded, previewUrl, inputRef, onFileDrop, onFileSelect, onFileInputChange, onSampleLoad }: DropZoneProps) {
    const onDrop = (e: DragEvent) => {
        e.preventDefault();
        const file = e.dataTransfer?.files[0];
        if (file) void onFileDrop(side, file);
    };
    return (
        <div
            className="flex flex-col items-center justify-center gap-3 border border-dashed border-border rounded-sm bg-bg/40"
            onDragOver={(e) => e.preventDefault()}
            onDrop={onDrop as unknown as React.DragEventHandler}
        >
            <p className="font-syne font-bold text-text-3 text-xs tracking-wide uppercase">
                {label}
            </p>
            {isLoaded && previewUrl ? (
                <img src={previewUrl} alt={label} className="max-h-32 object-contain" />
            ) : (
                <div className="text-3xl opacity-20">◻</div>
            )}
            <div className="flex gap-2">
                <button
                    type="button"
                    onClick={() => onFileSelect(side)}
                    className="h-7 px-3 rounded-sm border border-border text-text-2 text-xs font-syne font-bold hover:border-amber hover:text-amber transition-colors"
                >
                    {isLoaded ? 'Substituir' : 'Selecionar'}
                </button>
                {onSampleLoad && (
                    <button
                        type="button"
                        onClick={onSampleLoad}
                        className="h-7 px-3 rounded-sm border border-border-soft text-text-3 text-xs font-syne hover:text-text-2 transition-colors"
                    >
                        Usar exemplo
                    </button>
                )}
            </div>
            <input
                ref={inputRef}
                type="file"
                accept="image/*,.heic,.heif"
                className="hidden"
                onChange={onFileInputChange(side)}
            />
        </div>
    );
}
```

(Adjust imports — `DragEvent` is the React type.)

- [ ] **Step 4: Run tests**

Run: `npm test --run -- tests/doc-pane.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/DocPane.tsx tests/doc-pane.test.tsx
git commit -m "feat(doc-pane): dual drop-zone layout in both mode"
```

---

## Task 15: `SideTabs` component and active-side switching in `both` mode

**Files:**
- Create: `src/components/layout/SideTabs.tsx`
- Modify: `src/components/forensics/ForensicsContent.tsx` (or `RightPanel.tsx`)
- Create: `tests/side-tabs.test.tsx`

- [ ] **Step 1: Write failing test**

Create `tests/side-tabs.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SideTabs } from '../src/components/layout/SideTabs.tsx';

describe('SideTabs', () => {
    it('shows two tabs and highlights the active one', () => {
        render(<SideTabs activeSide="back" onSelect={() => {}} />);
        expect(screen.getByRole('tab', { name: /verso/i })).toHaveAttribute('aria-selected', 'true');
        expect(screen.getByRole('tab', { name: /frente/i })).toHaveAttribute('aria-selected', 'false');
    });

    it('calls onSelect when clicking the inactive tab', () => {
        const onSelect = vi.fn();
        render(<SideTabs activeSide="back" onSelect={onSelect} />);
        fireEvent.click(screen.getByRole('tab', { name: /frente/i }));
        expect(onSelect).toHaveBeenCalledWith('front');
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test --run -- tests/side-tabs.test.tsx`
Expected: FAIL — file does not exist.

- [ ] **Step 3: Create component**

Create `src/components/layout/SideTabs.tsx`:

```typescript
import type { Side } from '../../types.ts';

interface SideTabsProps {
    activeSide: Side;
    onSelect: (side: Side) => void;
}

const TABS: { side: Side; label: string }[] = [
    { side: 'front', label: 'Frente' },
    { side: 'back', label: 'Verso' },
];

export function SideTabs({ activeSide, onSelect }: SideTabsProps) {
    return (
        <div role="tablist" aria-label="Lado do documento" className="flex border-b border-border">
            {TABS.map(({ side, label }) => {
                const selected = side === activeSide;
                return (
                    <button
                        key={side}
                        role="tab"
                        type="button"
                        aria-selected={selected}
                        onClick={() => onSelect(side)}
                        className={`flex-1 h-8 font-syne text-xs font-bold uppercase tracking-wide transition-colors ${
                            selected
                                ? 'text-amber border-b-2 border-amber'
                                : 'text-text-3 hover:text-text-2'
                        }`}
                    >
                        {label}
                    </button>
                );
            })}
        </div>
    );
}
```

- [ ] **Step 4: Render in `ForensicsContent`**

In `src/components/forensics/ForensicsContent.tsx`, near the top of the returned JSX:

```tsx
import { SideTabs } from '../layout/SideTabs.tsx';
// ...
{state.mode === 'both' && state.sides.front && state.sides.back && (
    <SideTabs
        activeSide={state.activeSide}
        onSelect={(side) => dispatch({ type: 'SET_ACTIVE_SIDE', side })}
    />
)}
```

- [ ] **Step 5: Run tests**

Run: `npm test --run -- tests/side-tabs.test.tsx tests/forensics-content.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/layout/SideTabs.tsx src/components/forensics/ForensicsContent.tsx tests/side-tabs.test.tsx
git commit -m "feat(side-tabs): swap active side in both mode"
```

---

## Task 16: `AggregatedScore` header with inconsistency badge

**Files:**
- Create: `src/components/forensics/AggregatedScore.tsx`
- Modify: `src/components/forensics/ForensicsContent.tsx` (mount it above modules in `both` mode)
- Create: `tests/aggregated-score.test.tsx`

- [ ] **Step 1: Write failing test**

Create `tests/aggregated-score.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AggregatedScore } from '../src/components/forensics/AggregatedScore.tsx';

describe('AggregatedScore', () => {
    it('shows mean of two side scores', () => {
        render(<AggregatedScore frontScore={80} backScore={60} />);
        expect(screen.getByText(/70/)).toBeInTheDocument();
    });

    it('shows inconsistency badge when |delta| >= 25', () => {
        render(<AggregatedScore frontScore={90} backScore={60} />);
        expect(screen.getByText(/inconsistência/i)).toBeInTheDocument();
    });

    it('does NOT show inconsistency badge when |delta| < 25', () => {
        render(<AggregatedScore frontScore={80} backScore={70} />);
        expect(screen.queryByText(/inconsistência/i)).not.toBeInTheDocument();
    });

    it('renders nothing if either score is null', () => {
        const { container } = render(<AggregatedScore frontScore={null} backScore={70} />);
        expect(container.firstChild).toBeNull();
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test --run -- tests/aggregated-score.test.tsx`
Expected: FAIL — file does not exist.

- [ ] **Step 3: Create component**

Create `src/components/forensics/AggregatedScore.tsx`:

```typescript
interface AggregatedScoreProps {
    frontScore: number | null;
    backScore: number | null;
}

const INCONSISTENCY_THRESHOLD = 25;

export function AggregatedScore({ frontScore, backScore }: AggregatedScoreProps) {
    if (frontScore == null || backScore == null) return null;
    const mean = Math.round((frontScore + backScore) / 2);
    const delta = Math.abs(frontScore - backScore);
    return (
        <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2 bg-bg-1">
            <div className="flex items-baseline gap-2">
                <span className="font-syne text-[11px] font-bold uppercase tracking-wide text-text-3">
                    Autenticidade agregada
                </span>
                <span className="font-mono text-lg font-bold text-text">{mean}</span>
            </div>
            {delta >= INCONSISTENCY_THRESHOLD && (
                <span
                    className="rounded-sm border border-amber/40 bg-amber-dim px-2 py-0.5 font-mono text-[11px] text-amber"
                    aria-label="Inconsistência entre frente e verso"
                >
                    ⚠ inconsistência entre frente e verso
                </span>
            )}
        </div>
    );
}
```

- [ ] **Step 4: Mount in `ForensicsContent.tsx`**

```tsx
import { AggregatedScore } from './AggregatedScore.tsx';
// ...
{state.mode === 'both' && (
    <AggregatedScore
        frontScore={state.sides.front?.forensicResult?.report.totalScore ?? null}
        backScore={state.sides.back?.forensicResult?.report.totalScore ?? null}
    />
)}
```

(Verify the field name — it's `report.totalScore` per `js/forensics/report.ts:35` and `ForensicReport`. If the field is named differently, use the actual one.)

- [ ] **Step 5: Run tests**

Run: `npm test --run -- tests/aggregated-score.test.tsx tests/forensics-content.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/forensics/AggregatedScore.tsx src/components/forensics/ForensicsContent.tsx tests/aggregated-score.test.tsx
git commit -m "feat(aggregated-score): mean header with inconsistency badge"
```

---

## Task 17: Full verification

**Files:** none

- [ ] **Step 1: Full test suite**

Run: `npm test --run`
Expected: ALL pass.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 3: Production build**

Run: `npm run build`
Expected: success, no warnings about unused exports tied to the new code.

- [ ] **Step 4: Manual smoke test**

Run: `npm run dev` and walk through:

1. Default mode `both`: two drop-zones visible, "Analisar" effectively gated by both images.
2. Upload only the front from `learning/Foto-FRENTE.png` (or any image) → tab "Frente" shows analysis, MRZ module says "Não aplicável".
3. Upload the back from `learning/Foto-VERSO.png` → tab "Verso" shows analysis with MRZ parsed and authentic.
4. Header shows aggregated score; if |Δ| ≥ 25 a badge appears.
5. Switch to "Só Frente" mode → confirm dialog; on accept, both sides clear, layout becomes single-zone.

- [ ] **Step 5: Final commit (if any tweaks)**

```bash
git add -A
git commit -m "chore: final tweaks for dual-side analysis" --allow-empty
```

---

## Self-Review Notes

- All spec sections (modes, upload area, state shape, pipeline, UI, MRZ rendering, testing, future hook) are covered by tasks 1-17.
- No placeholders ("TBD", "appropriate", "etc.") remain.
- Action and state-shape names are consistent: `SET_MODE`, `SET_SIDE_IMAGE`, `CLEAR_SIDE`, `SET_ACTIVE_SIDE`, `SIDE_ANALYSIS_STARTED/PROGRESS/DONE/ERROR` — used identically across tests and reducer.
- Test paths use the existing `tests/*.test.{ts,tsx}` convention.
- All commands are `npm` (not pnpm), matching the verified repo memory.
