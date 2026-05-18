import type { ActiveTab } from '../../types.ts';

const TABS: { id: ActiveTab; label: string }[] = [
    { id: 'forensics', label: 'Forense' },
    { id: 'filters', label: 'Filtros' },
    { id: 'canvas', label: 'Canvas' },
    { id: 'ela', label: 'ELA' },
    { id: 'tools', label: 'Ferramentas' },
];

interface TabBarProps {
    activeTab: ActiveTab;
    onTabChange: (tab: ActiveTab) => void;
}

export function TabBar({ activeTab, onTabChange }: TabBarProps) {
    return (
        <nav className="h-9 shrink-0 flex border-b border-border bg-bg-1 px-2 gap-0.5 items-end">
            {TABS.map(({ id, label }) => {
                const active = activeTab === id;
                return (
                    <button
                        type="button"
                        key={id}
                        onClick={() => onTabChange(id)}
                        className={[
                            'h-8 px-3 text-xs font-syne font-bold tracking-wide rounded-t-sm transition-colors',
                            active
                                ? 'bg-bg-2 text-amber border-t border-x border-border border-b-0'
                                : 'text-text-3 hover:text-text-2',
                        ].join(' ')}
                    >
                        {label.toUpperCase()}
                    </button>
                );
            })}
        </nav>
    );
}
