import { describe, expect, it } from 'vitest';
import { analyzeDocStructure } from '../js/forensics/doc-structure.js';
import type { ImageDataLike } from '../js/types.js';

function makeUniformImage(w: number, h: number, value: number): ImageDataLike {
    const data = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < data.length; i += 4) {
        data[i] = value; data[i + 1] = value; data[i + 2] = value; data[i + 3] = 255;
    }
    return { data, width: w, height: h };
}

function makeRandomImage(w: number, h: number, seed = 42): ImageDataLike {
    const data = new Uint8ClampedArray(w * h * 4);
    let s = seed;
    for (let i = 0; i < data.length; i++) {
        s = (s * 1664525 + 1013904223) & 0x7fffffff;
        data[i] = s % 256;
    }
    return { data, width: w, height: h };
}

describe('analyzeDocStructure', () => {
    it('returns neutral score 50 and mrzDetected false for random noise', () => {
        const img = makeRandomImage(100, 100);
        const r = analyzeDocStructure(img);
        expect(r.score).toBe(50);
        expect(r.mrzDetected).toBe(false);
    });

    it('detects MRZ zone when bottom 15% is very uniform and bright', () => {
        const w = 100, h = 100;
        const data = makeRandomImage(w, h).data.slice();
        // Overwrite bottom 15% with very uniform white (mean=220, variance≈0)
        const mrzY0 = Math.floor(h * 0.85);
        for (let y = mrzY0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const i = (y * w + x) * 4;
                data[i] = 220; data[i + 1] = 220; data[i + 2] = 220; data[i + 3] = 255;
            }
        }
        const img: ImageDataLike = { data: new Uint8ClampedArray(data), width: w, height: h };
        const r = analyzeDocStructure(img);
        expect(r.mrzDetected).toBe(true);
    });

    it('score is always between 0 and 100', () => {
        const imgs = [
            makeUniformImage(100, 100, 0),
            makeUniformImage(100, 100, 255),
            makeRandomImage(100, 100),
            makeUniformImage(1, 1, 128),
        ];
        for (const img of imgs) {
            const r = analyzeDocStructure(img);
            expect(r.score).toBeGreaterThanOrEqual(0);
            expect(r.score).toBeLessThanOrEqual(100);
        }
    });

    it('returns neutral values for tiny images (< 10px)', () => {
        const img = makeUniformImage(5, 5, 200);
        const r = analyzeDocStructure(img);
        expect(r.score).toBe(50);
        expect(r.mrzDetected).toBe(false);
    });

    it('regionConsistency and photoZoneIntegrity are always in range 0–1', () => {
        const img = makeRandomImage(100, 100);
        const r = analyzeDocStructure(img);
        expect(r.regionConsistency).toBeGreaterThanOrEqual(0);
        expect(r.regionConsistency).toBeLessThanOrEqual(1);
        expect(r.photoZoneIntegrity).toBeGreaterThanOrEqual(0);
        expect(r.photoZoneIntegrity).toBeLessThanOrEqual(1);
    });
});
