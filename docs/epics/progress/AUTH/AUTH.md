# Epica AUTH — Access management

**Stato:** in corso

## Contesto

Migrazione dal modello no-auth (`owner_token` UUID) a utenze reali con login e ruoli, tramite
Supabase Auth.

**Decisioni:**
- Nessun multitenant a schema: tabella unica con `user_id`/`owner_id` + RLS
- Enforcement dei permessi a livello DB (Row Level Security), non solo applicativo
- OAuth (Google) è story finale **obbligatoria** di questa epica, non opzionale

## Task

Vedi directory `AUTH/` per i task singoli.

| ID | Titolo | Stato |
|---|---|---|
| AUTH-00001 | Supabase Auth + tabella `profiles` | ✅ done |
| AUTH-00002 | Migrazione soft da `owner_token` a `user_id` | ⏭️ chiuso, non applicabile |
| AUTH-00003 | RLS policy sulle tabelle utente-specifiche | ✅ done |
| AUTH-00004 | Middleware Next.js per route protette | ✅ done |
| AUTH-00005 | UI minima login/logout | ✅ done |
| AUTH-00006 | Deprecazione formale di `owner_token` | todo |
| AUTH-00007 | OAuth Google (finale, obbligatoria) | todo |
| AUTH-00008 | Registrazione solo su invito | ✅ done (eccezione nota) |
| AUTH-00009 | Stato utente enabled/disabled | todo |
| AUTH-00010 | Configurazione SMTP custom (Resend) | todo — in attesa dominio |

## Note aperte

- Ruoli custom/permessi granulari (tabella `roles`/`user_roles` many-to-many) non necessari
  per ora: `role` enum su `profiles` è sufficiente per lo scope attuale.
- AUTH-00001 chiusa: migration `20260729010000_auth_profiles.sql` applicata al DB, DoD verificato
  manualmente in Supabase Studio (utente di test → riga `profiles` auto-creata, `role='user'`) —
  v. `done/AUTH-00001-supabase-auth-profiles.md` e D66.
- Email advisory Supabase (26/07/2026, `rls_disabled_in_public`) segnala `games`/`chunks`/
  `forum_threads`/`forum_posts`/`chat_sessions`/`chat_messages` senza RLS — gap noto, atteso, si
  chiude ad AUTH-00003. Nessuna azione fuori sequenza decisa esplicitamente da Francesco. Nota
  per quando si arriva ad AUTH-00003: `chunks`/`forum_threads`/`forum_posts` non hanno una
  colonna utente propria, l'ownership è ereditata da `games` via `game_id` — le policy lì
  richiedono un `exists` join su `games`, non un confronto diretto `auth.uid() = user_id` come
  scritto oggi nel task.
- AUTH-00002 chiusa senza implementazione: `owner_token` non è mai stato popolato in produzione
  (D43, D65, verificato via grep — v. `done/AUTH-00002-migrazione-owner-token.md`), nessuna
  conversazione legacy da collegare al login — v. D67.
- AUTH-00003 avviata: confermato con Francesco che l'accesso anonimo resta per `games`
  `shared` e per la chat (nessun login obbligatorio per l'uso base); `user_id` aggiunto solo su
  `games`/`chat_sessions`, le tabelle derivate (`chunks`/`forum_threads`/`forum_posts`/
  `chat_messages`) usano policy con `exists` join, nessuna colonna propria — v. D68 e
  `done/AUTH-00003-rls-policy.md` per i dettagli. Migration applicata, DoD verificato
  manualmente (chat su giochi esistenti ok, isolamento tra due utenti confermato, self-role-
  escalation bloccata) — task chiuso. Nota tecnica lasciata nel file: l'SQL Editor di Supabase
  Studio mostra solo il risultato del primo statement quando ce ne sono più con output nello
  stesso script — per isolare il risultato che interessa, l'impostazione del JWT va in un
  blocco `do $$ ... perform set_config(...); end $$;`. Resta da fare (non bloccante): rimuovere
  la riga `games` "Test Privato" creata per il test.
- AUTH-00008/00009 aggiunte (sessione 2026-07-29): Francesco vuole evitare registrazioni
  indiscriminate se l'app circola. Scartata l'approvazione post-signup (crea utenti "pending" in
  limbo, serve una coda da controllare + UI admin per essere davvero usabile) a favore di
  invito nativo Supabase (`Authentication → Users → Invite` / `inviteUserByEmail`, signup
  pubblico disabilitato via config progetto) preceduto da una richiesta esplicita
  (`invite_requests`, chiunque inserisce, solo admin legge) — v. D70. Stato `enabled`/`disabled`
  (AUTH-00009) resta comunque utile indipendentemente dal gate, per revocare accesso a un utente
  già invitato.
- Nota di sequenza (chiarita): il form "richiedi invito" è parte di AUTH-00008 stesso (necessario
  al suo DoD), non di AUTH-00005. AUTH-00005 resta comunque necessaria — diventa "accetta invito
  (imposta password dopo il link email) + login + logout" invece di "signup libero + login +
  logout" — va affrontata dopo AUTH-00008, non prima, altrimenti si costruirebbe un form di
  signup libero poi da buttare.
- AUTH-00008 chiusa con eccezione nota: migration `20260730000000_invite_requests.sql` (enum
  `invite_request_status`, tabella `invite_requests`, RLS insert-chiunque/select-update-admin),
  `lib/repositories/invite-requests.repository.ts` + `app/api/invite-requests/route.ts` (prima
  applicazione della convenzione repository/controller per codice nuovo, v. D72),
  `app/request-invite/page.tsx` + `components/invite/RequestInviteForm.tsx`. Verificato: signup
  pubblico bloccato (`signup_disabled` via curl diretto), richiesta via form confermata in
  `invite_requests`. **Non verificato:** l'invito via email nativo Supabase — il servizio SMTP
  built-in invia solo a indirizzi già membri del team del progetto e ha un limite di 2 email/ora,
  inadatto all'uso reale (v. D73). SMTP custom (Resend) richiede un dominio di proprietà —
  acquisto rimandato su decisione esplicita di Francesco. V.
  `done/AUTH-00008-registrazione-solo-invito.md`.
- **Processo attuale per invitare, finché non c'è un dominio:** niente email — Francesco crea
  l'utente a mano in Studio (Authentication → Users → Add user → **Create new user**, con "Auto
  Confirm User" spuntato) e comunica email/password fuori dall'app. Verificato che "Create new
  user" non manda email (endpoint admin diretto, diverso da "Invite user") — non soggetto al
  rate limit né alla restrizione "solo membri del team". Password temporanea, l'utente potrà
  cambiarla quando AUTH-00005 esiste.
- AUTH-00004 avviata: nessuna route esistente richiede login oggi (D68) — creato `app/admin/
  page.tsx` come placeholder solo per avere un caso concreto da proteggere, `/home`/`/game/[id]`/
  `/api/chat` non toccate. Scoperto durante `npm run build` che Next.js 16 ha deprecato
  `middleware.ts` in favore di `proxy.ts` (un `middleware.ts` lasciato lì viene ignorato in
  build senza errore — protezione silenziosamente non funzionante) — v. D71 e
  `done/AUTH-00004-middleware-route-protette.md`. Verifica manuale confermata da Francesco:
  `/admin` redirige senza sessione, `/home`/`/game/[id]`/`/api/chat` restano pubbliche — task
  chiuso.
- AUTH-00005 avviata: scope ridotto a "login + stato sessione + logout" (niente signup, mai
  esistito con AUTH-00008; niente "accetta invito", rimandato ad AUTH-00010) — scelta confermata
  da Francesco. Implementati `components/auth/LoginForm.tsx` (client, `signInWithPassword`,
  redirect via `?redirect=`), `app/login/page.tsx`, `components/auth/LogoutButton.tsx`, e
  `components/ui/Header.tsx` convertito a Server Component `async` che legge la sessione con
  `createServerSupabaseClient()`. Verificato `tsc`/`lint`/`build` puliti. **Chiusa:** verifica
  manuale confermata da Francesco (login/logout con utente creato via Studio, header mostra
  l'email) — v. `done/AUTH-00005-ui-login-signup-logout.md`.
