// Server-only: usa next/headers, che rompe la build se importato (anche solo transitivamente)
// da un Client Component. Mai importare questo file da codice con 'use client' in testa —
// per quello c'è createBrowserSupabaseClient in lib/supabase.ts.
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL');
if (!supabaseAnonKey) throw new Error('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY');

// client con sessione via cookie, per Server Component/Route Handler/middleware (AUTH-00004)
export async function createServerSupabaseClient() {
    const cookieStore = await cookies();
    // supabaseUrl/supabaseAnonKey già validati sopra, il cast è sicuro
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
