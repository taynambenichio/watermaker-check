import type { ImageDataLike, HistogramResult } from './types.js';

// ── Pure functions — testable in Node/Vitest ──────────────────

export function computeHistogram({ data }: ImageDataLike): HistogramResult {
    const r = new Uint32Array(256);
    const g = new Uint32Array(256);
    const b = new Uint32Array(256);
    for (let i = 0; i < data.length; i += 4) {
        r[data[i]!]++;
        g[data[i + 1]!]++;
        b[data[i + 2]!]++;
    }
    return { r, g, b };
}

export function sobelEdges({ data, width, height }: ImageDataLike): ImageDataLike {
    const gray = new Uint8Array(width * height);
    for (let i = 0; i < width * height; i++) {
        gray[i] = Math.round(
            0.299 * data[i * 4]! + 0.587 * data[i * 4 + 1]! + 0.114 * data[i * 4 + 2]!
        );
    }

    const out = new Uint8ClampedArray(width * height * 4);
    const px = (row: number, col: number): number => gray[row * width + col] ?? 0;

    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            const gx = -px(y-1,x-1) + px(y-1,x+1)
                       -2*px(y,x-1) + 2*px(y,x+1)
                       -px(y+1,x-1) + px(y+1,x+1);
            const gy = -px(y-1,x-1) - 2*px(y-1,x) - px(y-1,x+1)
                       +px(y+1,x-1) + 2*px(y+1,x) + px(y+1,x+1);
            const mag = Math.min(255, Math.round(Math.sqrt(gx * gx + gy * gy)));
            const idx = (y * width + x) * 4;
            out[idx] = out[idx + 1] = out[idx + 2] = mag;
            out[idx + 3] = 255;
        }
    }
    return { data: out, width, height };
}

export function amplifyDifferences({ data, width, height }: ImageDataLike): ImageDataLike {
    const out = new Uint8ClampedArray(data.length);
    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            const idx = (y * width + x) * 4;
            for (let c = 0; c < 3; c++) {
                let sum = 0, count = 0;
                for (let dy = -1; dy <= 1; dy++) {
                    for (let dx = -1; dx <= 1; dx++) {
                        if (dy === 0 && dx === 0) continue;
                        sum += data[((y + dy) * width + (x + dx)) * 4 + c]!;
                        count++;
                    }
                }
                const diff = Math.abs(data[idx + c]! - sum / count);
                out[idx + c] = Math.min(255, Math.round(diff * 5));
            }
            out[idx + 3] = 255;
        }
    }
    return { data: out, width, height };
}

// ── DOM rendering functions (browser only) ────────────────────

export function renderHistogram(imageData: ImageDataLike, histCanvas: HTMLCanvasElement): void {
    const { r, g, b } = computeHistogram(imageData);
    const ctx = histCanvas.getContext('2d')!;
    const W = histCanvas.width, H = histCanvas.height;
    ctx.clearRect(0, 0, W, H);
    const maxVal = Math.max(...Array.from(r), ...Array.from(g), ...Array.from(b)) || 1;
    const barW = W / 256;
    ctx.globalAlpha = 0.7;
    for (let i = 0; i < 256; i++) {
        const x = i * barW;
        ctx.fillStyle = '#e57373';
        ctx.fillRect(x, H - (r[i]! / maxVal) * H, barW, (r[i]! / maxVal) * H);
        ctx.fillStyle = '#81c784';
        ctx.fillRect(x, H - (g[i]! / maxVal) * H, barW, (g[i]! / maxVal) * H);
        ctx.fillStyle = '#64b5f6';
        ctx.fillRect(x, H - (b[i]! / maxVal) * H, barW, (b[i]! / maxVal) * H);
    }
    ctx.globalAlpha = 1;
}

function captureImage(img: HTMLImageElement): ImageDataLike {
    const tmp = document.createElement('canvas');
    tmp.width  = img.naturalWidth;
    tmp.height = img.naturalHeight;
    tmp.getContext('2d')!.drawImage(img, 0, 0);
    return tmp.getContext('2d')!.getImageData(0, 0, tmp.width, tmp.height);
}

function putResultOnCanvas(result: ImageDataLike, overlayCanvas: HTMLCanvasElement): void {
    overlayCanvas.width  = result.width;
    overlayCanvas.height = result.height;
    const ctx = overlayCanvas.getContext('2d')!;
    const out = ctx.createImageData(result.width, result.height);
    out.data.set(result.data);
    ctx.putImageData(out, 0, 0);
    overlayCanvas.style.display = '';
}

export function renderSobel(img: HTMLImageElement, overlayCanvas: HTMLCanvasElement): void {
    try {
        putResultOnCanvas(sobelEdges(captureImage(img)), overlayCanvas);
    } catch (e: unknown) {
        if (e instanceof Error && e.name === 'SecurityError')
            alert('Análise Canvas não disponível para imagens externas');
        else
            alert('Erro ao processar imagem: ' + (e instanceof Error ? e.message : String(e)));
    }
}

export function renderAmplify(img: HTMLImageElement, overlayCanvas: HTMLCanvasElement): void {
    try {
        putResultOnCanvas(amplifyDifferences(captureImage(img)), overlayCanvas);
    } catch (e: unknown) {
        if (e instanceof Error && e.name === 'SecurityError')
            alert('Análise Canvas não disponível para imagens externas');
        else
            alert('Erro ao processar imagem: ' + (e instanceof Error ? e.message : String(e)));
    }
}

export function clearOverlay(overlayCanvas: HTMLCanvasElement): void {
    overlayCanvas.style.display = 'none';
    overlayCanvas.getContext('2d')!.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
}
