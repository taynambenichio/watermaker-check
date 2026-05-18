import { describe, expect, it } from 'vitest';
import { computeELA } from '../js/ela.js';
import type { ImageDataLike } from '../js/types.js';

function img(pixels: number[], width: number, height: number): ImageDataLike {
    return { data: new Uint8ClampedArray(pixels), width, height };
}

describe('computeELA', () => {
    it('identical images → score=0 and all pixels blue', () => {
        const pixels = [128, 64, 32, 255, 200, 100, 50, 255];
        const { imageData, score } = computeELA(img(pixels, 2, 1), img(pixels, 2, 1), 10);
        expect(score).toBe(0);
        // Both pixels should be blue (thermal cold: R=0, G=0, B=255)
        expect(imageData.data[0]).toBe(0); // px0 R
        expect(imageData.data[1]).toBe(0); // px0 G
        expect(imageData.data[2]).toBe(255); // px0 B
        expect(imageData.data[4]).toBe(0); // px1 R
        expect(imageData.data[5]).toBe(0); // px1 G
        expect(imageData.data[6]).toBe(255); // px1 B
    });

    it('amplification scales magnitude (diff=10, amp=5 → magnitude=50 → blue)', () => {
        // Single channel diff of 10; amp=5 → magnitude=50 (< 64, stays in blue zone)
        const orig = img([100, 0, 0, 255], 1, 1);
        const recomp = img([90, 0, 0, 255], 1, 1);
        const { imageData } = computeELA(orig, recomp, 5);
        // magnitude=50 → thermal blue [0, 0, 255]
        expect(imageData.data[0]).toBe(0);
        expect(imageData.data[1]).toBe(0);
        expect(imageData.data[2]).toBe(255);
    });

    it('magnitude is clamped at 255 → white output (thermal hot)', () => {
        // diff=765 (255+255+255), amp=100 → clamped to 255 → thermal white [255,255,255]
        const orig = img([255, 255, 255, 255], 1, 1);
        const recomp = img([0, 0, 0, 255], 1, 1);
        const { imageData } = computeELA(orig, recomp, 100);
        expect(imageData.data[0]).toBe(255); // R
        expect(imageData.data[1]).toBe(255); // G
        expect(imageData.data[2]).toBe(255); // B
    });

    it('magnitude=128 → green pixel (thermal mid)', () => {
        // diff = |138-10| = 128, amp=1 → magnitude=128
        // thermal(128): m<192, t=(128-128)/64=0 → [0, 255, 0] pure green
        const orig = img([138, 0, 0, 255], 1, 1);
        const recomp = img([10, 0, 0, 255], 1, 1);
        const { imageData } = computeELA(orig, recomp, 1);
        expect(imageData.data[0]).toBe(0); // R
        expect(imageData.data[1]).toBe(255); // G
        expect(imageData.data[2]).toBe(0); // B
    });

    it('score=100 for maximum pixel difference', () => {
        // diff=765, amp=1, magnitude=255 → mean=255 → score=round(255/255*100)=100
        const { score } = computeELA(img([255, 255, 255, 255], 1, 1), img([0, 0, 0, 255], 1, 1), 1);
        expect(score).toBe(100);
    });

    it('uses default amplification of 10 when not specified', () => {
        const orig = img([10, 0, 0, 255], 1, 1);
        const recomp = img([0, 0, 0, 255], 1, 1);
        const { imageData } = computeELA(orig, recomp); // no 3rd argument
        // diff=10, amp=10 → magnitude=100 → blue→green lerp zone
        expect(imageData.data[3]).toBe(255); // alpha
    });

    it('throws on dimension mismatch', () => {
        const a = img([100, 100, 100, 255], 2, 1);
        const b = img([100, 100, 100, 255], 1, 1);
        expect(() => computeELA(a, b, 10)).toThrow('dimension mismatch');
    });

    it('returns score=0 for zero-dimension image', () => {
        const empty: ImageDataLike = { data: new Uint8ClampedArray(0), width: 0, height: 0 };
        const { score } = computeELA(empty, empty, 10);
        expect(score).toBe(0);
    });
});
