import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CanvasTab } from '../src/components/tabs/CanvasTab.tsx';
import { initialAppState } from '../src/types.ts';

describe('CanvasTab', () => {
    it('mantém o canvas do histograma montado antes da primeira execução', () => {
        const html = renderToStaticMarkup(
            <CanvasTab
                state={{ ...initialAppState, activeTab: 'canvas' }}
                dispatch={() => {}}
                overlayCanvasRef={{ current: null }}
            />,
        );

        expect(html).toContain('width="256"');
        expect(html).toContain('height="80"');
    });

    it('permite limpar quando existe um modo de canvas ativo mesmo sem imagem', () => {
        const html = renderToStaticMarkup(
            <CanvasTab
                state={{ ...initialAppState, activeTab: 'canvas', canvasMode: 'sobel' }}
                dispatch={() => {}}
                overlayCanvasRef={{ current: null }}
            />,
        );

        expect(html).toMatch(/<button type="button" class="[^"]*">✕ Limpar<\/button>/);
    });
});
