import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

// prefissi di route che richiedono una sessione attiva. Vuoto salvo il placeholder /admin:
// altre epiche (es. ADMIN-CONSOLE) aggiungono qui i propri prefissi quando arrivano.
const PROTECTED_PATH_PREFIXES = ['/admin'];

function isProtectedPath(pathname: string): boolean {
    return PROTECTED_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

// Client Supabase costruito qui e non riusando lib/supabase-server.ts: proxy.ts legge/scrive
// cookie tramite NextRequest/NextResponse, non tramite next/headers (disponibile solo in
// Server Component/Route Handler) — API diverse, non basta importare la funzione esistente.
export async function proxy(request: NextRequest) {
    let response = NextResponse.next({ request });

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error('Missing Supabase env vars in proxy.ts');
    }

    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
        cookies: {
            getAll() {
                return request.cookies.getAll();
            },
            setAll(cookiesToSet) {
                cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
                response = NextResponse.next({ request });
                cookiesToSet.forEach(({ name, value, options }) =>
                    response.cookies.set(name, value, options)
                );
            },
        },
    });

    // getUser() (non getSession()) valida il JWT contro il server Auth invece di fidarsi del
    // solo cookie locale — è il check server-side autoritativo, nessun bypass client-side.
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (isProtectedPath(request.nextUrl.pathname) && !user) {
        const loginUrl = new URL('/login', request.url);
        loginUrl.searchParams.set('redirect', request.nextUrl.pathname);
        return NextResponse.redirect(loginUrl);
    }

    return response;
}

export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
