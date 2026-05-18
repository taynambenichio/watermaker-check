import assert from 'node:assert/strict';

// canvas.js expõe funções puras que aceitam {data: Uint8ClampedArray, width, height}
// compatíveis com ImageData, testáveis em Node.js sem browser
import { computeHistogram, sobelEdges } from '../js/canvas.js';

function img(pixels, width, height) {
    return { data: new Uint8ClampedArray(pixels), width, height };
}

// ── computeHistogram ──────────────────────────────────────────
{
    // 1 pixel vermelho puro
    const h = computeHistogram(img([255, 0, 0, 255], 1, 1));
    assert.equal(h.r[255], 1, 'r[255] deve ser 1 para pixel vermelho');
    assert.equal(h.g[0],   1, 'g[0] deve ser 1 para pixel vermelho');
    assert.equal(h.b[0],   1, 'b[0] deve ser 1 para pixel vermelho');
    console.log('✓ computeHistogram: pixel vermelho');
}
{
    // 2 pixels: vermelho e azul
    const h = computeHistogram(img([255,0,0,255, 0,0,255,255], 2, 1));
    assert.equal(h.r[255], 1); assert.equal(h.r[0], 1);
    assert.equal(h.b[255], 1); assert.equal(h.b[0], 1);
    console.log('✓ computeHistogram: dois pixels');
}
{
    // 256 pixels com valor crescente em R
    const pixels = [];
    for (let i = 0; i < 256; i++) pixels.push(i, 0, 0, 255);
    const h = computeHistogram(img(pixels, 256, 1));
    for (let i = 0; i < 256; i++) assert.equal(h.r[i], 1, `r[${i}] deve ser 1`);
    console.log('✓ computeHistogram: 256 valores únicos em R');
}

console.log('\n✅ computeHistogram OK');

// ── sobelEdges ────────────────────────────────────────────────
{
    // 3×3 imagem uniforme → sem bordas
    const pixels = new Array(3 * 3 * 4).fill(0);
    for (let i = 0; i < 9; i++) { pixels[i*4]=pixels[i*4+1]=pixels[i*4+2]=128; pixels[i*4+3]=255; }
    const result = sobelEdges(img(pixels, 3, 3));
    const center = (1 * 3 + 1) * 4;
    assert.equal(result.data[center], 0, 'imagem uniforme: magnitude deve ser 0 no centro');
    console.log('✓ sobelEdges: imagem uniforme → sem bordas');
}
{
    // 3×3 com borda vertical: coluna 0-1 preta, coluna 2 branca
    const pixels = new Array(3 * 3 * 4).fill(0);
    for (let y = 0; y < 3; y++) {
        for (let x = 0; x < 3; x++) {
            const v = x >= 2 ? 255 : 0;
            const i = (y * 3 + x) * 4;
            pixels[i]=pixels[i+1]=pixels[i+2]=v; pixels[i+3]=255;
        }
    }
    const result = sobelEdges(img(pixels, 3, 3));
    const center = (1 * 3 + 1) * 4;
    assert.ok(result.data[center] > 0, 'borda vertical: centro deve ter magnitude > 0');
    assert.equal(result.data.length, 3 * 3 * 4, 'saída deve ter mesmas dimensões');
    assert.equal(result.width, 3); assert.equal(result.height, 3);
    console.log('✓ sobelEdges: borda vertical detectada');
}

console.log('\n✅ sobelEdges OK');
