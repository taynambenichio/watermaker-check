import { describe, expect, it } from 'vitest';
import { buildReport } from '../js/forensics/report.js';

describe('buildReport', () => {
    it('computes weighted score correctly', () => {
        // ela=40, exif=0, noise=20, ghost=80
        // suspicion = 40×0.25 + 80×0.30 + 20×0.25 + 0×0.20 = 10+24+5+0 = 39
        // totalScore = 100 - 39 = 61
        const r = buildReport(40, 0, 20, 80);
        expect(r.totalScore).toBe(61);
    });

    it('returns authentic verdict for score > 70', () => {
        const r = buildReport(0, 0, 0, 0);
        expect(r.verdict).toBe('authentic');
        expect(r.totalScore).toBe(100);
    });

    it('returns suspicious verdict for score exactly 40', () => {
        // ela=60, exif=60, noise=60, ghost=60
        // suspicion = 60×0.25+60×0.30+60×0.25+60×0.20 = 15+18+15+12 = 60
        // totalScore = 100 - 60 = 40 → suspicious (≥40)
        const r = buildReport(60, 60, 60, 60);
        expect(r.verdict).toBe('suspicious');
        expect(r.totalScore).toBe(40);
    });

    it('returns suspicious verdict for score in 40–70 range', () => {
        // ela=40, exif=40, noise=40, ghost=40 → suspicion=40 → total=60 → suspicious
        const r = buildReport(40, 40, 40, 40);
        expect(r.verdict).toBe('suspicious');
    });

    it('returns tampered verdict for score < 40', () => {
        const r = buildReport(100, 100, 100, 100);
        expect(r.verdict).toBe('tampered');
        expect(r.totalScore).toBe(0);
    });

    it('preserves individual scores in breakdown fields (inverted)', () => {
        const r = buildReport(10, 20, 30, 40);
        expect(r.ela).toBe(90);
        expect(r.exif).toBe(80);
        expect(r.noise).toBe(70);
        expect(r.ghost).toBe(60);
    });

    it('completedAt is a recent timestamp', () => {
        const before = Date.now();
        const r = buildReport(0, 0, 0, 0);
        const after = Date.now();
        expect(r.completedAt).toBeGreaterThanOrEqual(before);
        expect(r.completedAt).toBeLessThanOrEqual(after);
    });
});
