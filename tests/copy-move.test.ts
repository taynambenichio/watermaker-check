import { describe, expect, it } from 'vitest';
import { analyzeCopyMove } from '../js/forensics/copy-move.js';
import type { ImageDataLike } from '../js/types.js';

function makeGradientImage(w: number, h: number): ImageDataLike {
    const data = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const i = (y * w + x) * 4;
            data[i] = (x * 4) % 256;
            data[i + 1] = (y * 4) % 256;
            data[i + 2] = 128;
            data[i + 3] = 255;
        }
    }
    return { data, width: w, height: h };
}

describe('analyzeCopyMove', () => {
    it('returns matchCount > 0 for image with a manually cloned 16×16 block', () => {
        const w = 64,
            h = 64;
        const img = makeGradientImage(w, h);
        const data = img.data.slice();
        // Copy block at (0,0) onto block at (32,0) — identical pixel values → match
        for (let py = 0; py < 16; py++) {
            for (let px = 0; px < 16; px++) {
                const src = (py * w + px) * 4;
                const dst = (py * w + 32 + px) * 4;
                data[dst] = data[src];
                data[dst + 1] = data[src + 1];
                data[dst + 2] = data[src + 2];
                data[dst + 3] = 255;
            }
        }
        const clonedImg: ImageDataLike = { data: new Uint8ClampedArray(data), width: w, height: h };
        const r = analyzeCopyMove(clonedImg);
        expect(r.matchCount).toBeGreaterThan(0);
    });

    it('score is always in range 0–100', () => {
        const img = makeGradientImage(64, 64);
        const r = analyzeCopyMove(img);
        expect(r.score).toBeGreaterThanOrEqual(0);
        expect(r.score).toBeLessThanOrEqual(100);
    });

    it('returns null heatmapData for images too small to analyse (<4 blocks)', () => {
        const data = new Uint8ClampedArray(10 * 10 * 4).fill(128);
        const img: ImageDataLike = { data, width: 10, height: 10 };
        const r = analyzeCopyMove(img);
        expect(r.heatmapData).toBeNull();
        expect(r.matchCount).toBe(0);
    });

    it('heatmapData has same dimensions as input for valid images', () => {
        const img = makeGradientImage(64, 64);
        const r = analyzeCopyMove(img);
        if (r.heatmapData) {
            expect(r.heatmapData.width).toBe(64);
            expect(r.heatmapData.height).toBe(64);
            expect(r.heatmapData.data.length).toBe(64 * 64 * 4);
        }
    });

    it('returns score 0 and matchCount 0 for images too small', () => {
        const data = new Uint8ClampedArray(4).fill(0);
        const img: ImageDataLike = { data, width: 1, height: 1 };
        const r = analyzeCopyMove(img);
        expect(r.score).toBe(0);
        expect(r.matchCount).toBe(0);
    });
});
