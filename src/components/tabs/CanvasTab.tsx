import type { Dispatch, RefObject } from 'react';
import { useCallback, useRef } from 'react';
import { clearOverlay, renderAmplify, renderHistogram, renderSobel } from '../../../js/canvas.js';
import type { AppAction, AppState } from '../../types.ts';

interface CanvasTabProps {
    state: AppState;
    dispatch: Dispatch<AppAction>;
    overlayCanvasRef: RefObject<HTMLCanvasElement>;
}

export function CanvasTab({ state, dispatch, overlayCanvasRef }: CanvasTabProps) {
    const histCanvasRef = useRef<HTMLCanvasElement>(null);
    const { imageElement, canvasMode } = state;

    const runHistogram = useCallback(() => {
        if (!imageElement) return;
        const tmp = document.createElement('canvas');
        tmp.width = imageElement.naturalWidth;
        tmp.height = imageElement.naturalHeight;
        const ctx = tmp.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(imageElement, 0, 0);
        const imageData = ctx.getImageData(0, 0, tmp.width, tmp.height);
        if (histCanvasRef.current) renderHistogram(imageData, histCanvasRef.current);
        if (overlayCanvasRef.current) clearOverlay(overlayCanvasRef.current);
        dispatch({ type: 'SET_CANVAS_MODE', mode: 'histogram' });
    }, [imageElement, overlayCanvasRef, dispatch]);

    const runSobel = useCallback(() => {
        if (!imageElement || !overlayCanvasRef.current) return;
        renderSobel(imageElement, overlayCanvasRef.current);
        dispatch({ type: 'SET_CANVAS_MODE', mode: 'sobel' });
    }, [imageElement, overlayCanvasRef, dispatch]);

    const runAmplify = useCallback(() => {
        if (!imageElement || !overlayCanvasRef.current) return;
        renderAmplify(imageElement, overlayCanvasRef.current);
        dispatch({ type: 'SET_CANVAS_MODE', mode: 'amplify' });
    }, [imageElement, overlayCanvasRef, dispatch]);

    const runClear = useCallback(() => {
        if (overlayCanvasRef.current) clearOverlay(overlayCanvasRef.current);
        dispatch({ type: 'SET_CANVAS_MODE', mode: null });
    }, [overlayCanvasRef, dispatch]);

    const actionDisabled = !imageElement;
    const clearDisabled = canvasMode === null;

    const btnClass = (mode: typeof canvasMode) =>
        [
            'h-8 px-3 rounded-sm border text-left text-xs font-syne font-bold transition-colors',
            canvasMode === mode
                ? 'border-amber bg-amber-dim text-amber'
                : actionDisabled
                  ? 'cursor-not-allowed border-border-soft text-text-3 opacity-40'
                  : 'border-border text-text-3 hover:border-border hover:text-text-2',
        ].join(' ');

    return (
        <div className="flex flex-col gap-2 p-3">
            <p className="mb-1 text-xs text-text-3">Processamento de pixels via Canvas API</p>
            <button
                type="button"
                onClick={runHistogram}
                disabled={actionDisabled}
                className={btnClass('histogram')}
            >
                📊 Histograma RGB
            </button>
            <button
                type="button"
                onClick={runSobel}
                disabled={actionDisabled}
                className={btnClass('sobel')}
            >
                📐 Bordas (Sobel)
            </button>
            <button
                type="button"
                onClick={runAmplify}
                disabled={actionDisabled}
                className={btnClass('amplify')}
            >
                🔍 Amplificar diferenças
            </button>
            <button
                type="button"
                onClick={runClear}
                disabled={clearDisabled}
                className="h-8 rounded-sm border border-border-soft px-3 text-xs font-syne font-bold text-text-3 transition-colors hover:text-text-2 disabled:cursor-not-allowed disabled:opacity-40"
            >
                ✕ Limpar
            </button>
            <div
                className={[
                    'mt-2 overflow-hidden rounded-sm border border-border bg-bg-3',
                    canvasMode === 'histogram' ? '' : 'hidden',
                ].join(' ')}
            >
                <canvas ref={histCanvasRef} width={256} height={80} className="w-full" />
            </div>
        </div>
    );
}
