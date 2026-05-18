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
