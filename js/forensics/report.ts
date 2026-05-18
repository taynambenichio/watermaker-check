import type { ForensicReport, Verdict } from '../types.js';

export function buildReport(
    elaScore: number,
    exifScore: number,
    noiseScore: number,
    ghostScore: number,
): ForensicReport {
    const suspicionScore = Math.round(
        elaScore * 0.25 + ghostScore * 0.3 + noiseScore * 0.25 + exifScore * 0.2,
    );
    const totalScore = 100 - suspicionScore;

    let verdict: Verdict;
    if (totalScore > 70) verdict = 'authentic';
    else if (totalScore >= 40) verdict = 'suspicious';
    else verdict = 'tampered';

    return {
        totalScore,
        verdict,
        ela: 100 - elaScore,
        exif: 100 - exifScore,
        noise: 100 - noiseScore,
        ghost: 100 - ghostScore,
        completedAt: Date.now(),
    };
}
