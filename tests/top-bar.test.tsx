import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { TopBar } from '../src/components/layout/TopBar.tsx';
import type { AppState } from '../src/types.ts';
import { initialAppState } from '../src/types.ts';

function stateWithScore(totalScore: number): AppState {
    return {
        ...initialAppState,
        imageElement: {
            naturalWidth: 100,
            naturalHeight: 100,
        } as HTMLImageElement,
        sourceFile: new File([], 'document.jpg'),
        forensicResult: {
            exif: {
                hasExif: false,
                software: null,
                camera: null,
                dateTime: null,
                gpsPresent: false,
                flags: [],
                score: 0,
            },
            noise: {
                score: 0,
                blockMap: new Float32Array(0),
                gridW: 0,
                gridH: 0,
                suspiciousBlockCount: 0,
                totalBlockCount: 0,
            },
            ghost: {
                score: 0,
                levels: [],
                suspectedOriginalQuality: null,
            },
            elaScore: 0,
            quality: {
                sharpness: 100,
                exposure: 50,
                flags: [],
                isAcceptable: true,
            },
            report: {
                totalScore,
                verdict:
                    totalScore > 70 ? 'authentic' : totalScore >= 40 ? 'suspicious' : 'tampered',
                ela: totalScore,
                exif: totalScore,
                noise: totalScore,
                ghost: totalScore,
                copyMove: totalScore,
                resampling: totalScore,
                histogram: totalScore,
                docStructure: totalScore,
                completedAt: 0,
            },
            copyMoveResult: { score: 0, matchCount: 0, heatmapData: null },
            resamplingResult: { score: 0, affectedRatio: 0, heatmapData: null },
            histogramResult: {
                score: 0,
                r: new Uint32Array(256),
                g: new Uint32Array(256),
                b: new Uint32Array(256),
                holes: 0,
                combStrength: 0,
            },
            docStructureResult: {
                score: 50,
                mrzDetected: false,
                regionConsistency: 0,
                photoZoneIntegrity: 0,
            },
            mrzResult: null,
        },
    };
}

describe('TopBar', () => {
    it('uses green status for high authenticity scores', () => {
        const html = renderToStaticMarkup(
            <TopBar state={stateWithScore(85)} onReanalyze={() => {}} />,
        );

        expect(html).toContain('background:#5cb87a');
    });

    it('uses red status for low authenticity scores', () => {
        const html = renderToStaticMarkup(
            <TopBar state={stateWithScore(25)} onReanalyze={() => {}} />,
        );

        expect(html).toContain('background:#d95f5f');
    });
});
