'use client';

import { useEffect, useRef, useState } from 'react';
import { GameOption } from './types';

interface GameChipSelectProps {
    games: GameOption[];
    value: string;
    onChange: (gameId: string) => void;
}

// Selettore del gioco per l'input domanda in home: un chip compatto (non il
// riquadro pieno del Dropdown generico) — qui è un dettaglio dentro l'input,
// non un campo di form a sé stante.
export function GameChipSelect({ games, value, onChange }: GameChipSelectProps) {
    const [open, setOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const selected = games.find((game) => game.id === value);

    useEffect(() => {
        if (!open) return;

        function handleClickOutside(event: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setOpen(false);
            }
        }

        function handleKeyDown(event: KeyboardEvent) {
            if (event.key === 'Escape') setOpen(false);
        }

        document.addEventListener('mousedown', handleClickOutside);
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [open]);

    return (
        <div ref={containerRef} className="relative">
            <button
                type="button"
                onClick={() => setOpen((prev) => !prev)}
                aria-haspopup="listbox"
                aria-expanded={open}
                title={selected?.name}
                // max-w: senza un limite il chip cresce con il nome e spinge "Chiedi"
                // fuori dalla riga — oltre la soglia il nome tronca con ellipsis, il
                // title sopra fa da tooltip col nome completo. Più stretto sotto sm:
                // meno spazio per badge/bottone accanto sulla stessa riga.
                className="inline-flex max-w-32 cursor-pointer items-center gap-1.5 rounded-full bg-primary-soft px-2.5 py-1.5 text-xs font-semibold text-primary hover:bg-primary-soft/70 sm:max-w-40 sm:px-3"
            >
                <span className="min-w-0 truncate">{selected?.name ?? 'Scegli un gioco'}</span>
                <svg viewBox="0 0 24 24" className={`h-2.5 w-2.5 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6,10 12,16 18,10" />
                </svg>
            </button>

            {open && (
                // w-max invece di una larghezza fissa: si adatta al nome più lungo tra i
                // giochi, fino a max-w-64 — oltre quella soglia i nomi troncano con
                // ellipsis (title nativo del browser fa da tooltip col nome completo).
                <ul
                    role="listbox"
                    className="absolute z-10 mt-1 max-h-60 w-max max-w-64 min-w-full overflow-y-auto rounded-lg border border-line bg-card py-1 shadow-lg"
                >
                    {games.map((game) => (
                        <li key={game.id}>
                            <button
                                type="button"
                                role="option"
                                aria-selected={game.id === value}
                                title={game.name}
                                onClick={() => {
                                    onChange(game.id);
                                    setOpen(false);
                                }}
                                className={`block w-full cursor-pointer truncate px-3 py-1.5 text-left text-xs hover:bg-primary-soft ${
                                    game.id === value ? 'bg-primary-soft font-semibold text-primary' : 'text-ink'
                                }`}
                            >
                                {game.name}
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
