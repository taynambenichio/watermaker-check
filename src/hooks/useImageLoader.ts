import heic2any from 'heic2any';
import { useCallback } from 'react';

interface LoadedImage {
    imageElement: HTMLImageElement;
    sourceFile: File;
    objectUrl: string;
}

function isHeicFile(file: File): boolean {
    return (
        file.type === 'image/heic' ||
        file.type === 'image/heif' ||
        /\.(heic|heif)$/i.test(file.name)
    );
}

export function useImageLoader(onLoaded: (data: LoadedImage) => void) {
    const loadFile = useCallback(
        async (file: File): Promise<void> => {
            const heic = isHeicFile(file);
            if (!heic && !file.type.startsWith('image/')) return;

            let objectUrl: string;
            if (heic) {
                const blob = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.92 });
                const single = Array.isArray(blob) ? blob[0] : blob;
                objectUrl = URL.createObjectURL(single);
            } else {
                objectUrl = URL.createObjectURL(file);
            }

            const img = new Image();
            img.onload = () => onLoaded({ imageElement: img, sourceFile: file, objectUrl });
            img.onerror = () => URL.revokeObjectURL(objectUrl);
            img.src = objectUrl;
        },
        [onLoaded],
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
            img.src = url;
        },
        [onLoaded],
    );

    return { loadFile, loadUrl };
}
