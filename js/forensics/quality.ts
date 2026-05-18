import type { ImageDataLike, QualityFlag, QualityResult } from '../types.js';

const LAPLACIAN = [0, 1, 0, 1, -4, 1, 0, 1, 0] as const;

// Laplacian variance of a greyscale image — the standard blur-detection metric.
// High variance = sharp edges present; low variance = blurry.
const SHARPNESS_SCALE = 50_000; // lapVar at which sharpness reaches 100

function laplacianVariance(grey: Float32Array, w: number, h: number): number {
    if (w < 3 || h < 3) return 0;
    let sum = 0;
    let sumSq = 0;
    let count = 0;
    for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
            let v = 0;
            let ki = 0;
            for (let ky = -1; ky <= 1; ky++) {
                for (let kx = -1; kx <= 1; kx++) {
                    v += grey[(y + ky) * w + (x + kx)] * LAPLACIAN[ki++];
                }
            }
            sum += v;
            sumSq += v * v;
            count++;
        }
    }
    if (count === 0) return 0;
    const mean = sum / count;
    return sumSq / count - mean * mean;
}

// Downsample to max 256×256 before computing Laplacian — fast enough for pipeline.
function sampleGrey(data: Uint8ClampedArray, w: number, h: number): [Float32Array, number, number] {
    const MAX = 256;
    if (w <= MAX && h <= MAX) {
        const grey = new Float32Array(w * h);
        for (let i = 0; i < w * h; i++) {
            const o = i * 4;
            grey[i] = 0.299 * data[o] + 0.587 * data[o + 1] + 0.114 * data[o + 2];
        }
        return [grey, w, h];
    }
    const scale = Math.min(MAX / w, MAX / h);
    const gw = Math.round(w * scale);
    const gh = Math.round(h * scale);
    const grey = new Float32Array(gw * gh);
    const stepX = w / gw;
    const stepY = h / gh;
    for (let sy = 0; sy < gh; sy++) {
        for (let sx = 0; sx < gw; sx++) {
            const px = Math.min(Math.round(sx * stepX), w - 1);
            const py = Math.min(Math.round(sy * stepY), h - 1);
            const o = (py * w + px) * 4;
            grey[sy * gw + sx] = 0.299 * data[o] + 0.587 * data[o + 1] + 0.114 * data[o + 2];
        }
    }
    return [grey, gw, gh];
}

export function analyzeQuality(imageData: ImageDataLike): QualityResult {
    const { data, width: w, height: h } = imageData;

    if (w === 0 || h === 0) {
        return { sharpness: 0, exposure: 0, flags: [], isAcceptable: false };
    }

    const [grey, gw, gh] = sampleGrey(data, w, h);
    const lapVar = laplacianVariance(grey, gw, gh);
    const sharpness = Math.min(100, Math.round((lapVar / SHARPNESS_SCALE) * 100));

    // Mean luminance over the full image
    let totalLum = 0;
    for (let i = 0; i < w * h; i++) {
        const o = i * 4;
        totalLum += 0.299 * data[o] + 0.587 * data[o + 1] + 0.114 * data[o + 2];
    }
    const meanLum = totalLum / (w * h);
    const exposure = Math.min(100, Math.round((meanLum / 255) * 100));

    const flags: QualityFlag[] = [];
    if (meanLum < 50)
        flags.push({ code: 'DARK', message: 'Imagem muito escura — melhore a iluminação' });
    if (meanLum > 210)
        flags.push({ code: 'OVEREXPOSED', message: 'Imagem superexposta — reduza a exposição' });
    if (sharpness < 30)
        flags.push({ code: 'BLUR', message: 'Imagem desfocada — use câmera estável e boa luz' });

    return { sharpness, exposure, flags, isAcceptable: flags.length === 0 };
}
