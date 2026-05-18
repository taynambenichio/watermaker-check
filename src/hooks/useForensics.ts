import { type Dispatch, useCallback } from 'react';
import { runForensicPipeline } from '../../js/forensics/index.js';
import type { PipelineStep } from '../../js/types.js';
import type { AppAction } from '../types.ts';

export function useForensics(dispatch: Dispatch<AppAction>) {
    const analyze = useCallback(
        async (img: HTMLImageElement, sourceFile: File | null): Promise<void> => {
            dispatch({ type: 'ANALYSIS_STARTED' });
            try {
                const result = await runForensicPipeline(
                    img,
                    (step: PipelineStep, status: 'running' | 'done' | 'error') => {
                        dispatch({ type: 'STEP_PROGRESS', step, status });
                    },
                    sourceFile,
                );
                dispatch({ type: 'ANALYSIS_DONE', result });
            } catch (err) {
                console.error('Forensic pipeline failed:', err);
                dispatch({ type: 'ANALYSIS_ERROR' });
            }
        },
        [dispatch],
    );

    return { analyze };
}
