# BUG-002 — Login bloccato in caricamento su mobile

**Stato:** risolto
**Emerso in:** uso reale post AUTH-00005/AUTH-00011, sessione 2026-07-30

## Sintomo

Da cellulare, dopo aver inserito email e password, a volte il bottone resta su "Accesso..." a
tempo indeterminato e la home non si renderizza mai. Nessun log anomalo su Vercel.

## Causa

`components/auth/LoginForm.tsx` chiamava `supabase.auth.signInWithPassword` senza `try/catch`.
Su una connessione mobile instabile, una fetch fallita può far lanciare un'eccezione invece di
restituire `{ error }` (comportamento diverso da un errore applicativo tipo credenziali errate).
L'eccezione non gestita interrompeva `handleSubmit` prima di `setSubmitting(false)`, lasciando il
bottone bloccato. Essendo una chiamata diretta al client Supabase lato browser, il fallimento non
tocca mai il backend — coerente con l'assenza di log su Vercel.

## Fix (v1)

Aggiunto `try/catch` attorno alla chiamata: in caso di eccezione, mostra "Connessione assente o
instabile. Riprova." e resetta sempre `submitting`. Verificato `tsc`/`lint` puliti.

## Riapparso dopo il fix v1 (stessa sessione)

Riprodotto di nuovo (login manuale → salvataggio credenziali via Google Password Manager →
logout → login da credenziali salvate), stesso sintomo, ancora zero log. Il `try/catch` da solo
non basta: una fetch su mobile può restare **sospesa indefinitamente** (né risolta né rifiutata),
tipicamente per un cambio di rete/segnale a metà richiesta — non c'è eccezione da catturare, la
funzione resta in attesa per sempre.

## Fix (v2)

Aggiunto un timeout esplicito (`withTimeout`, 15s) attorno a `signInWithPassword`: se il timeout
scade prima che la promise si risolva, la UI si sblocca comunque con un messaggio dedicato ("La
richiesta sta impiegando troppo tempo. Controlla la connessione e riprova."). Nota: se la
richiesta originale poi va comunque a buon fine in background dopo il timeout, un secondo
tentativo dell'utente risulterà comunque valido (sessione già stabilita) — nessun effetto
collaterale dannoso. Verificato `tsc`/`lint` puliti.

## Indagine causa profonda (stessa sessione)

Ipotesi iniziale: deadlock noto di `supabase-js`/`@supabase/ssr` sulla Web Locks API del browser
(`navigator.locks`) — un lock orfano da un'operazione precedente blocca le chiamate auth
successive **senza nemmeno emettere una richiesta di rete**, coerente con l'assenza di log.
Verificato leggendo il sorgente installato (`@supabase/auth-js` 2.111.0, in `node_modules`): in
questa versione la libreria ha **già rimosso `navigator.locks` di default** (migrazione a
"lockless coordination") — questo meccanismo specifico è escluso.

Trovato invece, sempre leggendo il sorgente: il costruttore del client stampa un warning quando
viene creata più di un'istanza `GoTrueClient` nello stesso browser sulla stessa storage key —
*"may produce undefined behavior when used concurrently under the same storage key"*.
`createBrowserSupabaseClient()` (`lib/supabase.ts`) era una funzione factory che creava
un'istanza **nuova a ogni chiamata** (in `LoginForm` e `LogoutButton`), invece della singola
istanza riusata che Supabase raccomanda — esposizione concreta a comportamento non definito su
quella storage key, più plausibile di una generica instabilità di rete.

## Fix (v3)

`createBrowserSupabaseClient()` ora è un singleton: la prima chiamata crea l'istanza, le
successive riusano la stessa. Nessun cambiamento per i chiamanti (`LoginForm`, `LogoutButton`).
Verificato `tsc`/`lint`/`build` puliti.

## Riapparso in altra forma (stessa sessione)

Nuovo sintomo, causa diversa: `signInWithPassword` va a buon fine (sessione creata, confermato
ricaricando la pagina), ma `router.push(redirectTo)` + `router.refresh()` — navigazione soft
lato client, fetch del payload RSC — resta anch'essa sospesa sulle stesse condizioni di rete
mobile, lasciando la UI ferma sul login pur essendo già autenticati.

## Fix (v4)

Sostituito `router.push`/`router.refresh()` con un redirect pieno (`window.location.href`) in
`LoginForm.tsx` e `LogoutButton.tsx`: forza un nuovo request al server con i cookie appena
scritti, bypassando il router client-side di Next.js e la sua fetch RSC. Verificato
`tsc`/`lint`/`build` puliti.
