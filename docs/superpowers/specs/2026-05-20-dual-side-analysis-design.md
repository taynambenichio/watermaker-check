# Dual-side document analysis (Frente / Verso)

**Status:** Design approved by user — pending implementation plan
**Date:** 2026-05-20

## Problem

The forensics pipeline currently assumes a single uploaded image. The MRZ
module flags absence of MRZ as "Não detectada" (suspicious), but the front of
many ID documents legitimately has no MRZ — MRZ lives only on the back. Users
verifying a document's front therefore see a false-negative checksum panel and
no way to upload the back for a complete check.

## Goal

Support analysis of **one or two sides** of a document with the user
explicitly choosing the mode, so the MRZ module can correctly distinguish
"MRZ missing because front" (neutral, expected) from "MRZ unreadable on back"
(suspicious). Lay groundwork for a future front-vs-back comparison module.

## Scope

In scope:
- New analysis-mode selector (Só Frente / Só Verso / Frente + Verso).
- Per-side state in `AppState`, per-side forensic results, per-side scores.
- Mode-aware upload UI (1 or 2 drop-zones).
- MRZ module "Não aplicável" rendering for front side.
- Per-side results UI with tabs in `both` mode + aggregated header score.
- Tests for new state shape, MRZ short-circuit, and `both`-mode rendering.

Out of scope (designed for, not built):
- The actual comparison module between front and back results.
- Auto-detection of which side an image is (mode is user-selected).

## Modes

| Mode | Images required | MRZ behavior on FRONT | MRZ behavior on BACK |
|---|---|---|---|
| `front-only` | 1 (front) | "Não aplicável" (neutral) | — |
| `back-only`  | 1 (back)  | — | Full OCR + parse |
| `both`       | 2 (front + back) | "Não aplicável" (neutral) | Full OCR + parse |

Default mode: `both`. Selector is a segmented control at the top of the
forensics panel. Changing modes after images are loaded prompts a confirm
("Trocar de modo vai limpar as imagens carregadas. Continuar?") and clears
state for the dropped side(s).

## Upload area

Layout switches by mode:

- `front-only` / `back-only`: single drop-zone, labelled appropriately
  ("Frente do documento" or "Verso do documento") with a small inline preview
  + "Substituir" button once an image is loaded.
- `both`: two drop-zones side-by-side. The "Analisar" button is disabled
  until both slots contain an image.

When `both` is selected and both images are present, analysis runs in parallel
(`Promise.all` over the two pipeline invocations).

## State shape

```ts
type Side = 'front' | 'back';
type AnalysisMode = 'front-only' | 'back-only' | 'both';

interface SideState {
    sourceFile: File;
    imageElement: HTMLImageElement;
    objectUrl: string;
    forensicResult: ForensicPipelineResult | null;
    progress: ForensicProgress;
    isAnalyzing: boolean;
}

interface AppState {
    mode: AnalysisMode;
    sides: {
        front: SideState | null;
        back: SideState | null;
    };
    activeSide: Side; // which tab is visible in `both` mode; ignored otherwise
    // ... existing fields that are not per-side (ghostLevelIndex, ui prefs)
    //     stay top-level
}
```

Sides not used by the current mode are kept at `null`. `activeSide` defaults
to `'back'` in `back-only`, `'front'` in `front-only`, and `'back'` in
`both` (the most informative tab opens first).

The reducer/store gains:
- `setMode(mode)` — clears the dropped sides, sets default `activeSide`.
- `setSideImage(side, file, image, url)` — populates a side slot.
- `clearSide(side)` — empties a slot.
- `setSideForensicResult(side, result)` — writes pipeline output.
- `setActiveSide(side)` — pure UI toggle for `both` mode.

## Pipeline

The forensic pipeline function gains a `side: Side` argument. Behavior is
identical for both sides **except** the MRZ step:

```ts
if (side === 'front') {
    return {
        rawText: '',
        parsed: { ...emptyMrzResult(), notApplicable: true },
    };
}
```

`MrzResult` gains an optional `notApplicable?: boolean` flag. No Tesseract
worker is created when `notApplicable` is set — front-side analyses pay zero
OCR cost.

The authenticity score calculation **ignores** any MRZ result with
`notApplicable: true` — neither its sub-checks nor its overall failure flag
contribute to the score or to the failed-checks counter.

## UI

### Single-side modes (`front-only`, `back-only`)

Visually identical to the current layout. Only the populated side renders.
MRZ module in `front-only` mode renders the neutral "Não aplicável" state.

### Dual-side mode (`both`)

Above the cards, a tab bar appears: **Frente | Verso**. Selecting a tab
swaps which `SideState` the modules read from — no re-computation. Each tab
shows the full forensic-module stack for its side.

The panel header shows an **aggregated authenticity score** (simple mean of
the two per-side scores) and, when the absolute difference between the two
scores is ≥ 25 points, a `⚠ inconsistência entre frente e verso` badge
(visual gancho for the future comparison module — purely informative for
now, no behavior change).

### MRZ module — `notApplicable` rendering

When `result.notApplicable === true`, the card replaces its normal content
with:

> **MRZ / OCR** — `Não aplicável`
>
> O MRZ aparece tipicamente no verso de cartões de identidade. Esta imagem
> foi marcada como "Frente do documento".

No "Ler MRZ" button, no checksum table, no failed-checks counter, neutral
grey accent (not red).

## Testing

New tests:

- **Unit (`tests/app-state.test.ts`)** — `setMode('front-only')` clears
  `sides.back`; `setMode('both')` preserves both if present.
- **Unit (`tests/forensics-pipeline.test.ts`)** — pipeline with
  `side: 'front'` returns `notApplicable: true` MRZ result and does not
  invoke `recognizeMrzFromImage`.
- **Unit (mrz authenticity)** — score calculation skips `notApplicable` MRZ.
- **Integration (`tests/forensics-content.test.tsx`)** — render with
  `notApplicable: true` shows "Não aplicável" copy, hides "Ler MRZ" button.
- **Integration (new)** — render `ForensicsPanel` in `both` mode with two
  populated sides shows tab bar and switching tabs swaps visible cards.

All existing tests must continue to pass. Where a test today instantiates
`AppState` directly, it gets a small `makeSideState()` helper for less churn.

## Future comparison hook

With both `sides.front.forensicResult` and `sides.back.forensicResult`
available in state simultaneously, a future "Comparison" module can compare:

- EXIF camera/date metadata coherence
- Geometric / lighting consistency
- MRZ-vs-front OCR cross-check (name printed on the front matches MRZ on the
  back)
- Paper texture / colour profile similarity

Not implemented in this spec — only the state shape is designed to support
it without further refactor.

## Non-goals

- **Auto-detecting which side an image is.** Mode is user-selected.
- **More than two images.** Always exactly one or two.
- **Persisting mode across sessions.** Mode defaults to `both` on each load.
