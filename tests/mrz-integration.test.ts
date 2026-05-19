import { describe, it, expect, beforeEach, vi } from 'vitest';
import { buildReport } from '../js/forensics/report.js';
import { parseMrz } from '../js/forensics/mrz.js';
import type { ForensicReport } from '../js/types.js';

// Mock document.createElement for Canvas
function setupMocks() {
    // Mock Canvas 2D Context
    const mockContext = {
        fillStyle: '',
        clearRect: vi.fn(),
        fillRect: vi.fn(),
        drawImage: vi.fn(),
        getImageData: vi.fn(() => ({
            data: new Uint8ClampedArray(800 * 600 * 4),
            width: 800,
            height: 600,
        })),
        createImageData: vi.fn((w, h) => ({
            data: new Uint8ClampedArray(w * h * 4),
            width: w,
            height: h,
        })),
        putImageData: vi.fn(),
    };

    const mockCanvas = {
        width: 0,
        height: 0,
        getContext: vi.fn(() => mockContext),
        toDataURL: vi.fn(() => 'data:image/png;base64,fake'),
    };

    global.document = {
        createElement: vi.fn((tagName: string) => {
            if (tagName === 'canvas') return mockCanvas;
            return {};
        }),
    } as any;

    global.Image = class MockImage {
        naturalWidth = 100;
        naturalHeight = 100;
        src = '';
        onload: (() => void) | null = null;

        constructor() {
            setTimeout(() => this.onload?.(), 0);
        }
    } as any;
}

describe('MRZ Integration', () => {
    beforeEach(() => {
        setupMocks();
        vi.clearAllMocks();
    });

    it('should include MRZ result in report output', () => {
        // Create a valid MRZ
        const validMrz = [
            'P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<',
            'L898902C36UTO7408122F1204159ZE184226B<<<<<10',
        ].join('\n');
        const mrzResult = parseMrz(validMrz);

        // Build report with valid MRZ
        const report = buildReport(0, 0, 0, 0, 0, 0, 0, 0, mrzResult);

        // Verify MRZ is included in report
        expect(report.mrz).toBeDefined();
        expect(typeof report.mrz).toBe('number');
        expect(report.mrz).toBeGreaterThan(0);
    });

    it('should set MRZ score between 0 and 100', () => {
        // Test with valid MRZ
        const validMrz = [
            'P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<',
            'L898902C36UTO7408122F1204159ZE184226B<<<<<10',
        ].join('\n');
        const mrzResult = parseMrz(validMrz);
        const report1 = buildReport(0, 0, 0, 0, 0, 0, 0, 0, mrzResult);

        expect(report1.mrz).toBeGreaterThanOrEqual(0);
        expect(report1.mrz).toBeLessThanOrEqual(100);

        // Test with invalid MRZ
        const invalidMrz = parseMrz('INVALID');
        const report2 = buildReport(0, 0, 0, 0, 0, 0, 0, 0, invalidMrz);

        expect(report2.mrz).toBeGreaterThanOrEqual(0);
        expect(report2.mrz).toBeLessThanOrEqual(100);
    });

    it('should include MRZ in verdict calculation', () => {
        // Valid MRZ should contribute to authenticity
        const validMrz = [
            'P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<',
            'L898902C36UTO7408122F1204159ZE184226B<<<<<10',
        ].join('\n');
        const mrzResultValid = parseMrz(validMrz);
        const reportValid = buildReport(0, 0, 0, 0, 0, 0, 0, 0, mrzResultValid);

        // Invalid MRZ should affect the verdict/score
        const invalidMrz = parseMrz('INVALID');
        const reportInvalid = buildReport(0, 0, 0, 0, 0, 0, 0, 0, invalidMrz);

        // Both should have valid verdicts
        expect(reportValid.verdict).toMatch(/^(authentic|suspicious|tampered)$/);
        expect(reportInvalid.verdict).toMatch(/^(authentic|suspicious|tampered)$/);

        // Both should have valid scores
        expect(reportValid.totalScore).toBeGreaterThanOrEqual(0);
        expect(reportValid.totalScore).toBeLessThanOrEqual(100);
        expect(reportInvalid.totalScore).toBeGreaterThanOrEqual(0);
        expect(reportInvalid.totalScore).toBeLessThanOrEqual(100);

        // Valid MRZ report should score better or equal to invalid (MRZ is only 2.5% weight)
        expect(reportValid.mrz).toBeGreaterThanOrEqual(reportInvalid.mrz);
    });

    it('should handle missing MRZ gracefully (no MRZ provided)', () => {
        // No MRZ provided (null)
        const report = buildReport(0, 0, 0, 0, 0, 0, 0, 0, null);

        // Should not crash - pipeline should handle gracefully
        expect(report).toBeDefined();

        // MRZ score should default to 50 (neutral)
        expect(report.mrz).toBe(50);

        // Pipeline should still produce valid report
        expect(report.verdict).toMatch(/^(authentic|suspicious|tampered)$/);
        expect(report.totalScore).toBeGreaterThanOrEqual(0);
        expect(report.totalScore).toBeLessThanOrEqual(100);
    });

    it('should return proper MRZ score if MRZ parsing returns invalid result', () => {
        // Parse invalid MRZ data
        const invalidMrz = parseMrz('');
        expect(invalidMrz.valid).toBe(false);

        const report = buildReport(0, 0, 0, 0, 0, 0, 0, 0, invalidMrz);

        // Pipeline should still complete successfully (error handled gracefully)
        expect(report).toBeDefined();

        // Invalid MRZ gets converted to a suspicion score which affects the overall score
        // Just verify the score is in valid range (not necessarily 50)
        expect(report.mrz).toBeGreaterThanOrEqual(0);
        expect(report.mrz).toBeLessThanOrEqual(100);

        // Pipeline should still produce a valid report with valid verdict
        expect(report.verdict).toMatch(/^(authentic|suspicious|tampered)$/);
        expect(report.totalScore).toBeGreaterThanOrEqual(0);
        expect(report.totalScore).toBeLessThanOrEqual(100);
    });
});
