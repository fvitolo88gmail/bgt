import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL');
if (!supabaseAnonKey) throw new Error('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY');

// client anonimo senza sessione — retrieval/chat pubblici, non autenticati (uso esistente)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export function createServiceClient() {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');
    // supabaseUrl è già validato sopra, il cast è sicuro
    return createClient(supabaseUrl as string, serviceRoleKey);
}

// client con sessione via cookie, per Client Component (form login/logout). Istanza singola
// riusata in tutta l'app: creare un GoTrueClient nuovo a ogni chiamata sulla stessa storage key
// produce "undefined behavior" (warning esplicito della libreria).
let browserSupabaseClient: SupabaseClient | undefined;

export function createBrowserSupabaseClient() {
    if (!browserSupabaseClient) {
        browserSupabaseClient = createBrowserClient(supabaseUrl as string, supabaseAnonKey as string);
    }
    return browserSupabaseClient;
}