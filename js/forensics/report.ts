import type { ForensicReport, Verdict } from '../types.js';

export function buildReport(
    elaScore: number,
    exifScore: number,
    noiseScore: number,
    ghostScore: number,
): ForensicReport {
    const totalScore = Math.round(
        elaScore * 0.25 + ghostScore * 0.3 + noiseScore * 0.25 + exifScore * 0.2,
    );

    let verdict: Verdict;
    if (totalScore < 30) verdict = 'authentic';
    else if (totalScore <= 60) verdict = 'suspicious';
    else verdict = 'tampered';

    return {
        totalScore,
        verdict,
        ela: elaScore,
        exif: exifScore,
        noise: noiseScore,
        ghost: ghostScore,
        completedAt: Date.now(),
    };
}
