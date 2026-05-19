import { type MrzResult, parseMrz } from './mrz.js';

export interface MrzOcrResult {
    rawText: string;
    parsed: MrzResult;
}

export interface MrzOcrProgress {
    status: string;
    progress: number;
}

// Cached worker — created once, reused for all scans (avoids reloading the language model)
let cachedWorker: Awaited<ReturnType<typeof import('tesseract.js').createWorker>> | null = null;
let workerReady: Promise<void> | null = null;
// Module-level ref so the logger can always call the latest progress callback
let currentProgressCallback: ((p: MrzOcrProgress) => void) | undefined;

async function getWorker(onProgress?: (progress: MrzOcrProgress) => void) {
    const { createWorker } = await import('tesseract.js');

    currentProgressCallback = onProgress;

    if (!cachedWorker) {
        workerReady = (async () => {
            cachedWorker = await createWorker('eng', 1, {
                logger: (message) => {
                    currentProgressCallback?.({ status: message.status, progress: message.progress });
                },
            });
        })();
    }

    await workerReady;
    return cachedWorker!;
}

/**
 * Scan the full image without positional crop.
 * Photos taken on a surface may have the document anywhere in the frame.
 */
function buildMrzCanvas(img: HTMLImageElement): HTMLCanvasElement {
    const sourceW = img.naturalWidth;
    const sourceH = img.naturalHeight;
    const targetW = Math.min(2400, Math.max(sourceW, 1600));
    const scale = targetW / sourceW;

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(sourceW * scale);
    canvas.height = Math.round(sourceH * scale);

    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('MRZ OCR: canvas context unavailable');

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, sourceW, sourceH, 0, 0, canvas.width, canvas.height);

    // Grayscale + contrast for OCR-B font legibility.
    // No inversion: browser Tesseract.js WASM misreads digits as letters under inversion
    // (e.g. 9→I, 4→I, 0→S, 2→U) even though CLI handles it fine. Dark chars on light
    // background work well with higher contrast (1.5×).
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const { data } = imageData;
    for (let i = 0; i < data.length; i += 4) {
        const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        const contrasted = Math.max(0, Math.min(255, (lum - 128) * 1.5 + 128));
        data[i] = contrasted;
        data[i + 1] = contrasted;
        data[i + 2] = contrasted;
    }
    ctx.putImageData(imageData, 0, 0);

    return canvas;
}

/**
 * Fix common OCR-B font misreadings in extracted MRZ lines.
 * The '<' fill character is frequently misread as 'C' (lowercase) or 'K'.
 * Multiple passes handle chained replacements like K<KK<KKKK → <<<<<<<<
 */
function fixOcrBMisreadings(line: string): string {
    let result = line;
    for (let i = 0; i < 3; i++) {
        result = result
            .replace(/[KC]{2,}/g, (m) => '<'.repeat(m.length)) // KKK+ / CCC+ → <<<
            .replace(/<[KC]/g, '<<')                             // <K or <C → <<
            .replace(/[KC]</g, '<<');                            // K< or C< → <<
    }
    // Trailing K/C chars (end padding zone)
    result = result.replace(/[KC]+$/, (m) => '<'.repeat(m.length));
    // Without inversion, '<' in the trailing fill zone is sometimes read as 'S'.
    // Only fix runs of 3+ to avoid corrupting real name characters.
    result = result.replace(/S{3,}$/, (m) => '<'.repeat(m.length));
    return result;
}

/**
 * Trim a candidate line to target length by removing obvious OCR trailing noise.
 * When a line is slightly longer than expected, trailing non-MRZ patterns often
 * appear after the real filler zone (e.g. 'ssss¢', 'eess', etc.).
 */
function trimToLength(line: string, target: number): string {
    if (line.length <= target) return line.padEnd(target, '<');
    // If only 1-4 chars too long, check if the extra chars look like noise
    if (line.length <= target + 4) {
        const extra = line.slice(target);
        // Keep if extra chars are valid MRZ filler or uppercase
        if (/^[<A-Z0-9]+$/.test(extra)) return line.slice(0, target);
    }
    return line.slice(0, target);
}

/**
 * Extract MRZ lines from raw OCR output using a gap-tolerant position-aware search.
 *
 * Key design: Tesseract (especially WASM/browser) may insert short noise lines
 * between the real MRZ lines. Filtering empty lines and requiring strict
 * consecutive placement breaks when this happens.
 *
 * Instead we:
 *  1. Keep original line indices so we can measure gaps in raw output
 *  2. Collect all candidate lines by length
 *  3. Find the first triplet/pair of candidates whose raw-index span is small
 *     (≤ MAX_GAP raw lines), meaning they're close together in the document
 */
function extractMrzLines(rawText: string): string {
    // Map every raw line to its cleaned version and original index
    const allLines = rawText.toUpperCase().split(/\r?\n/);
    const indexed = allLines.map((raw, idx) => ({
        line: raw.replace(/[^A-Z0-9<]/g, ''),
        idx,
    }));

    // Maximum number of raw lines allowed between consecutive MRZ candidates.
    // This tolerates blank lines, single-char noise, stray OCR detections, etc.
    const MAX_GAP = 10;

    function searchTD1(minLen: number, maxLen: number): string | null {
        const cands = indexed.filter(({ line }) => line.length >= minLen && line.length <= maxLen);
        for (let i = 0; i < cands.length - 2; i++) {
            const a = cands[i];
            const b = cands[i + 1];
            const c = cands[i + 2];
            if (b.idx - a.idx <= MAX_GAP && c.idx - b.idx <= MAX_GAP) {
                // fixOcrBMisreadings first so trailing-noise fixes apply before padding
                const fix = (l: string) =>
                    trimToLength(fixOcrBMisreadings(l), 30);
                return `${fix(a.line)}\n${fix(b.line)}\n${fix(c.line)}`;
            }
        }
        return null;
    }

    function searchTD3(minLen: number, maxLen: number): string | null {
        const cands = indexed.filter(({ line }) => line.length >= minLen && line.length <= maxLen);
        for (let i = 0; i < cands.length - 1; i++) {
            const a = cands[i];
            const b = cands[i + 1];
            if (b.idx - a.idx <= MAX_GAP) {
                // fixOcrBMisreadings first so trailing-noise fixes apply before padding
                const fix = (l: string) =>
                    trimToLength(fixOcrBMisreadings(l), 44);
                return `${fix(a.line)}\n${fix(b.line)}`;
            }
        }
        return null;
    }

    // Try strict ranges first, then progressively looser
    return (
        searchTD1(26, 34) ??
        searchTD3(40, 48) ??
        searchTD1(22, 36) ??  // loose TD1 (distorted scans)
        searchTD3(36, 52) ??  // loose TD3
        rawText
    );
}

export async function recognizeMrzFromImage(
    img: HTMLImageElement,
    onProgress?: (progress: MrzOcrProgress) => void,
): Promise<MrzOcrResult> {
    const canvas = buildMrzCanvas(img);
    const worker = await getWorker(onProgress);

    const { PSM } = await import('tesseract.js');
    await worker.setParameters({
        tessedit_pageseg_mode: PSM.SPARSE_TEXT,
        // No char whitelist — whitelist corrupts OCR on full photos by forcing background/normal
        // text to be interpreted as MRZ chars. Filtering is done in extractMrzLines() instead.
        // preserve_interword_spaces omitted: can cause Tesseract to split MRZ lines at '<' runs
    });

    const {
        data: { text },
    } = await worker.recognize(canvas);

    let mrzText = extractMrzLines(text);

    // If first pass found nothing (fell back to raw text), try SINGLE_BLOCK mode
    // which sometimes picks up the MRZ zone more reliably
    if (mrzText === text) {
        await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK });
        const { data: { text: text2 } } = await worker.recognize(canvas);
        const mrzText2 = extractMrzLines(text2);
        if (mrzText2 !== text2) mrzText = mrzText2;
    }

    onProgress?.({ status: 'done', progress: 1 });
    return { rawText: mrzText, parsed: parseMrz(mrzText) };
}

/** Call this to release the cached worker (e.g. on app teardown) */
export async function terminateMrzWorker(): Promise<void> {
    if (cachedWorker) {
        await cachedWorker.terminate();
        cachedWorker = null;
        workerReady = null;
    }
}
