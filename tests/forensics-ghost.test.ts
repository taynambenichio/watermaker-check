import { describe, expect, it } from 'vitest';
import { computeGhostScore } from '../js/forensics/ghost.js';

describe('computeGhostScore', () => {
    it('returns score 0 for flat meanDiffs (no ghost signal)', () => {
        const { score } = computeGhostScore([10, 10, 10, 10]);
        expect(score).toBe(0); // stdDev = 0
    });

    it('returns non-zero score for varied meanDiffs', () => {
        // [2, 20, 18, 15]: mean=13.75, stdDev≈7 → score=min(100,70)=70
        const { score } = computeGhostScore([2, 20, 18, 15]);
        expect(score).toBeGreaterThan(0);
    });

    it('identifies suspected original quality at min-meanDiff index', () => {
        // min at index 0 (meanDiff=2) → quality 50
        const { suspectedOriginalQuality } = computeGhostScore([2, 20, 18, 15]);
        expect(suspectedOriginalQuality).toBe(50);
    });

    it('returns suspectedOriginalQuality=null when score is low (≤10)', () => {
        // Nearly flat: stdDev tiny → score≤10
        const { suspectedOriginalQuality } = computeGhostScore([10, 10, 10, 10]);
        expect(suspectedOriginalQuality).toBeNull();
    });

    it('caps score at 100 for very high stdDev', () => {
        const { score } = computeGhostScore([0, 100, 100, 100]);
        expect(score).toBeLessThanOrEqual(100);
        expect(score).toBeGreaterThan(0);
    });

    it('returns score 0 for empty array', () => {
        const { score } = computeGhostScore([]);
        expect(score).toBe(0);
    });

    it('handles single element array gracefully', () => {
        const { score, suspectedOriginalQuality } = computeGhostScore([42]);
        expect(score).toBe(0);
        expect(suspectedOriginalQuality).toBeNull();
    });

    it('quality 65 suspected when min is at index 1', () => {
        // [20, 1, 18, 15] → min at index 1 → quality 65
        const { suspectedOriginalQuality } = computeGhostScore([20, 1, 18, 15]);
        expect(suspectedOriginalQuality).toBe(65);
    });
});
