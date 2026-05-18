import type { ImageDataLike, ResamplingResult } from '../types.js';

function clamp(v: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, v));
}

function getLuma(data: Uint8ClampedArray, x: number, y: number, w: number): number {
    const i = (y * w + x) * 4;
    return 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
}

function gradientRow(data: Uint8ClampedArray, y: number, w: number): Float32Array {
    const g = new Float32Array(w - 1);
    for (let x = 0; x < w - 1; x++) {
        g[x] = getLuma(data, x + 1, y, w) - getLuma(data, x, y, w);
    }
    return g;
}

function autocorr(signal: Float32Array, lag: number): number {
    const n = signal.length;
    if (lag >= n) return 0;
    let sum = 0;
    let norm = 0;
    for (let i = 0; i < n - lag; i++) {
        sum += signal[i] * signal[i + lag];
        norm += signal[i] * signal[i];
    }
    return norm === 0 ? 0 : Math.abs(sum / norm);
}

function hasPeriodicity(signal: Float32Array): boolean {
    // Lag range 2-32: skips lag 1 (noise), caps at 32 (typical resampling factors)
    // Threshold 0.15: empirically chosen; resampling artifacts show normalized autocorr > 0.15
    // Min 3 peaks: reduces false positives from single coincidental correlations
    let peakCount = 0;
    for (let lag = 2; lag <= 32; lag++) {
        if (autocorr(signal, lag) > 0.15) peakCount++;
    }
    return peakCount >= 3;
}

export function analyzeResampling(imageData: ImageDataLike): ResamplingResult {
    const { data, width: w, height: h } = imageData;

    if (w < 4 || h < 4) {
        return { score: 0, affectedRatio: 0, heatmapData: null };
    }

    const flaggedRows = new Set<number>();
    for (let y = 0; y < h; y++) {
        if (hasPeriodicity(gradientRow(data, y, w))) {
            flaggedRows.add(y);
        }
    }

    const affectedRatio = flaggedRows.size / h;
    const score = clamp(Math.round(affectedRatio * 100), 0, 100);

    // Orange heatmap on flagged rows
    const hmData = new Uint8ClampedArray(w * h * 4);
    for (const y of flaggedRows) {
        for (let x = 0; x < w; x++) {
            const i = (y * w + x) * 4;
            hmData[i]     = 255;
            hmData[i + 1] = 140;
            hmData[i + 2] = 0;
            hmData[i + 3] = 160;
        }
    }

    return {
        score,
        affectedRatio,
        heatmapData: { data: hmData, width: w, height: h },
    };
}
