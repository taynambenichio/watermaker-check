// ── Existing ──────────────────────────────────────────────────────────────
export interface AppState {
    image: HTMLImageElement | null;
    sourceFile: File | null;
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
    blockMap: Float32Array; // normalised 0–1 variance per block
    gridW: number;
    gridH: number;
    suspiciousBlockCount: number;
    totalBlockCount: number;
}

// ── Ghost ─────────────────────────────────────────────────────────────────
export interface GhostLevel {
    quality: number; // 50 | 65 | 80 | 95
    imageData: ImageDataLike; // greyscale diff heatmap
    meanDiff: number; // mean absolute diff (amplified)
}

export interface GhostResult {
    score: number;
    levels: GhostLevel[];
    suspectedOriginalQuality: number | null;
    heicConverted?: boolean; // true when source was HEIC — Ghost analysis may be unreliable
}

// ── Quality ───────────────────────────────────────────────────────────────
export type QualityFlagCode = 'BLUR' | 'DARK' | 'OVEREXPOSED';

export interface QualityFlag {
    code: QualityFlagCode;
    message: string;
}

export interface QualityResult {
    sharpness: number; // 0–100 (100 = sharp)
    exposure: number; // 0–100 (100 = max brightness)
    flags: QualityFlag[];
    isAcceptable: boolean; // suitable for document verification
}

// ── Report ────────────────────────────────────────────────────────────────
export type Verdict = 'authentic' | 'suspicious' | 'tampered';

// ── Copy-Move ─────────────────────────────────────────────────────────────
export interface CopyMoveResult {
    score: number; // 0–100, suspicion direction (inverted at report layer)
    matchCount: number;
    heatmapData: ImageDataLike | null;
}

// ── Resampling ────────────────────────────────────────────────────────────
export interface ResamplingResult {
    score: number; // 0–100, suspicion direction
    affectedRatio: number; // 0.0–1.0 fraction of rows flagged
    heatmapData: ImageDataLike | null;
}

// ── Histogram Forensic ────────────────────────────────────────────────────
export interface HistogramForensicResult {
    score: number; // 0–100, suspicion direction
    r: Uint32Array; // 256-bin red histogram
    g: Uint32Array; // 256-bin green histogram
    b: Uint32Array; // 256-bin blue histogram
    holes: number; // empty bins in range [16,240] across all 3 channels
    combStrength: number; // 0.0–1.0 regularity of gap pattern
}

// ── Document Structure ────────────────────────────────────────────────────
export interface DocStructureResult {
    score: number; // 0–100, suspicion direction; 50 = neutral (no doc detected)
    mrzDetected: boolean;
    regionConsistency: number; // 0.0–1.0
    photoZoneIntegrity: number; // 0.0–1.0
}

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

// ── Pipeline result ───────────────────────────────────────────────────────
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
