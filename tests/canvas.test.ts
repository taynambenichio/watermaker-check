import { describe, it, expect } from 'vitest';
import { computeHistogram, sobelEdges, amplifyDifferences } from '../js/canvas.js';
import type { ImageDataLike } from '../js/types.js';

function img(pixels: number[], width: number, height: number): ImageDataLike {
    return { data: new Uint8ClampedArray(pixels), width, height };
}

describe('computeHistogram', () => {
    it('pixel vermelho', () => {
        const h = computeHistogram(img([255, 0, 0, 255], 1, 1));
        expect(h.r[255]).toBe(1);
        expect(h.g[0]).toBe(1);
        expect(h.b[0]).toBe(1);
    });

    it('dois pixels', () => {
        const h = computeHistogram(img([255, 0, 0, 255, 0, 0, 255, 255], 2, 1));
        expect(h.r[255]).toBe(1);
        expect(h.r[0]).toBe(1);
        expect(h.b[255]).toBe(1);
        expect(h.b[0]).toBe(1);
    });

    it('256 valores únicos em R', () => {
        const pixels: number[] = [];
        for (let i = 0; i < 256; i++) pixels.push(i, 0, 0, 255);
        const h = computeHistogram(img(pixels, 256, 1));
        for (let i = 0; i < 256; i++) expect(h.r[i]).toBe(1);
    });
});

describe('sobelEdges', () => {
    it('imagem uniforme → sem bordas', () => {
        const pixels: number[] = new Array<number>(3 * 3 * 4).fill(0);
        for (let i = 0; i < 9; i++) {
            pixels[i * 4] = pixels[i * 4 + 1] = pixels[i * 4 + 2] = 128;
            pixels[i * 4 + 3] = 255;
        }
        const result = sobelEdges(img(pixels, 3, 3));
        const center = (1 * 3 + 1) * 4;
        expect(result.data[center]).toBe(0);
    });

    it('borda vertical detectada', () => {
        const pixels: number[] = new Array<number>(3 * 3 * 4).fill(0);
        for (let y = 0; y < 3; y++) {
            for (let x = 0; x < 3; x++) {
                const v = x >= 2 ? 255 : 0;
                const i = (y * 3 + x) * 4;
                pixels[i] = pixels[i + 1] = pixels[i + 2] = v;
                pixels[i + 3] = 255;
            }
        }
        const result = sobelEdges(img(pixels, 3, 3));
        const center = (1 * 3 + 1) * 4;
        expect(result.data[center]).toBeGreaterThan(0);
        expect(result.data.length).toBe(3 * 3 * 4);
        expect(result.width).toBe(3);
        expect(result.height).toBe(3);
    });
});

describe('amplifyDifferences', () => {
    it('imagem uniforme → saída zero', () => {
        const pixels: number[] = new Array<number>(3 * 3 * 4).fill(0);
        for (let i = 0; i < 9; i++) {
            pixels[i * 4] = pixels[i * 4 + 1] = pixels[i * 4 + 2] = 100;
            pixels[i * 4 + 3] = 255;
        }
        const result = amplifyDifferences(img(pixels, 3, 3));
        const center = (1 * 3 + 1) * 4;
        expect(result.data[center]).toBe(0);
    });

    it('pixel diferente amplificado', () => {
        const pixels: number[] = new Array<number>(3 * 3 * 4).fill(0);
        for (let i = 0; i < 9; i++) {
            pixels[i * 4] = pixels[i * 4 + 1] = pixels[i * 4 + 2] = 100;
            pixels[i * 4 + 3] = 255;
        }
        pixels[4 * 4] = pixels[4 * 4 + 1] = pixels[4 * 4 + 2] = 200;
        const result = amplifyDifferences(img(pixels, 3, 3));
        const center = (1 * 3 + 1) * 4;
        expect(result.data[center]).toBeGreaterThan(0);
        expect(result.data[center + 3]).toBe(255);
    });
});
