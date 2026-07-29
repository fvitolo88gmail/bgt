# AUTH-00005 — UI minima login/logout

**Stato:** ✅ done

**Blocca:** AUTH-00001

## Task

UI minima: pagina login, stato sessione visibile, logout.

**Nota di scope:** la story originale includeva anche "signup". Con AUTH-00008 (registrazione
solo su invito) il signup libero non esiste più; l'accettazione di un invito (impostare la
password dal link email) è rimandata ad AUTH-00010, quando sarà attivo l'SMTP custom — nel
frattempo l'accesso viene creato a mano in Supabase Studio ("Create new user", v. `AUTH.md`).
Scelta confermata da Francesco: *"Solo login/logout ora, accetta-invito con AUTH-00010"*.

## Implementazione

- `components/auth/LoginForm.tsx` — client component, `signInWithPassword` via
  `createBrowserSupabaseClient`, legge `?redirect=` dalla query string, redirect + `router.refresh()`
  al successo, messaggio generico "Email o password non corretti." al fallimento (nessuna
  distinzione tra utente inesistente/password errata, per non far enumerare le email).
- `app/login/page.tsx` — wrapper server; `<LoginForm />` è avvolto in `<Suspense>` perché usa
  `useSearchParams`.
- `components/auth/LogoutButton.tsx` — client component, `signOut()` poi redirect a `/home` +
  `router.refresh()`.
- `components/ui/Header.tsx` — da funzione statica a Server Component `async`: legge la sessione
  con `createServerSupabaseClient()` + `getUser()` (da `lib/supabase-server.ts`), mostra
  email utente + `LogoutButton` se loggato, altrimenti link "Accedi" a `/login`. Nessuna modifica
  richiesta ad `app/layout.tsx` (già renderizzava `<Header />` come componente).

## DoD

Flusso completo testabile in locale end-to-end.

**Verificato (tsc/lint/build):** `npx tsc --noEmit` pulito, `npm run lint` pulito (stessi 2
warning preesistenti non correlati in `scripts/manual/`), `npm run build` pulito (unico errore è
il fetch di Google Fonts bloccato dall'allowlist di rete del sandbox, non correlato al codice).

**Verificato manualmente da Francesco:** login su `/login` con utente creato via Studio, header
mostra l'email, "Esci" riporta allo stato sloggato. Task chiuso.
