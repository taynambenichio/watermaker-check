import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('heic2any', () => ({
    default: vi.fn(),
}));

import App from '../src/App.tsx';

describe('App forensics panel', () => {
    it('renders the forensics empty state instead of the task placeholder', () => {
        const html = renderToStaticMarkup(<App />);

        expect(html).toContain('Carregue um documento para iniciar a análise forense automática');
        expect(html).not.toContain('RightPanel — Task 6');
    });
});
