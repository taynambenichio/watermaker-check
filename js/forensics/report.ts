import type { ForensicReport, ForensicSignal, MrzResult, Verdict } from '../types.js';
import { validateMrzAuthenticity } from './mrz-authenticity.js';

type WeightedSignal = {
    key: ForensicSignal['key'];
    label: string;
    weight: number;
    score: number;
    detail: string;
};

const VERDICT_THRESHOLDS = {
    authentic: 85,
    suspicious: 40,
};

const SIGNAL_WEIGHTS: Array<Omit<WeightedSignal, 'score' | 'detail'>> = [
    { key: 'copyMove', label: 'Copy-Move', weight: 0.2 },
    { key: 'ghost', label: 'Ghost JPEG', weight: 0.15 },
    { key: 'ela', label: 'ELA', weight: 0.15 },
    { key: 'resampling', label: 'Reamostramento', weight: 0.15 },
    { key: 'noise', label: 'Ruído', weight: 0.15 },
    { key: 'exif', label: 'EXIF', weight: 0.1 },
    { key: 'histogram', label: 'Histograma RGB', weight: 0.05 },
    { key: 'docStructure', label: 'Estrutura do Documento', weight: 0.025 },
    { key: 'mrz', label: 'MRZ/OCR', weight: 0.025 },
];

function formatContribution(value: number): string {
    return value >= 10 ? value.toFixed(0) : value.toFixed(1);
}

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

function buildSummary(reportVerdict: Verdict, signals: ForensicSignal[]): string {
    const strongest = signals.filter((signal) => signal.contribution >= 4).slice(0, 3);
    if (strongest.length === 0) {
        return reportVerdict === 'authentic'
            ? 'Nenhum módulo concentrou suspeita suficiente para derrubar o veredito.'
            : 'A suspeita está distribuída, sem um único módulo dominante.';
    }

    const labels = strongest.map((signal) => signal.label).join(', ');
    if (reportVerdict === 'authentic') {
        return `Sinais leves em ${labels}, mas abaixo do limiar de suspeita relevante.`;
    }
    if (reportVerdict === 'suspicious') {
        return `Os maiores indícios vêm de ${labels}.`;
    }
    return `Suspeita forte concentrada em ${labels}.`;
}

function buildConfidence(totalScore: number, signals: ForensicSignal[]): number {
    const [dominant = null, runnerUp = null] = signals;
    const dominantContribution = dominant?.contribution ?? 0;
    const runnerUpContribution = runnerUp?.contribution ?? 0;
    const evidenceSpread = dominantContribution + runnerUpContribution;
    const verdictDistance =
        totalScore >= VERDICT_THRESHOLDS.authentic
            ? totalScore - VERDICT_THRESHOLDS.authentic
            : totalScore <= VERDICT_THRESHOLDS.suspicious
              ? VERDICT_THRESHOLDS.suspicious - totalScore
              : Math.abs(totalScore - 55);

    return clamp(
        Math.round(55 + evidenceSpread * 1.25 + Math.max(0, verdictDistance) * 0.6),
        55,
        96,
    );
}

function buildEvidenceLevel(
    confidence: number,
    strongestContribution: number,
): 'low' | 'moderate' | 'high' {
    if (strongestContribution >= 18 || confidence >= 82) return 'high';
    if (strongestContribution >= 8 || confidence >= 68) return 'moderate';
    return 'low';
}

function buildSignals(
    elaScore: number,
    exifScore: number,
    noiseScore: number,
    ghostScore: number,
    copyMoveScore: number,
    resamplingScore: number,
    histogramScore: number,
    docStructureScore: number,
    mrzResult: MrzResult | null,
    mrzAuth: ReturnType<typeof validateMrzAuthenticity> | null,
): Array<WeightedSignal> {
    const mrzSuspicion = mrzAuth?.suspicionScore ?? 50;

    return SIGNAL_WEIGHTS.map((definition) => {
        const score =
            definition.key === 'copyMove'
                ? copyMoveScore
                : definition.key === 'ghost'
                  ? ghostScore
                  : definition.key === 'ela'
                    ? elaScore
                    : definition.key === 'resampling'
                      ? resamplingScore
                      : definition.key === 'noise'
                        ? noiseScore
                        : definition.key === 'exif'
                          ? exifScore
                          : definition.key === 'histogram'
                            ? histogramScore
                            : definition.key === 'docStructure'
                              ? docStructureScore
                              : mrzSuspicion;

        const detail =
            definition.key === 'mrz'
                ? mrzResult
                    ? `Autenticidade MRZ: ${formatContribution(100 - mrzSuspicion)}`
                    : 'MRZ não detectado; penalidade leve aplicada.'
                : `${definition.label} contribuiu com ${formatContribution(score * definition.weight)} pontos de suspeita.`;

        return {
            ...definition,
            score,
            detail,
        };
    });
}

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
    const mrzAuth = mrzResult ? validateMrzAuthenticity(mrzResult) : null;
    let mrzScore = 50; // Neutral if no MRZ
    if (mrzAuth) {
        // Convert suspicion (0–100) to authenticity (100–0)
        // suspicionScore=0 means authentic → score=100
        // suspicionScore=100 means very suspicious → score=0
        mrzScore = 100 - mrzAuth.suspicionScore;
    }

    const signals = buildSignals(
        elaScore,
        exifScore,
        noiseScore,
        ghostScore,
        copyMoveScore,
        resamplingScore,
        histogramScore,
        docStructureScore,
        mrzResult,
        mrzAuth,
    ).map((signal) => ({
        ...signal,
        contribution:
            signal.key === 'mrz' ? (100 - mrzScore) * signal.weight : signal.score * signal.weight,
    }));

    const suspicionScore = Math.round(
        signals.reduce((sum, signal) => sum + signal.contribution, 0),
    );
    const totalScore = 100 - suspicionScore;
    const sortedSignals = [...signals].sort((a, b) => b.contribution - a.contribution);
    const confidence = buildConfidence(totalScore, sortedSignals);
    const evidenceLevel = buildEvidenceLevel(confidence, sortedSignals[0]?.contribution ?? 0);

    let verdict: Verdict;
    if (
        totalScore >= 95 ||
        (totalScore >= VERDICT_THRESHOLDS.authentic && confidence >= 70 && evidenceLevel === 'high')
    ) {
        verdict = 'authentic';
    } else if (totalScore >= 40) verdict = 'suspicious';
    else verdict = 'tampered';

    return {
        totalScore,
        suspicionScore,
        confidence,
        evidenceLevel,
        verdict,
        summary: buildSummary(verdict, sortedSignals),
        signals: sortedSignals,
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
