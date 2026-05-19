import type { ForensicReport, MrzResult, Verdict } from '../types.js';
import { validateMrzAuthenticity } from './mrz-authenticity.js';

export function buildReport(
    elaScore: number,
    exifScore: number,
    noiseScore: number,
    ghostScore: number,
    copyMoveScore: number,
    resamplingScore: number,
    histogramScore: number,
    docStructureScore: number,
    mrzResult: MrzResult | null,
): ForensicReport {
    let mrzScore = 50; // Neutral if no MRZ
    if (mrzResult) {
        const auth = validateMrzAuthenticity(mrzResult);
        // Convert suspicion (0–100) to authenticity (100–0)
        // suspicionScore=0 means authentic → score=100
        // suspicionScore=100 means very suspicious → score=0
        mrzScore = 100 - auth.suspicionScore;
    }

    const suspicionScore = Math.round(
        copyMoveScore * 0.2 +
            ghostScore * 0.15 +
            elaScore * 0.15 +
            resamplingScore * 0.15 +
            noiseScore * 0.15 +
            exifScore * 0.1 +
            histogramScore * 0.05 +
            docStructureScore * 0.025 +
            (100 - mrzScore) * 0.025, // MRZ inverted: higher score = lower suspicion
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
        copyMove: 100 - copyMoveScore,
        resampling: 100 - resamplingScore,
        histogram: 100 - histogramScore,
        docStructure: 100 - docStructureScore,
        mrz: mrzScore,
        completedAt: Date.now(),
    };
}
