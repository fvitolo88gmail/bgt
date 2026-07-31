import Link from 'next/link';
import { OwlMark } from './OwlMark';
import { UserMenu } from './UserMenu';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { getProfile } from '@/lib/repositories/profiles.repository';
import { getDisplayName, getInitials } from '@/lib/profile-display';

export async function Header() {
    const supabase = await createServerSupabaseClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    const profile = user ? await getProfile(supabase, user.id).catch(() => null) : null;
    const email = user?.email ?? '';

    return (
        <header className="flex items-center justify-between gap-2 border-b border-line-soft bg-card px-4 py-3">
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
                <Link href="/login" className="text-sm text-ink-soft hover:text-ink">
                    Accedi
                </Link>
            )}
        </header>
    );
}
