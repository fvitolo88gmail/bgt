/**
 * Icona info con tooltip al passaggio del mouse — puro CSS (:hover via
 * classi Tailwind `group`/`group-hover`), nessuno stato client necessario:
 * usabile sia da Server Component (CostTable) sia da Client Component
 * (TopRequestsTable).
 */
export function InfoTooltip({ text }: { text: string }) {
    return (
        <span className="group relative ml-1 inline-flex align-middle">
            <span
                className="inline-flex h-3.5 w-3.5 cursor-help items-center justify-center rounded-full border border-ink-faint text-[9px] font-bold leading-none text-ink-faint"
                aria-label={text}
            >
                i
            </span>
            <span
                role="tooltip"
                className="invisible absolute bottom-full left-1/2 z-10 mb-1.5 w-56 -translate-x-1/2 rounded-md border border-line bg-card p-2 text-[11px] font-normal normal-case leading-snug text-ink-soft opacity-0 shadow-md transition-opacity group-hover:visible group-hover:opacity-100"
            >
                {text}
            </span>
        </span>
    );
}
