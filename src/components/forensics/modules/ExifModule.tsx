import type { ExifResult } from '../../../../js/types.js';
import { COLOR_BAD, COLOR_OK, COLOR_WARN } from '../scoreColor.ts';

export function ExifModule({ result }: { result: ExifResult }) {
    return (
        <div className="flex flex-col gap-1.5">
            <table className="w-full text-xs">
                <tbody>
                    <Row
                        label="EXIF"
                        value={result.hasExif ? '✓ Presente' : '✗ Ausente'}
                        color={result.hasExif ? COLOR_OK : COLOR_BAD}
                    />
                    {result.camera && <Row label="Câmara" value={result.camera} />}
                    {result.software && (
                        <Row label="Software" value={result.software} color={COLOR_WARN} />
                    )}
                    {result.dateTime && <Row label="Data" value={result.dateTime} />}
                    <Row
                        label="GPS"
                        value={result.gpsPresent ? '✓ Presente' : '—'}
                        color={result.gpsPresent ? COLOR_OK : undefined}
                    />
                </tbody>
            </table>
            {result.flags.map((flag) => (
                <div key={flag.code} className="flex items-start gap-1.5 text-xs text-amber">
                    <span className="shrink-0">⚠</span>
                    <span>{flag.message}</span>
                </div>
            ))}
        </div>
    );
}

function Row({ label, value, color }: { label: string; value: string; color?: string }) {
    return (
        <tr className="border-b border-border-soft last:border-0">
            <td className="w-20 whitespace-nowrap py-1 pr-3 text-text-3">{label}</td>
            <td className="py-1 font-mono text-xs" style={{ color: color ?? '#9a9485' }}>
                {value}
            </td>
        </tr>
    );
}
