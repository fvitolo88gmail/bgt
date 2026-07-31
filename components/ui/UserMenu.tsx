'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Avatar } from './Avatar';
import { LogoutButton } from '@/components/auth/LogoutButton';

/**
 * Avatar in fondo all'Header: click per espandere. Primo item non
 * cliccabile con nome + email, poi i link (Profilo, Admin solo per chi ha
 * il ruolo, Esci) — DESIGN-00004.
 */
export function UserMenu({
    displayName,
    initials,
    email,
    isAdmin,
}: {
    displayName: string;
    initials: string;
    email: string;
    isAdmin: boolean;
}) {
    const [open, setOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        function handleClickOutside(event: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [open]);

    return (
        <div ref={containerRef} className="relative">
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                aria-expanded={open}
                aria-label="Menu utente"
                className="cursor-pointer"
            >
                <Avatar initials={initials} />
            </button>

            {open && (
                <div className="absolute right-0 top-full z-10 mt-2 w-52 rounded-md border border-line bg-card p-2 shadow-sm">
                    <div className="px-2 py-1.5">
                        <p className="truncate text-sm font-medium text-ink">{displayName}</p>
                        <p className="truncate text-xs text-ink-faint">{email}</p>
                    </div>
                    <div className="my-1 border-t border-line-soft" />
                    <Link
                        href="/profile"
                        onClick={() => setOpen(false)}
                        className="block rounded px-2 py-1.5 text-sm text-ink hover:bg-paper-2"
                    >
                        Profilo
                    </Link>
                    {isAdmin && (
                        <Link
                            href="/admin"
                            onClick={() => setOpen(false)}
                            className="block rounded px-2 py-1.5 text-sm text-ink hover:bg-paper-2"
                        >
                            Admin
                        </Link>
                    )}
                    <div className="flex justify-end px-2 py-1">
                        <LogoutButton />
                    </div>
                </div>
            )}
        </div>
    );
}
