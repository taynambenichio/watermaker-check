import { useCallback } from 'react';
import { type LoadedImage, loadImageFile } from './imageLoader.ts';

export function useImageLoader(
    onLoaded: (data: LoadedImage) => void,
    onError?: (message: string) => void,
) {
    const loadFile = useCallback(
        async (file: File): Promise<void> => {
            try {
                const loaded = await loadImageFile(file);
                onLoaded(loaded);
            } catch (error) {
                const message =
                    error instanceof Error ? error.message : 'Falha ao carregar a imagem.';
                console.error('[useImageLoader] Failed to load file:', error);
                onError?.(message);
            }
        },
        [onLoaded, onError],
    );

    const loadUrl = useCallback(
        (url: string): void => {
            const img = new Image();
            img.onload = () =>
                onLoaded({
                    imageElement: img,
                    sourceFile: new File([], url.split('/').pop() ?? 'image'),
                    objectUrl: url,
                });
            img.onerror = () => console.error('[useImageLoader] Failed to load URL:', url);
            img.src = url;
        },
        [onLoaded],
    );

    return { loadFile, loadUrl };
}
