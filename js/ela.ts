import type { ImageDataLike } from './types.js';

export interface ELAResult {
    imageData: ImageDataLike;
    /** Suspicion score: 0 (no manipulation) to 100 (high manipulation). */
    score: number;
}

/**
 * Maps a magnitude (0–255) to an RGB thermal colour:
 *   0–63   → blue
 *   64–127 → blue → green (lerp)
 *   128–191 → green → red (lerp)
 *   192–255 → red → white (lerp)
 */
function thermalPalette(magnitude: number): [number, number, number] {
    const m = Math.max(0, Math.min(255, magnitude));
    if (m < 64) {
        return [0, 0, 255];
    } else if (m < 128) {
        const t = (m - 64) / 64;
        return [0, Math.round(255 * t), Math.round(255 * (1 - t))];
    } else if (m < 192) {
        const t = (m - 128) / 64;
        return [Math.round(255 * t), Math.round(255 * (1 - t)), 0];
    } else {
        const t = (m - 192) / 63; // intentional: ensures m=255 → t=1.0 → pure white [255,255,255]
        return [255, Math.round(255 * t), Math.round(255 * t)];
    }
}

/**
 * Pure ELA computation. No DOM access — safe to call from Vitest.
 *
 * Algorithm:
 *   For each pixel: diff = |origR−recompR| + |origG−recompG| + |origB−recompB|
 *                   magnitude = clamp(diff * amplification, 0, 255)
 *   Score = round(mean(magnitudes) / 255 * 100)
 *   Output = thermal palette applied to each magnitude
 */
export function computeELA(
    original: ImageDataLike,
    recompressed: ImageDataLike,
    amplification: number = 10,
): ELAResult {
    if (original.width !== recompressed.width || original.height !== recompressed.height) {
        throw new Error(
            `computeELA: dimension mismatch (${original.width}×${original.height} vs ${recompressed.width}×${recompressed.height})`,
        );
    }

    const numPixels = original.width * original.height;

    if (numPixels === 0) {
        return { imageData: { data: new Uint8ClampedArray(0), width: 0, height: 0 }, score: 0 };
    }

    const out = new Uint8ClampedArray(numPixels * 4);
    let totalMagnitude = 0;

    for (let i = 0; i < numPixels; i++) {
        const o = i * 4;
        const dr = Math.abs(original.data[o] - recompressed.data[o]);
        const dg = Math.abs(original.data[o + 1] - recompressed.data[o + 1]);
        const db = Math.abs(original.data[o + 2] - recompressed.data[o + 2]);
        const magnitude = Math.min(255, (dr + dg + db) * amplification);
        totalMagnitude += magnitude;
        const [r, g, b] = thermalPalette(magnitude);
        out[o] = r;
        out[o + 1] = g;
        out[o + 2] = b;
        out[o + 3] = 255;
    }

    const score = Math.round((totalMagnitude / numPixels / 255) * 100);
    return {
        imageData: { data: out, width: original.width, height: original.height },
        score,
    };
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

/**
 * Canvas-level orchestrator. Calls computeELA and renders the result.
 * @returns Suspicion score 0–100.
 * @throws SecurityError if the image is cross-origin.
 */
export async function renderELA(
    img: HTMLImageElement,
    outputCanvas: HTMLCanvasElement,
    amplification: number,
): Promise<number> {
    const { naturalWidth: w, naturalHeight: h } = img;
    if (w === 0 || h === 0) {
        throw new Error(
            'renderELA: image has zero dimensions – ensure img is fully loaded before calling',
        );
    }

    // Step 1: Capture original ImageData
    const tmp = document.createElement('canvas');
    tmp.width = w;
    tmp.height = h;
    const ctx = tmp.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    const originalData = ctx.getImageData(0, 0, w, h);

    // Step 2: Recompress at JPEG q=95
    const jpegUrl = tmp.toDataURL('image/jpeg', 0.95);
    const recompImg = await loadImage(jpegUrl);

    // Step 3: Capture recompressed ImageData (reuse same temp canvas)
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(recompImg, 0, 0);
    const recompData = ctx.getImageData(0, 0, w, h);

    // Step 4: Compute ELA
    const { imageData, score } = computeELA(originalData, recompData, amplification);

    // Step 5: Paint heatmap to output canvas
    outputCanvas.width = w;
    outputCanvas.height = h;
    const outCtx = outputCanvas.getContext('2d')!;
    const outImageData = outCtx.createImageData(w, h);
    outImageData.data.set(imageData.data);
    outCtx.putImageData(outImageData, 0, 0);

    return score;
}
