import { describe, expect, it } from 'vitest';
import { analyzeResampling } from '../js/forensics/resampling.js';
import type { ImageDataLike } from '../js/types.js';

function makeRandomImage(w: number, h: number, seed = 42): ImageDataLike {
    const data = new Uint8ClampedArray(w * h * 4);
    let s = seed;
    for (let i = 0; i < data.length; i++) {
        s = (s * 1664525 + 1013904223) & 0x7fffffff;
        data[i] = s % 256;
    }
    return { data, width: w, height: h };
}

describe('analyzeResampling', () => {
    it('score is in range 0–100 for random image', () => {
        const img = makeRandomImage(64, 64);
        const r = analyzeResampling(img);
        expect(r.score).toBeGreaterThanOrEqual(0);
        expect(r.score).toBeLessThanOrEqual(100);
    });

    it('affectedRatio is in range 0–1', () => {
        const img = makeRandomImage(64, 64);
        const r = analyzeResampling(img);
        expect(r.affectedRatio).toBeGreaterThanOrEqual(0);
        expect(r.affectedRatio).toBeLessThanOrEqual(1);
    });

    it('returns score 0 and affectedRatio 0 for tiny images', () => {
        const data = new Uint8ClampedArray(4).fill(0);
        const img: ImageDataLike = { data, width: 1, height: 1 };
        const r = analyzeResampling(img);
        expect(r.score).toBe(0);
        expect(r.affectedRatio).toBe(0);
    });

    it('heatmapData has correct dimensions', () => {
        const img = makeRandomImage(64, 64);
        const r = analyzeResampling(img);
        expect(r.heatmapData).not.toBeNull();
        expect(r.heatmapData?.width).toBe(64);
        expect(r.heatmapData?.height).toBe(64);
        expect(r.heatmapData?.data.length).toBe(64 * 64 * 4);
    });

    it('uniform image has low affectedRatio (no gradient variations to correlate)', () => {
        const data = new Uint8ClampedArray(64 * 64 * 4).fill(128);
        const img: ImageDataLike = { data, width: 64, height: 64 };
        const r = analyzeResampling(img);
        // Uniform image → gradient is all zeros → no periodicity
        expect(r.affectedRatio).toBe(0);
    });

    it('detects periodicity in a synthetic periodic-gradient image', () => {
        // Create image where every row's luma alternates with period 4
        // This simulates a classic resampling artifact pattern
        const w = 64,
            h = 64;
        const data = new Uint8ClampedArray(w * h * 4);
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                // Alternating pattern: 0, 128, 0, 128, ... → gradient repeats with period 2
                const v = x % 2 === 0 ? 0 : 200;
                const i = (y * w + x) * 4;
                data[i] = v;
                data[i + 1] = v;
                data[i + 2] = v;
                data[i + 3] = 255;
            }
        }
        const img: ImageDataLike = { data, width: w, height: h };
        const r = analyzeResampling(img);
        // Perfect alternating pattern → gradient is constant ±200 → high autocorrelation at lag 2
        expect(r.affectedRatio).toBeGreaterThan(0.5);
    });
});
