import type { ImageDataLike } from './types.js';

export interface ELAResult {
    imageData: ImageDataLike;
    /** Suspicion score: 0 (no manipulation) to 100 (high manipulation). */
    score: number;
}

/**
 * Maps a magnitude (0–255) to an RGB thermal colour:
 *   0–63   → blue
 *   64–127 → blue → green (lerp)
 *   128–191 → green → red (lerp)
 *   192–255 → red → white (lerp)
 */
function thermalPalette(magnitude: number): [number, number, number] {
    const m = Math.max(0, Math.min(255, magnitude));
    if (m < 64) {
        return [0, 0, 255];
    } else if (m < 128) {
        const t = (m - 64) / 64;
        return [0, Math.round(255 * t), Math.round(255 * (1 - t))];
    } else if (m < 192) {
        const t = (m - 128) / 64;
        return [Math.round(255 * t), Math.round(255 * (1 - t)), 0];
    } else {
        const t = (m - 192) / 63;
        return [255, Math.round(255 * t), Math.round(255 * t)];
    }
}

/**
 * Pure ELA computation. No DOM access — safe to call from Vitest.
 *
 * Algorithm:
 *   For each pixel: diff = |origR−recompR| + |origG−recompG| + |origB−recompB|
 *                   magnitude = clamp(diff * amplification, 0, 255)
 *   Score = round(mean(magnitudes) / 255 * 100)
 *   Output = thermal palette applied to each magnitude
 */
export function computeELA(
    original: ImageDataLike,
    recompressed: ImageDataLike,
    amplification: number = 10,
): ELAResult {
    const numPixels = original.width * original.height;
    const out = new Uint8ClampedArray(numPixels * 4);
    let totalMagnitude = 0;

    for (let i = 0; i < numPixels; i++) {
        const o = i * 4;
        const dr = Math.abs(original.data[o] - recompressed.data[o]);
        const dg = Math.abs(original.data[o + 1] - recompressed.data[o + 1]);
        const db = Math.abs(original.data[o + 2] - recompressed.data[o + 2]);
        const magnitude = Math.min(255, (dr + dg + db) * amplification);
        totalMagnitude += magnitude;
        const [r, g, b] = thermalPalette(magnitude);
        out[o] = r;
        out[o + 1] = g;
        out[o + 2] = b;
        out[o + 3] = 255;
    }

    const score = Math.round((totalMagnitude / numPixels / 255) * 100);
    return {
        imageData: { data: out, width: original.width, height: original.height },
        score,
    };
}
