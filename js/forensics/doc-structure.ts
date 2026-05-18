import type { DocStructureResult, ImageDataLike } from '../types.js';

function clamp(v: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, v));
}

function getLuma(data: Uint8ClampedArray, x: number, y: number, w: number): number {
    const i = (y * w + x) * 4;
    return 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
}

function regionStats(
    data: Uint8ClampedArray,
    w: number,
    x0: number,
    y0: number,
    x1: number,
    y1: number,
): { mean: number; variance: number } {
    let sum = 0;
    let sum2 = 0;
    let count = 0;
    for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
            const l = getLuma(data, x, y, w);
            sum += l;
            sum2 += l * l;
            count++;
        }
    }
    if (count === 0) return { mean: 0, variance: 0 };
    const mean = sum / count;
    return { mean, variance: sum2 / count - mean * mean };
}

function laplacianVariance(
    data: Uint8ClampedArray,
    w: number,
    h: number,
    x0: number,
    y0: number,
    x1: number,
    y1: number,
): number {
    const laps: number[] = [];
    for (let y = Math.max(1, y0); y < Math.min(h - 1, y1); y++) {
        for (let x = Math.max(1, x0); x < Math.min(w - 1, x1); x++) {
            const lap =
                getLuma(data, x, y - 1, w) +
                getLuma(data, x, y + 1, w) +
                getLuma(data, x - 1, y, w) +
                getLuma(data, x + 1, y, w) -
                4 * getLuma(data, x, y, w);
            laps.push(lap);
        }
    }
    if (laps.length === 0) return 0;
    const mean = laps.reduce((a, b) => a + b, 0) / laps.length;
    return laps.reduce((s, v) => s + (v - mean) ** 2, 0) / laps.length;
}

export function analyzeDocStructure(imageData: ImageDataLike): DocStructureResult {
    const { data, width: w, height: h } = imageData;

    if (w < 10 || h < 10) {
        return { score: 50, mrzDetected: false, regionConsistency: 0, photoZoneIntegrity: 0 };
    }

    // MRZ zone: bottom 15% — typically high-mean, very-low-variance white band
    const mrzY0 = Math.floor(h * 0.85);
    const mrzStats = regionStats(data, w, 0, mrzY0, w, h);
    const mrzDetected = mrzStats.variance < 500 && mrzStats.mean > 180;
    const regionConsistency = clamp(1 - mrzStats.variance / 1000, 0, 1);

    // Photo zone: top-left 30% width × 50% height — edge coherence via Laplacian
    const photoX1 = Math.floor(w * 0.3);
    const photoY1 = Math.floor(h * 0.5);
    const lapVar = laplacianVariance(data, w, h, 0, 0, photoX1, photoY1);
    const photoZoneIntegrity = clamp(lapVar > 50 ? 1 - Math.abs(lapVar - 500) / 5000 : 0, 0, 1);

    if (!mrzDetected) {
        return { score: 50, mrzDetected: false, regionConsistency, photoZoneIntegrity };
    }

    const suspicion = Math.round((1 - regionConsistency) * 50 + (1 - photoZoneIntegrity) * 50);
    return {
        score: clamp(suspicion, 0, 100),
        mrzDetected,
        regionConsistency,
        photoZoneIntegrity,
    };
}
