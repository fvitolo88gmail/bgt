import type { SupabaseClient } from '@supabase/supabase-js';

export interface Profile {
    id: string;
    firstName: string | null;
    lastName: string | null;
    role: 'admin' | 'user';
}

interface ProfileRow {
    id: string;
    first_name: string | null;
    last_name: string | null;
    role: string;
}

/**
 * Legge il ruolo dalla riga profiles dell'utente autenticato — la RLS
 * (`profiles_select_own_or_admin`) permette sempre a un utente di leggere la
 * propria riga, quindi funziona anche per un utente non-admin. Usato per il
 * gate UI di pagine admin-only (es. app/admin/costs) — la RLS sulle tabelle
 * sottostanti resta comunque l'enforcement reale, non solo questo controllo.
 */
export async function isAdmin(supabase: SupabaseClient, userId: string): Promise<boolean> {
    const profile = await getProfile(supabase, userId);
    return profile.role === 'admin';
}

/**
 * Legge nome/cognome/ruolo dell'utente autenticato (DESIGN-00004) — usato dal
 * menu avatar, dalla pagina profilo e dal saluto in /home.
 */
export async function getProfile(supabase: SupabaseClient, userId: string): Promise<Profile> {
    const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, role')
        .eq('id', userId)
        .single();

    if (error || !data) {
        throw new Error(`Errore leggendo il profilo per l'utente ${userId}: ${error?.message ?? 'nessuna riga restituita'}`);
    }

    const row = data as ProfileRow;
    return {
        id: row.id,
        firstName: row.first_name,
        lastName: row.last_name,
        role: row.role === 'admin' ? 'admin' : 'user',
    };
}

/**
 * Aggiorna nome/cognome — la RLS (`profiles_update_own_or_admin`) permette
 * già a un utente di modificare la propria riga; il trigger
 * `prevent_role_self_escalation` riguarda solo la colonna `role`, non tocca
 * questi campi.
 */
export async function updateProfileName(
    supabase: SupabaseClient,
    userId: string,
    params: { firstName: string; lastName: string },
): Promise<void> {
    const { error } = await supabase
        .from('profiles')
        .update({ first_name: params.firstName, last_name: params.lastName })
        .eq('id', userId);

    if (error) {
        throw new Error(`Errore aggiornando il profilo per l'utente ${userId}: ${error.message}`);
    }
}
