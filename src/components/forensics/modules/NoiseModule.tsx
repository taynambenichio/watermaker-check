import { useEffect, useRef } from 'react';
import { renderNoiseMap } from '../../../../js/forensics/noise.js';
import type { NoiseResult } from '../../../../js/types.js';

interface NoiseModuleProps {
    result: NoiseResult;
    imageWidth: number;
    imageHeight: number;
}

export function NoiseModule({ result, imageWidth, imageHeight }: NoiseModuleProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        if (canvasRef.current) {
            renderNoiseMap(result, canvasRef.current, imageWidth, imageHeight);
        }
    }, [result, imageWidth, imageHeight]);

    return (
        <div className="flex flex-col gap-2">
            <p className="text-xs text-text-3">
                {result.suspiciousBlockCount} bloco(s) anómalo(s) de {result.totalBlockCount} total
            </p>
            <canvas ref={canvasRef} className="noise-map w-full rounded-sm" />
        </div>
    );
}
