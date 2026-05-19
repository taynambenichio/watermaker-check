import { describe, expect, it } from 'vitest';
import { buildReport } from '../js/forensics/report.js';

// Helper: call buildReport with all 9 parameters (8 scores + mrzResult)
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
    return buildReport(ela, exif, noise, ghost, copyMove, resampling, histogram, docStructure, null);
}

describe('buildReport', () => {
    it('returns authentic verdict and score 99 when all scores are 0 (neutral MRZ adds 1 to suspicion)', () => {
        const r = report(0, 0, 0, 0, 0, 0, 0, 0);
        expect(r.totalScore).toBe(99);
        expect(r.verdict).toBe('authentic');
    });

    it('returns tampered verdict and score 1 when all scores are 100', () => {
        const r = report(100, 100, 100, 100, 100, 100, 100, 100);
        expect(r.totalScore).toBe(1);
        expect(r.verdict).toBe('tampered');
    });

    it('applies correct 9-module weights (including MRZ at 2.5%)', () => {
        // copyMove=100 (×0.20=20), ghost=100 (×0.15=15), ela=100 (×0.15=15),
        // resampling=100 (×0.15=15), noise=100 (×0.15=15), exif=100 (×0.10=10),
        // histogram=100 (×0.05=5), docStructure=100 (×0.025=2.5), mrz=50→(100-50)×0.025=1.25 → total suspicion≈99
        const r = report(100, 100, 100, 100, 100, 100, 100, 100);
        expect(r.totalScore).toBe(1);

        // Only copyMove=100 (×0.20=20 suspicion) + MRZ neutral (1.25) → suspicion≈21, totalScore=79
        const r2 = report(0, 0, 0, 0, 100, 0, 0, 0);
        expect(r2.totalScore).toBe(79);
    });

    it('suspicious verdict for score in 40–70 range', () => {
        const r = report(50, 50, 50, 50, 50, 50, 50, 50);
        expect(r.verdict).toBe('suspicious');
        expect(r.totalScore).toBeCloseTo(50, 0);
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
