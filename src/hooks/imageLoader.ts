import heic2any from 'heic2any';

export interface LoadedImage {
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

function loadImageFromUrl(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error(`Falha ao carregar imagem: ${url}`));
        img.src = url;
    });
}

function describeError(error: unknown): string {
    if (error instanceof Error) return error.message;
    if (typeof error === 'string') return error;
    if (error && typeof error === 'object') {
        const candidate = error as {
            errorMsg?: unknown;
            message?: unknown;
            errorCode?: unknown;
            error?: unknown;
        };
        const parts = [candidate.errorCode, candidate.errorMsg, candidate.message, candidate.error]
            .filter((part) => typeof part === 'string' && part.trim().length > 0)
            .map((part) => String(part));
        if (parts.length > 0) return parts.join(': ');

        try {
            return JSON.stringify(error);
        } catch {
            return 'erro desconhecido';
        }
    }
    return 'erro desconhecido';
}

function classifyHeicError(detail: string): string {
    const normalized = detail.toLowerCase();
    if (normalized.includes('format not supported')) {
        return 'Este arquivo HEIC/HEIF não pode ser aberto neste navegador.';
    }
    if (normalized.includes('does not contain valid images')) {
        return 'O arquivo HEIC parece estar corrompido ou sem imagens válidas.';
    }
    if (
        normalized.includes('could not load image') ||
        normalized.includes('falha ao carregar imagem')
    ) {
        return 'A imagem convertida não pôde ser carregada para visualização.';
    }
    return detail;
}

async function convertHeicToBlob(file: File, toType: 'image/jpeg' | 'image/png'): Promise<Blob> {
    const converted = await heic2any(
        toType === 'image/jpeg' ? { blob: file, toType, quality: 0.92 } : { blob: file, toType },
    );
    const single = Array.isArray(converted) ? converted[0] : converted;
    if (!single) {
        throw new Error('Conversão HEIC sem saída válida.');
    }
    return single;
}

async function tryLoadNativeHeic(file: File): Promise<LoadedImage | null> {
    const objectUrl = URL.createObjectURL(file);
    try {
        const imageElement = await loadImageFromUrl(objectUrl);
        return { imageElement, sourceFile: file, objectUrl };
    } catch {
        URL.revokeObjectURL(objectUrl);
        return null;
    }
}

export async function loadImageFile(file: File): Promise<LoadedImage> {
    const heic = isHeicFile(file);
    if (!heic && !file.type.startsWith('image/')) {
        throw new Error('Arquivo não suportado. Envie uma imagem.');
    }

    if (heic) {
        const native = await tryLoadNativeHeic(file);
        if (native) return native;

        const conversionAttempts: Array<'image/jpeg' | 'image/png'> = ['image/jpeg', 'image/png'];
        let lastError: unknown = null;

        for (const toType of conversionAttempts) {
            try {
                const blob = await convertHeicToBlob(file, toType);
                const objectUrl = URL.createObjectURL(blob);
                try {
                    const imageElement = await loadImageFromUrl(objectUrl);
                    return { imageElement, sourceFile: file, objectUrl };
                } catch (error) {
                    URL.revokeObjectURL(objectUrl);
                    lastError = error;
                }
            } catch (error) {
                lastError = error;
            }
        }

        const detail = classifyHeicError(describeError(lastError));
        throw new Error(
            `Falha ao abrir HEIC: ${detail} Exporte a imagem como JPEG ou PNG e tente novamente.`,
        );
    }

    const objectUrl = URL.createObjectURL(file);
    const imageElement = await loadImageFromUrl(objectUrl);
    return { imageElement, sourceFile: file, objectUrl };
}

export { isHeicFile };
