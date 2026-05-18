import type { GhostResult, ImageDataLike } from '../types.js';

const QUALITIES = [50, 65, 80, 95] as const;

// Exported for unit testing — pure function, no DOM
export function computeGhostScore(meanDiffs: readonly number[]): {
    score: number;
    suspectedOriginalQuality: number | null;
} {
    if (meanDiffs.length < 2) return { score: 0, suspectedOriginalQuality: null };

    const mean = meanDiffs.reduce((a, b) => a + b, 0) / meanDiffs.length;
    const stdDev = Math.sqrt(
        meanDiffs.reduce((acc, d) => acc + (d - mean) ** 2, 0) / meanDiffs.length,
    );

    // stdDev of 10 → score 100; empirically calibrated for 4 quality levels
    const score = Math.min(100, Math.round((stdDev / 10) * 100));

    const minIdx = meanDiffs.indexOf(Math.min(...meanDiffs));
    const suspectedOriginalQuality = score > 10 ? (QUALITIES[minIdx] ?? null) : null;

    return { score, suspectedOriginalQuality };
}

function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = (ev) =>
            reject(new Error(`loadImage: failed to load image (${(ev as Event).type ?? ev})`));
        image.src = src;
    });
}

export async function analyzeGhost(img: HTMLImageElement): Promise<GhostResult> {
    const { naturalWidth: w, naturalHeight: h } = img;

    if (w === 0 || h === 0) {
        return { score: 0, levels: [], suspectedOriginalQuality: null };
    }

    const tmp = document.createElement('canvas');
    tmp.width = w;
    tmp.height = h;
    const ctx = tmp.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    const origData = ctx.getImageData(0, 0, w, h);

    const levels = [];
    for (const quality of QUALITIES) {
        const jpegUrl = tmp.toDataURL('image/jpeg', quality / 100);
        const recomp = await loadImage(jpegUrl);

        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(recomp, 0, 0);
        const recompData = ctx.getImageData(0, 0, w, h);

        const outData = new Uint8ClampedArray(w * h * 4);
        let totalDiff = 0;

        for (let i = 0; i < w * h; i++) {
            const o = i * 4;
            const dr = Math.abs(origData.data[o] - recompData.data[o]);
            const dg = Math.abs(origData.data[o + 1] - recompData.data[o + 1]);
            const db = Math.abs(origData.data[o + 2] - recompData.data[o + 2]);
            const diff = Math.min(255, ((dr + dg + db) / 3) * 8); // amplify ×8
            totalDiff += diff;
            outData[o] = outData[o + 1] = outData[o + 2] = diff;
            outData[o + 3] = 255;
        }

        const imageData: ImageDataLike = { data: outData, width: w, height: h };
        levels.push({ quality, imageData, meanDiff: totalDiff / (w * h) });
    }

    const meanDiffs = levels.map((l) => l.meanDiff);
    const { score, suspectedOriginalQuality } = computeGhostScore(meanDiffs);

    return { score, levels, suspectedOriginalQuality };
}
