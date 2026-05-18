import type { HistogramForensicResult, ImageDataLike } from '../types.js';

function clamp(v: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, v));
}

function buildHistogram(data: Uint8ClampedArray, channel: number): Uint32Array {
    const hist = new Uint32Array(256);
    for (let i = channel; i < data.length; i += 4) {
        hist[data[i]]++;
    }
    return hist;
}

function countHoles(hist: Uint32Array): number {
    let holes = 0;
    for (let i = 16; i <= 240; i++) {
        if (hist[i] === 0) holes++;
    }
    return holes;
}

/** Estimate comb regularity: fraction of even-indexed bins that are empty vs odd bins that are not */
function computeCombStrength(hist: Uint32Array): number {
    let evenEmpty = 0;
    let oddFilled = 0;
    let total = 0;
    for (let i = 16; i <= 240; i++) {
        total++;
        if (i % 2 === 0 && hist[i] === 0) evenEmpty++;
        if (i % 2 === 1 && hist[i] > 0) oddFilled++;
    }
    if (total === 0) return 0;
    return clamp((evenEmpty + oddFilled) / (total * 2), 0, 1);
}

export function analyzeHistogramForensic(imageData: ImageDataLike): HistogramForensicResult {
    const r = buildHistogram(imageData.data, 0);
    const g = buildHistogram(imageData.data, 1);
    const b = buildHistogram(imageData.data, 2);

    const holes = countHoles(r) + countHoles(g) + countHoles(b);
    const combStrength =
        (computeCombStrength(r) + computeCombStrength(g) + computeCombStrength(b)) / 3;

    // holes/15: normalize hole count (~15 holes baseline); combStrength already 0-1; scale to 0-100
    const score = clamp(Math.round((holes / 15 + combStrength) * 50), 0, 100);

    return { score, r, g, b, holes, combStrength };
}
