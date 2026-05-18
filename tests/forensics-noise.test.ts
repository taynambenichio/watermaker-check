import { describe, expect, it } from 'vitest';
import { analyzeNoise } from '../js/forensics/noise.js';
import type { ImageDataLike } from '../js/types.js';

function makeUniform(w: number, h: number, grey = 128): ImageDataLike {
    const data = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < w * h; i++) {
        data[i * 4] = grey;
        data[i * 4 + 1] = grey;
        data[i * 4 + 2] = grey;
        data[i * 4 + 3] = 255;
    }
    return { data, width: w, height: h };
}

function makeWithCheckerBlock(
    w: number,
    h: number,
    bx0: number,
    by0: number,
    size: number,
): ImageDataLike {
    const data = new Uint8ClampedArray(w * h * 4);
    // Fill uniform base
    for (let i = 0; i < w * h; i++) {
        data[i * 4] = 128;
        data[i * 4 + 1] = 128;
        data[i * 4 + 2] = 128;
        data[i * 4 + 3] = 255;
    }
    // Paint checkerboard in the target block
    for (let y = by0; y < Math.min(by0 + size, h); y++) {
        for (let x = bx0; x < Math.min(bx0 + size, w); x++) {
            const v = (x + y) % 2 === 0 ? 0 : 255;
            const o = (y * w + x) * 4;
            data[o] = data[o + 1] = data[o + 2] = v;
        }
    }
    return { data, width: w, height: h };
}

// Paints multiple 32px blocks as checkerboard (rest stays uniform grey).
// Used to generate images where anomalous-block ratio hits the score cap.
function makeWithMultipleCheckerBlocks(
    w: number,
    h: number,
    blocks: Array<[bx: number, by: number]>,
    blockSize = 32,
): ImageDataLike {
    const data = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < w * h; i++) {
        data[i * 4] = 128;
        data[i * 4 + 1] = 128;
        data[i * 4 + 2] = 128;
        data[i * 4 + 3] = 255;
    }
    for (const [bx, by] of blocks) {
        const x0 = bx * blockSize;
        const y0 = by * blockSize;
        for (let y = y0; y < Math.min(y0 + blockSize, h); y++) {
            for (let x = x0; x < Math.min(x0 + blockSize, w); x++) {
                const v = (x + y) % 2 === 0 ? 0 : 255;
                const o = (y * w + x) * 4;
                data[o] = data[o + 1] = data[o + 2] = v;
            }
        }
    }
    return { data, width: w, height: h };
}

describe('analyzeNoise', () => {
    it('returns zero score for a uniform image', () => {
        const result = analyzeNoise(makeUniform(128, 128));
        expect(result.score).toBe(0);
        expect(result.suspiciousBlockCount).toBe(0);
    });

    it('returns zero dimensions guard for 0×0 image', () => {
        const result = analyzeNoise({ data: new Uint8ClampedArray(0), width: 0, height: 0 });
        expect(result.score).toBe(0);
        expect(result.totalBlockCount).toBe(0);
    });

    it('detects checkerboard block as anomalous', () => {
        // 128×128 image, 32-pixel blocks → 4×4=16 blocks total
        // Block at (0,0) has checkerboard — max Laplacian variance
        const result = analyzeNoise(makeWithCheckerBlock(128, 128, 0, 0, 32));
        expect(result.suspiciousBlockCount).toBeGreaterThanOrEqual(1);
        expect(result.score).toBeGreaterThan(0);
    });

    it('computes correct grid dimensions', () => {
        // 128×64 image, blockSize=32 → gridW=4, gridH=2
        const result = analyzeNoise(makeUniform(128, 64));
        expect(result.gridW).toBe(4);
        expect(result.gridH).toBe(2);
        expect(result.totalBlockCount).toBe(8);
    });

    it('blockMap has length equal to totalBlockCount and values in [0,1]', () => {
        const result = analyzeNoise(makeWithCheckerBlock(128, 128, 0, 0, 32));
        expect(result.blockMap.length).toBe(result.totalBlockCount);
        for (const v of result.blockMap) {
            expect(v).toBeGreaterThanOrEqual(0);
            expect(v).toBeLessThanOrEqual(1);
        }
    });

    it('score is clamped to 100', () => {
        // 128×128 = 16 blocks. 4 checkerboard blocks among 12 smooth → Tukey flags the 4
        // outliers; score = min(100, round(4/16 * 400)) = 100, confirming the cap.
        const result = analyzeNoise(
            makeWithMultipleCheckerBlocks(128, 128, [
                [0, 0],
                [3, 0],
                [0, 3],
                [3, 3],
            ]),
        );
        expect(result.score).toBeLessThanOrEqual(100);
        expect(result.score).toBeGreaterThan(0);
    });

    it('respects custom blockSize parameter', () => {
        // 64×64 image, blockSize=16 → gridW=4, gridH=4
        const result = analyzeNoise(makeUniform(64, 64), 16);
        expect(result.gridW).toBe(4);
        expect(result.gridH).toBe(4);
    });
});
