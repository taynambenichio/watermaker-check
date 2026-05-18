import { useEffect, useRef } from 'react';
import type { ImageDataLike } from '../../../js/types.js';
import type { AppState } from '../../types.ts';
import { scoreColor } from '../forensics/scoreColor.ts';

function HeatmapCanvas({ heatmapData }: { heatmapData: ImageDataLike }) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.width = heatmapData.width;
        canvas.height = heatmapData.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const imgData = new ImageData(
            new Uint8ClampedArray(heatmapData.data),
            heatmapData.width,
            heatmapData.height,
        );
        ctx.putImageData(imgData, 0, 0);
    }, [heatmapData]);

    return (
        <canvas
            ref={canvasRef}
            className="block w-full overflow-hidden rounded-sm border border-border"
        />
    );
}

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

    const color = score !== null ? scoreColor(score) : '#5a5750';

    return (
        <div className="flex flex-col gap-3 p-3">
            <p className="text-xs text-text-3">
                Detecta regiões duplicadas/clonadas por correspondência de blocos DCT. Áreas a
                vermelho indicam potencial clonagem.
            </p>
            {score !== null && (
                <div className="flex items-center gap-2">
                    <span className="text-xs text-text-3">Score:</span>
                    <span className="font-mono text-sm font-bold" style={{ color }}>
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
