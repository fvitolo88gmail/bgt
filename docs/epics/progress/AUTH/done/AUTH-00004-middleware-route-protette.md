# AUTH-00004 — Middleware Next.js per route protette

**Stato:** done

**Blocca:** AUTH-00001

## Task

Middleware Next.js (App Router) per proteggere le route server-side che richiedono sessione
attiva.

## DoD

Route protette rispondono 401/redirect a login se non autenticato; nessun bypass client-side.

## Decisioni prese

Oggi non esiste ancora nessuna route che richieda login (`/home`/`/game/[id]`/`/api/chat`
restano pubbliche per D68) — creata `app/admin/page.tsx` come placeholder solo per avere un
caso concreto da proteggere/testare, in attesa di ADMIN-CONSOLE. `/home`/`/game/[id]`/
`/api/chat` **non** sono state toccate.

## Implementazione

`proxy.ts` (non `middleware.ts` — Next.js 16 l'ha deprecato/rinominato, v. D71):
- rinfresca la sessione ad ogni richiesta (`supabase.auth.getUser()`, non `getSession()` — valida
  il JWT contro il server Auth invece di fidarsi del solo cookie, check autoritativo server-side)
- se il path inizia per un prefisso in `PROTECTED_PATH_PREFIXES` (oggi solo `/admin`) e non c'è
  utente autenticato, redirect a `/login?redirect=<path>` — `/login` non esiste ancora
  (AUTH-00005), il redirect è comunque la prova che la protezione scatta
- verificato con `npm run build` completo (Turbopack), non solo `tsc --noEmit`

## Verifica (2026-07-29)

Confermato da Francesco: `/admin` senza sessione redirige correttamente, `/home`/`/game/[id]`/
`/api/chat` restano accessibili senza login. DoD soddisfatto.
