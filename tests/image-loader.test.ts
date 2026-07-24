import heic2any from 'heic2any';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadImageFile } from '../src/hooks/imageLoader.ts';

vi.mock('heic2any', () => ({
    default: vi.fn(),
}));

class MockImage {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    private _src = '';

    set src(value: string) {
        this._src = value;
        queueMicrotask(() => {
            if (
                value.includes('native-ok') ||
                value.includes('converted-ok') ||
                value.includes('png-ok')
            ) {
                this.onload?.();
            } else {
                this.onerror?.();
            }
        });
    }

    get src() {
        return this._src;
    }
}

describe('imageLoader', () => {
    const originalImage = global.Image;
    let createObjectURLSpy: ReturnType<typeof vi.spyOn>;
    let revokeObjectURLSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        vi.clearAllMocks();
        global.Image = MockImage as unknown as typeof Image;
        createObjectURLSpy = vi
            .spyOn(URL, 'createObjectURL')
            .mockImplementation(() => 'blob:default');
        revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    });

    it('loads HEIC natively when the browser supports it', async () => {
        createObjectURLSpy.mockReturnValue('blob:native-ok');

        const file = new File(['heic'], 'sample.heic', { type: 'image/heic' });
        const loaded = await loadImageFile(file);

        expect(heic2any).not.toHaveBeenCalled();
        expect(createObjectURLSpy).toHaveBeenCalledTimes(1);
        expect(loaded.objectUrl).toBe('blob:native-ok');
        expect(loaded.sourceFile).toBe(file);
        expect(loaded.imageElement.src).toBe('blob:native-ok');
    });

    it('falls back to heic2any when native HEIC loading fails', async () => {
        createObjectURLSpy
            .mockReturnValueOnce('blob:native-fail')
            .mockReturnValueOnce('blob:converted-ok');
        vi.mocked(heic2any).mockResolvedValue(new Blob(['jpeg'], { type: 'image/jpeg' }));

        const file = new File(['heic'], 'sample.heic', { type: 'image/heic' });
        const loaded = await loadImageFile(file);

        expect(heic2any).toHaveBeenCalledTimes(1);
        expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:native-fail');
        expect(loaded.objectUrl).toBe('blob:converted-ok');
        expect(loaded.sourceFile).toBe(file);
    });

    it('falls back to PNG conversion when JPEG conversion fails', async () => {
        createObjectURLSpy
            .mockReturnValueOnce('blob:native-fail')
            .mockReturnValueOnce('blob:png-ok');
        vi.mocked(heic2any)
            .mockRejectedValueOnce(new Error('jpeg conversion failed'))
            .mockResolvedValueOnce(new Blob(['png'], { type: 'image/png' }));

        const file = new File(['heic'], 'sample.heic', { type: 'image/heic' });
        const loaded = await loadImageFile(file);

        expect(heic2any).toHaveBeenCalledTimes(2);
        expect(loaded.objectUrl).toBe('blob:png-ok');
        expect(loaded.sourceFile).toBe(file);
    });

    it('formats object-based conversion errors into readable messages', async () => {
        createObjectURLSpy.mockReturnValue('blob:native-fail');
        vi.mocked(heic2any).mockRejectedValue({
            errorCode: 'ERR_LIBHEIF',
            errorMsg: 'format not supported',
        });

        const file = new File(['heic'], 'sample.heic', { type: 'image/heic' });
        await expect(loadImageFile(file)).rejects.toThrow(
            'Falha ao abrir HEIC: Este arquivo HEIC/HEIF não pode ser aberto neste navegador. Exporte a imagem como JPEG ou PNG e tente novamente.',
        );
    });

    it('rejects unsupported non-image files', async () => {
        await expect(
            loadImageFile(new File(['x'], 'notes.txt', { type: 'text/plain' })),
        ).rejects.toThrow('Arquivo não suportado');
    });

    afterEach(() => {
        global.Image = originalImage;
        createObjectURLSpy?.mockRestore();
        revokeObjectURLSpy?.mockRestore();
    });
});
