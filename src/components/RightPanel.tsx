import type { Dispatch, RefObject } from 'react';
import type { AppAction, AppState } from '../types.ts';
import { ForensicsContent } from './forensics/ForensicsContent.tsx';
import { CanvasTab } from './tabs/CanvasTab.tsx';
import { ElaTab } from './tabs/ElaTab.tsx';
import { FiltersTab } from './tabs/FiltersTab.tsx';
import { ToolsTab } from './tabs/ToolsTab.tsx';

interface RightPanelProps {
    state: AppState;
    dispatch: Dispatch<AppAction>;
    imageRef: RefObject<HTMLImageElement>;
    overlayCanvasRef: RefObject<HTMLCanvasElement>;
}

export function RightPanel({ state, dispatch, imageRef, overlayCanvasRef }: RightPanelProps) {
    const { activeTab } = state;

    return (
        <aside className="flex w-[360px] shrink-0 flex-col overflow-hidden border-l border-border bg-bg-1">
            <div className="flex-1 overflow-y-auto">
                {activeTab === 'forensics' && (
                    <ForensicsContent state={state} dispatch={dispatch} />
                )}
                {activeTab === 'filters' && <FiltersTab state={state} dispatch={dispatch} />}
                {activeTab === 'canvas' && (
                    <CanvasTab
                        state={state}
                        dispatch={dispatch}
                        overlayCanvasRef={overlayCanvasRef}
                    />
                )}
                {activeTab === 'ela' && (
                    <ElaTab state={state} dispatch={dispatch} imageRef={imageRef} />
                )}
                {activeTab === 'tools' && (
                    <ToolsTab
                        state={state}
                        dispatch={dispatch}
                        imageRef={imageRef}
                        overlayCanvasRef={overlayCanvasRef}
                    />
                )}
            </div>
        </aside>
    );
}
