'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

// "Accedi" nell'header è utile solo dalla pagina di richiesta accesso (per
// tornare al login); sulla pagina di login stessa è ridondante col form già
// a schermo. Client component perché il pathname corrente non è disponibile
// in Header (server component).
export function HeaderAuthLink() {
    const pathname = usePathname();
    if (pathname !== '/request-invite') return null;

    return (
        <Link href="/login" className="text-sm text-ink-soft hover:text-ink">
            Accedi
        </Link>
    );
}
