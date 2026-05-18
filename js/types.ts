export interface AppState {
    image: HTMLImageElement | null;
    zoom: number;
    activePreset: string | null;
    activeCanvasMode: 'histogram' | 'sobel' | 'amplify' | 'ela' | null;
    beforeAfterActive: boolean;
}

export interface HistogramResult {
    r: Uint32Array;
    g: Uint32Array;
    b: Uint32Array;
}

export interface ImageDataLike {
    data: Uint8ClampedArray;
    width: number;
    height: number;
}
