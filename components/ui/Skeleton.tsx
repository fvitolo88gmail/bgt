import { HTMLAttributes } from 'react';

// Placeholder generico per contenuto in caricamento (es. il nome del gioco in
// /game/[id], noto solo lato client) — dimensioni impostate dal chiamante via
// className (h-*/w-*), qui solo il trattamento visivo (pulse, forma, colore).
export function Skeleton({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
    return (
        <div
            role="status"
            aria-label="Caricamento..."
            className={`animate-pulse rounded-sm bg-line-soft ${className}`}
            {...props}
        />
    );
}
