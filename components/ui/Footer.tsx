'use client';

import { usePathname } from 'next/navigation';

// Riusata dalla chat, che mostra il disclaimer sotto il proprio campo di input
// invece di ereditare questo footer: un'unica formulazione per entrambi i punti.
export const CITATIONS_DISCLAIMER = 'Risposte citate dal manuale e dal forum, mai inventate.';

// Schermate che occupano tutta l'altezza disponibile e hanno già una propria
// barra in fondo: un footer sotto quella barra sarebbe una seconda fascia
// bordata consecutiva, e interromperebbe le colonne a piena altezza sopra di
// essa. Lì il disclaimer lo mostra la pagina, dove ha davvero contesto.
const FULL_HEIGHT_PATHS = [/^\/game\//];

export function Footer() {
    const pathname = usePathname();
    if (FULL_HEIGHT_PATHS.some((pattern) => pattern.test(pathname))) return null;

    return (
        <footer className="border-t border-line-soft px-4 py-3 text-center text-xs text-ink-faint">
            BGT — {CITATIONS_DISCLAIMER}
        </footer>
    );
}
