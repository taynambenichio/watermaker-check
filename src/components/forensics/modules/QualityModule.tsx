import type { QualityResult } from '../../../../js/types.js';
import { COLOR_BAD, COLOR_OK, COLOR_WARN } from '../scoreColor.ts';

export function QualityModule({ result }: { result: QualityResult }) {
    return (
        <div className="flex flex-col gap-2">
            <MeterRow label="Nitidez" value={result.sharpness} />
            <MeterRow label="Exposição" value={result.exposure} />
            {result.flags.map((flag) => (
                <div key={flag.code} className="flex items-start gap-1.5 text-xs text-amber">
                    <span className="shrink-0">⚠</span>
                    <span>{flag.message}</span>
                </div>
            ))}
        </div>
    );
}

function meterColor(value: number): string {
    return value < 30 ? COLOR_BAD : value < 70 ? COLOR_WARN : COLOR_OK;
}

function MeterRow({ label, value }: { label: string; value: number }) {
    return (
        <div className="flex items-center gap-2">
            <span className="w-16 shrink-0 text-xs text-text-3">{label}</span>
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-bg-3">
                <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{ width: `${value}%`, background: meterColor(value) }}
                />
            </div>
            <span className="w-7 text-right font-mono text-xs text-text-3">{value}</span>
        </div>
    );
}
