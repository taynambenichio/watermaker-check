import {
    type ChangeEvent,
    type Dispatch,
    type DragEvent,
    type KeyboardEvent as ReactKeyboardEvent,
    type MouseEvent as ReactMouseEvent,
    type RefObject,
    useCallback,
    useEffect,
    useRef,
    useState,
    type WheelEvent,
} from 'react';
import type { AppAction, AppState } from '../types.ts';
import { filtersToCSS } from '../types.ts';

interface DocPaneProps {
    state: AppState;
    dispatch: Dispatch<AppAction>;
    imageRef: RefObject<HTMLImageElement>;
    overlayCanvasRef: RefObject<HTMLCanvasElement>;
    onFileDrop: (file: File) => Promise<void>;
    onSampleLoad: () => void;
    onFileSelect: () => void;
    fileInputRef: RefObject<HTMLInputElement>;
    onFileInputChange: (e: ChangeEvent<HTMLInputElement>) => void;
}

export function DocPane({
    state,
    dispatch,
    imageRef,
    overlayCanvasRef,
    onFileDrop,
    onSampleLoad,
    onFileSelect,
    fileInputRef,
    onFileInputChange,
}: DocPaneProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const beforeImgRef = useRef<HTMLImageElement>(null);
    const dividerRef = useRef<HTMLButtonElement>(null);
    const [isDragOver, setIsDragOver] = useState(false);
    const [dividerPct, setDividerPct] = useState(50);
    const draggingRef = useRef(false);
    const { imageElement, zoom, filters, beforeAfterActive } = state;

    // Apply CSS filter to image
    useEffect(() => {
        if (imageRef.current) {
            imageRef.current.style.filter = filtersToCSS(filters);
        }
    }, [filters, imageRef]);

    // Apply zoom
    useEffect(() => {
        if (imageRef.current) {
            imageRef.current.style.transform = `scale(${zoom})`;
        }
        if (beforeImgRef.current) {
            beforeImgRef.current.style.transform = `scale(${zoom})`;
        }
    }, [zoom, imageRef]);

    const applyBeforeAfterClip = useCallback(
        (pct: number) => {
            const before = beforeImgRef.current;
            const img = imageRef.current;
            const divider = dividerRef.current;
            const overlay = overlayCanvasRef.current;
            if (!before || !img || !divider) return;
            before.style.clipPath = `inset(0 ${100 - pct}% 0 0)`;
            img.style.clipPath = `inset(0 0 0 ${pct}%)`;
            if (overlay) overlay.style.clipPath = `inset(0 0 0 ${pct}%)`;
            divider.style.left = `${pct}%`;
            setDividerPct(pct);
        },
        [imageRef, overlayCanvasRef],
    );

    // Sync before-image src and position when activated
    useEffect(() => {
        const before = beforeImgRef.current;
        const img = imageRef.current;
        if (!before || !img) return;
        if (beforeAfterActive && imageElement) {
            before.src = imageElement.src;
            before.style.filter = 'none';
            before.style.display = '';
            applyBeforeAfterClip(50);
            if (dividerRef.current) dividerRef.current.style.display = '';
        } else {
            before.style.display = 'none';
            img.style.clipPath = '';
            if (overlayCanvasRef.current) overlayCanvasRef.current.style.clipPath = '';
            if (dividerRef.current) dividerRef.current.style.display = 'none';
        }
    }, [beforeAfterActive, imageElement, imageRef, overlayCanvasRef, applyBeforeAfterClip]);

    // Before/After mouse drag
    const onDividerMouseDown = useCallback((e: ReactMouseEvent) => {
        draggingRef.current = true;
        e.preventDefault();
    }, []);

    useEffect(() => {
        function onMouseUp() {
            draggingRef.current = false;
        }
        function onMouseMove(e: MouseEvent) {
            if (!draggingRef.current || !containerRef.current) return;
            const rect = containerRef.current.getBoundingClientRect();
            const pct = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
            applyBeforeAfterClip(pct);
        }
        window.addEventListener('mouseup', onMouseUp);
        window.addEventListener('mousemove', onMouseMove);
        return () => {
            window.removeEventListener('mouseup', onMouseUp);
            window.removeEventListener('mousemove', onMouseMove);
        };
    }, [applyBeforeAfterClip]);

    const onDividerKeyDown = useCallback(
        (e: ReactKeyboardEvent<HTMLButtonElement>) => {
            if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
            e.preventDefault();
            const next = e.key === 'ArrowLeft' ? dividerPct - 5 : dividerPct + 5;
            applyBeforeAfterClip(Math.max(0, Math.min(100, next)));
        },
        [applyBeforeAfterClip, dividerPct],
    );

    // Zoom on wheel
    const onWheel = useCallback(
        (e: WheelEvent) => {
            if (!imageElement) return;
            e.preventDefault();
            dispatch({ type: 'ADJUST_ZOOM', delta: e.deltaY < 0 ? 0.1 : -0.1 });
        },
        [imageElement, dispatch],
    );

    // Drag and drop
    const onDragOver = useCallback((e: DragEvent) => {
        e.preventDefault();
        setIsDragOver(true);
    }, []);
    const onDragLeave = useCallback((e: DragEvent) => {
        if (containerRef.current?.contains(e.relatedTarget as Node)) return;
        setIsDragOver(false);
    }, []);
    const onDrop = useCallback(
        (e: DragEvent) => {
            e.preventDefault();
            setIsDragOver(false);
            const file = e.dataTransfer?.files[0];
            if (file) {
                void onFileDrop(file).catch((error) => {
                    console.error('[DocPane] Failed to load dropped file:', error);
                });
            }
        },
        [onFileDrop],
    );

    const fileName = state.sourceFile?.name;
    const dims = imageElement ? `${imageElement.naturalWidth}×${imageElement.naturalHeight}` : null;

    return (
        <section className="flex-1 flex flex-col overflow-hidden bg-bg relative">
            {/* Document stage */}
            {/* biome-ignore lint/a11y/noStaticElementInteractions: document stage intentionally handles drag-and-drop and wheel zoom */}
            <div
                ref={containerRef}
                className={[
                    'flex-1 relative overflow-hidden doc-grid scan-line',
                    isDragOver ? 'ring-1 ring-amber ring-inset' : '',
                ].join(' ')}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                onWheel={onWheel}
            >
                {/* Upload zone — shown when no image */}
                {!imageElement && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 z-10">
                        <div className="text-5xl opacity-20">◻</div>
                        <p className="font-syne font-bold text-text-3 text-sm tracking-wide uppercase">
                            Arraste um documento ou
                        </p>
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={onFileSelect}
                                className="h-8 px-4 rounded-sm border border-border text-text-2 text-xs font-syne font-bold hover:border-amber hover:text-amber transition-colors"
                            >
                                Selecionar arquivo
                            </button>
                            <button
                                type="button"
                                onClick={onSampleLoad}
                                className="h-8 px-4 rounded-sm border border-border-soft text-text-3 text-xs font-syne hover:text-text-2 transition-colors"
                            >
                                Usar exemplo
                            </button>
                        </div>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*,.heic,.heif"
                            className="hidden"
                            onChange={onFileInputChange}
                        />
                    </div>
                )}

                {/* Before image (before/after comparison) */}
                <img
                    ref={beforeImgRef}
                    alt=""
                    style={{ display: 'none' }}
                    className="absolute inset-0 w-full h-full object-contain pointer-events-none z-2"
                />

                {/* Main image */}
                {imageElement && (
                    <img
                        ref={imageRef}
                        src={imageElement.src}
                        alt={fileName ?? 'Documento analisado'}
                        className="absolute inset-0 w-full h-full object-contain z-1 origin-center transition-transform duration-100"
                    />
                )}

                {/* Canvas overlay (Sobel / Amplify) */}
                <canvas
                    ref={overlayCanvasRef}
                    className="absolute inset-0 w-full h-full object-contain z-3 pointer-events-none"
                    style={{
                        display:
                            state.canvasMode === 'sobel' || state.canvasMode === 'amplify'
                                ? 'block'
                                : 'none',
                    }}
                />

                {/* Before/After divider */}
                <button
                    ref={dividerRef}
                    type="button"
                    role="slider"
                    aria-label="Ajustar divisão antes/depois"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(dividerPct)}
                    style={{
                        display: 'none',
                        position: 'absolute',
                        top: 0,
                        bottom: 0,
                        left: '50%',
                        zIndex: 10,
                    }}
                    className="w-px bg-amber cursor-ew-resize"
                    onMouseDown={onDividerMouseDown}
                    onKeyDown={onDividerKeyDown}
                >
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-amber flex items-center justify-center text-bg text-xs font-bold">
                        ↔
                    </div>
                </button>

                {/* Corner labels */}
                {imageElement && (
                    <>
                        <div className="absolute bottom-2 left-2 font-mono text-xs text-text-3 bg-bg/70 px-1.5 py-0.5 rounded-sm z-10">
                            {fileName} {dims && `· ${dims}`}
                        </div>
                        <div className="absolute top-2 right-2 font-mono text-xs text-text-3 bg-bg/70 px-1.5 py-0.5 rounded-sm z-10">
                            {Math.round(zoom * 100)}%
                        </div>
                    </>
                )}
            </div>
        </section>
    );
}
