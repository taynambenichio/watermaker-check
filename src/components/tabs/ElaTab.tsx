import type { Dispatch, RefObject } from 'react';
import { useCallback, useRef, useState } from 'react';
import { renderELA } from '../../../js/ela.js';
import type { AppAction, AppState } from '../../types.ts';

interface ElaTabProps {
    state: AppState;
    dispatch: Dispatch<AppAction>;
    imageRef: RefObject<HTMLImageElement>;
}

export function ElaTab({ state, dispatch, imageRef }: ElaTabProps) {
    const elaCanvasRef = useRef<HTMLCanvasElement>(null);
    const [isRunning, setIsRunning] = useState(false);
    const { imageElement, elaAmplification, elaScore } = state;

    const runELA = useCallback(async () => {
        const img = imageRef.current ?? imageElement;
        const canvas = elaCanvasRef.current;
        if (!img || !canvas || isRunning) return;
        setIsRunning(true);
        dispatch({ type: 'SET_ELA_SCORE', score: null });
        try {
            const score = await renderELA(img, canvas, elaAmplification);
            dispatch({ type: 'SET_ELA_SCORE', score });
        } catch (e: unknown) {
            if (e instanceof Error && e.name === 'SecurityError') {
                alert('ELA não disponível para imagens de origem externa');
            } else {
                alert(`Erro ao analisar: ${e instanceof Error ? e.message : String(e)}`);
            }
        } finally {
            setIsRunning(false);
        }
    }, [imageElement, imageRef, elaAmplification, isRunning, dispatch]);

    const disabled = !imageElement || isRunning;
    const scoreColor =
        elaScore === null
            ? '#5a5750'
            : elaScore < 30
              ? '#5cb87a'
              : elaScore < 60
                ? '#e8a800'
                : '#d95f5f';

    return (
        <div className="flex flex-col gap-3 p-3">
            <p className="text-xs text-text-3">
                Detecta regiões adulteradas por diferenças de compressão JPEG. Regiões quentes
                (vermelho/branco) indicam adulteração.
            </p>

            <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                    <label htmlFor="ela-amp" className="font-syne text-xs font-bold text-text-2">
                        SENSIBILIDADE
                    </label>
                    <span className="font-mono text-xs text-amber">{elaAmplification}</span>
                </div>
                <input
                    id="ela-amp"
                    type="range"
                    min={1}
                    max={30}
                    value={elaAmplification}
                    onChange={(e) =>
                        dispatch({ type: 'SET_ELA_AMP', value: Number(e.target.value) })
                    }
                    className="h-1 w-full"
                />
            </div>

            <button
                type="button"
                onClick={() => {
                    void runELA();
                }}
                disabled={disabled}
                className="h-8 w-full rounded-sm border border-border text-xs font-syne font-bold text-text-2 transition-colors hover:border-amber hover:text-amber disabled:cursor-not-allowed disabled:opacity-40"
            >
                {isRunning ? '⏳ A analisar…' : '🔬 Analisar ELA'}
            </button>

            {elaScore !== null && (
                <div className="flex items-center gap-2">
                    <span className="text-xs text-text-3">Score ELA:</span>
                    <span className="font-mono text-sm font-bold" style={{ color: scoreColor }}>
                        {elaScore}%
                    </span>
                </div>
            )}

            <canvas
                ref={elaCanvasRef}
                className={[
                    'block w-full overflow-hidden rounded-sm border border-border',
                    elaScore === null ? 'hidden' : '',
                ].join(' ')}
            />
        </div>
    );
}
