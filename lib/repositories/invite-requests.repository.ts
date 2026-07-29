import { supabase } from '@/lib/supabase';

export class InviteRequestError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'InviteRequestError';
    }
}

/**
 * Salva una richiesta di accesso — nessuna verifica di merito qui (la fa l'admin
 * a mano in Supabase Studio prima di invitare). RLS su invite_requests permette
 * l'insert a chiunque, quindi funziona anche con la chiave anon lato client.
 */
export async function createInviteRequest(email: string, message: string | null): Promise<void> {
    const { error } = await supabase.from('invite_requests').insert({ email, message });

    if (error) {
        throw new InviteRequestError(`Errore salvando la richiesta di invito per ${email}: ${error.message}`);
    }
}
