# Design Spec: UI Redesign — React + Tailwind + shadcn/ui
**Date**: 2026-05-18  
**Status**: Approved

---

## Problem & Approach

The existing UI is built with vanilla TypeScript + Vite + custom CSS. The design is inconsistent, hard to maintain, and lacks accessibility. The user wants a modern, professional UI inspired by Onfido/Jumio/Veriff — tools a forensic analyst would trust.

**Approach**: Migrate to React + Tailwind CSS + shadcn/ui. Keep all forensic logic (TypeScript modules in `js/forensics/`) intact — only the UI layer changes.

---

## Approved Design Direction: "Forensic Instrument"

A precision instrument aesthetic — dense but breathable, technical but readable. Inspired by high-end scientific software, not startup dashboards.

### Typography
- **Syne** (800/700/600) — headings, labels, tab names, module titles
- **JetBrains Mono** (700/500/400) — scores, numeric data, file info, metadata values
- **DM Sans** (400/300) — body text, descriptions, flag messages

### Color System (CSS variables / Tailwind theme extension)
```
--bg:          #0c0c0a   (page background)
--bg-1:        #131311   (surface: topbar, panels)
--bg-2:        #1b1b18   (elevated surface: cards)
--bg-3:        #242420   (inputs, tracks)
--border:      #2a2a26
--border-soft: #222220
--text:        #e6e1d5   (primary)
--text-2:      #9a9485   (secondary)
--text-3:      #5a5750   (muted)
--amber:       #e8a800   (only warm accent — warnings, active states, CTA)
--amber-dim:   #3a2a00
--green:       #5cb87a   (authentic/ok)
--green-dim:   #0d2818
--red:         #d95f5f   (suspicious/forged)
--red-dim:     #2a0f0f
--blue:        #5b9cf6   (ELA/neutral info)
--blue-dim:    #0d1e3a
```

### Layout
Full-viewport app (no scroll), split-panel:
- **Topbar** (44px): Logo + status dot + file info + action buttons
- **Tabbar** (36px): Forense · Filtros · Canvas · ELA · Ferramentas
- **Main** (remaining height):
  - **Left pane** (flex: 1): Document stage + bottom toolbar
  - **Right panel** (360px fixed): Verdict block + scrollable module list + footer

### Key Design Details
- `border-radius: 3px` (subtle, not rounded)
- No drop shadows — structure from borders and color contrast only
- Grid texture on document stage (CSS background-image)
- Animated scan-line on document stage
- Corner labels showing image metadata (dimensions, format, EXIF status)
- Module cards: 3px left border colored by status (green/amber/red/blue)
- Score numbers: large JetBrains Mono, with SVG ring indicator
- Noise blocks: small colored grid visualization

---

## Architecture

### Stack
- Vite 5 + **@vitejs/plugin-react** (add React to existing Vite project)
- **React 18** + TypeScript (strict)
- **Tailwind CSS v4** (via `@tailwindcss/vite` plugin)
- **shadcn/ui** (Vite setup, using Radix UI primitives)
- All existing forensics modules (`js/forensics/*.ts`) stay as-is — pure functions
- `js/types.ts` stays as-is

### Component Structure
```
src/
  components/
    layout/
      TopBar.tsx
      TabBar.tsx
    doc-pane/
      DocPane.tsx          — document stage + toolbar
      DocStage.tsx         — image display with grid/scan-line
      DocToolbar.tsx       — zoom, before/after, mode buttons
    analysis/
      AnalysisPanel.tsx    — right panel wrapper
      VerdictBlock.tsx     — score ring + verdict text + pill badges
      ModuleCard.tsx       — collapsible card with indicator
      modules/
        ExifModule.tsx
        NoiseModule.tsx
        GhostModule.tsx
        QualityModule.tsx
        ElaModule.tsx
    shared/
      ScorePill.tsx
      FlagRow.tsx
      QualityMeter.tsx
      NoiseGrid.tsx
  hooks/
    useForensics.ts        — wraps runForensicPipeline, manages state
    useImageLoader.ts      — handles file drop/select/HEIC conversion
  App.tsx
  main.tsx
  index.css               — Tailwind base + CSS variables
```

### State Management
React `useState` + `useReducer` in `App.tsx`. No external state library needed. Key state:
- `imageState`: `{ img, file, objectUrl } | null`
- `forensicResult: ForensicPipelineResult | null`
- `activeTab: 'forensics' | 'filters' | 'canvas' | 'ela' | 'tools'`
- `zoom: number`
- `ghostLevelIndex: number`
- `isAnalyzing: boolean`
- `progress: Record<PipelineStep, 'idle' | 'running' | 'done'>`

---

## Accessibility
- All interactive elements: keyboard navigable, visible focus ring (amber outline)
- ARIA labels on icon-only buttons
- Screen reader labels on score values ("Score: 81 de 100 — Provavelmente Autêntico")
- Module cards: `<button>` for the toggle header, `aria-expanded`
- Color not the only indicator — text labels always accompany color badges

---

## Migration Strategy
1. Install React, Tailwind, shadcn/ui alongside existing code
2. Create `src/` directory with React entry point
3. Update `vite.config.ts` to use React plugin + Tailwind plugin
4. Update `index.html` to point to `src/main.tsx`
5. Migrate JS modules piece by piece — wrap in hooks, not rewrite
6. Remove `css/styles.css` and `js/main.ts` / `js/ui.ts` when React takes over
7. Keep `js/forensics/`, `js/ela.ts`, `js/canvas.ts`, `js/types.ts` unchanged

---

## Out of Scope
- Internationalization (i18n)
- Mobile layout (desktop-first, min-width: 1024px)
- Dark/light theme toggle (dark-only)
- Backend / server-side rendering
