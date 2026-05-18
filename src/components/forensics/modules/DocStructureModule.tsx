import type { DocStructureResult } from '../../../../js/types.js';

interface Props {
    result: DocStructureResult;
}

function Bar({ value, label }: { value: number; label: string }) {
    const pct = Math.round(value * 100);
    const color = pct > 70 ? '#4ade80' : pct > 40 ? '#fbbf24' : '#f87171';
    return (
        <div className="flex flex-col gap-0.5">
            <div className="flex justify-between text-xs">
                <span className="text-text-3">{label}</span>
                <span className="font-mono text-text">{pct}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-bg-3">
                <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${pct}%`, backgroundColor: color }}
                />
            </div>
        </div>
    );
}

export function DocStructureModule({ result }: Props) {
    return (
        <div className="flex flex-col gap-2.5">
            <div className="flex items-center gap-2 text-xs">
                <span className="text-text-3">Zona MRZ:</span>
                <span
                    className="rounded px-1.5 py-0.5 font-mono text-xs font-bold"
                    style={{
                        background: result.mrzDetected ? '#16a34a22' : '#6b728022',
                        color: result.mrzDetected ? '#4ade80' : '#9ca3af',
                    }}
                >
                    {result.mrzDetected ? '✓ Detectada' : '— Não detectada'}
                </span>
                {!result.mrzDetected && <span className="text-text-3">(score neutro)</span>}
            </div>
            <Bar value={result.regionConsistency} label="Consistência regional" />
            <Bar value={result.photoZoneIntegrity} label="Integridade zona foto" />
        </div>
    );
}
