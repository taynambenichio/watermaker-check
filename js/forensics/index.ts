import { renderELA } from '../ela.js';
import type { ForensicPipelineResult, PipelineProgressCallback } from '../types.js';
import { analyzeExif } from './exif.js';
import { analyzeGhost } from './ghost.js';
import { analyzeNoise } from './noise.js';
import { analyzeQuality } from './quality.js';
import { buildReport } from './report.js';

function isHeicFile(file: File): boolean {
    return (
        file.type === 'image/heic' ||
        file.type === 'image/heif' ||
        /\.(heic|heif)$/i.test(file.name)
    );
}

export async function runForensicPipeline(
    img: HTMLImageElement,
    onProgress?: PipelineProgressCallback,
    sourceFile?: File | null,
): Promise<ForensicPipelineResult> {
    const { naturalWidth: w, naturalHeight: h } = img;

    // Capture original ImageData once (reused for noise + quality analysis)
    const tmp = document.createElement('canvas');
    tmp.width = w;
    tmp.height = h;
    const ctx = tmp.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    const imageData = ctx.getImageData(0, 0, w, h);

    // Phase 1: EXIF + Noise + Quality in parallel
    onProgress?.('exif', 'running');
    onProgress?.('noise', 'running');
    onProgress?.('quality', 'running');

    const [exif, noise, quality] = await Promise.all([
        analyzeExif(sourceFile ?? img).then((r) => {
            onProgress?.('exif', 'done');
            return r;
        }),
        Promise.resolve(analyzeNoise(imageData)).then((r) => {
            onProgress?.('noise', 'done');
            return r;
        }),
        Promise.resolve(analyzeQuality(imageData)).then((r) => {
            onProgress?.('quality', 'done');
            return r;
        }),
    ]);

    // Phase 2: ELA + Ghost in parallel
    onProgress?.('ela', 'running');
    onProgress?.('ghost', 'running');

    const elaOutputCanvas = document.createElement('canvas');

    const [elaScore, ghost] = await Promise.all([
        renderELA(img, elaOutputCanvas, 10).then((s) => {
            onProgress?.('ela', 'done');
            return s;
        }),
        analyzeGhost(img).then((r) => {
            onProgress?.('ghost', 'done');
            return r;
        }),
    ]);

    // Flag HEIC sources — Ghost analysis is affected by heic2any Q92 conversion
    if (sourceFile && isHeicFile(sourceFile)) {
        ghost.heicConverted = true;
    }

    // Phase 3: Report
    onProgress?.('report', 'running');
    const report = buildReport(elaScore, exif.score, noise.score, ghost.score);
    onProgress?.('report', 'done');

    return { exif, noise, ghost, elaScore, quality, report };
}
