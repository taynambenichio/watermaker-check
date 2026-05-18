import { describe, expect, it } from 'vitest';
import { buildReport } from '../js/forensics/report.js';

// Helper: call buildReport with all 8 scores
function report(
    ela: number,
    exif: number,
    noise: number,
    ghost: number,
    copyMove = 0,
    resampling = 0,
    histogram = 0,
    docStructure = 0,
) {
    return buildReport(ela, exif, noise, ghost, copyMove, resampling, histogram, docStructure);
}

describe('buildReport', () => {
    it('returns authentic verdict and score 100 when all scores are 0 (no suspicion)', () => {
        const r = report(0, 0, 0, 0, 0, 0, 0, 0);
        expect(r.totalScore).toBe(100);
        expect(r.verdict).toBe('authentic');
    });

    it('returns tampered verdict and score 0 when all scores are 100', () => {
        const r = report(100, 100, 100, 100, 100, 100, 100, 100);
        expect(r.totalScore).toBe(0);
        expect(r.verdict).toBe('tampered');
    });

    it('applies correct 8-module weights', () => {
        // copyMove=100 (×0.20=20), ghost=100 (×0.15=15), ela=100 (×0.15=15),
        // resampling=100 (×0.15=15), noise=100 (×0.15=15), exif=100 (×0.10=10),
        // histogram=100 (×0.05=5), docStructure=100 (×0.05=5) → total suspicion=100
        const r = report(100, 100, 100, 100, 100, 100, 100, 100);
        expect(r.totalScore).toBe(0);

        // Only copyMove=100 (×0.20=20 suspicion) → totalScore=80
        const r2 = report(0, 0, 0, 0, 100, 0, 0, 0);
        expect(r2.totalScore).toBe(80);
    });

    it('suspicious verdict for score in 40–70 range', () => {
        const r = report(50, 50, 50, 50, 50, 50, 50, 50);
        expect(r.verdict).toBe('suspicious');
        expect(r.totalScore).toBe(50);
    });

    it('inverts individual scores in breakdown fields', () => {
        const r = report(10, 20, 30, 40, 50, 60, 70, 80);
        expect(r.ela).toBe(90);
        expect(r.exif).toBe(80);
        expect(r.noise).toBe(70);
        expect(r.ghost).toBe(60);
        expect(r.copyMove).toBe(50);
        expect(r.resampling).toBe(40);
        expect(r.histogram).toBe(30);
        expect(r.docStructure).toBe(20);
    });

    it('completedAt is a recent timestamp', () => {
        const before = Date.now();
        const r = report(0, 0, 0, 0);
        const after = Date.now();
        expect(r.completedAt).toBeGreaterThanOrEqual(before);
        expect(r.completedAt).toBeLessThanOrEqual(after);
    });
});
