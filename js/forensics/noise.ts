import type { ImageDataLike, NoiseResult } from '../types.js';

const LAPLACIAN = [0, 1, 0, 1, -4, 1, 0, 1, 0] as const;

function toGreyscale(data: Uint8ClampedArray, w: number, h: number): Float32Array {
    const grey = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) {
        const o = i * 4;
        grey[i] = 0.299 * data[o] + 0.587 * data[o + 1] + 0.114 * data[o + 2];
    }
    return grey;
}

function applyLaplacian(grey: Float32Array, w: number, h: number): Float32Array {
    const out = new Float32Array(w * h);
    for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
            let sum = 0;
            let ki = 0;
            for (let ky = -1; ky <= 1; ky++) {
                for (let kx = -1; kx <= 1; kx++) {
                    sum += grey[(y + ky) * w + (x + kx)] * LAPLACIAN[ki++];
                }
            }
            out[y * w + x] = sum;
        }
    }
    return out;
}

function blockVariance(
    lap: Float32Array,
    w: number,
    x0: number,
    y0: number,
    x1: number,
    y1: number,
): number {
    const vals: number[] = [];
    for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
            vals.push(lap[y * w + x]);
        }
    }
    if (vals.length === 0) return 0;
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    return vals.reduce((acc, v) => acc + (v - mean) ** 2, 0) / vals.length;
}

export function analyzeNoise(imageData: ImageDataLike, blockSize = 32): NoiseResult {
    const { data, width: w, height: h } = imageData;

    if (w === 0 || h === 0) {
        return {
            score: 0,
            blockMap: new Float32Array(0),
            gridW: 0,
            gridH: 0,
            suspiciousBlockCount: 0,
            totalBlockCount: 0,
        };
    }

    const grey = toGreyscale(data, w, h);
    const lap = applyLaplacian(grey, w, h);

    const gridW = Math.ceil(w / blockSize);
    const gridH = Math.ceil(h / blockSize);
    const totalBlockCount = gridW * gridH;
    const variances = new Float32Array(totalBlockCount);

    for (let by = 0; by < gridH; by++) {
        for (let bx = 0; bx < gridW; bx++) {
            variances[by * gridW + bx] = blockVariance(
                lap,
                w,
                bx * blockSize,
                by * blockSize,
                Math.min((bx + 1) * blockSize, w),
                Math.min((by + 1) * blockSize, h),
            );
        }
    }

    const mean = Array.from(variances).reduce((a, b) => a + b, 0) / totalBlockCount;
    const stdDev = Math.sqrt(
        Array.from(variances).reduce((acc, v) => acc + (v - mean) ** 2, 0) / totalBlockCount,
    );
    const threshold = mean + 2 * stdDev;

    let suspiciousBlockCount = 0;
    const maxVariance = Math.max(...Array.from(variances), 1); // avoid /0
    const blockMap = new Float32Array(totalBlockCount);

    for (let i = 0; i < totalBlockCount; i++) {
        blockMap[i] = variances[i] / maxVariance;
        if (variances[i] > threshold) suspiciousBlockCount++;
    }

    // Scale: 25% suspicious blocks → score 100
    const score = Math.min(100, Math.round((suspiciousBlockCount / totalBlockCount) * 400));

    return { score, blockMap, gridW, gridH, suspiciousBlockCount, totalBlockCount };
}

export function renderNoiseMap(
    result: NoiseResult,
    canvas: HTMLCanvasElement,
    width: number,
    height: number,
): void {
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx || result.totalBlockCount === 0) return;

    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, width, height);

    const blockW = width / result.gridW;
    const blockH = height / result.gridH;

    for (let i = 0; i < result.totalBlockCount; i++) {
        const bx = i % result.gridW;
        const by = Math.floor(i / result.gridW);
        const t = result.blockMap[i]; // 0–1

        // Green (low) → Yellow (mid) → Red (high)
        const r = t < 0.5 ? Math.round(255 * t * 2) : 255;
        const g = t < 0.5 ? 255 : Math.round(255 * (1 - (t - 0.5) * 2));

        ctx.fillStyle = `rgba(${r},${g},0,0.7)`;
        ctx.fillRect(bx * blockW, by * blockH, blockW, blockH);
    }
}
