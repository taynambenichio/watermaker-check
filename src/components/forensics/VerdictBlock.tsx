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

function getSignalSeverity(contribution: number): 'Alta' | 'Média' | 'Baixa' | 'Residual' {
    if (contribution >= 15) return 'Alta';
    if (contribution >= 6) return 'Média';
    if (contribution >= 2) return 'Baixa';
    return 'Residual';
}

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
    const suspicionScore = report.suspicionScore ?? 100 - report.totalScore;
    const confidence = report.confidence ?? 60;
    const evidenceLevel = report.evidenceLevel ?? 'low';
    const signals = report.signals ?? [];
    const strongestSignal = signals[0] ?? null;
    const strongestContribution = strongestSignal?.contribution ?? 0;
    const evidenceLabel =
        evidenceLevel === 'high' ? 'Alta' : evidenceLevel === 'moderate' ? 'Média' : 'Baixa';

    return (
        <div className="border-b border-border p-4">
            <div className="mb-3 flex items-center justify-between">
                <p className="font-syne text-[11px] font-bold uppercase tracking-[0.28em] text-text-3">
                    Resumo executivo
                </p>
                <div className="flex items-center gap-2">
                    <span className="rounded-full border border-border bg-bg-2 px-2 py-0.5 font-mono text-[11px] text-text-2">
                        Confiança {confidence}%
                    </span>
                    <span className="rounded-full border border-border bg-bg-2 px-2 py-0.5 font-mono text-[11px] text-text-2">
                        Evidência {evidenceLabel}
                    </span>
                </div>
            </div>
            <div className="mb-4 flex items-start gap-4">
                <ScoreRing score={report.totalScore} />
                <div className="flex-1 pt-1">
                    <p
                        className="mb-3 font-syne text-sm font-bold"
                        style={{ color: scoreColor(report.totalScore) }}
                    >
                        {verdictText}
                    </p>
                    <div className="mb-3 grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded-sm border border-border bg-bg-2 px-2 py-1.5">
                            <span className="block text-[11px] uppercase tracking-widest text-text-3">
                                Suspeita agregada
                            </span>
                            <span className="font-mono text-text-2">{suspicionScore}/100</span>
                        </div>
                        <div className="rounded-sm border border-border bg-bg-2 px-2 py-1.5">
                            <span className="block text-[11px] uppercase tracking-widest text-text-3">
                                Sinal dominante
                            </span>
                            <span className="font-mono text-text-2">
                                {strongestSignal ? strongestSignal.label : 'Nenhum'}
                            </span>
                        </div>
                    </div>
                    {report.summary && (
                        <p className="mb-3 text-xs leading-relaxed text-text-3">{report.summary}</p>
                    )}
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

            <div className="mb-4 rounded-sm border border-border bg-bg-3/40 p-3">
                <p className="mb-2 font-syne text-[11px] font-bold uppercase tracking-widest text-text-3">
                    Tabela de evidências
                </p>
                <div className="flex flex-col gap-2">
                    {signals.map((signal) => {
                        const pct =
                            strongestContribution > 0
                                ? Math.max(
                                      6,
                                      Math.round(
                                          (signal.contribution / strongestContribution) * 100,
                                      ),
                                  )
                                : 0;
                        return (
                            <div
                                key={signal.key}
                                className="rounded-sm border border-border/60 bg-bg-2/40 p-2.5"
                            >
                                <div className="mb-2 flex items-center justify-between gap-2 text-xs">
                                    <span className="text-text-2">{signal.label}</span>
                                    <span className="font-mono text-text-3">
                                        {signal.contribution.toFixed(1)} pts
                                    </span>
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-[11px] text-text-3">
                                    <span>Sinal: {signal.score}/100</span>
                                    <span>Peso: ×{signal.weight.toFixed(3)}</span>
                                    <span>
                                        Severidade: {getSignalSeverity(signal.contribution)}
                                    </span>
                                    <span>Contribuição: {signal.contribution.toFixed(1)}</span>
                                </div>
                                <div className="mt-2 h-px overflow-hidden rounded-full bg-bg-3">
                                    <div className="h-full bg-amber" style={{ width: `${pct}%` }} />
                                </div>
                                <p className="mt-2 text-[11px] leading-relaxed text-text-3">
                                    {signal.detail}
                                </p>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="rounded-sm border border-border bg-bg-2 px-3 py-2 text-[11px] leading-relaxed text-text-3">
                {report.verdict === 'authentic'
                    ? 'Leitura operacional: os indícios não ultrapassaram o limiar de suspeita. Ainda assim, confirme com revisão visual quando o caso for sensível.'
                    : report.verdict === 'suspicious'
                      ? 'Leitura operacional: há sinais mistos. O caso merece revisão manual e comparação com a fonte original.'
                      : 'Leitura operacional: múltiplos sinais convergem para adulteração. Trate o arquivo como contestado até validação externa.'}
            </div>
        </div>
    );
}
