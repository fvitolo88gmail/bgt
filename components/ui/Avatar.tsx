// Cerchio bianco, bordo bold, iniziali colorate dalla palette — sostituisce
// l'OwlMark usato provvisoriamente in BILLING-00002 (DESIGN-00004).
export function Avatar({ initials, size = 32 }: { initials: string; size?: number }) {
    return (
        <span
            style={{ width: size, height: size, fontSize: size * 0.4 }}
            className="flex shrink-0 items-center justify-center rounded-full border-2 border-ink bg-white font-bold text-primary"
        >
            {initials}
        </span>
    );
}
