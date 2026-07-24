import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DocPane } from '../src/components/DocPane.tsx';
import { initialAppState } from '../src/types.ts';

describe('DocPane', () => {
    it('mostra a zona de upload quando não há imagem', () => {
        const html = renderToStaticMarkup(
            <DocPane
                state={initialAppState}
                dispatch={() => {}}
                imageRef={{ current: null }}
                overlayCanvasRef={{ current: null }}
                onFileDrop={async () => {}}
                onSampleLoad={() => {}}
                onFileSelect={() => {}}
                fileInputRef={{ current: null }}
                onFileInputChange={() => {}}
            />,
        );

        expect(html).toContain('Arraste um documento ou');
        expect(html).toContain('Selecionar arquivo');
        expect(html).toContain('Usar exemplo');
        expect(html).toContain('type="file"');
    });

    it('mostra erro de upload quando a conversão falha', () => {
        const html = renderToStaticMarkup(
            <DocPane
                state={{
                    ...initialAppState,
                    loadError: 'Não foi possível processar arquivos HEIC neste navegador.',
                }}
                dispatch={() => {}}
                imageRef={{ current: null }}
                overlayCanvasRef={{ current: null }}
                onFileDrop={async () => {}}
                onSampleLoad={() => {}}
                onFileSelect={() => {}}
                fileInputRef={{ current: null }}
                onFileInputChange={() => {}}
            />,
        );

        expect(html).toContain('Não foi possível processar arquivos HEIC neste navegador.');
    });

    it('mostra metadados da imagem carregada', () => {
        const imageElement = {
            src: 'example.png',
            naturalWidth: 1200,
            naturalHeight: 800,
        } as HTMLImageElement;

        const html = renderToStaticMarkup(
            <DocPane
                state={{
                    ...initialAppState,
                    imageElement,
                    sourceFile: new File([], 'amostra.png'),
                    zoom: 1.25,
                }}
                dispatch={() => {}}
                imageRef={{ current: null }}
                overlayCanvasRef={{ current: null }}
                onFileDrop={async () => {}}
                onSampleLoad={() => {}}
                onFileSelect={() => {}}
                fileInputRef={{ current: null }}
                onFileInputChange={() => {}}
            />,
        );

        expect(html).toContain('amostra.png · 1200×800');
        expect(html).toContain('125%');
        expect(html).toContain('src="example.png"');
        expect(html).toContain('alt="amostra.png"');
        expect(html).toContain('aria-label="Ajustar divisão antes/depois"');
        expect(html).toContain('aria-valuemin="0"');
        expect(html).toContain('aria-valuemax="100"');
        expect(html).toContain('aria-valuenow="50"');
    });

    it('mostra o canvas de overlay para modos sobel e amplify', () => {
        const imageElement = {
            src: 'example.png',
            naturalWidth: 1200,
            naturalHeight: 800,
        } as HTMLImageElement;

        const sobelHtml = renderToStaticMarkup(
            <DocPane
                state={{
                    ...initialAppState,
                    imageElement,
                    canvasMode: 'sobel',
                }}
                dispatch={() => {}}
                imageRef={{ current: null }}
                overlayCanvasRef={{ current: null }}
                onFileDrop={async () => {}}
                onSampleLoad={() => {}}
                onFileSelect={() => {}}
                fileInputRef={{ current: null }}
                onFileInputChange={() => {}}
            />,
        );

        const amplifyHtml = renderToStaticMarkup(
            <DocPane
                state={{
                    ...initialAppState,
                    imageElement,
                    canvasMode: 'amplify',
                }}
                dispatch={() => {}}
                imageRef={{ current: null }}
                overlayCanvasRef={{ current: null }}
                onFileDrop={async () => {}}
                onSampleLoad={() => {}}
                onFileSelect={() => {}}
                fileInputRef={{ current: null }}
                onFileInputChange={() => {}}
            />,
        );

        const histogramHtml = renderToStaticMarkup(
            <DocPane
                state={{
                    ...initialAppState,
                    imageElement,
                    canvasMode: 'histogram',
                }}
                dispatch={() => {}}
                imageRef={{ current: null }}
                overlayCanvasRef={{ current: null }}
                onFileDrop={async () => {}}
                onSampleLoad={() => {}}
                onFileSelect={() => {}}
                fileInputRef={{ current: null }}
                onFileInputChange={() => {}}
            />,
        );

        expect(sobelHtml).toContain('style="display:block"');
        expect(amplifyHtml).toContain('style="display:block"');
        expect(histogramHtml).toContain('style="display:none"');
    });
});
