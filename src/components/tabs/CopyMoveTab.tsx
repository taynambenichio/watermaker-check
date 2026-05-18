import type { AppState } from '../../types.ts';
import { HeatmapCanvas } from '../forensics/HeatmapCanvas.tsx';
import { scoreColor } from '../forensics/scoreColor.ts';

interface CopyMoveTabProps {
    state: AppState;
}

export function CopyMoveTab({ state }: CopyMoveTabProps) {
    const result = state.forensicResult?.copyMoveResult ?? null;
    const score = state.forensicResult?.report.copyMove ?? null;

    if (!result) {
        return (
            <div className="flex h-full items-center justify-center p-6 text-center">
                <p className="text-xs text-text-3">
                    Execute a análise forense para visualizar o mapa de regiões copiadas.
                </p>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-3 p-3">
            <p className="text-xs text-text-3">
                Detecta regiões duplicadas/clonadas por correspondência de blocos DCT. Áreas a
                vermelho indicam potencial clonagem.
            </p>
            {score !== null && (
                <div className="flex items-center gap-2">
                    <span className="text-xs text-text-3">Score:</span>
                    <span
                        className="font-mono text-sm font-bold"
                        style={{ color: scoreColor(score) }}
                    >
                        {score}
                    </span>
                    <span className="text-xs text-text-3">
                        — {result.matchCount} blocos correspondentes
                    </span>
                </div>
            )}
            {result.heatmapData && <HeatmapCanvas heatmapData={result.heatmapData} />}
        </div>
    );
}
