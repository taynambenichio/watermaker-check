import { describe, expect, it } from 'vitest';
import { analyzeHistogramForensic } from '../js/forensics/histogram-forensic.js';
import type { ImageDataLike } from '../js/types.js';

function makeImageData(pixels: number[][]): ImageDataLike {
    const data = new Uint8ClampedArray(pixels.length * 4);
    for (let i = 0; i < pixels.length; i++) {
        data[i * 4] = pixels[i][0];
        data[i * 4 + 1] = pixels[i][1];
        data[i * 4 + 2] = pixels[i][2];
        data[i * 4 + 3] = pixels[i][3] ?? 255;
    }
    const side = Math.sqrt(pixels.length);
    return { data, width: Math.ceil(side), height: Math.ceil(side) };
}

describe('analyzeHistogramForensic', () => {
    it('returns 256-bin histograms per channel', () => {
        const img = makeImageData([[128, 64, 200, 255]]);
        const r = analyzeHistogramForensic(img);
        expect(r.r.length).toBe(256);
        expect(r.g.length).toBe(256);
        expect(r.b.length).toBe(256);
        expect(r.r[128]).toBe(1);
        expect(r.g[64]).toBe(1);
        expect(r.b[200]).toBe(1);
    });

    it('detects holes in image that uses only even bin values', () => {
        // Pixels only use even values (0,2,4,...) — odd bins will be empty
        const pixels: number[][] = [];
        for (let v = 0; v <= 254; v += 2) {
            for (let j = 0; j < 5; j++) pixels.push([v, v, v, 255]);
        }
        const img = makeImageData(pixels);
        const r = analyzeHistogramForensic(img);
        // Odd bins in 16..240 are empty — should have many holes
        expect(r.holes).toBeGreaterThan(300);
    });

    it('returns zero holes for image with all 256 luminance values present', () => {
        const pixels: number[][] = [];
        for (let v = 0; v < 256; v++) pixels.push([v, v, v, 255]);
        const img = makeImageData(pixels);
        const r = analyzeHistogramForensic(img);
        expect(r.holes).toBe(0);
    });

    it('score is always in range 0–100', () => {
        const pixels: number[][] = [];
        for (let v = 0; v < 256; v++) pixels.push([v, v, v, 255]);
        const img = makeImageData(pixels);
        const r = analyzeHistogramForensic(img);
        expect(r.score).toBeGreaterThanOrEqual(0);
        expect(r.score).toBeLessThanOrEqual(100);
    });

    it('combStrength is always in range 0–1', () => {
        const img = makeImageData([[100, 100, 100, 255]]);
        const r = analyzeHistogramForensic(img);
        expect(r.combStrength).toBeGreaterThanOrEqual(0);
        expect(r.combStrength).toBeLessThanOrEqual(1);
    });

    it('detects high combStrength for even-only histogram (comb pattern)', () => {
        const pixels: number[][] = [];
        for (let v = 1; v <= 255; v += 2) {
            for (let j = 0; j < 5; j++) pixels.push([v, v, v, 255]);
        }
        const img = makeImageData(pixels);
        const r = analyzeHistogramForensic(img);
        expect(r.combStrength).toBeGreaterThan(0.3);
    });

    it('detects low combStrength for full-spectrum histogram', () => {
        const pixels: number[][] = [];
        for (let v = 0; v < 256; v++) pixels.push([v, v, v, 255]);
        const img = makeImageData(pixels);
        const r = analyzeHistogramForensic(img);
        expect(r.combStrength).toBeLessThan(0.5);
    });
});
