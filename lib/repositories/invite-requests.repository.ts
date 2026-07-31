import { supabase } from '@/lib/supabase';

export class InviteRequestError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'InviteRequestError';
    }
}

export interface InviteRequestInput {
    email: string;
    firstName: string;
    lastName: string;
    message: string | null;
}

/**
 * Salva una richiesta di accesso — nessuna verifica di merito qui (la fa l'admin
 * a mano in Supabase Studio prima di invitare). RLS su invite_requests permette
 * l'insert a chiunque, quindi funziona anche con la chiave anon lato client.
 * Nome/cognome: l'admin che rivede la coda sa a chi sta per inviare
 * l'invito, non solo l'indirizzo email.
 */
export async function createInviteRequest(params: InviteRequestInput): Promise<void> {
    const { error } = await supabase.from('invite_requests').insert({
        email: params.email,
        first_name: params.firstName,
        last_name: params.lastName,
        message: params.message,
    });

    if (error) {
        throw new InviteRequestError(`Errore salvando la richiesta di invito per ${params.email}: ${error.message}`);
    }
}
