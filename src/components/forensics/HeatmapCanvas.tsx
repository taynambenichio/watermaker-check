import { useEffect, useRef } from 'react';
import type { ImageDataLike } from '../../../js/types.ts';

interface HeatmapCanvasProps {
    heatmapData: ImageDataLike;
}

export function HeatmapCanvas({ heatmapData }: HeatmapCanvasProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.width = heatmapData.width;
        canvas.height = heatmapData.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.putImageData(
            new ImageData(
                new Uint8ClampedArray(heatmapData.data),
                heatmapData.width,
                heatmapData.height,
            ),
            0,
            0,
        );
    }, [heatmapData]);

    return (
        <canvas
            ref={canvasRef}
            className="block w-full overflow-hidden rounded-sm border border-border"
        />
    );
}
