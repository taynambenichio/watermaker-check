import { type ChangeEvent, useCallback, useEffect, useReducer, useRef } from 'react';
import { DocPane } from './components/DocPane.tsx';
import { TabBar } from './components/layout/TabBar.tsx';
import { TopBar } from './components/layout/TopBar.tsx';
import { RightPanel } from './components/RightPanel.tsx';
import { useForensics } from './hooks/useForensics.ts';
import { useImageLoader } from './hooks/useImageLoader.ts';
import { appReducer, initialAppState } from './types.ts';

export default function App() {
    const [state, dispatch] = useReducer(appReducer, initialAppState);
    const imageRef = useRef<HTMLImageElement>(null);
    const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const { analyze } = useForensics(dispatch);

    const handleImageLoaded = useCallback(
        (data: { imageElement: HTMLImageElement; sourceFile: File; objectUrl: string }) => {
            dispatch({ type: 'IMAGE_LOADED', ...data });
        },
        [],
    );

    const { loadFile, loadUrl } = useImageLoader(handleImageLoaded, (message) =>
        dispatch({ type: 'LOAD_ERROR', message }),
    );

    // biome-ignore lint/correctness/useExhaustiveDependencies: auto-analyze only when a new image loads; broader deps can retrigger after analysis errors
    useEffect(() => {
        if (state.imageElement && !state.forensicResult && !state.isAnalyzing) {
            analyze(state.imageElement, state.sourceFile);
        }
    }, [state.imageElement]);

    useEffect(() => {
        return () => {
            if (state.objectUrl) URL.revokeObjectURL(state.objectUrl);
        };
    }, [state.objectUrl]);

    const handleReanalyze = useCallback(() => {
        if (state.imageElement) analyze(state.imageElement, state.sourceFile);
    }, [state.imageElement, state.sourceFile, analyze]);

    const handleFileSelect = useCallback(() => fileInputRef.current?.click(), []);
    const handleSampleLoad = useCallback(() => loadUrl('example.png'), [loadUrl]);
    const handleFileInputChange = useCallback(
        (e: ChangeEvent<HTMLInputElement>) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file) {
                void loadFile(file).catch((error) => {
                    console.error('[App] Failed to load selected file:', error);
                });
            }
        },
        [loadFile],
    );

    return (
        <div className="h-screen w-screen flex flex-col overflow-hidden bg-bg font-sans text-text">
            <TopBar state={state} onReanalyze={handleReanalyze} />
            <TabBar
                activeTab={state.activeTab}
                onTabChange={(tab) => dispatch({ type: 'SET_TAB', tab })}
            />
            <main className="flex flex-1 overflow-hidden">
                <DocPane
                    state={state}
                    dispatch={dispatch}
                    imageRef={imageRef}
                    overlayCanvasRef={overlayCanvasRef}
                    onFileDrop={loadFile}
                    onSampleLoad={handleSampleLoad}
                    onFileSelect={handleFileSelect}
                    fileInputRef={fileInputRef}
                    onFileInputChange={handleFileInputChange}
                />
                <RightPanel
                    state={state}
                    dispatch={dispatch}
                    imageRef={imageRef}
                    overlayCanvasRef={overlayCanvasRef}
                />
            </main>
        </div>
    );
}
