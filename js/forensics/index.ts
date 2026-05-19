import { renderELA } from '../ela.js';
import type { ForensicPipelineResult, PipelineProgressCallback } from '../types.js';
import { analyzeCopyMove } from './copy-move.js';
import { analyzeDocStructure } from './doc-structure.js';
import { analyzeExif } from './exif.js';
import { analyzeGhost } from './ghost.js';
import { analyzeHistogramForensic } from './histogram-forensic.js';
import { analyzeNoise } from './noise.js';
import { analyzeQuality } from './quality.js';
import { buildReport } from './report.js';
import { analyzeResampling } from './resampling.js';

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

    if (sourceFile && isHeicFile(sourceFile)) {
        ghost.heicConverted = true;
    }

    // Phase 3: Advanced modules in parallel (after ELA + Ghost)
    onProgress?.('copy-move', 'running');
    onProgress?.('resampling', 'running');
    onProgress?.('histogram', 'running');
    onProgress?.('doc-structure', 'running');

    const [copyMoveResult, resamplingResult, histogramResult, docStructureResult] =
        await Promise.all([
            Promise.resolve(analyzeCopyMove(imageData)).then((r) => {
                onProgress?.('copy-move', 'done');
                return r;
            }),
            Promise.resolve(analyzeResampling(imageData)).then((r) => {
                onProgress?.('resampling', 'done');
                return r;
            }),
            Promise.resolve(analyzeHistogramForensic(imageData)).then((r) => {
                onProgress?.('histogram', 'done');
                return r;
            }),
            Promise.resolve(analyzeDocStructure(imageData)).then((r) => {
                onProgress?.('doc-structure', 'done');
                return r;
            }),
        ]);

    // Build report
    onProgress?.('report', 'running');
    const report = buildReport(
        elaScore,
        exif.score,
        noise.score,
        ghost.score,
        copyMoveResult.score,
        resamplingResult.score,
        histogramResult.score,
        docStructureResult.score,
    );
    onProgress?.('report', 'done');

    return {
        exif,
        noise,
        ghost,
        elaScore,
        quality,
        report,
        copyMoveResult,
        resamplingResult,
        histogramResult,
        docStructureResult,
        mrzResult: null,
    };
}
