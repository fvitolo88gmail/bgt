'use client';

import { useState } from 'react';
import Link from 'next/link';

/**
 * Shell della console admin (sidebar + contenuto), dal design di riferimento
 * (docs/design-reference/"BGT Design System - Standalone.html", sezione
 * ADMIN). Le voci non ancora costruite restano nel menu ma disabilitate —
 * visibili per fedeltà al reference, non anticipano
 * l'implementazione di quelle pagine. Nessuna etichetta "in arrivo": solo
 * non cliccabili (scelta esplicita di Francesco).
 *
 * Sotto `md` la sidebar collassa in un menu ad hamburger (drawer a
 * comparsa): serve stato client per aprirla/chiuderla.
 */
interface AdminNavItem {
    label: string;
    href: string;
    comingSoon?: boolean;
}

const NAV_ITEMS: AdminNavItem[] = [
    { label: 'Giochi', href: '/admin/games', comingSoon: true },
    { label: 'Ingest', href: '/admin/ingest', comingSoon: true },
    { label: 'Log & Audit', href: '/admin/audit', comingSoon: true },
    { label: 'Impostazioni', href: '/admin/settings', comingSoon: true },
    { label: 'Costi', href: '/admin/costs' },
];

function NavLinks({ active, onNavigate }: { active?: string; onNavigate?: () => void }) {
    return (
        <>
            {NAV_ITEMS.map((item) =>
                item.comingSoon ? (
                    <span
                        key={item.label}
                        className="cursor-not-allowed rounded-[7px] px-2.5 py-2 text-xs text-admin-sidebar-ink-muted"
                    >
                        {item.label}
                    </span>
                ) : (
                    <Link
                        key={item.label}
                        href={item.href}
                        onClick={onNavigate}
                        className={`rounded-[7px] px-2.5 py-2 text-xs font-semibold transition-colors ${
                            active === item.label
                                ? 'bg-admin-sidebar-active text-white'
                                : 'text-admin-sidebar-ink hover:text-white'
                        }`}
                    >
                        {item.label}
                    </Link>
                ),
            )}
        </>
    );
}

export function AdminShell({ active, children }: { active?: string; children: React.ReactNode }) {
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    return (
        // h-full invece di un calc(100vh-...) hardcoded: il genitore <main>
        // è già dimensionato correttamente da flexbox (viewport meno header
        // meno footer, v. app/layout.tsx) — ricalcolare qui rischia di
        // disallinearsi se l'altezza di header/footer cambia altrove.
        <div className="flex h-full flex-col md:flex-row">
            {/* Top bar con hamburger, visibile solo sotto md */}
            <div className="flex shrink-0 items-center justify-between bg-admin-sidebar px-3.5 py-3 md:hidden">
                <span className="font-serif text-sm font-bold text-white">Administration</span>
                <button
                    type="button"
                    aria-label={isMenuOpen ? 'Chiudi menu' : 'Apri menu'}
                    aria-expanded={isMenuOpen}
                    onClick={() => setIsMenuOpen((open) => !open)}
                    className="flex h-8 w-8 items-center justify-center rounded-[7px] text-admin-sidebar-ink hover:text-white"
                >
                    <span className="sr-only">Menu</span>
                    {isMenuOpen ? (
                        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" />
                        </svg>
                    ) : (
                        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M4 12h16M4 17h16" />
                        </svg>
                    )}
                </button>
            </div>

            {isMenuOpen && (
                <nav className="flex shrink-0 flex-col gap-1 bg-admin-sidebar px-3.5 py-3 md:hidden">
                    <NavLinks active={active} onNavigate={() => setIsMenuOpen(false)} />
                </nav>
            )}

            <aside className="hidden w-[200px] shrink-0 flex-col gap-1 bg-admin-sidebar px-3.5 py-5 md:flex">
                <span className="mb-4 font-serif text-sm font-bold text-white">Administration</span>
                <NavLinks active={active} />
            </aside>

            {/* min-h-0 necessario perché un figlio flex non si restringe sotto
                il contenuto senza di esso, altrimenti l'overflow-y-auto non
                scrolla mai (rimane alto quanto il contenuto). */}
            <div className="min-h-0 flex-1 overflow-y-auto bg-paper p-6">{children}</div>
        </div>
    );
}
