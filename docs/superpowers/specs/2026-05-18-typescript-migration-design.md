# Design Spec: TypeScript Migration

**Date:** 2026-05-18  
**Project:** watermaker-check  
**Scope:** Migrate the existing ES module JavaScript codebase to TypeScript using Vite + Vitest.

---

## Background

The project was recently refactored from a monolithic 720-line `index.html` into 4 ES modules (`filters.js`, `ui.js`, `canvas.js`, `main.js`). TypeScript is now added to improve type safety, editor tooling, and long-term maintainability.

---

## Goals

- Add TypeScript with `strict: true` to catch type errors at compile time
- Use Vite as the dev server and bundler (replaces `python3 -m http.server`)
- Migrate tests from Node.js `assert` to Vitest (same API, integrates with Vite)
- Minimal structural disruption — keep `js/` folder, keep `index.html` at root

---

## Out of Scope

- No new features
- No UI changes
- No folder restructuring to `src/`
- No CI/CD changes

---

## Project Structure After Migration

```
watermaker-check/
├── index.html              (unchanged — Vite entry point)
├── css/styles.css          (unchanged)
├── js/
│   ├── types.ts            (NEW — shared interfaces)
│   ├── filters.ts          (renamed from filters.js + typed)
│   ├── ui.ts               (renamed from ui.js + typed)
│   ├── canvas.ts           (renamed from canvas.js + typed)
│   └── main.ts             (renamed from main.js + typed)
├── tests/
│   └── canvas.test.ts      (renamed from canvas.test.mjs, migrated to Vitest)
├── package.json            (NEW)
├── tsconfig.json           (NEW)
├── vite.config.ts          (NEW)
└── .gitignore              (updated: node_modules/, dist/)
```

---

## Shared Types (`js/types.ts`)

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

`ImageDataLike` is used by the pure canvas functions instead of the browser's `ImageData` type, keeping them testable in Node/Vitest without a DOM.

---

## Build Configuration

### `tsconfig.json`

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

Key decisions:
- `moduleResolution: "bundler"` — required for Vite to resolve TS imports correctly
- `lib: ["DOM"]` — provides `HTMLCanvasElement`, `ImageData`, `HTMLImageElement`, etc.

### `vite.config.ts`

```typescript
import { defineConfig } from 'vite';
export default defineConfig({ root: '.' });
```

Vite uses `index.html` at the project root as the entry point. The `<script type="module" src="js/main.ts">` tag is resolved by Vite during dev and compiled to `dist/` on build.

### `package.json`

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

---

## Test Migration

`tests/canvas.test.mjs` → `tests/canvas.test.ts`

The 7 existing tests are migrated 1:1. Only the assertion API changes:

```typescript
// Before (Node.js)
import assert from 'node:assert';
assert.strictEqual(result.r[255], 1);

// After (Vitest)
import { describe, it, expect } from 'vitest';
expect(result.r[255]).toBe(1);
```

Test command: `npm test` (runs `vitest run` — no watch mode, exits after results).

---

## Module-by-Module Migration Notes

### `js/types.ts`
New file. Contains `AppState`, `HistogramResult`, `ImageDataLike`.

### `js/canvas.ts`
- Pure functions (`computeHistogram`, `sobelEdges`, `amplifyDifferences`) receive `ImageDataLike` instead of `ImageData`
- Return types: `HistogramResult`, `ImageDataLike`
- DOM functions (`renderHistogram`, `renderSobel`, `renderAmplify`, `clearOverlay`) use `HTMLCanvasElement` and `HTMLImageElement` parameter types

### `js/filters.ts`
- `initFilters(state: AppState, onUpdate?: (state: AppState) => void): void`
- `applyFilters(state: AppState): void`
- `resetFilters(state: AppState): void`
- `applyPreset(name: string, state: AppState): void`
- `PRESETS` typed as `Record<string, Record<string, number>>`

### `js/ui.ts`
- `initTabs(): void`
- `initUpload(state: AppState, onLoaded: (img: HTMLImageElement) => void): void`
- `updateAnalysisPanel(state: AppState): void`
- `enableImageTools(): void`

### `js/main.ts`
- `state` exported as `AppState`
- All local functions annotated (no implicit `any`)
- `matchImageBounds(el: HTMLElement): void`
- `onImageLoaded(img: HTMLImageElement): void`

---

## Error Handling

No changes to runtime error handling. TypeScript errors are compile-time only and do not affect the existing `SecurityError`/generic error `catch` blocks.

---

## .gitignore Updates

Add to `.gitignore`:
```
node_modules/
dist/
```

---

## Acceptance Criteria

- [ ] `npm install` completes without errors
- [ ] `npm run dev` starts Vite dev server and app loads in browser
- [ ] `npm run build` produces `dist/` with no TypeScript errors
- [ ] `npm test` runs all 7 tests with Vitest, all pass
- [ ] No `any` types in source files (except where absolutely unavoidable with a comment)
- [ ] `strict: true` compile passes cleanly
