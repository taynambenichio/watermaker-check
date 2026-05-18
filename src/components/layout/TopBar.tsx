import type { AppState } from '../../types.ts';

interface TopBarProps {
    state: AppState;
    onReanalyze: () => void;
}

export function TopBar({ state, onReanalyze }: TopBarProps) {
    const { imageElement, sourceFile, forensicResult, isAnalyzing } = state;

    const statusColor = !imageElement
        ? '#5a5750'
        : isAnalyzing
          ? '#e8a800'
          : forensicResult
            ? forensicResult.report.totalScore < 30
                ? '#5cb87a'
                : forensicResult.report.totalScore <= 60
                  ? '#e8a800'
                  : '#d95f5f'
            : '#5a5750';

    const fileName = sourceFile?.name ?? null;
    const dims = imageElement
        ? `${imageElement.naturalWidth} × ${imageElement.naturalHeight}`
        : null;

    return (
        <header className="h-11 shrink-0 flex items-center gap-3 px-4 border-b border-border bg-bg-1">
            {/* Logo */}
            <div className="flex items-center gap-2 mr-2">
                <span className="font-syne font-bold text-sm text-text tracking-wide">
                    WATERMARK<span className="text-amber">CHECK</span>
                </span>
            </div>

            {/* Status dot */}
            <div
                role="status"
                aria-live="polite"
                className="w-1.5 h-1.5 rounded-full shrink-0 transition-colors"
                style={{ background: statusColor }}
                aria-label={
                    isAnalyzing
                        ? 'A analisar…'
                        : !imageElement
                          ? 'Sem imagem'
                          : !forensicResult
                            ? 'Erro de análise'
                            : 'Pronto'
                }
            />

            {/* File info */}
            {fileName && (
                <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono text-xs text-text-3 truncate max-w-48">
                        {fileName}
                    </span>
                    {dims && <span className="font-mono text-xs text-text-3 shrink-0">{dims}</span>}
                </div>
            )}

            <div className="flex-1" />

            {/* Actions */}
            {imageElement && !isAnalyzing && (
                <button
                    type="button"
                    onClick={onReanalyze}
                    className="h-7 px-2.5 rounded-sm border border-border text-text-3 text-xs font-syne font-bold hover:border-amber hover:text-amber transition-colors"
                    title="Re-analisar"
                >
                    ↺ Re-analisar
                </button>
            )}
        </header>
    );
}
