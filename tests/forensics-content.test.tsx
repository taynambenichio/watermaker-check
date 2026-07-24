import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ForensicsContent } from '../src/components/forensics/ForensicsContent.tsx';
import { initialAppState } from '../src/types.ts';

describe('ForensicsContent', () => {
    it('shows the empty forensics state before analysis starts', () => {
        const html = renderToStaticMarkup(
            <ForensicsContent state={initialAppState} dispatch={() => {}} />,
        );

        expect(html).toContain('Carregue um documento para iniciar a análise forense automática');
    });

    it('shows pipeline progress while analysis is running', () => {
        const html = renderToStaticMarkup(
            <ForensicsContent
                state={{
                    ...initialAppState,
                    isAnalyzing: true,
                    progress: {
                        exif: 'done',
                        noise: 'running',
                        ghost: 'error',
                        report: 'running',
                    },
                }}
                dispatch={() => {}}
            />,
        );

        expect(html).toContain('A analisar…');
        expect(html).toContain('Metadados EXIF');
        expect(html).toContain('Ruído');
        expect(html).toContain('Ghost JPEG');
        expect(html).toContain('ELA');
        expect(html).toContain('Qualidade');
        expect(html).toContain('Relatório');
    });

    it('hides ghost controls when no ghost levels are available', () => {
        const html = renderToStaticMarkup(
            <ForensicsContent
                state={{
                    ...initialAppState,
                    forensicResult: {
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
                            mrz: 50,
                            completedAt: Date.now(),
                        },
                        mrzResult: null,
                    },
                }}
                dispatch={() => {}}
            />,
        );

        expect(html).not.toContain('Qualidade JPEG Ghost');
        expect(html).not.toContain('Q50');
        expect(html).toContain('Sem sinal de dupla compressão JPEG detectado');
    });

    it('renders verdict and module cards when a forensic result exists', () => {
        const signals = [
            {
                key: 'copyMove' as const,
                label: 'Copy-Move',
                score: 100,
                weight: 0.2,
                contribution: 20,
                detail: 'Copy-Move contribuiu com 20 pontos de suspeita.',
            },
            {
                key: 'ela' as const,
                label: 'ELA',
                score: 81,
                weight: 0.15,
                contribution: 12.15,
                detail: 'ELA contribuiu com 12.2 pontos de suspeita.',
            },
            {
                key: 'ghost' as const,
                label: 'Ghost JPEG',
                score: 67,
                weight: 0.15,
                contribution: 10.05,
                detail: 'Ghost JPEG contribuiu com 10.1 pontos de suspeita.',
            },
        ];

        const html = renderToStaticMarkup(
            <ForensicsContent
                state={{
                    ...initialAppState,
                    imageElement: {
                        naturalWidth: 1600,
                        naturalHeight: 1200,
                    } as HTMLImageElement,
                    forensicResult: {
                        exif: {
                            hasExif: true,
                            software: 'Editor X',
                            camera: 'Canon',
                            dateTime: '2025:01:01 12:00:00',
                            gpsPresent: false,
                            flags: [{ code: 'EDITING_SOFTWARE', message: 'Software detectado' }],
                            score: 50,
                        },
                        noise: {
                            score: 42,
                            blockMap: new Float32Array([0, 1]),
                            gridW: 2,
                            gridH: 1,
                            suspiciousBlockCount: 1,
                            totalBlockCount: 2,
                        },
                        ghost: {
                            score: 67,
                            levels: [
                                {
                                    quality: 50,
                                    meanDiff: 10,
                                    imageData: {
                                        width: 1,
                                        height: 1,
                                        data: new Uint8ClampedArray([0, 0, 0, 255]),
                                    },
                                },
                            ],
                            suspectedOriginalQuality: 65,
                            heicConverted: false,
                        },
                        elaScore: 81,
                        quality: {
                            sharpness: 55,
                            exposure: 70,
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
                            regionConsistency: 0,
                            photoZoneIntegrity: 0,
                        },
                        report: {
                            totalScore: 39,
                            suspicionScore: 61,
                            verdict: 'tampered',
                            summary: 'Suspeita forte concentrada em Copy-Move, ELA e Ghost JPEG.',
                            signals,
                            ela: 19,
                            exif: 50,
                            noise: 58,
                            ghost: 33,
                            copyMove: 80,
                            resampling: 75,
                            histogram: 90,
                            docStructure: 50,
                            mrz: 50,
                            completedAt: Date.now(),
                        },
                        mrzResult: null,
                    },
                }}
                dispatch={() => {}}
            />,
        );

        expect(html).toContain('Provável Adulteração');
        expect(html).toContain('Resumo executivo');
        expect(html).toContain('Score 39 de 100');
        expect(html).toContain('Confiança');
        expect(html).toContain('Tabela de evidências');
        expect(html).toContain('Suspeita agregada');
        expect(html).toContain('Suspeita forte concentrada em Copy-Move');
        expect(html).toContain('Sinal dominante');
        expect(html).toContain('Metadados EXIF');
        expect(html).toContain('Inconsistência de Ruído');
        expect(html).toContain('JPEG Ghost');
        expect(html).toContain('Qualidade de Captura');
        expect(html).toContain('Error Level Analysis');
        expect(html).toContain('Software detectado');
        expect(html).toContain('Detecção Copy-Move');
        expect(html).toContain('Reamostramento');
        expect(html).toContain('Análise Histograma RGB');
        expect(html).toContain('Estrutura do Documento');
        expect(html).toContain('MRZ / OCR');
    });
});
