# progress.md

*Stato di avanzamento delle epiche. Aggiornato ad ogni cambio di stato di epica o task — vedi
`CLAUDE.md` per le regole di gestione (D56: epiche parallele, nomi parlanti, cartelle
todo/progress/done).*

## Epiche

| Epica | Directory | Stato |
|---|---|---|
| POC | `progress/POC/` | in corso (solo POC-00011 ancora aperto, in pausa; tutto il resto chiuso o deprecato) |
| AUTH | `progress/AUTH/` | in corso, priorità corrente (v. D65) — AUTH-00001/00003/00004/00005/00008 ✅ (00008: invito via email rimandato, processo manuale via Studio nel frattempo), AUTH-00002 chiusa non applicabile, AUTH-00010 aggiunta (SMTP, in attesa dominio), AUTH-00011 aggiunta (proxy esteso a tutta l'app, supera D68) e in verifica, prossimi: 00006/00007/00009 |
| BILLING | `progress/BILLING/` | in corso, BILLING-00001 in pausa in attesa di AUTH (v. D65) |
| TEACH | `todo/TEACH/` | da iniziare |
| VISUAL | `todo/VISUAL/` | nice to have, in coda |
| DESIGN | `done/DESIGN/` | completata (v. D64) |
| CHAT-LISTING | `todo/CHAT-LISTING/` | da iniziare |
| ADMIN-CONSOLE | `todo/ADMIN-CONSOLE/` | da iniziare |
| GAME-REQUEST | `todo/GAME-REQUEST/` | da iniziare, priorità molto bassa |
| EXPANSIONS | `progress/EXPANSIONS/` | in corso — EXPANSIONS-00001 in verifica (v. D75) |

## Priorità corrente

**POC-00014 — Chat multilingua** chiusa nella sostanza (v. D61): il corpo della risposta segue
correttamente la lingua della domanda, refactor `lib/prompt.ts` → `lib/prompt/` (shared + due
specializzazioni qa/conversation). Residuo aperto: **BUG-001** — traduzione incoerente delle
etichette di sezione manuale tra parentesi quadre nelle citazioni, quando la risposta non è in
italiano (v. `docs/bugs/BUG-001-traduzione-parziale-etichette-sezione.md`), accantonato dopo 4
tentativi di fix via prompt — probabile limite del modello, non di istruzioni mancanti. Esecuzione
di L3 (`eval/fixtures/hegemony-ambiguous-en.json`) ancora da fare in locale (sandbox non riesce a
tenere in vita `next dev`).

**POC-00017 — Restyling delle risposte** chiusa (v. D57, D58): eval `hegemony-ambiguous` dopo il
fix 18/20 (90%), in linea con baseline 005 — v. `progress/POC/done/POC-00017-restyling-risposte.md`.

**POC-00011 — Reranking e ricerca ibrida** (v. D49, D52) resta in pausa, non priorità assoluta
(v. D57) — resta comunque da chiudere (R2 full-text search, R3 traduzione query) quando si
riprende. Il primo sotto-step ha già risolto la regressione principale osservata ("Come guadagna
Legittimità la Classe Media?", D52/D53) — v.
`progress/POC/progress/POC-00011-reranking-ricerca-ibrida.md` per il dettaglio dei sotto-step.

**POC-00016 — Chat con contesto** chiusa (C1-C3 ✅; C4-C5 mai implementati lì, assorbiti da
`CHAT-LISTING-00004` e da una nota in `CHAT-LISTING-00002`/`-00003` — v. D59).

**Baseline 005 (2026-07-28, post-D53/D55):** eval `hegemony-ambiguous` 18/20 (90%), sopra
soglia — v. `docs/baselines/005-20260728-hegemony-ambiguous-gemini-3-1-flash-lite.json`. Eval
non va più in timeout (D55). 2 fallimenti residui, entrambi noti: heg-amb-01 (Legittimità
Classe Media — risposta ambigua invece di correggere con sicurezza) e heg-amb-08 (Prosperità
dello Stato — "non trovato" invece di correggere, v. D54, non un'allucinazione ma subottimale).
Non ancora affrontati in questa sessione.

**Nuove epiche (sessione 2026-07-28, D56):** aggiunte `AUTH` (access management, Supabase Auth +
RLS + OAuth Google) e `BILLING` (modello di costo e monetizzazione, con l'ex-epica "AI Provider
Adapters" ridotta a un singolo task BILLING-00008). Entrambe da iniziare, nessuna priorità
assegnata ancora rispetto a POC-00011/POC-00016.

**BILLING-00001 avviata (sessione 2026-07-29):** definito con Francesco lo schema di tracking
uso Gemini — due tabelle (`user_requests` per interazione utente, `gemini_calls` per singola
chiamata Gemini con FK a `user_requests`), non la tabella unica `usage_logs` originariamente
descritta nel task. `call_type` a 5 valori (`embedding`, `generation`,
`query_contextualization`, `query_enhancement`, `reranking`), uno per ogni chiamata reale nel
codice invece del bucket unico "expansion" del task originale — scelta esplicita di Francesco
per dare a BILLING-00003 visibilità sul costo per tecnica, non solo imbedding vs generazione.
Migration bozza (SQL ora in `BILLING-00001-usage-logs.md`, non più un file in
`supabase/migrations/`: rimosso il 2026-07-29 perché il suo timestamp precedeva quello di
`20260729010000_auth_profiles.sql`, creata dopo ma eseguita per prima — verrà ricreato con
timestamp aggiornato quando riprende questo task). Istrumentazione delle chiamate reali
(`lib/gemini.ts`, `lib/retrieval.ts`,
`lib/reranking.ts`, `lib/query-contextualization.ts`, `app/api/chat/route.ts`) messa in pausa
subito dopo (D65): userebbe `owner_token`, non ancora popolato e a rischio di essere sostituito
appena `AUTH` introduce autenticazione vera — priorità sposta su `AUTH` prima di riprendere.

**AUTH-00001 chiusa (sessione 2026-07-29):** aggiunto `@supabase/ssr`; `lib/supabase.ts` guadagna
`createBrowserSupabaseClient`/`createServerSupabaseClient` (cookie-based, riutilizzabili dal
middleware di AUTH-00004) accanto ai client esistenti, invariati. Migration
`20260729010000_auth_profiles.sql` (enum `user_role`, tabella `profiles` 1:1 `auth.users`, RLS
abilitata senza policy — deferred ad AUTH-00003 — trigger `handle_new_user`) applicata al DB da
Francesco; DoD verificato manualmente in Supabase Studio (utente di test → riga `profiles`
auto-creata) — v. D66. Email advisory Supabase (`rls_disabled_in_public` su `games`/`chunks`/
`forum_threads`/`forum_posts`/`chat_sessions`/`chat_messages`) è il gap noto che AUTH-00003 chiude
— nessuna azione fuori sequenza, confermato da Francesco.

**AUTH-00002 chiusa, non applicabile (sessione 2026-07-29):** verificato che `owner_token` non è
mai stato popolato in produzione (nessun riferimento in `app/`/`lib/`/`components/`, `lib/owner-
token.ts` vuoto — D43, D65) — nessuna conversazione legacy da collegare al login, il task come
scritto non ha nulla da fare. Chiusa senza implementazione — v. D67.

**AUTH-00003 avviata (sessione 2026-07-29):** confermato con Francesco che l'accesso anonimo
resta per `games` `shared` e per la chat — login richiesto solo per giochi privati e funzioni
admin, coerente con D05 (MVP a basso attrito) e con "route protette" (AUTH-00004, sottoinsieme
delle route). Migration `20260729020000_rls_policies.sql`: `user_id` aggiunto su `games`/
`chat_sessions` (proprietà diretta); `chunks`/`forum_threads`/`forum_posts`/`chat_messages`
restano senza colonna propria, policy con `exists` join sulla tabella padre; funzione `is_admin()`
riusabile; trigger anti-auto-promozione su `profiles.role`. Non ancora applicata al DB — v. D68 e
`progress/AUTH-00003-rls-policy.md` per il pre-flight check obbligatorio (`games.visibility`) e i
passi di verifica manuale. **Chiusa (2026-07-29):** DoD verificato manualmente in SQL Editor
(impersonazione via `set_config('request.jwt.claims', ...)`) — chat sui giochi esistenti ok,
isolamento tra due utenti confermato (A vede il proprio game privato, B zero righe), self-role-
escalation bloccata. Resta da fare (non bloccante): rimuovere il game di test creato per la
verifica.

**AUTH-00004 avviata (sessione 2026-07-29):** `proxy.ts` (non `middleware.ts` — Next.js 16 l'ha
deprecato/rinominato, scoperto solo con `npm run build`, non con `tsc`; un `middleware.ts`
residuo verrebbe ignorato in build senza errore — v. D71): rinfresca la sessione ad ogni
richiesta (`getUser()`, validazione server-side) e redirige a `/login` per path sotto
`/admin` (placeholder creato solo per avere un caso concreto — nessuna route esistente richiede
login oggi, D68). **Chiusa:** verifica manuale confermata da Francesco (redirect su `/admin`,
route pubbliche invariate).

**AUTH-00008 chiusa, con eccezione nota (sessione 2026-07-30):** migration `invite_requests` +
prima applicazione della convenzione repository/controller per codice nuovo
(`lib/repositories/invite-requests.repository.ts`, `app/api/invite-requests/route.ts`, D72) +
form pubblico `/request-invite`. Verificato: signup pubblico bloccato (`signup_disabled`),
richiesta via form confermata in `invite_requests`. Non verificato: invito email end-to-end —
il servizio SMTP built-in Supabase non è utilizzabile in pratica (2 email/ora, invia solo a
membri del team del progetto, v. D73); servirebbe SMTP custom (Resend) + un dominio di
proprietà, il cui acquisto Francesco ha deciso esplicitamente di rimandare. Processo interinale
deciso: inviti gestiti a mano via Studio ("Create new user", non manda email, nessun rate limit)
invece del meccanismo email nativo. Chiarito che il form
richiesta-invito è scope di questo task, non di AUTH-00005 (che diventa "accetta invito + login
+ logout", da fare dopo).

**AUTH-00005 avviata (sessione 2026-07-30):** scope confermato da Francesco — solo "login +
stato sessione + logout" ora, "accetta invito" (impostare password dal link email) rimandato ad
AUTH-00010 insieme all'SMTP, dato che nel frattempo gli account si creano a mano via Studio.
`components/auth/LoginForm.tsx` + `app/login/page.tsx` (signIn via `@supabase/ssr`, redirect
`?redirect=`), `components/auth/LogoutButton.tsx`, `components/ui/Header.tsx` convertito a
Server Component `async` (mostra email/logout o link "Accedi"). `tsc`/`lint`/`build` puliti.
**Chiusa:** verifica manuale confermata da Francesco (login/logout con utente creato via Studio,
header mostra l'email).

**AUTH-00011 aggiunta (sessione 2026-07-30):** dopo aver verificato AUTH-00005, Francesco ha
chiesto che l'intera app richieda sessione, non solo `/admin` (AUTH-00004). `proxy.ts` invertito
da allowlist-route-protette ad allowlist-route-pubbliche (`/login`, `/request-invite`,
`/api/invite-requests`); API non pubbliche rispondono 401 JSON, pagine rimandano a `/login`.
Supera D68 solo per la protezione delle route — le RLS con accesso anonimo (AUTH-00003) restano
invariate come difesa in profondità, non toccato lo schema DB. `tsc`/`lint`/`build` puliti, in
attesa di verifica manuale (richiede riavvio dev server) — v. D74.

**AUTH-00008/00009 aggiunte (sessione 2026-07-29):** Francesco vuole evitare registrazioni
indiscriminate se l'app circola tra amici. Invito nativo Supabase (signup pubblico disabilitato
via config, `inviteUserByEmail`/Studio per invitare) preceduto da richiesta esplicita
(`invite_requests`) invece di approvazione post-signup — evita utenti "pending" in limbo e non
richiede una UI admin per essere usabile da subito (basta Supabase Studio). Stato
`enabled`/`disabled` su `profiles` (00009) resta separato, per revocare accesso a un utente già
invitato — v. D70.

**Nuove epiche (sessione 2026-07-28, seconda tranche):** aggiunte `DESIGN` (tema, palette,
generalizzazione componenti UI base — copre `POC-00015`, ora deprecata come superseded, v. D63),
`CHAT-LISTING`
(sidebar conversazioni + limite risposte configurabile — dipende dal modello dati di
`POC-00016`) e `ADMIN-CONSOLE` (gestione stato giochi, wizard ingest, UI diagnostica — dipende
da `AUTH-00001`, sovrappone `BILLING-00002`). Tutte da iniziare, nessuna priorità assegnata.

**Epica DESIGN completata (sessione 2026-07-29):** tema/palette "Ludico Vivace" formalizzato in
`app/theme.css` (DESIGN-00001, D64), componenti base in `components/ui/` (Button, Input, Select,
Badge, Card, Header, Footer, Modal, OwlMark — DESIGN-00002), applicati a tutte le pagine esistenti
(home, chat, citazioni — DESIGN-00003). `Modal` pronto ma non ancora agganciato a nessuna
schermata; nessuna pagina login/admin esiste ancora nel codice (solo nel mockup di riferimento).

**Epica EXPANSIONS aggiunta (sessione 2026-07-30):** nata durante l'ingest di SETI (espansione
Space Agencies) — Francesco ha chiesto di evitare che il retrieval consideri sempre valide le
regole di un'espansione anche quando si gioca solo la base. `games.base_game_id`
(self-referencing FK nullable) invece di un tag su `chunks` (v. D75): ogni espansione resta una
riga `games` a sé con proprio `bgg_id`/`manual_ready`/`visibility`; `match_chunks`/
`lib/retrieval.ts`/`/api/chat` accettano un insieme di game_id; toggle in `/game/[id]` per
attivare le espansioni collegate, non selezionate di default. Codice completo, `tsc`/`lint`
puliti — **in verifica**: migration da applicare e ingest di SETI (base + espansione) da fare in
locale, non ancora testato end-to-end.

## Note aperte

- Brass Birmingham rimosso dal DB (manuale + forum) in attesa di un re-ingest migliorato dopo
  la correzione di `games.bgg_id` — v. `progress/POC/done/POC-00006-forum-bgg.md`. Non ancora
  pianificato come task.
- Limite di retrieval emerso dall'eval Hegemony (`heg-09`, v.
  `progress/POC/done/POC-00006-forum-bgg.md`): quando due thread genuini coprono lo stesso argomento con
  angolazioni diverse (regola generale vs eccezione di una carta specifica), il retrieval può
  portare in contesto solo il più generico. Da valutare in POC-00011 (topK più alto su query
  specifiche, o query rewriting mirato).
- Baseline eval 003 (impatto D21) resta deferred — v. `progress/POC/done/POC-00002-eval-harness.md` e
  `docs/baselines/`.
- Upgrade Tier 1 Gemini (a pagamento): dati di prezzo raccolti (embedding $0.15/1M token,
  generazione $0.25/$1.50 per 1M input/output), deciso di rimandare finché non si valida
  l'ingest su un secondo gioco oltre Brass. Potrebbe ridurre l'urgenza di BILLING-00007 (BYOK)
  se il tetto RPD condiviso smette di essere un vincolo reale.
- POC-00013 (Fase 3 continua) chiusa — v. `progress/POC/done/POC-00013-fase3-continua.md` e D60
  (S3.2 de facto, S3.3/S3.5 riassegnati ad `ADMIN-CONSOLE-00004`/`-00005`, S3.7 a
  `GAME-REQUEST-00001`).
- Puntatore a `todo/VISUAL/todo/VISUAL-00001-scoping-approccio.md` — nice to have, in coda dopo TEACH.
- POC-00012 (Link BGG citazioni) chiusa — v. `progress/POC/done/POC-00012-link-bgg-citazioni.md`.
- Nota su D32 (prompt: non introdurre argomenti non richiesti): verificato su un caso concreto,
  da ri-controllare con un eval completo quando si riprende il lavoro — potrebbe migliorare
  ulteriormente heg-amb-01/08.
