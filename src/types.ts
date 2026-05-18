import type { ForensicPipelineResult, PipelineStep } from '../js/types.js';

export type ActiveTab =
    | 'forensics'
    | 'filters'
    | 'canvas'
    | 'ela'
    | 'tools'
    | 'copy-move'
    | 'resampling';
export type CanvasMode = 'histogram' | 'sobel' | 'amplify' | null;

export interface FilterState {
    brightness: number; // 0–300, default 100
    contrast: number; // 0–300, default 100
    saturation: number; // 0–300, default 100
    hue: number; // 0–360, default 0
    invert: number; // 0–100, default 0
    blur: number; // 0–20, default 0
    preset: string | null;
}

export const DEFAULT_FILTERS: FilterState = {
    brightness: 100,
    contrast: 100,
    saturation: 100,
    hue: 0,
    invert: 0,
    blur: 0,
    preset: null,
};

export function filtersToCSS(f: FilterState): string {
    return [
        `brightness(${f.brightness}%)`,
        `contrast(${f.contrast}%)`,
        `saturate(${f.saturation}%)`,
        `hue-rotate(${f.hue}deg)`,
        `invert(${f.invert}%)`,
        `blur(${f.blur}px)`,
    ].join(' ');
}

export interface AppState {
    imageElement: HTMLImageElement | null;
    sourceFile: File | null;
    objectUrl: string | null;
    isAnalyzing: boolean;
    progress: Partial<Record<PipelineStep, 'running' | 'done' | 'error'>>;
    forensicResult: ForensicPipelineResult | null;
    ghostLevelIndex: number;
    activeTab: ActiveTab;
    canvasMode: CanvasMode;
    beforeAfterActive: boolean;
    zoom: number;
    filters: FilterState;
    elaAmplification: number;
    elaScore: number | null;
}

export const initialAppState: AppState = {
    imageElement: null,
    sourceFile: null,
    objectUrl: null,
    isAnalyzing: false,
    progress: {},
    forensicResult: null,
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
    | { type: 'IMAGE_LOADED'; imageElement: HTMLImageElement; sourceFile: File; objectUrl: string }
    | { type: 'ANALYSIS_STARTED' }
    | { type: 'STEP_PROGRESS'; step: PipelineStep; status: 'running' | 'done' | 'error' }
    | { type: 'ANALYSIS_DONE'; result: ForensicPipelineResult }
    | { type: 'ANALYSIS_ERROR' }
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

export function appReducer(state: AppState, action: AppAction): AppState {
    switch (action.type) {
        case 'IMAGE_LOADED':
            if (state.objectUrl) URL.revokeObjectURL(state.objectUrl);
            return {
                ...initialAppState,
                activeTab: state.activeTab,
                imageElement: action.imageElement,
                sourceFile: action.sourceFile,
                objectUrl: action.objectUrl,
            };
        case 'ANALYSIS_STARTED':
            return { ...state, isAnalyzing: true, progress: {}, forensicResult: null };
        case 'STEP_PROGRESS':
            return { ...state, progress: { ...state.progress, [action.step]: action.status } };
        case 'ANALYSIS_DONE':
            return {
                ...state,
                isAnalyzing: false,
                progress: {},
                forensicResult: action.result,
                elaScore: 100 - action.result.elaScore,
                ghostLevelIndex: 0,
            };
        case 'ANALYSIS_ERROR':
            return { ...state, isAnalyzing: false, progress: {} };
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
