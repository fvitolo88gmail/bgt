import Link from 'next/link';
import { OwlMark } from '@/components/ui/OwlMark';

/**
 * Shell della console admin (sidebar + contenuto), dal design di riferimento
 * (docs/design-reference/"BGT Design System - Standalone.html", sezione
 * ADMIN). Le voci non ancora costruite (ADMIN-CONSOLE) restano nel menu ma
 * disabilitate — visibili per fedeltà al reference, non anticipano
 * l'implementazione di quelle pagine. Nessuna etichetta "in arrivo": solo
 * non cliccabili (scelta esplicita di Francesco).
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

export function AdminShell({ active, children }: { active?: string; children: React.ReactNode }) {
    return (
        <div className="flex min-h-[calc(100vh-57px)]">
            <aside className="flex w-[200px] shrink-0 flex-col gap-1 bg-admin-sidebar px-3.5 py-5">
                <span className="mb-4 flex items-center gap-1.5 font-serif text-sm font-bold text-white">
                    <OwlMark size={18} />
                    BGT Admin
                </span>
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
            </aside>
            <div className="flex-1 bg-paper p-6">{children}</div>
        </div>
    );
}
