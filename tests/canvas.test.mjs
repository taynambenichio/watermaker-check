import assert from 'node:assert/strict';

// canvas.js expõe funções puras que aceitam {data: Uint8ClampedArray, width, height}
// compatíveis com ImageData, testáveis em Node.js sem browser
import { computeHistogram } from '../js/canvas.js';

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
