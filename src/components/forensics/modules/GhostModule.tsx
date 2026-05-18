import { useEffect, useRef } from 'react';
import type { GhostResult } from '../../../../js/types.js';

interface GhostModuleProps {
    result: GhostResult;
    levelIndex: number;
    onLevelChange: (idx: number) => void;
}

export function GhostModule({ result, levelIndex, onLevelChange }: GhostModuleProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const maxLevelIndex = Math.max(0, result.levels.length - 1);
    const effectiveLevelIndex = Math.min(levelIndex, maxLevelIndex);
    const selectedQuality =
        result.levels[effectiveLevelIndex]?.quality ?? result.levels[maxLevelIndex]?.quality ?? '?';

    useEffect(() => {
        const canvas = canvasRef.current;
        const level = result.levels[effectiveLevelIndex];
        if (!canvas || !level) return;

        canvas.width = level.imageData.width;
        canvas.height = level.imageData.height;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const imageData = ctx.createImageData(level.imageData.width, level.imageData.height);
        imageData.data.set(level.imageData.data);
        ctx.putImageData(imageData, 0, 0);
    }, [result, effectiveLevelIndex]);

    return (
        <div className="flex flex-col gap-2">
            {result.levels.length > 0 && (
                <>
                    <div className="flex items-center gap-2">
                        <span className="shrink-0 text-xs text-text-3">Qualidade</span>
                        <input
                            type="range"
                            min={0}
                            max={maxLevelIndex}
                            value={effectiveLevelIndex}
                            onChange={(event) =>
                                onLevelChange(Math.min(Number(event.target.value), maxLevelIndex))
                            }
                            className="h-1 flex-1"
                            aria-label="Qualidade JPEG Ghost"
                        />
                        <span className="w-8 text-right font-mono text-xs text-blue">
                            Q{selectedQuality}
                        </span>
                    </div>
                    <canvas ref={canvasRef} className="w-full rounded-sm" />
                </>
            )}
            <p className="text-xs text-text-3">
                {result.suspectedOriginalQuality
                    ? `Qualidade original suspeita: Q${result.suspectedOriginalQuality}`
                    : 'Sem sinal de dupla compressão JPEG detectado'}
                {result.heicConverted && (
                    <span className="text-amber">
                        {' '}
                        — ⚠ Fonte HEIC: análise Ghost pode ser imprecisa
                    </span>
                )}
            </p>
        </div>
    );
}
