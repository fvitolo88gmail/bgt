import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

// tutto richiede sessione tranne queste route — l'app non ammette uso anonimo, la registrazione
// è solo su invito.
const PUBLIC_PATH_PREFIXES = ['/login', '/request-invite', '/api/invite-requests'];

function isPublicPath(pathname: string): boolean {
    return PUBLIC_PATH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
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

    if (!isPublicPath(request.nextUrl.pathname) && !user) {
        // un fetch non gestisce bene un redirect verso una pagina HTML: le API rispondono 401,
        // le pagine vengono rimandate al login (con redirect di ritorno)
        if (request.nextUrl.pathname.startsWith('/api/')) {
            return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });
        }
        const loginUrl = new URL('/login', request.url);
        loginUrl.searchParams.set('redirect', request.nextUrl.pathname);
        return NextResponse.redirect(loginUrl);
    }

    // sessione già attiva: /login non ha senso, evita di far ripassare l'utente dal form
    if (request.nextUrl.pathname === '/login' && user) {
        return NextResponse.redirect(new URL('/home', request.url));
    }

    return response;
}

export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
