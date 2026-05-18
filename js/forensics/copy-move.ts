import type { CopyMoveResult, ImageDataLike } from '../types.js';

const BLOCK = 16;
const MATCH_THRESHOLD = 8.0;

function clamp(v: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, v));
}

function getLuma(data: Uint8ClampedArray, x: number, y: number, w: number, h: number): number {
    if (x < 0 || x >= w || y < 0 || y >= h) return 0;
    const i = (y * w + x) * 4;
    return 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
}

/**
 * Extract 16-element feature vector from a 16×16 block.
 * Divides the block into 4×4 sub-blocks and computes mean luma per sub-block.
 */
function blockFeature(data: Uint8ClampedArray, w: number, h: number, bx: number, by: number): Float32Array {
    const feat = new Float32Array(16);
    for (let sy = 0; sy < 4; sy++) {
        for (let sx = 0; sx < 4; sx++) {
            let sum = 0;
            for (let py = 0; py < 4; py++) {
                for (let px = 0; px < 4; px++) {
                    sum += getLuma(data, bx * BLOCK + sx * 4 + px, by * BLOCK + sy * 4 + py, w, h);
                }
            }
            feat[sy * 4 + sx] = sum / 16;
        }
    }
    return feat;
}

function euclidean(a: Float32Array, b: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < a.length; i++) sum += (a[i] - b[i]) ** 2;
    return Math.sqrt(sum);
}

export function analyzeCopyMove(imageData: ImageDataLike): CopyMoveResult {
    const { data, width: w, height: h } = imageData;
    const gbw = Math.floor(w / BLOCK);
    const gbh = Math.floor(h / BLOCK);
    const totalBlocks = gbw * gbh;

    if (totalBlocks < 4) {
        return { score: 0, matchCount: 0, heatmapData: null };
    }

    // Build feature vectors for all blocks
    const features: { feat: Float32Array; bx: number; by: number }[] = [];
    for (let by = 0; by < gbh; by++) {
        for (let bx = 0; bx < gbw; bx++) {
            features.push({ feat: blockFeature(data, w, h, bx, by), bx, by });
        }
    }

    // Sort by first component (lexicographic approximation) — O(n log n)
    features.sort((a, b) => a.feat[0] - b.feat[0]);

    // Compare adjacent sorted pairs — nearby vectors may be clone candidates
    const matchedBlocks = new Set<number>();
    let matchCount = 0;
    for (let i = 0; i < features.length - 1; i++) {
        if (euclidean(features[i].feat, features[i + 1].feat) < MATCH_THRESHOLD) {
            matchCount++;
            matchedBlocks.add(features[i].by * gbw + features[i].bx);
            matchedBlocks.add(features[i + 1].by * gbw + features[i + 1].bx);
        }
    }

    const score = clamp(Math.round((matchCount / totalBlocks) * 100), 0, 100);

    // Build red heatmap overlay on matched block regions
    const hmData = new Uint8ClampedArray(w * h * 4);
    for (const blockIdx of matchedBlocks) {
        const bx = blockIdx % gbw;
        const by = Math.floor(blockIdx / gbw);
        for (let py = 0; py < BLOCK; py++) {
            for (let px = 0; px < BLOCK; px++) {
                const idx = ((by * BLOCK + py) * w + bx * BLOCK + px) * 4;
                hmData[idx] = 220;
                hmData[idx + 1] = 50;
                hmData[idx + 2] = 50;
                hmData[idx + 3] = 180;
            }
        }
    }

    return {
        score,
        matchCount,
        heatmapData: { data: hmData, width: w, height: h },
    };
}
