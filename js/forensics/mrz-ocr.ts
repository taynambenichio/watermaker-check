import { type MrzResult, parseMrz } from './mrz.js';

export interface MrzOcrResult {
    rawText: string;
    parsed: MrzResult;
    preprocess: 'normal' | 'negative';
    region: 'full' | 'bottom';
    confidence: number;
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
                    currentProgressCallback?.({
                        status: message.status,
                        progress: message.progress,
                    });
                },
            });
        })();
    }

    await workerReady;
    return cachedWorker!;
}

type MrzRegion = 'full' | 'bottom';

type MrzCanvasOptions = {
    invert: boolean;
    region: MrzRegion;
    threshold: boolean;
};

function buildMrzCanvas(img: HTMLImageElement, options: MrzCanvasOptions): HTMLCanvasElement {
    const sourceW = img.naturalWidth;
    const sourceH = img.naturalHeight;
    const targetW = Math.min(2400, Math.max(sourceW, 1600));
    const scale = targetW / sourceW;
    const cropY = options.region === 'bottom' ? Math.floor(sourceH * 0.72) : 0;
    const cropH = options.region === 'bottom' ? Math.max(1, sourceH - cropY) : sourceH;

    const canvas = document.createElement('canvas');
    canvas.dataset.mrzPreprocess = options.invert ? 'negative' : 'normal';
    canvas.dataset.mrzRegion = options.region;
    canvas.dataset.mrzThreshold = options.threshold ? 'adaptive' : 'contrast';
    canvas.width = Math.round(sourceW * scale);
    canvas.height = Math.round(cropH * scale);

    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('MRZ OCR: canvas context unavailable');

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, cropY, sourceW, cropH, 0, 0, canvas.width, canvas.height);

    // Grayscale + contrast for OCR-B font legibility.
    // When `invert` is enabled, we invert the luminance after boosting contrast.
    // Bottom-crop and threshold passes help when the MRZ sits in shadow or the
    // OCR is distracted by the rest of the document.
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const { data } = imageData;
    const tones = options.threshold ? new Uint8ClampedArray(data.length / 4) : null;
    let toneSum = 0;
    for (let i = 0; i < data.length; i += 4) {
        const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        const contrasted = Math.max(0, Math.min(255, (lum - 128) * 1.8 + 128));
        const tone = options.invert ? 255 - contrasted : contrasted;
        if (tones) {
            tones[i / 4] = tone;
            toneSum += tone;
        }
        data[i] = tone;
        data[i + 1] = tone;
        data[i + 2] = tone;
    }
    if (tones) {
        const threshold = Math.max(
            92,
            Math.min(182, toneSum / tones.length + (options.invert ? -4 : 4)),
        );
        for (let i = 0; i < tones.length; i++) {
            const tone = tones[i] >= threshold ? 255 : 0;
            const base = i * 4;
            data[base] = tone;
            data[base + 1] = tone;
            data[base + 2] = tone;
        }
    }
    ctx.putImageData(imageData, 0, 0);

    return canvas;
}

function scoreRecognizedMrz(rawText: string, parsed: MrzResult, confidence: number): number {
    let score = Math.round(confidence);

    if (parsed.valid) {
        score += 100;
    } else {
        score -= parsed.errors.length * 20;
    }

    if (
        parsed.documentType === 'TD1' ||
        parsed.documentType === 'TD2' ||
        parsed.documentType === 'TD3'
    ) {
        score += 20;
    }

    score += parsed.checks.filter((check) => check.valid).length * 8;
    score += rawText.includes('<<') ? 5 : 0;
    score += parsed.normalizedLines.some((line) => /[0-9]/.test(line)) ? 5 : 0;

    return Math.max(0, score);
}

async function runOcrPass(
    worker: Awaited<ReturnType<typeof import('tesseract.js').createWorker>>,
    canvas: HTMLCanvasElement,
    sparseText = true,
): Promise<{ rawText: string; parsed: MrzResult; score: number; confidence: number }> {
    const { PSM } = await import('tesseract.js');
    await worker.setParameters({
        tessedit_pageseg_mode: sparseText ? PSM.SPARSE_TEXT : PSM.SINGLE_BLOCK,
        tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<',
        preserve_interword_spaces: '0',
        user_defined_dpi: '300',
    });

    const {
        data: { text, confidence = 0 },
    } = await worker.recognize(canvas);
    const mrzText = sparseText ? extractMrzLines(text) : extractMrzLines(text);
    const normalized = normalizeMrzDigitPositions(mrzText);
    const parsed = parseMrz(normalized);
    return {
        rawText: normalized,
        parsed,
        score: scoreRecognizedMrz(normalized, parsed, confidence),
        confidence,
    };
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
            .replace(/<[KC]/g, '<<') // <K or <C → <<
            .replace(/[KC]</g, '<<'); // K< or C< → <<
    }
    // Trailing K/C chars (end padding zone)
    result = result.replace(/[KC]+$/, (m) => '<'.repeat(m.length));
    // Without inversion, '<' in the trailing fill zone is sometimes read as 'S'.
    // Only fix runs of 3+ to avoid corrupting real name characters.
    result = result.replace(/S{3,}$/, (m) => '<'.repeat(m.length));
    // In the trailing fill zone, L is also a frequent misread of '<' (the vertical
    // stroke of '<' is read as L). Only trigger when we have a strong '<<' anchor
    // followed exclusively by K/C/L/< up to end of line — this guarantees we're
    // in the padding region and not corrupting a real name suffix.
    result = result.replace(/<<[KCL<]+$/, (m) => '<'.repeat(m.length));
    return result;
}

/**
 * Trim a candidate line to target length, handling three OCR distortion patterns:
 *
 *  1. Excess at start: '1I<LVAPA...<<<<<' (31 chars) — sliding window picks best
 *  2. Excess in middle: 'RAMON<<<<STALMANS<<<' — internal '<{3,}' followed by a
 *     letter/digit indicates OCR inserted extra '<'; collapse to the standard
 *     '<<' separator.
 *  3. Excess at end (name line only): trailing '<' filler — truncate.
 *
 * Name lines (no digits) are anchored at start to preserve the primary
 * identifier. Data lines (with digits) use sliding-window selection.
 */
function trimToLength(line: string, target: number): string {
    if (line.length === target) return line;
    if (line.length < target) return line.padEnd(target, '<');

    let l = line;
    // Step 1: collapse internal '<{3,}' (excess separator) followed by [A-Z0-9]
    while (l.length > target) {
        const m = l.match(/<{3,}(?=[A-Z0-9])/);
        if (!m || m.index === undefined) break;
        l = `${l.slice(0, m.index)}<<${l.slice(m.index + m[0].length)}`;
    }
    if (l.length <= target) return l.padEnd(target, '<');

    // Step 2: name line (no digits) — anchor at start, truncate trailing '<'
    if (!/[0-9]/.test(l)) {
        while (l.length > target && l.endsWith('<')) l = l.slice(0, -1);
        return l.slice(0, target).padEnd(target, '<');
    }

    // Step 3: data line — sliding window by candidate-window score
    let best = l.slice(0, target);
    let bestScore = scoreCandidateWindow(best);
    for (let start = 1; start <= l.length - target; start++) {
        const win = l.slice(start, start + target);
        const s = scoreCandidateWindow(win);
        if (s > bestScore) {
            bestScore = s;
            best = win;
        }
    }
    return best;
}

/**
 * Window scoring for sliding-window trim. Prefers windows that:
 *  - Have high MRZ-char density (digits + '<')
 *  - Contain at least some letters (real MRZ has names/codes, not pure filler)
 *  - End with a long '<' filler run (canonical MRZ trailing pattern)
 * Pure-filler windows (all '<') are explicitly rejected.
 */
function scoreCandidateWindow(line: string): number {
    if (/^<+$/.test(line)) return 0;
    let digits = 0,
        lt = 0,
        letters = 0;
    for (let i = 0; i < line.length; i++) {
        const c = line.charCodeAt(i);
        if (c >= 48 && c <= 57) digits++;
        else if (c === 60) lt++;
        else if (c >= 65 && c <= 90) letters++;
    }
    const base = (digits + lt) / line.length;
    const fillerBonus = /<<+/.test(line) ? 0.1 : 0;
    const letterBonus = letters > 0 ? 0.1 : 0;
    const trailMatch = line.match(/<+$/);
    const trailingBonus = (trailMatch ? trailMatch[0].length : 0) * 0.002;
    return base + fillerBonus + letterBonus + trailingBonus;
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
        if (c >= 48 && c <= 57)
            digits++; // 0-9
        else if (c === 60) lt++; // '<'
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
        const stripped = raw.replace(/[^A-Z0-9<]/g, '');
        // Apply OCR fixes BEFORE scoring/filtering so heavily garbled lines
        // (like name-line with K/L/C misreads of '<') enter the candidate pool
        // with correct length and score.
        const line = fixOcrBMisreadings(stripped);
        return { line, idx, score: scoreMrzLikeness(line) };
    });

    // PSM SPARSE_TEXT may insert HUNDREDS of garbage lines between real MRZ
    // lines. Score+length filter does the heavy lifting; gap is just a sanity
    // check that we're not joining lines from completely separate documents.
    const MAX_GAP = 2000;
    const MIN_SCORE = 0.25;

    function searchTD1(minLen: number, maxLen: number, minScore: number): string | null {
        const cands = indexed.filter(
            ({ line, score }) =>
                line.length >= minLen && line.length <= maxLen && score >= minScore,
        );
        let best: {
            a: (typeof cands)[0];
            b: (typeof cands)[0];
            c: (typeof cands)[0];
            total: number;
        } | null = null;
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
        const fix = (l: string) => trimToLength(l, 30);
        return `${fix(best.a.line)}\n${fix(best.b.line)}\n${fix(best.c.line)}`;
    }

    function searchTD3(minLen: number, maxLen: number, minScore: number): string | null {
        const cands = indexed.filter(
            ({ line, score }) =>
                line.length >= minLen && line.length <= maxLen && score >= minScore,
        );
        let best: { a: (typeof cands)[0]; b: (typeof cands)[0]; total: number } | null = null;
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
        const fix = (l: string) => trimToLength(l, 44);
        return `${fix(best.a.line)}\n${fix(best.b.line)}`;
    }

    function searchTD2(minLen: number, maxLen: number, minScore: number): string | null {
        const cands = indexed.filter(
            ({ line, score }) =>
                line.length >= minLen && line.length <= maxLen && score >= minScore,
        );
        let best: { a: (typeof cands)[0]; b: (typeof cands)[0]; total: number } | null = null;
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
        const fix = (l: string) => trimToLength(l, 36);
        return `${fix(best.a.line)}\n${fix(best.b.line)}`;
    }

    // Strict ranges & high score first; loosen progressively.
    // Upper bound generous on TD1 to admit lines like 'RAMON<<<<STALMANS<<...'
    // (41 chars) where OCR inserted extra '<' between name parts — trimToLength
    // collapses these to canonical 30.
    return (
        searchTD1(26, 34, MIN_SCORE) ??
        searchTD2(34, 38, MIN_SCORE) ??
        searchTD3(40, 48, MIN_SCORE) ??
        searchTD1(22, 45, MIN_SCORE) ?? // loose TD1 (distorted/expanded scans)
        searchTD2(32, 42, MIN_SCORE) ?? // loose TD2
        searchTD3(36, 55, MIN_SCORE) ?? // loose TD3
        ''
    );
}

export async function recognizeMrzFromImage(
    img: HTMLImageElement,
    onProgress?: (progress: MrzOcrProgress) => void,
): Promise<MrzOcrResult> {
    const worker = await getWorker(onProgress);
    const passes = [
        {
            canvas: buildMrzCanvas(img, { invert: false, region: 'bottom', threshold: false }),
            preprocess: 'normal' as const,
            region: 'bottom' as const,
        },
        {
            canvas: buildMrzCanvas(img, { invert: true, region: 'bottom', threshold: false }),
            preprocess: 'negative' as const,
            region: 'bottom' as const,
        },
        {
            canvas: buildMrzCanvas(img, { invert: false, region: 'full', threshold: false }),
            preprocess: 'normal' as const,
            region: 'full' as const,
        },
        {
            canvas: buildMrzCanvas(img, { invert: true, region: 'full', threshold: false }),
            preprocess: 'negative' as const,
            region: 'full' as const,
        },
    ];

    let best: (MrzOcrResult & { score: number }) | null = null;

    for (const { canvas, preprocess, region } of passes) {
        const block = await runOcrPass(worker, canvas, false);
        let candidate = { ...block, preprocess, region };

        if (!candidate.parsed.valid) {
            const sparse = await runOcrPass(worker, canvas, true);
            if (sparse.score > candidate.score) {
                candidate = { ...sparse, preprocess, region };
            }
        }

        if (!best || candidate.score > best.score) {
            best = candidate;
        }

        if (candidate.parsed.valid && candidate.confidence >= 85) {
            best = candidate;
            break;
        }

        if (candidate.parsed.valid && candidate.score >= 180) {
            best = candidate;
            break;
        }
    }

    if (!best) {
        throw new Error('MRZ OCR: unable to process image');
    }

    const parsed = best.parsed.valid || best.confidence >= 85 ? best.parsed : parseMrz('');

    onProgress?.({ status: 'done', progress: 1 });
    return {
        rawText: best.rawText,
        parsed,
        preprocess: best.preprocess,
        region: best.region,
        confidence: best.confidence,
    };
}

/**
 * Map common OCR letter-as-digit confusions in MRZ positions that ICAO defines
 * as numeric. In the green CRT-style display font, characters like 'O', 'D',
 * 'I', 'S' visually resemble digits, so an OCR slip is invisible to the user
 * but causes checksum failures (e.g. expected="0", actual="O" both render
 * identically yet compare unequal).
 *
 * Conservative: only touches positions where ICAO format guarantees a digit
 * (check digits, birth date, expiry date). Document number / optional zone
 * are alphanumeric and left untouched. Names are letters-only and untouched.
 */
const LETTER_TO_DIGIT: Record<string, string> = {
    O: '0',
    D: '0',
    Q: '0',
    I: '1',
    L: '1',
    Z: '2',
    A: '4',
    S: '5',
    G: '6',
    T: '7',
    B: '8',
};

const NUMERIC_OCR_CANDIDATES: Record<string, string[]> = {
    O: ['0'],
    D: ['0'],
    Q: ['0'],
    I: ['1', '9'],
    L: ['1', '9'],
    Z: ['2'],
    A: ['4'],
    S: ['5', '9'],
    G: ['6'],
    T: ['7'],
    B: ['8'],
    '1': ['1', '9'],
    '7': ['7', '9'],
};

function fixDigitsIn(line: string, ranges: ReadonlyArray<readonly [number, number]>): string {
    const chars = line.split('');
    for (const [start, end] of ranges) {
        for (let i = start; i < end && i < chars.length; i++) {
            const mapped = LETTER_TO_DIGIT[chars[i]];
            if (mapped) chars[i] = mapped;
        }
    }
    return chars.join('');
}

function repairCheckDigitField(
    chars: string[],
    dataStart: number,
    dataEnd: number,
    checkPos: number,
) {
    if (checkPos >= chars.length) return;
    const current = chars.slice(dataStart, dataEnd).join('');
    const actual = LETTER_TO_DIGIT[chars[checkPos]] ?? chars[checkPos];
    if (/^\d+$/.test(current) && actual === parseMrzCheckDigit(current)) {
        chars[checkPos] = actual;
        return;
    }

    const candidateSets = chars.slice(dataStart, dataEnd).map((char) => {
        const mapped = LETTER_TO_DIGIT[char];
        const base = mapped ?? char;
        const candidates = NUMERIC_OCR_CANDIDATES[char] ?? [base];
        return [...new Set(candidates.filter((candidate) => /^\d$/.test(candidate)))];
    });

    const tryRepair = (index: number, built: string[]): boolean => {
        if (index === candidateSets.length) {
            const candidate = built.join('');
            if (parseMrzCheckDigit(candidate) !== actual) return false;
            for (let i = dataStart; i < dataEnd; i++) {
                chars[i] = built[i - dataStart];
            }
            chars[checkPos] = actual;
            return true;
        }

        for (const candidate of candidateSets[index]) {
            if (tryRepair(index + 1, [...built, candidate])) return true;
        }
        return false;
    };

    tryRepair(0, []);
}

function parseMrzCheckDigit(input: string): string {
    const weights = [7, 3, 1] as const;
    let sum = 0;
    for (let i = 0; i < input.length; i++) {
        const char = input[i];
        const value =
            char === '<'
                ? 0
                : char >= '0' && char <= '9'
                  ? char.charCodeAt(0) - 48
                  : char.charCodeAt(0) - 55;
        sum += value * weights[i % weights.length];
    }
    return String(sum % 10);
}

function normalizeMrzDigitPositions(mrzText: string): string {
    const lines = mrzText.split('\n');

    // TD1: 3 lines × 30 chars
    if (lines.length === 3 && lines.every((l) => l.length === 30)) {
        // Line 1: doc-number check digit at pos 14
        const l1 = fixDigitsIn(lines[0], [[14, 15]]);
        // Line 2: birth (0-5) + check (6), expiry (8-13) + check (14), composite check (29)
        const l2Chars = fixDigitsIn(lines[1], [
            [0, 7],
            [8, 15],
            [29, 30],
        ]).split('');
        repairCheckDigitField(l2Chars, 0, 6, 6);
        repairCheckDigitField(l2Chars, 8, 14, 14);
        const l2 = l2Chars.join('');
        return `${l1}\n${l2}\n${lines[2]}`;
    }

    // TD3: 2 lines × 44 chars
    if (lines.length === 2 && lines.every((l) => l.length === 44)) {
        // Line 2: doc# check (9), birth (13-18) + check (19), expiry (21-26) + check (27),
        // optional check (42), composite check (43)
        const l2Chars = fixDigitsIn(lines[1], [
            [9, 10],
            [13, 20],
            [21, 28],
            [42, 44],
        ]).split('');
        repairCheckDigitField(l2Chars, 13, 19, 19);
        repairCheckDigitField(l2Chars, 21, 27, 27);
        const l2 = l2Chars.join('');
        return `${lines[0]}\n${l2}`;
    }

    // TD2: 2 lines × 36 chars
    if (lines.length === 2 && lines.every((l) => l.length === 36)) {
        const l2Chars = fixDigitsIn(lines[1], [
            [9, 10],
            [13, 20],
            [21, 28],
            [35, 36],
        ]).split('');
        repairCheckDigitField(l2Chars, 13, 19, 19);
        repairCheckDigitField(l2Chars, 21, 27, 27);
        const l2 = l2Chars.join('');
        return `${lines[0]}\n${l2}`;
    }

    return mrzText;
}

/** Call this to release the cached worker (e.g. on app teardown) */
export async function terminateMrzWorker(): Promise<void> {
    if (cachedWorker) {
        const terminator = (cachedWorker as { terminate?: () => Promise<void> }).terminate;
        if (terminator) {
            await terminator.call(cachedWorker);
        }
        cachedWorker = null;
        workerReady = null;
    }
}
