import type { HistogramForensicResult } from '../../../../js/types.js';

interface Props {
    result: HistogramForensicResult;
}

export function HistogramForensicModule({ result }: Props) {
    const maxVal = Math.max(
        Math.max(...Array.from(result.r)),
        Math.max(...Array.from(result.g)),
        Math.max(...Array.from(result.b)),
        1,
    );

    const channels = [
        { key: 'r' as const, color: '#f87171', label: 'R' },
        { key: 'g' as const, color: '#4ade80', label: 'G' },
        { key: 'b' as const, color: '#60a5fa', label: 'B' },
    ];

    return (
        <div className="flex flex-col gap-2">
            <div className="flex gap-3 text-xs text-text-3">
                <span>
                    Buracos: <span className="font-mono text-text">{result.holes}</span>
                </span>
                <span>
                    Regularidade:{' '}
                    <span className="font-mono text-text">
                        {(result.combStrength * 100).toFixed(0)}%
                    </span>
                </span>
            </div>
            {channels.map(({ key, color, label }) => (
                <div key={key} className="flex items-center gap-1.5">
                    <span className="w-3 font-mono text-xs" style={{ color }}>
                        {label}
                    </span>
                    <div className="flex h-[18px] flex-1 items-end gap-px overflow-hidden rounded-sm bg-bg-3">
                        {Array.from(result[key]).map((v, i) => (
                            <div
                                // biome-ignore lint/suspicious/noArrayIndexKey: histogram bins use inherently stable indices
                                key={`${key}-bin-${i}`}
                                className="flex-1"
                                style={{
                                    height: `${Math.round((v / maxVal) * 18)}px`,
                                    backgroundColor: color,
                                    opacity: v === 0 && i >= 16 && i <= 240 ? 0.15 : 0.75,
                                }}
                            />
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}
