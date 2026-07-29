import { createClient } from '@supabase/supabase-js';
import { createBrowserClient, createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

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

// client con sessione via cookie, per Client Component (form login/signup, AUTH-00005)
export function createBrowserSupabaseClient() {
    return createBrowserClient(supabaseUrl as string, supabaseAnonKey as string);
}

// client con sessione via cookie, per Server Component/Route Handler/middleware (AUTH-00004)
export async function createServerSupabaseClient() {
    const cookieStore = await cookies();
    return createServerClient(supabaseUrl as string, supabaseAnonKey as string, {
        cookies: {
            getAll() {
                return cookieStore.getAll();
            },
            setAll(cookiesToSet) {
                try {
                    cookiesToSet.forEach(({ name, value, options }) =>
                        cookieStore.set(name, value, options)
                    );
                } catch {
                    // setAll chiamato da un Server Component non può scrivere cookie —
                    // va bene se la sessione viene comunque rinfrescata dal middleware (AUTH-00004)
                }
            },
        },
    });
}