// Icona gufo con tocco da laurea — geometria ripresa dal design di
// riferimento (docs/epics/todo/DESIGN/reference), colori sempre da theme.css.
// viewBox spostato di -4 in y: il disegno (corpo + tocco) non è centrato nel
// box 64x64 originale, lascia più spazio vuoto sotto che sopra — allineato
// qui per farlo centrare correttamente col testo quando affiancato in flex
// items-center.
export function OwlMark({ size = 26 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 -4 64 64" aria-hidden="true">
            <circle cx="32" cy="34" r="22" fill="var(--owl-body)" />
            <circle cx="24" cy="30" r="7" fill="white" />
            <circle cx="40" cy="30" r="7" fill="white" />
            <circle cx="24" cy="30" r="3" fill="var(--ink)" />
            <circle cx="40" cy="30" r="3" fill="var(--ink)" />
            <polygon points="32,38 28,44 36,44" fill="var(--accent-designer)" />
            <rect x="22" y="4" width="20" height="20" transform="rotate(45 32 14)" fill="var(--ink)" />
            <line x1="46" y1="14" x2="46" y2="20" stroke="var(--ink)" strokeWidth="2" />
            <circle cx="46" cy="21" r="2.2" fill="var(--accent-designer)" />
        </svg>
    );
}
