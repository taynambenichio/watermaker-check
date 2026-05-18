import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { RightPanel } from '../src/components/RightPanel.tsx';
import { initialAppState } from '../src/types.ts';

describe('RightPanel', () => {
    it('renders the forensics tab content', () => {
        const html = renderToStaticMarkup(
            <RightPanel
                state={{ ...initialAppState, activeTab: 'forensics' }}
                dispatch={() => {}}
                imageRef={{ current: null }}
                overlayCanvasRef={{ current: null }}
            />,
        );

        expect(html).toContain('Carregue um documento para iniciar a análise forense automática');
    });

    it.each([
        ['filters', 'Predefinidos'],
        ['canvas', 'Histograma RGB'],
        ['ela', 'Analisar ELA'],
        ['tools', 'Exportar PNG'],
    ] as const)('renders the %s tab content', (activeTab, expectedText) => {
        const html = renderToStaticMarkup(
            <RightPanel
                state={{ ...initialAppState, activeTab }}
                dispatch={() => {}}
                imageRef={{ current: null }}
                overlayCanvasRef={{ current: null }}
            />,
        );

        expect(html).toContain(expectedText);
    });
});
