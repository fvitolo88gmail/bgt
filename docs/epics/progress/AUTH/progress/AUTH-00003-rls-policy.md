# AUTH-00003 — RLS policy sulle tabelle utente-specifiche

**Stato:** in progress — migration scritta, da applicare e verificare

**Blocca:** AUTH-00001

## Task

Scrivi le RLS policy sulle tabelle utente-specifiche: accesso solo a `auth.uid() = user_id`,
eccezione per `role = 'admin'` dove serve.

## DoD

Query dirette su Supabase con utente non autorizzato non ritornano righe; test con due utenti
diversi confermano isolamento.

## Decisioni prese (v. D68)

- Accesso anonimo confermato per `games` con `visibility='shared'` e per la chat (nessun
  obbligo di login per l'uso base) — l'isolamento per-utente si applica solo a giochi privati e
  a sessioni chat con `user_id` valorizzato. `route protette` (AUTH-00004) è quindi un
  sottoinsieme delle route, non tutte.
- `user_id` (FK → `profiles(id)`, nullable, `on delete set null`) aggiunto solo su `games` e
  `chat_sessions` (proprietà diretta). `chunks`/`forum_threads`/`forum_posts` (via `games.game_id`)
  e `chat_messages` (via `chat_sessions.session_id`) restano senza colonna propria — policy con
  `exists` join.
- Scope ampliato oltre il testo originale del task: non solo scrittura delle policy ma anche
  aggiunta delle colonne `user_id` mancanti (nota lasciata in AUTH-00002).

## Migration

`supabase/migrations/20260729020000_rls_policies.sql` — RLS abilitata su `games`, `chunks`,
`forum_threads`, `forum_posts`, `chat_sessions`, `chat_messages`; policy per `profiles`
(deferred da AUTH-00001/D66); funzione `is_admin()` (security definer, riusata ovunque); trigger
`prevent_role_self_escalation` (un utente non può auto-promuoversi admin via update diretto).

**Da fare prima di applicare:** verificare in Supabase Studio che `games.visibility = 'shared'`
per Brass Birmingham e Hegemony (i due giochi in uso pubblico oggi) — l'app usa sempre la
chiave anon senza sessione, un game non-shared con `user_id` null diventerebbe invisibile a
chiunque dopo questa migration (`match_chunks` è `security invoker`, quindi eredita RLS —
nessun bypass silenzioso, ma nessun errore visibile: la chat tornerebbe "non trovato" su un
gioco che prima funzionava).

**Dopo l'applicazione, verifica manuale in Supabase Studio:**
1. Chat/retrieval sui giochi esistenti continua a funzionare (nessuna regressione anonima).
2. Due utenti autenticati diversi, ciascuno con un game privato proprio (`user_id` impostato a
   mano): ognuno vede solo il proprio in una query diretta, non quello dell'altro.
3. Un utente non-admin che prova `update profiles set role='admin' where id=auth.uid()` non
   riesce (il trigger riporta `role` al valore precedente).
