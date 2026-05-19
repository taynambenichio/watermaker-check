import { type MrzResult, parseMrz } from './mrz.js';

export interface MrzOcrResult {
    rawText: string;
    parsed: MrzResult;
}

export interface MrzOcrProgress {
    status: string;
    progress: number;
}

function buildMrzCanvas(img: HTMLImageElement): HTMLCanvasElement {
    const sourceW = img.naturalWidth;
    const sourceH = img.naturalHeight;
    const cropY = Math.floor(sourceH * 0.52);
    const cropH = sourceH - cropY;
    const targetW = Math.min(3600, Math.max(sourceW, 2200));
    const scale = targetW / sourceW;

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(sourceW * scale);
    canvas.height = Math.round(cropH * scale);

    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('MRZ OCR: canvas context unavailable');

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, cropY, sourceW, cropH, 0, 0, canvas.width, canvas.height);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const { data } = imageData;
    for (let i = 0; i < data.length; i += 4) {
        const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        const contrasted = Math.max(0, Math.min(255, (lum - 128) * 1.8 + 128));
        data[i] = contrasted;
        data[i + 1] = contrasted;
        data[i + 2] = contrasted;
    }
    ctx.putImageData(imageData, 0, 0);

    return canvas;
}

export async function recognizeMrzFromImage(
    img: HTMLImageElement,
    onProgress?: (progress: MrzOcrProgress) => void,
): Promise<MrzOcrResult> {
    const { createWorker, PSM } = await import('tesseract.js');
    const canvas = buildMrzCanvas(img);
    const worker = await createWorker('eng', 1, {
        logger: (message) => {
            onProgress?.({ status: message.status, progress: message.progress });
        },
    });

    try {
        await worker.setParameters({
            tessedit_pageseg_mode: PSM.SPARSE_TEXT,
            tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<',
            preserve_interword_spaces: '1',
        });
        const {
            data: { text },
        } = await worker.recognize(canvas);
        return { rawText: text, parsed: parseMrz(text) };
    } finally {
        await worker.terminate();
    }
}
