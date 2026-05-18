import { describe, expect, it } from 'vitest';
import { analyzeQuality } from '../js/forensics/quality.js';
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

function makeCheckerboard(w: number, h: number): ImageDataLike {
    const data = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const v = (x + y) % 2 === 0 ? 0 : 255;
            const o = (y * w + x) * 4;
            data[o] = data[o + 1] = data[o + 2] = v;
            data[o + 3] = 255;
        }
    }
    return { data, width: w, height: h };
}

describe('analyzeQuality', () => {
    it('returns sharpness=0 and isAcceptable=false for 0×0 image', () => {
        const result = analyzeQuality({ data: new Uint8ClampedArray(0), width: 0, height: 0 });
        expect(result.sharpness).toBe(0);
        expect(result.isAcceptable).toBe(false);
    });

    it('returns sharpness=0 for a uniform image (no edges → no Laplacian response)', () => {
        const result = analyzeQuality(makeUniform(64, 64, 128));
        expect(result.sharpness).toBe(0);
    });

    it('returns sharpness=100 for a max-frequency checkerboard image', () => {
        const result = analyzeQuality(makeCheckerboard(64, 64));
        expect(result.sharpness).toBe(100);
    });

    it('flags DARK for very dark image (meanLum < 50)', () => {
        const result = analyzeQuality(makeUniform(64, 64, 20));
        const codes = result.flags.map((f) => f.code);
        expect(codes).toContain('DARK');
    });

    it('flags OVEREXPOSED for very bright image (meanLum > 210)', () => {
        const result = analyzeQuality(makeUniform(64, 64, 230));
        const codes = result.flags.map((f) => f.code);
        expect(codes).toContain('OVEREXPOSED');
    });

    it('flags BLUR for a uniform image (sharpness=0 < 30)', () => {
        const result = analyzeQuality(makeUniform(64, 64, 128));
        const codes = result.flags.map((f) => f.code);
        expect(codes).toContain('BLUR');
    });

    it('isAcceptable=false when any flag is present', () => {
        const dark = analyzeQuality(makeUniform(64, 64, 20));
        expect(dark.isAcceptable).toBe(false);
        const blurry = analyzeQuality(makeUniform(64, 64, 128));
        expect(blurry.isAcceptable).toBe(false);
    });

    it('isAcceptable=true for well-exposed sharp image (no flags)', () => {
        // Checkerboard at mid-grey luminance: sharpness=100, meanLum≈128, no flags
        const result = analyzeQuality(makeCheckerboard(64, 64));
        expect(result.isAcceptable).toBe(true);
        expect(result.flags).toHaveLength(0);
    });

    it('exposure=0 for fully black image', () => {
        const result = analyzeQuality(makeUniform(64, 64, 0));
        expect(result.exposure).toBe(0);
    });

    it('exposure=100 for fully white image', () => {
        const result = analyzeQuality(makeUniform(64, 64, 255));
        expect(result.exposure).toBe(100);
    });

    it('exposure is between 0 and 100 for any image', () => {
        const result = analyzeQuality(makeCheckerboard(64, 64));
        expect(result.exposure).toBeGreaterThanOrEqual(0);
        expect(result.exposure).toBeLessThanOrEqual(100);
    });

    it('sharpness is higher for checkerboard than for uniform image', () => {
        const sharp = analyzeQuality(makeCheckerboard(64, 64));
        const blurry = analyzeQuality(makeUniform(64, 64, 128));
        expect(sharp.sharpness).toBeGreaterThan(blurry.sharpness);
    });
});
