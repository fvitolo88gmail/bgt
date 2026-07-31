'use client';

import { useState } from 'react';
import { createBrowserSupabaseClient } from '@/lib/shared/supabase';
import { Button } from '@/components/ui/Button';

export function LogoutButton() {
    const [signingOut, setSigningOut] = useState(false);

    async function handleLogout() {
        setSigningOut(true);
        const supabase = createBrowserSupabaseClient();
        await supabase.auth.signOut();
        // redirect pieno, non router.push/refresh: v. LoginForm.tsx per il motivo
        window.location.href = '/home';
    }

    return (
        <Button variant="ghost" onClick={handleLogout} disabled={signingOut} className="px-2 py-1 text-xs">
            {signingOut ? 'Uscita...' : 'Esci'}
        </Button>
    );
}
