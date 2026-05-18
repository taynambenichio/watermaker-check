// ── Pure functions — testable in Node.js ──────────────────────
// Aceitam { data: Uint8ClampedArray, width: number, height: number }

export function computeHistogram({ data }) {
    const r = new Uint32Array(256);
    const g = new Uint32Array(256);
    const b = new Uint32Array(256);
    for (let i = 0; i < data.length; i += 4) {
        r[data[i]]++;
        g[data[i + 1]]++;
        b[data[i + 2]]++;
    }
    return { r, g, b };
}

export function sobelEdges({ data, width, height }) {
    // Converter para escala de cinza
    const gray = new Uint8Array(width * height);
    for (let i = 0; i < width * height; i++) {
        gray[i] = Math.round(0.299 * data[i*4] + 0.587 * data[i*4+1] + 0.114 * data[i*4+2]);
    }

    const out = new Uint8ClampedArray(width * height * 4);
    const px = (row, col) => gray[row * width + col];

    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            const gx = -px(y-1,x-1) + px(y-1,x+1)
                       -2*px(y,x-1) + 2*px(y,x+1)
                       -px(y+1,x-1) + px(y+1,x+1);
            const gy = -px(y-1,x-1) - 2*px(y-1,x) - px(y-1,x+1)
                       +px(y+1,x-1) + 2*px(y+1,x) + px(y+1,x+1);
            const mag = Math.min(255, Math.round(Math.sqrt(gx * gx + gy * gy)));
            const idx = (y * width + x) * 4;
            out[idx] = out[idx+1] = out[idx+2] = mag;
            out[idx+3] = 255;
        }
    }
    return { data: out, width, height };
}
