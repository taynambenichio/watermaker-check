import { describe, expect, it, vi } from 'vitest';
import { appReducer, initialAppState } from '../src/types.ts';

describe('appReducer', () => {
    it('clears progress and resets ghost level when analysis completes', () => {
        const state = {
            ...initialAppState,
            isAnalyzing: true,
            ghostLevelIndex: 3,
            progress: {
                exif: 'done',
                ghost: 'running',
            },
        };

        const next = appReducer(state, {
            type: 'ANALYSIS_DONE',
            result: {
                exif: {
                    hasExif: true,
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
                    heicConverted: false,
                },
                elaScore: 0,
                quality: {
                    sharpness: 80,
                    exposure: 60,
                    flags: [],
                    isAcceptable: true,
                },
                copyMoveResult: {
                    score: 0,
                    matchCount: 0,
                    heatmapData: null,
                },
                resamplingResult: {
                    score: 0,
                    affectedRatio: 0,
                    heatmapData: null,
                },
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
                    mrzResult: null,
                    regionConsistency: 0,
                    photoZoneIntegrity: 0,
                },
                report: {
                    totalScore: 100,
                    verdict: 'authentic',
                    ela: 100,
                    exif: 100,
                    noise: 100,
                    ghost: 100,
                    copyMove: 100,
                    resampling: 100,
                    histogram: 100,
                    docStructure: 50,
                    completedAt: Date.now(),
                },
            },
        });

        expect(next.isAnalyzing).toBe(false);
        expect(next.progress).toEqual({});
        expect(next.ghostLevelIndex).toBe(0);
    });

    it('does not revoke object URLs inside the reducer', () => {
        const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

        const next = appReducer(
            {
                ...initialAppState,
                objectUrl: 'blob:old-image',
            },
            {
                type: 'IMAGE_LOADED',
                imageElement: {} as HTMLImageElement,
                sourceFile: new File(['x'], 'sample.png', { type: 'image/png' }),
                objectUrl: 'blob:new-image',
            },
        );

        expect(revokeSpy).not.toHaveBeenCalled();
        expect(next.objectUrl).toBe('blob:new-image');

        revokeSpy.mockRestore();
    });
});
