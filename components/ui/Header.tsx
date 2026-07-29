import Link from 'next/link';
import { OwlMark } from './OwlMark';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { LogoutButton } from '@/components/auth/LogoutButton';

export async function Header() {
    const supabase = await createServerSupabaseClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    return (
        <header className="flex items-center justify-between gap-2 border-b border-line-soft bg-card px-4 py-3">
            <Link href="/home" className="flex items-center gap-2 font-serif text-base font-bold text-ink">
                <OwlMark size={24} />
                BGT
            </Link>

            {user ? (
                <div className="flex items-center gap-3 text-sm text-ink-soft">
                    <span>{user.email}</span>
                    <LogoutButton />
                </div>
            ) : (
                <Link href="/login" className="text-sm text-ink-soft hover:text-ink">
                    Accedi
                </Link>
            )}
        </header>
    );
}
