import { type ReactNode, useId, useState } from 'react';
import { COLOR_OK, COLOR_WARN, scoreColor } from './scoreColor.ts';

interface ModuleCardProps {
    title: string;
    score?: number;
    icon: string;
    children: ReactNode;
    defaultOpen?: boolean;
    isQuality?: boolean;
    isAcceptable?: boolean;
}

export function ModuleCard({
    title,
    score,
    icon,
    children,
    defaultOpen = false,
    isQuality = false,
    isAcceptable,
}: ModuleCardProps) {
    const [open, setOpen] = useState(defaultOpen);
    const contentId = useId();
    const resolvedScore = score ?? 0;
    const borderColor = isQuality
        ? isAcceptable
            ? COLOR_OK
            : COLOR_WARN
        : scoreColor(resolvedScore);

    const badgeText = isQuality ? (isAcceptable ? 'OK' : 'Atenção') : String(resolvedScore);
    const badgeColor = isQuality
        ? isAcceptable
            ? COLOR_OK
            : COLOR_WARN
        : scoreColor(resolvedScore);

    return (
        <div className="overflow-hidden rounded-sm border border-border bg-bg-2">
            <button
                type="button"
                onClick={() => setOpen((value) => !value)}
                className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-bg-3"
                style={{ borderLeft: `3px solid ${borderColor}` }}
                aria-expanded={open}
                aria-controls={contentId}
            >
                <span className="shrink-0 text-xs">{icon}</span>
                <span className="flex-1 font-syne text-xs font-bold uppercase tracking-wide text-text">
                    {title}
                </span>
                <span className="font-mono text-xs font-bold" style={{ color: badgeColor }}>
                    {badgeText}
                </span>
                <span className="ml-1 text-xs text-text-3">{open ? '▲' : '▼'}</span>
            </button>
            <div
                id={contentId}
                hidden={!open}
                className="border-t border-border px-3 pt-2 pb-3 text-sm text-text-2"
            >
                {children}
            </div>
        </div>
    );
}
