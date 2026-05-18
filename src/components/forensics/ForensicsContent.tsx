import type { Dispatch } from 'react';
import type { AppAction, AppState } from '../../types.ts';
import { ModuleCard } from './ModuleCard.tsx';
import { ExifModule } from './modules/ExifModule.tsx';
import { GhostModule } from './modules/GhostModule.tsx';
import { HistogramForensicModule } from './modules/HistogramForensicModule.tsx';
import { DocStructureModule } from './modules/DocStructureModule.tsx';
import { NoiseModule } from './modules/NoiseModule.tsx';
import { QualityModule } from './modules/QualityModule.tsx';
import { VerdictBlock } from './VerdictBlock.tsx';

interface ForensicsContentProps {
    state: AppState;
    dispatch: Dispatch<AppAction>;
}

export function ForensicsContent({ state, dispatch }: ForensicsContentProps) {
    const { forensicResult, isAnalyzing, progress, ghostLevelIndex, imageElement } = state;
    const report = forensicResult?.report ?? null;

    const imageWidth = imageElement?.naturalWidth ?? 0;
    const imageHeight = imageElement?.naturalHeight ?? 0;

    return (
        <div className="flex h-full flex-col">
            <VerdictBlock report={report} isAnalyzing={isAnalyzing} progress={progress} />

            {forensicResult && (
                <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-3">
                    <ModuleCard
                        title="Metadados EXIF"
                        score={forensicResult.report.exif}
                        icon="🗂"
                        defaultOpen
                    >
                        <ExifModule result={forensicResult.exif} />
                    </ModuleCard>

                    <ModuleCard
                        title="Inconsistência de Ruído"
                        score={forensicResult.report.noise}
                        icon="🌊"
                    >
                        <NoiseModule
                            result={forensicResult.noise}
                            imageWidth={imageWidth}
                            imageHeight={imageHeight}
                        />
                    </ModuleCard>

                    <ModuleCard title="JPEG Ghost" score={forensicResult.report.ghost} icon="👻">
                        <GhostModule
                            result={forensicResult.ghost}
                            levelIndex={ghostLevelIndex}
                            onLevelChange={(index) => dispatch({ type: 'SET_GHOST_LEVEL', index })}
                        />
                    </ModuleCard>

                    <ModuleCard
                        title="Qualidade de Captura"
                        icon="📷"
                        isQuality
                        isAcceptable={forensicResult.quality.isAcceptable}
                    >
                        <QualityModule result={forensicResult.quality} />
                    </ModuleCard>

                    <ModuleCard
                        title="Error Level Analysis"
                        score={forensicResult.report.ela}
                        icon="🔬"
                    >
                        <p className="text-xs text-text-3">
                            Score ELA:{' '}
                            <span className="font-mono text-blue">{forensicResult.report.ela}</span>{' '}
                            — Use a aba ELA para visualização detalhada.
                        </p>
                    </ModuleCard>

                    <ModuleCard
                        title="Detecção Copy-Move"
                        score={forensicResult.report.copyMove}
                        icon="🔁"
                    >
                        <p className="text-xs text-text-3">
                            {forensicResult.copyMoveResult.matchCount} blocos correspondentes — Use
                            a aba Copy-Move para visualização do mapa.
                        </p>
                    </ModuleCard>

                    <ModuleCard
                        title="Reamostramento"
                        score={forensicResult.report.resampling}
                        icon="📐"
                    >
                        <p className="text-xs text-text-3">
                            {(forensicResult.resamplingResult.affectedRatio * 100).toFixed(1)}%
                            linhas com periodicidade suspeita — Use a aba Resampling para
                            visualização.
                        </p>
                    </ModuleCard>

                    <ModuleCard
                        title="Análise Histograma RGB"
                        score={forensicResult.report.histogram}
                        icon="📊"
                    >
                        <HistogramForensicModule result={forensicResult.histogramResult} />
                    </ModuleCard>

                    <ModuleCard
                        title="Estrutura do Documento"
                        score={forensicResult.report.docStructure}
                        icon="🪪"
                    >
                        <DocStructureModule result={forensicResult.docStructureResult} />
                    </ModuleCard>
                </div>
            )}

            {!forensicResult && !isAnalyzing && <div className="flex-1" />}
        </div>
    );
}
