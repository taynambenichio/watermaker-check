import { useCallback, useEffect, useReducer, useRef } from 'react';
import { TabBar } from './components/layout/TabBar.tsx';
import { TopBar } from './components/layout/TopBar.tsx';
import { useForensics } from './hooks/useForensics.ts';
import { useImageLoader } from './hooks/useImageLoader.ts';
import { appReducer, initialAppState } from './types.ts';

export default function App() {
    const [state, dispatch] = useReducer(appReducer, initialAppState);
    // biome-ignore lint/correctness/noUnusedVariables: wired in Task 5
    const imageRef = useRef<HTMLImageElement>(null);
    // biome-ignore lint/correctness/noUnusedVariables: wired in Task 5
    const overlayCanvasRef = useRef<HTMLCanvasElement>(null);

    const { analyze } = useForensics(dispatch);

    const handleImageLoaded = useCallback(
        (data: { imageElement: HTMLImageElement; sourceFile: File; objectUrl: string }) => {
            dispatch({ type: 'IMAGE_LOADED', ...data });
        },
        [],
    );

    const { loadFile: _loadFile, loadUrl: _loadUrl } = useImageLoader(handleImageLoaded);

    // biome-ignore lint/correctness/useExhaustiveDependencies: auto-analyze only when a new image loads; broader deps can retrigger after analysis errors
    useEffect(() => {
        if (state.imageElement && !state.forensicResult && !state.isAnalyzing) {
            analyze(state.imageElement, state.sourceFile);
        }
    }, [state.imageElement]);

    const handleReanalyze = useCallback(() => {
        if (state.imageElement) analyze(state.imageElement, state.sourceFile);
    }, [state.imageElement, state.sourceFile, analyze]);

    return (
        <div className="h-screen w-screen flex flex-col overflow-hidden bg-bg font-sans text-text">
            <TopBar state={state} onReanalyze={handleReanalyze} />
            <TabBar
                activeTab={state.activeTab}
                onTabChange={(tab) => dispatch({ type: 'SET_TAB', tab })}
            />
            <main className="flex flex-1 overflow-hidden">
                <div className="flex-1 bg-bg flex items-center justify-center text-text-3 text-sm">
                    DocPane — Task 5
                </div>
                <aside className="w-[360px] shrink-0 border-l border-border bg-bg-1 flex items-center justify-center text-text-3 text-sm">
                    RightPanel — Task 6
                </aside>
            </main>
        </div>
    );
}
