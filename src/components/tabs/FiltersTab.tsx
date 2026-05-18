import type { Dispatch } from 'react';
import type { AppAction, AppState, FilterState } from '../../types.ts';

const FILTER_DEFS = [
    { key: 'brightness' as const, label: 'Brilho', min: 0, max: 300, unit: '%' },
    { key: 'contrast' as const, label: 'Contraste', min: 0, max: 300, unit: '%' },
    { key: 'saturation' as const, label: 'Saturação', min: 0, max: 300, unit: '%' },
    { key: 'hue' as const, label: 'Matiz', min: 0, max: 360, unit: '°' },
    { key: 'invert' as const, label: 'Inversão', min: 0, max: 100, unit: '%' },
    { key: 'blur' as const, label: 'Desfoque', min: 0, max: 20, unit: 'px' },
];

const PRESETS: Record<string, Omit<FilterState, 'preset'>> = {
    uv: { brightness: 150, contrast: 200, saturation: 50, hue: 280, invert: 0, blur: 0 },
    infrared: { brightness: 120, contrast: 180, saturation: 0, hue: 0, invert: 30, blur: 1 },
    watermark: { brightness: 80, contrast: 250, saturation: 200, hue: 0, invert: 0, blur: 0 },
    security: { brightness: 200, contrast: 300, saturation: 150, hue: 45, invert: 0, blur: 0 },
    edges: { brightness: 50, contrast: 300, saturation: 0, hue: 0, invert: 50, blur: 0 },
    negative: { brightness: 120, contrast: 120, saturation: 120, hue: 180, invert: 100, blur: 0 },
};

const PRESET_LABELS: Record<string, string> = {
    uv: 'Luz UV',
    infrared: 'Infravermelho',
    watermark: "Marca d'Água",
    security: 'Segurança',
    edges: 'Bordas',
    negative: 'Negativo',
};

interface FiltersTabProps {
    state: AppState;
    dispatch: Dispatch<AppAction>;
}

export function FiltersTab({ state, dispatch }: FiltersTabProps) {
    const { filters } = state;

    return (
        <div className="flex flex-col gap-3 p-3">
            {FILTER_DEFS.map(({ key, label, min, max, unit }) => (
                <div key={key} className="flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                        <label
                            htmlFor={`filter-${key}`}
                            className="font-syne text-xs font-bold text-text-2"
                        >
                            {label.toUpperCase()}
                        </label>
                        <span className="font-mono text-xs text-amber">
                            {filters[key]}
                            {unit}
                        </span>
                    </div>
                    <input
                        id={`filter-${key}`}
                        type="range"
                        min={min}
                        max={max}
                        value={filters[key]}
                        onChange={(e) =>
                            dispatch({ type: 'SET_FILTER', key, value: Number(e.target.value) })
                        }
                        className="h-1 w-full"
                    />
                </div>
            ))}

            <div className="border-t border-border pt-3">
                <p className="mb-2 font-syne text-xs font-bold uppercase tracking-wide text-text-3">
                    Predefinidos
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                    {Object.entries(PRESET_LABELS).map(([key, label]) => (
                        <button
                            key={key}
                            type="button"
                            onClick={() =>
                                dispatch({ type: 'SET_PRESET', preset: key, values: PRESETS[key]! })
                            }
                            className={[
                                'h-7 rounded-sm border px-2 text-xs font-syne font-bold transition-colors',
                                filters.preset === key
                                    ? 'border-amber bg-amber-dim text-amber'
                                    : 'border-border text-text-3 hover:border-border hover:text-text-2',
                            ].join(' ')}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            </div>

            <button
                type="button"
                onClick={() => dispatch({ type: 'RESET_FILTERS' })}
                className="h-8 w-full rounded-sm border border-border text-xs font-syne font-bold text-text-3 transition-colors hover:border-amber hover:text-amber"
            >
                ↺ Restaurar original
            </button>
        </div>
    );
}
