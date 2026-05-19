import type { AppState } from '../../types.ts';
import { HeatmapCanvas } from '../forensics/HeatmapCanvas.tsx';
import { scoreColor } from '../forensics/scoreColor.ts';

interface ResamplingTabProps {
    state: AppState;
}

export function ResamplingTab({ state }: ResamplingTabProps) {
    const result = state.forensicResult?.resamplingResult ?? null;
    const score = state.forensicResult?.report.resampling ?? null;

    if (!result) {
        return (
            <div className="flex h-full items-center justify-center p-6 text-center">
                <p className="text-xs text-text-3">
                    Execute a análise forense para visualizar o mapa de reamostramento.
                </p>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-3 p-3">
            <p className="text-xs text-text-3">
                Detecta artefactos de interpolação de redimensionamento/rotação. Linhas a laranja
                indicam periodicidade suspeita no gradiente.
            </p>
            {score !== null && (
                <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-text-3">Autenticidade:</span>
                        <span
                            className="font-mono text-sm font-bold"
                            style={{ color: scoreColor(score) }}
                        >
                            {score}
                        </span>
                    </div>
                    <p className="text-xs text-text-3">
                        Risco bruto: {(result.affectedRatio * 100).toFixed(1)}% linhas afectadas
                    </p>
                </div>
            )}
            {result.heatmapData && <HeatmapCanvas heatmapData={result.heatmapData} />}
        </div>
    );
}
