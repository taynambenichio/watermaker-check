import { describe, expect, it } from 'vitest';
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
                report: {
                    totalScore: 0,
                    verdict: 'authentic',
                    ela: 0,
                    exif: 0,
                    noise: 0,
                    ghost: 0,
                    completedAt: Date.now(),
                },
            },
        });

        expect(next.isAnalyzing).toBe(false);
        expect(next.progress).toEqual({});
        expect(next.ghostLevelIndex).toBe(0);
    });
});
