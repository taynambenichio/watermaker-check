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
