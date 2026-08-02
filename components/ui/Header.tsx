import Link from 'next/link';
import { OwlMark } from './OwlMark';
import { UserMenu } from './UserMenu';
import { HeaderAuthLink } from './HeaderAuthLink';
import { createServerSupabaseClient } from '@/lib/shared/supabase-server';
import { getProfile } from '@/lib/profile/repository/profiles.repository';
import { getDisplayName, getInitials } from '@/lib/profile/service/profile-display';

export async function Header() {
    const supabase = await createServerSupabaseClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    const profile = user ? await getProfile(supabase, user.id).catch(() => null) : null;
    const email = user?.email ?? '';

    return (
        // relative z-[60]: deve restare sopra sia gli overlay a tutto schermo
        // (es. ConversationSidebar espansa da mobile, z-40) sia la bar
        // "Conversazioni" stessa (z-50, v. ConversationSidebar.tsx) — a
        // z-index pari vince l'ultimo nel DOM, e la bar viene dopo
        // nell'albero (dentro <main>), coprendo il menu utente aperto qui.
        // z-[60] (arbitrary value): 50 è il valore massimo della scala
        // predefinita di Tailwind, "z-60" da solo non genera alcuna regola.
        <header className="relative z-[60] flex items-center justify-between gap-2 border-b border-line-soft bg-card px-4 py-3">
            <Link href="/home" className="flex items-center gap-2 font-serif text-base font-bold text-ink">
                <OwlMark size={24} />
                BGT
            </Link>

            {user && profile ? (
                <UserMenu
                    displayName={getDisplayName(profile, email)}
                    initials={getInitials(profile, email)}
                    email={email}
                    isAdmin={profile.role === 'admin'}
                />
            ) : (
                <HeaderAuthLink />
            )}
        </header>
    );
}
