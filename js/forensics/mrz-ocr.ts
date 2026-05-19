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
 * Trim a candidate line to target length using sliding-window selection.
 * OCR may add garbage chars at EITHER start or end of an MRZ line (leading
 * stray digit, trailing 'SSSS' noise). For slightly-too-long lines, try
 * every possible window of `target` chars and pick the one with the best
 * MRZ-likeness score.
 */
function trimToLength(line: string, target: number): string {
    if (line.length <= target) return line.padEnd(target, '<');
    if (line.length === target) return line;
    // Try all sliding windows and pick highest-scoring one
    let bestWindow = line.slice(0, target);
    let bestScore = scoreMrzLikeness(bestWindow);
    for (let start = 1; start <= line.length - target; start++) {
        const win = line.slice(start, start + target);
        const s = scoreMrzLikeness(win);
        if (s > bestScore) {
            bestScore = s;
            bestWindow = win;
        }
    }
    return bestWindow;
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
/**
 * Score how likely a line is to be a real MRZ line.
 * Real MRZ lines consist entirely of [A-Z0-9<]; they have many digits and/or
 * many '<' fillers. Card body text (names, dates printed normally, descriptive
 * labels) has almost no '<' and few digits.
 *
 * Returns 0..1 where:
 *   - 0.00–0.10 = pure letters (card body text)
 *   - 0.30+     = looks like an MRZ line
 *   - 0.50+     = strong MRZ signal
 */
function scoreMrzLikeness(line: string): number {
    if (!line.length) return 0;
    let digits = 0;
    let lt = 0;
    for (let i = 0; i < line.length; i++) {
        const c = line.charCodeAt(i);
        if (c >= 48 && c <= 57) digits++;        // 0-9
        else if (c === 60) lt++;                  // '<'
    }
    // Bonus for runs of '<<' which are a strong MRZ filler signal
    const fillerBonus = /<<+/.test(line) ? 0.1 : 0;
    return Math.min(1, (digits + lt) / line.length + fillerBonus);
}

/**
 * Extract MRZ lines from raw OCR output using gap-tolerant scored search.
 *
 * Two-criteria selection:
 *  1. Length range (e.g. 26-34 chars for TD1)
 *  2. MRZ-likeness score above threshold (digit + '<' content)
 *
 * Without scoring, the algorithm may pick up card body text that happens to
 * fall within the length range (e.g. printed names + dates). Scoring rejects
 * letter-only lines from card body.
 *
 * Among valid candidates, picks the triplet/pair with the HIGHEST combined
 * score whose raw-line indices span ≤ MAX_GAP — not the first by position.
 */
function extractMrzLines(rawText: string): string {
    const allLines = rawText.toUpperCase().split(/\r?\n/);
    const indexed = allLines.map((raw, idx) => {
        const line = raw.replace(/[^A-Z0-9<]/g, '');
        return { line, idx, score: scoreMrzLikeness(line) };
    });

    const MAX_GAP = 10;
    // Minimum MRZ-likeness score. Card body text scores < 0.10; the lowest
    // real MRZ line (names line) typically scores 0.35-0.50 due to '<' filler.
    const MIN_SCORE = 0.25;

    function searchTD1(minLen: number, maxLen: number, minScore: number): string | null {
        const cands = indexed.filter(
            ({ line, score }) =>
                line.length >= minLen && line.length <= maxLen && score >= minScore,
        );
        let best: { a: typeof cands[0]; b: typeof cands[0]; c: typeof cands[0]; total: number } | null = null;
        for (let i = 0; i < cands.length - 2; i++) {
            for (let j = i + 1; j < cands.length - 1; j++) {
                if (cands[j].idx - cands[i].idx > MAX_GAP) break;
                for (let k = j + 1; k < cands.length; k++) {
                    if (cands[k].idx - cands[j].idx > MAX_GAP) break;
                    const total = cands[i].score + cands[j].score + cands[k].score;
                    if (!best || total > best.total) {
                        best = { a: cands[i], b: cands[j], c: cands[k], total };
                    }
                }
            }
        }
        if (!best) return null;
        const fix = (l: string) => trimToLength(fixOcrBMisreadings(l), 30);
        return `${fix(best.a.line)}\n${fix(best.b.line)}\n${fix(best.c.line)}`;
    }

    function searchTD3(minLen: number, maxLen: number, minScore: number): string | null {
        const cands = indexed.filter(
            ({ line, score }) =>
                line.length >= minLen && line.length <= maxLen && score >= minScore,
        );
        let best: { a: typeof cands[0]; b: typeof cands[0]; total: number } | null = null;
        for (let i = 0; i < cands.length - 1; i++) {
            for (let j = i + 1; j < cands.length; j++) {
                if (cands[j].idx - cands[i].idx > MAX_GAP) break;
                const total = cands[i].score + cands[j].score;
                if (!best || total > best.total) {
                    best = { a: cands[i], b: cands[j], total };
                }
            }
        }
        if (!best) return null;
        const fix = (l: string) => trimToLength(fixOcrBMisreadings(l), 44);
        return `${fix(best.a.line)}\n${fix(best.b.line)}`;
    }

    // Strict ranges & high score first; loosen progressively
    return (
        searchTD1(26, 34, MIN_SCORE) ??
        searchTD3(40, 48, MIN_SCORE) ??
        searchTD1(22, 36, MIN_SCORE) ??   // loose TD1 (distorted scans)
        searchTD3(36, 52, MIN_SCORE) ??   // loose TD3
        searchTD1(22, 36, 0.15) ??         // last-resort low score (mostly-garbled OCR)
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
        data: { text: textSparse },
    } = await worker.recognize(canvas);

    let mrzText = extractMrzLines(textSparse);
    let extracted = mrzText !== textSparse;
    let textBlock = '';

    // If first pass found nothing, try SINGLE_BLOCK mode and combine outputs
    if (!extracted) {
        await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK });
        const { data: { text: t2 } } = await worker.recognize(canvas);
        textBlock = t2;
        const mrzText2 = extractMrzLines(t2);
        if (mrzText2 !== t2) {
            mrzText = mrzText2;
            extracted = true;
        }
    }

    // When extraction fails, expose BOTH raw OCR outputs so the user can
    // diagnose what Tesseract.js actually produced (visible in "Texto Bruto OCR")
    if (!extracted) {
        mrzText = `--- PSM SPARSE_TEXT ---\n${textSparse}\n--- PSM SINGLE_BLOCK ---\n${textBlock}`;
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
