import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseMrz } from '../js/forensics/mrz.ts';
import { recognizeMrzFromImage, terminateMrzWorker } from '../js/forensics/mrz-ocr.ts';

let successfulVariant = 'full-negative-contrast';
const td3Text = [
    'P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<',
    'L898902C36UTO7408122F1204159ZE184226B<<<<<10',
].join('\n');
const td2Text = [
    'I<UTODOE<<JANE<<<<<<<<<<<<<<<<<<<<<<',
    'HA672242<6YTO5802254M9601086<<<<<<<8',
].join('\n');
const invalidTd3Text = [
    'P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<',
    'L898902C36UTO7408122F1204159ZE184226B<<<<<11',
].join('\n');
const passportPhotoOcrText = [
    'L6P<BRABENICH LO<DE<SOUZA<<TAYNAMS',
    'WY L PSAC 102340<9BRAI7TOS225M29 N7B09<K<<<K<<KK<SSSSS 02',
].join('\n');
let variantResponses: Record<string, { text: string; confidence: number }> = {};
const createdWorkers: Array<{
    setParameters: ReturnType<typeof vi.fn>;
    recognize: ReturnType<typeof vi.fn>;
}> = [];

vi.mock('tesseract.js', () => {
    type WorkerOptions = {
        logger?: (message: { status: string; progress: number }) => void;
    };

    const createWorker = vi.fn(async (_lang: string, _core: number, options?: WorkerOptions) => {
        const worker = {
            setParameters: vi.fn(),
            recognize: vi.fn(async (canvas: HTMLCanvasElement) => {
                const variant = [
                    canvas.dataset.mrzRegion ?? 'full',
                    canvas.dataset.mrzPreprocess ?? 'normal',
                    canvas.dataset.mrzThreshold ?? 'contrast',
                ].join('-');
                const response = variantResponses[variant];
                const text = response?.text ?? (variant === successfulVariant ? td3Text : '');
                const confidence =
                    response?.confidence ?? (variant === successfulVariant ? 90 : 15);
                options?.logger?.({ status: 'recognizing text', progress: 1 });
                return { data: { text, confidence } };
            }),
        };
        createdWorkers.push(worker);
        return worker;
    });

    return {
        createWorker,
        PSM: {
            SPARSE_TEXT: 11,
            SINGLE_BLOCK: 6,
        },
    };
});

describe('recognizeMrzFromImage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubGlobal('document', {
            createElement: (tagName: string) => {
                if (tagName === 'canvas') {
                    const context = {
                        imageSmoothingEnabled: true,
                        imageSmoothingQuality: 'high',
                        drawImage: vi.fn(),
                        getImageData: vi.fn(() => ({
                            data: new Uint8ClampedArray(1200 * 800 * 4).fill(180),
                            width: 1200,
                            height: 800,
                        })),
                        putImageData: vi.fn(),
                    };
                    return {
                        dataset: {},
                        width: 0,
                        height: 0,
                        getContext: vi.fn(() => context),
                        setAttribute: vi.fn(),
                    } as unknown as HTMLCanvasElement;
                }
                throw new Error(`Unexpected element: ${tagName}`);
            },
        } as unknown as Document);
    });

    afterEach(async () => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
        await terminateMrzWorker();
        successfulVariant = 'full-negative-contrast';
        variantResponses = {};
        createdWorkers.splice(0, createdWorkers.length);
    });

    it('configures Tesseract with an MRZ whitelist before OCR', async () => {
        const image = {
            naturalWidth: 1200,
            naturalHeight: 800,
        } as HTMLImageElement;

        await recognizeMrzFromImage(image);

        const calls = createdWorkers[0]?.setParameters.mock.calls;
        expect(calls?.length).toBeGreaterThan(0);
        expect(calls?.[0]?.[0]).toMatchObject({
            tessedit_pageseg_mode: 6,
            tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<',
            preserve_interword_spaces: '0',
            user_defined_dpi: '300',
        });
    });

    it('falls back to negative preprocessing when it produces the better MRZ read', async () => {
        successfulVariant = 'full-negative-contrast';
        const image = {
            naturalWidth: 1200,
            naturalHeight: 800,
        } as HTMLImageElement;

        const result = await recognizeMrzFromImage(image);

        expect(result.preprocess).toBe('negative');
        expect(result.region).toBe('full');
        expect(result.parsed.valid).toBe(true);
        expect(result.parsed.documentType).toBe('TD3');
        expect(parseMrz(result.rawText).valid).toBe(true);
    });

    it('preserves TD2 OCR output instead of padding it into TD3', async () => {
        variantResponses = {
            'bottom-normal-contrast': { text: td2Text, confidence: 92 },
        };
        const image = {
            naturalWidth: 1600,
            naturalHeight: 1100,
        } as HTMLImageElement;

        const result = await recognizeMrzFromImage(image);

        expect(result.parsed.valid).toBe(true);
        expect(result.parsed.documentType).toBe('TD2');
        expect(result.rawText.split('\n').every((line) => line.length === 36)).toBe(true);
    });

    it('normalizes TD2 digit positions before calculating fields', async () => {
        variantResponses = {
            'bottom-normal-contrast': {
                text: td2Text.replace('5802254', '580225A'),
                confidence: 88,
            },
        };
        const image = {
            naturalWidth: 1600,
            naturalHeight: 1100,
        } as HTMLImageElement;

        const result = await recognizeMrzFromImage(image);

        expect(result.parsed.valid).toBe(true);
        expect(result.parsed.documentType).toBe('TD2');
        expect(result.parsed.fields.birthDate).toBe('580225');
    });

    it('prefers a valid MRZ over a higher-confidence invalid candidate', async () => {
        variantResponses = {
            'bottom-normal-contrast': { text: invalidTd3Text, confidence: 99 },
            'full-negative-contrast': { text: td3Text, confidence: 55 },
        };
        const image = {
            naturalWidth: 1200,
            naturalHeight: 800,
        } as HTMLImageElement;

        const result = await recognizeMrzFromImage(image);

        expect(result.parsed.valid).toBe(true);
        expect(result.preprocess).toBe('negative');
        expect(result.region).toBe('full');
    });

    it('does not calculate fields from the noisy Brazilian passport sample OCR', async () => {
        successfulVariant = '__none__';
        variantResponses = {
            'bottom-negative-contrast': { text: passportPhotoOcrText, confidence: 72 },
        };
        const image = {
            naturalWidth: 4284,
            naturalHeight: 5712,
        } as HTMLImageElement;

        const result = await recognizeMrzFromImage(image);

        expect(result.parsed.valid).toBe(false);
        expect(result.parsed.documentType).toBeNull();
        expect(result.parsed.fields.documentNumber).toBeNull();
    });

    it('prefers a cropped bottom region when the MRZ sits low on the document', async () => {
        successfulVariant = 'bottom-normal-contrast';
        const image = {
            naturalWidth: 1600,
            naturalHeight: 1100,
        } as HTMLImageElement;

        const result = await recognizeMrzFromImage(image);

        expect(result.region).toBe('bottom');
        expect(result.parsed.valid).toBe(true);
        expect(result.rawText).toContain('P<UTOERIKSSON');
    });
});
