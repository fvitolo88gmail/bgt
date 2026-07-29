'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserSupabaseClient } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';

export function LogoutButton() {
    const router = useRouter();
    const [signingOut, setSigningOut] = useState(false);

    async function handleLogout() {
        setSigningOut(true);
        const supabase = createBrowserSupabaseClient();
        await supabase.auth.signOut();
        router.push('/home');
        router.refresh();
    }

    return (
        <Button variant="ghost" onClick={handleLogout} disabled={signingOut} className="px-2 py-1 text-xs">
            {signingOut ? 'Uscita...' : 'Esci'}
        </Button>
    );
}
