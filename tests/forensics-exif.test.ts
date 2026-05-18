import { describe, expect, it } from 'vitest';
import { computeExifScore } from '../js/forensics/exif.js';
import type { ExifFlag } from '../js/types.js';

function flag(code: ExifFlag['code']): ExifFlag {
    return { code, message: '' };
}

describe('computeExifScore', () => {
    it('returns 0 for no flags', () => {
        expect(computeExifScore([])).toBe(0);
    });

    it('returns 60 for NO_EXIF flag', () => {
        expect(computeExifScore([flag('NO_EXIF')])).toBe(60);
    });

    it('returns 50 for EDITING_SOFTWARE flag', () => {
        expect(computeExifScore([flag('EDITING_SOFTWARE')])).toBe(50);
    });

    it('returns 20 for DATE_ANOMALY flag', () => {
        expect(computeExifScore([flag('DATE_ANOMALY')])).toBe(20);
    });

    it('returns 15 for NO_CAMERA_INFO flag', () => {
        expect(computeExifScore([flag('NO_CAMERA_INFO')])).toBe(15);
    });

    it('accumulates multiple flags below cap', () => {
        // DATE_ANOMALY (20) + NO_CAMERA_INFO (15) = 35
        expect(computeExifScore([flag('DATE_ANOMALY'), flag('NO_CAMERA_INFO')])).toBe(35);
    });

    it('clamps score to 100 for multiple high-scoring flags', () => {
        // NO_EXIF (60) + EDITING_SOFTWARE (50) = 110 → clamped to 100
        expect(computeExifScore([flag('NO_EXIF'), flag('EDITING_SOFTWARE')])).toBe(100);
    });

    it('accumulates all four flags, still clamped to 100', () => {
        expect(
            computeExifScore([
                flag('NO_EXIF'),
                flag('EDITING_SOFTWARE'),
                flag('DATE_ANOMALY'),
                flag('NO_CAMERA_INFO'),
            ]),
        ).toBe(100);
    });
});
