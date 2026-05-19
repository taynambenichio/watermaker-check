import type { ForensicReport, PipelineStep } from '../../../js/types.js';
import { ScoreRing } from './ScoreRing.tsx';
import { scoreColor } from './scoreColor.ts';

const STEPS: PipelineStep[] = [
    'exif',
    'noise',
    'quality',
    'ela',
    'ghost',
    'copy-move',
    'resampling',
    'histogram',
    'doc-structure',
    'mrz',
    'report',
];

const STEP_LABELS: Record<PipelineStep, string> = {
    exif: 'Metadados EXIF',
    noise: 'Ruído',
    ghost: 'Ghost JPEG',
    ela: 'ELA',
    quality: 'Qualidade',
    'copy-move': 'Copy-Move',
    resampling: 'Reamostramento',
    histogram: 'Histograma RGB',
    'doc-structure': 'Estrutura Documento',
    mrz: 'MRZ/OCR',
    report: 'Relatório',
};

const WEIGHTS = [
    { key: 'copyMove' as const, label: 'Copy-Move', weight: '×0.20' },
    { key: 'ghost' as const, label: 'Ghost', weight: '×0.15' },
    { key: 'ela' as const, label: 'ELA', weight: '×0.15' },
    { key: 'resampling' as const, label: 'Resampling', weight: '×0.15' },
    { key: 'noise' as const, label: 'Ruído', weight: '×0.15' },
    { key: 'exif' as const, label: 'EXIF', weight: '×0.10' },
    { key: 'histogram' as const, label: 'Histograma', weight: '×0.05' },
    { key: 'docStructure' as const, label: 'Doc. Struct', weight: '×0.025' },
    { key: 'mrz' as const, label: 'MRZ', weight: '×0.025' },
];

interface VerdictBlockProps {
    report: ForensicReport | null;
    isAnalyzing: boolean;
    progress: Partial<Record<PipelineStep, 'running' | 'done' | 'error'>>;
}

export function VerdictBlock({ report, isAnalyzing, progress }: VerdictBlockProps) {
    if (isAnalyzing) {
        return (
            <div className="border-b border-border p-4">
                <p className="mb-3 font-syne text-xs font-bold text-text-2 uppercase tracking-widest">
                    A analisar…
                </p>
                <div className="flex flex-col gap-2">
                    {STEPS.map((step) => {
                        const status = progress[step];
                        const icon = !status
                            ? '○'
                            : status === 'running'
                              ? '◔'
                              : status === 'done'
                                ? '●'
                                : '✕';
                        const className = !status
                            ? 'text-text-3'
                            : status === 'running'
                              ? 'text-amber'
                              : status === 'done'
                                ? 'text-green'
                                : 'text-red';
                        return (
                            <div
                                key={step}
                                className={`flex items-center gap-2 text-xs ${className}`}
                            >
                                <span className="w-3 font-mono">{icon}</span>
                                <span>{STEP_LABELS[step]}</span>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    }

    if (!report) {
        return (
            <div className="flex flex-col items-center gap-3 border-b border-border p-6 text-center">
                <div className="select-none text-5xl text-text-3 opacity-20">◉</div>
                <p className="max-w-[200px] text-xs text-text-3">
                    Carregue um documento para iniciar a análise forense automática
                </p>
            </div>
        );
    }

    const verdictText =
        report.verdict === 'authentic'
            ? 'Provavelmente Autêntico'
            : report.verdict === 'suspicious'
              ? 'Suspeito'
              : 'Provável Adulteração';

    return (
        <div className="border-b border-border p-4">
            <div className="mb-4 flex items-start gap-4">
                <ScoreRing score={report.totalScore} />
                <div className="flex-1 pt-1">
                    <p
                        className="mb-3 font-syne text-sm font-bold"
                        style={{ color: scoreColor(report.totalScore) }}
                    >
                        {verdictText}
                    </p>
                    <div className="flex flex-col gap-2">
                        {WEIGHTS.map(({ key, label, weight }) => {
                            const score = report[key];
                            const color = scoreColor(score);
                            return (
                                <div key={key} className="flex items-center gap-2">
                                    <span className="w-10 font-syne text-xs text-text-3">
                                        {label}
                                    </span>
                                    <div className="h-px flex-1 overflow-hidden rounded-full bg-bg-3">
                                        <div
                                            className="h-full transition-all duration-500"
                                            style={{ width: `${score}%`, background: color }}
                                        />
                                    </div>
                                    <span
                                        className="w-5 text-right font-mono text-xs"
                                        style={{ color }}
                                    >
                                        {score}
                                    </span>
                                    <span className="w-8 text-xs text-text-3">{weight}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}
