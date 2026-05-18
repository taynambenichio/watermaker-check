import type { Dispatch, RefObject } from 'react';
import { useCallback } from 'react';
import type { AppAction, AppState } from '../../types.ts';

interface ToolsTabProps {
    state: AppState;
    dispatch: Dispatch<AppAction>;
    imageRef: RefObject<HTMLImageElement>;
    overlayCanvasRef: RefObject<HTMLCanvasElement>;
}

export function ToolsTab({ state, dispatch, imageRef, overlayCanvasRef }: ToolsTabProps) {
    const { imageElement, zoom, beforeAfterActive, forensicResult } = state;
    const disabled = !imageElement;

    const zoomIn = useCallback(() => dispatch({ type: 'ADJUST_ZOOM', delta: 0.25 }), [dispatch]);
    const zoomOut = useCallback(() => dispatch({ type: 'ADJUST_ZOOM', delta: -0.25 }), [dispatch]);
    const zoomReset = useCallback(() => dispatch({ type: 'SET_ZOOM', zoom: 1 }), [dispatch]);

    const exportPNG = useCallback(() => {
        const img = imageRef.current;
        if (!img) return;
        const tmp = document.createElement('canvas');
        tmp.width = img.naturalWidth;
        tmp.height = img.naturalHeight;
        const ctx = tmp.getContext('2d');
        if (!ctx) return;
        ctx.filter = img.style.filter || 'none';
        try {
            ctx.drawImage(img, 0, 0);
            const overlay = overlayCanvasRef.current;
            if (overlay && getComputedStyle(overlay).display !== 'none') {
                ctx.filter = 'none';
                ctx.drawImage(overlay, 0, 0, tmp.width, tmp.height);
            }
            const link = document.createElement('a');
            link.href = tmp.toDataURL('image/png');
            link.download = 'watermark-analysis.png';
            link.click();
        } catch (e: unknown) {
            alert(`Erro ao exportar: ${e instanceof Error ? e.message : String(e)}`);
        }
    }, [imageRef, overlayCanvasRef]);

    const exportJSON = useCallback(() => {
        if (!forensicResult) return;
        const { report } = forensicResult;
        const data = {
            timestamp: new Date(report.completedAt).toISOString(),
            verdict: report.verdict,
            totalScore: report.totalScore,
            breakdown: {
                ela: report.ela,
                ghost: report.ghost,
                noise: report.noise,
                exif: report.exif,
            },
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'forensic-report.json';
        link.click();
        URL.revokeObjectURL(url);
    }, [forensicResult]);

    const btnClass =
        'h-8 w-full rounded-sm border border-border text-xs font-syne font-bold text-text-2 transition-colors hover:border-amber hover:text-amber disabled:cursor-not-allowed disabled:opacity-40';

    return (
        <div className="flex flex-col gap-3 p-3">
            <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                    <span className="font-syne text-xs font-bold uppercase tracking-wide text-text-2">
                        Zoom
                    </span>
                    <span className="font-mono text-xs text-amber">{Math.round(zoom * 100)}%</span>
                </div>
                <div className="flex gap-1.5">
                    <button
                        type="button"
                        onClick={zoomOut}
                        disabled={disabled}
                        className={btnClass}
                        title="Reduzir"
                    >
                        −
                    </button>
                    <button
                        type="button"
                        onClick={zoomReset}
                        disabled={disabled}
                        className={btnClass}
                        title="Restaurar zoom"
                    >
                        ↺
                    </button>
                    <button
                        type="button"
                        onClick={zoomIn}
                        disabled={disabled}
                        className={btnClass}
                        title="Ampliar"
                    >
                        +
                    </button>
                </div>
            </div>

            <button
                type="button"
                onClick={() => dispatch({ type: 'TOGGLE_BEFORE_AFTER' })}
                disabled={disabled}
                className={[
                    btnClass,
                    beforeAfterActive ? 'border-amber bg-amber-dim text-amber' : '',
                ].join(' ')}
            >
                ↔ Antes / Depois
            </button>

            <div className="flex flex-col gap-1.5 border-t border-border pt-3">
                <p className="mb-1 font-syne text-xs font-bold uppercase tracking-wide text-text-3">
                    Exportar
                </p>
                <button type="button" onClick={exportPNG} disabled={disabled} className={btnClass}>
                    💾 Exportar PNG
                </button>
                <button
                    type="button"
                    onClick={exportJSON}
                    disabled={!forensicResult}
                    className={btnClass}
                >
                    📋 Exportar relatório JSON
                </button>
            </div>
        </div>
    );
}
