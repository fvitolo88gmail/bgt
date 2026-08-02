# progress.md

*Stato di avanzamento delle epiche. Aggiornato ad ogni cambio di stato di epica o task — vedi
`CLAUDE.md` per le regole di gestione (D56: epiche parallele, nomi parlanti, cartelle
todo/progress/done).*

## Epiche

| Epica | Directory | Stato |
|---|---|---|
| POC | `progress/POC/` | in corso (solo POC-00011 ancora aperto, in pausa; tutto il resto chiuso o deprecato) |
| AUTH | `progress/AUTH/` | in corso, priorità corrente (v. D65) — AUTH-00001/00003/00004/00005/00006/00008/00011 ✅ (00008: invito via email rimandato, processo manuale via Studio nel frattempo), AUTH-00002 chiusa non applicabile, AUTH-00012 ✅ (redirect /login se già loggato + logout per inattività), prossimi: 00007/00009/00010 (00010 in attesa dominio) |
| BILLING | `todo/BILLING/` | in pausa — BILLING-00001/00002/00009 ✅ done, prossimo BILLING-00003 in attesa raccolta dati reali |
| TEACH | `todo/TEACH/` | da iniziare |
| VISUAL | `todo/VISUAL/` | nice to have, in coda |
| DESIGN | `done/DESIGN/` | ✅ completata — DESIGN-00004 chiusa, verifica manuale confermata |
| CHAT-LISTING | `todo/CHAT-LISTING/` | da iniziare |
| ADMIN-CONSOLE | `todo/ADMIN-CONSOLE/` | da iniziare |
| GAME-REQUEST | `todo/GAME-REQUEST/` | da iniziare, priorità molto bassa |
| EXPANSIONS | `done/EXPANSIONS/` | ✅ completata — EXPANSIONS-00001 chiusa, verifica manuale confermata (v. D75) |

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
`20260729010000_auth_profiles.sql`, creata dopo ma eseguita per prima). Istrumentazione delle
chiamate reali messa in pausa subito dopo (D65): userebbe `owner_token`, non ancora popolato e a
rischio di essere sostituito appena `AUTH` introduce autenticazione vera — priorità sposta su
`AUTH` prima di riprendere.

**BILLING-00001 ripresa (sessione 2026-07-31, AUTH sostanzialmente chiusa):** schema aggiornato
per riflettere l'auth reale — `owner_token` rimosso dal design (deprecato in via definitiva da
AUTH-00006), `user_id` referenzia `profiles(id)` come già `games`/`chat_sessions`. Migration
ricreata con timestamp aggiornato: `supabase/migrations/20260731000000_usage_tracking.sql`
(aggiunta anche RLS admin-only su entrambe le tabelle, coerente col principio di enforcement a
livello DB già seguito da AUTH), non ancora applicata al DB. Gap emerso: `app/api/chat/route.ts`
usa ancora il client Supabase anonimo, non risolve mai l'utente autenticato lato server nonostante
`proxy.ts` garantisca sessione valida (AUTH-00011) — `chat_sessions.user_id` di conseguenza non è
mai popolato da `getOrCreateSession`. Gap preesistente più ampio di questo task; per il DoD di
BILLING-00001 basta risolvere l'utente dentro `route.ts`, senza necessariamente sistemare
`getOrCreateSession` (valutare come task a parte se serve altrove).

**BILLING-00001 istrumentazione completata (sessione 2026-07-31):** scelto wrapper centralizzato
in `lib/gemini.ts` (Francesco, tra le due opzioni proposte) invece di logging esplicito per call
site. `embed`/`generate` accettano un `GeminiCallContext` opzionale e loggano internamente via
il nuovo `lib/repositories/usage-tracking.repository.ts` (convenzione repository di D72,
sempre `createServiceClient()`); `withGeminiRetry` ora espone il retry_count reale anche su
esito di errore (`GeminiRetryError`). `userRequestId` propagato attraverso
`lib/retrieval.ts`/`lib/reranking.ts`/`lib/query-contextualization.ts` fino a
`app/api/chat/route.ts`, che ora risolve anche l'utente autenticato via
`createServerSupabaseClient()` (colmato il gap segnalato sopra, limitatamente a questa route —
`getOrCreateSession`/`chat_sessions.user_id` restano non toccati, fuori scope). Token count
embedding stimati (caratteri/4): l'API `embedContent` con chiave AI Studio non restituisce un
conteggio reale. `tsc`/`eslint` puliti; `npm run build` non eseguibile in sandbox (nessun
accesso di rete a Google Fonts, non collegato a queste modifiche).

**Prezzi in tabella `model_pricing` con periodo di validità (sessione 2026-07-31, su richiesta
di Francesco):** invece di congelare prezzo/costo su ogni riga `gemini_calls` (nessun modo di
correggerlo se un aggiornamento prezzo viene scoperto in ritardo, e nessuna API ufficiale Gemini
per recuperare i prezzi automaticamente), `gemini_calls` registra solo i token; il costo si
legge a runtime dalla vista `gemini_calls_costed`, join con la nuova tabella `model_pricing`
(model_name, prezzi, `effective_from`/`effective_to`) sul periodo in vigore alla data della
chiamata — un prezzo corretto a posteriori (nuovo periodo inserito) ricalcola anche lo storico.
Aggiornare un prezzo resta un processo manuale via Studio (chiudere il periodo aperto, inserire
il nuovo), stesso pattern interinale già usato da AUTH. Migration riscritta in place (non ancora
applicata quando modificata), poi Francesco ha ripulito con uno script `drop` mirato la versione
precedente già lanciata per errore e applicato quella corretta. **Non ancora chiusa:** manca la
verifica manuale del DoD (righe prodotte da una domanda reale, costo aggregato per interazione
via `gemini_calls_costed`, riga `status = error` su un fallimento forzato).

**BILLING-00001 chiusa (sessione 2026-07-31):** verificata da Francesco su due interazioni reali
in `/game/[id]` (una `qa`, una `conversation`) — una riga per chiamata Gemini con tutti i
`call_type` rappresentati tra le due, costi in `gemini_calls_costed` ricalcolati a mano e
corretti (es. $0.00588 su un'interazione), `price_output_per_1m` null solo sulle righe
`embedding` (atteso, nessun token di output per quel modello). Path di errore verificato solo
per lettura del codice, non su un fallimento reale forzato — nota aperta, non bloccante per un
progetto personale. Spostata in `done/`.

**BILLING-00002 avviata (sessione 2026-07-31):** su richiesta di Francesco, riusa il design
system esistente (`app/theme.css`/`components/ui`, non un mockup dedicato — non ce n'è uno nel
reference `DESIGN`). Aggiunta `recharts` (prima libreria di grafici del progetto, scelta di
Francesco tra le due opzioni proposte, contro "solo tabelle"). Nuova vista
`user_request_costs` (migration `20260731010000_user_request_costs_view.sql`, non ancora
applicata) pre-aggrega il costo per interazione; aggregazioni per gioco/nel tempo fatte in JS
(`lib/billing-aggregation.ts`, con test) — volume dati ancora troppo piccolo per RPC dedicate.
Prima verifica ruolo admin lato app (`lib/repositories/profiles.repository.ts`, `isAdmin`) — fin
qui esisteva solo a livello RLS. Pagina `app/admin/costs`. `tsc`/`eslint`/`vitest` puliti (22
test). Verificata da Francesco su `/admin/costs` con dati reali. Nota emersa nel bootstrap del
primo admin: il trigger `prevent_role_self_escalation` (AUTH-00003) blocca anche un update da
SQL Editor di Studio, perché lì non c'è un `auth.uid()` di sessione (gira come `postgres`) — va
disabilitato temporaneamente (`alter table profiles disable/enable trigger ...`) per il primo
`role = 'admin'`, poi promozioni successive le fa un admin già esistente tramite l'app.

**BILLING-00002 riaperta (sessione 2026-07-31):** Francesco ha segnalato che la prima versione
non seguiva il design di riferimento e non aveva un punto d'accesso diretto. Il reference (nel
frattempo spostato da `docs/epics/done/DESIGN/reference/` a `docs/design-reference/`) contiene
una sezione "ADMIN" mai vista prima — shell con sidebar scura (palette neutra distinta dal tema
chat, nuovi token in `app/theme.css`), pensata per la console admin generale (ADMIN-CONSOLE), non
solo per i costi. Su richiesta esplicita di Francesco: shell completa costruita subito
(`components/admin/AdminShell.tsx`, riusabile da ADMIN-CONSOLE), voci non ancora funzionanti
presenti ma disabilitate con "(prossimamente)" invece che link morti o omesse. `/admin` ora
redirige a `/admin/costs`; aggiunto link "Admin" nell'Header visibile solo per `role = 'admin'`
(prima l'unico accesso era digitare l'URL a mano). `tsc`/`eslint`/`vitest` puliti.

**BILLING-00002 seconda revisione (stessa sessione):** tolta l'etichetta "(prossimamente)" dalle
voci sidebar non pronte (restano solo disabilitate, scelta esplicita di Francesco). Aggiunto
`components/ui/UserMenu.tsx` — avatar in fondo all'Header, click espande nome utente + voci
abilitate (Admin solo se il ruolo lo prevede, poi Esci) — sostituisce l'email/link testuali.
`tsc`/`eslint` puliti. **Chiusa (2026-08-02):** verifica manuale confermata da Francesco.

**Aperta DESIGN-00004 (sessione 2026-07-31):** su richiesta di Francesco, epica DESIGN
(completata da D64) riaperta — `done/DESIGN` → `progress/DESIGN` — per un task che estende il
menu avatar introdotto in BILLING-00002 come primo tentativo minimale: `profiles` guadagna
nome/cognome, nuova pagina profilo raggiungibile dal menu avatar, avatar ridisegnato (cerchio
bianco, bordo bold, iniziali su colori palette, non più l'`OwlMark` provvisorio), homepage con
saluto personalizzato sopra il dropdown di selezione gioco esistente, menu avatar ristrutturato
(Nome Cognome + email non cliccabile, poi Profilo → Admin se admin → Esci). Implementato subito dopo, stessa sessione: migration
`20260801000000_profiles_name.sql` (non ancora applicata), `lib/profile-display.ts` (nome
visualizzato/iniziali, con test), `components/ui/Avatar.tsx` (cerchio bianco, bordo bold,
iniziali `text-primary`), `UserMenu` ristrutturato, `app/profile` (form nome/cognome),
saluto in `/home`. `tsc`/`eslint`/`vitest` puliti (29 test). File spostato in
`progress/DESIGN/progress/DESIGN-00004-menu-avatar-profilo.md`. **Non ancora chiusa:** manca
la verifica manuale di Francesco (applicare la migration, salvare nome/cognome, controllare
avatar/menu/saluto).

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
invariate come difesa in profondità, non toccato lo schema DB. `tsc`/`lint`/`build` puliti — v.
D74. **Chiusa (2026-07-31):** verifica manuale confermata da Francesco (redirect a `/login` senza
sessione su `/home`/`/game/[id]`, uso invariato con sessione attiva).

**AUTH-00006 chiusa (sessione 2026-07-31):** deprecazione formale di `owner_token` — nessun
codice da toccare, mai stato generato/popolato in produzione (D67), il DoD sull'assenza di nuova
generazione era già soddisfatto prima del task. Lavoro solo su `docs/architecture.md`: principio
di isolamento (`owner_token` → `user_id`+RLS), diagramma di topologia, schema `games` (riga
`owner_token` marcata deprecata, aggiunta riga `user_id` mai documentata da AUTH-00003), pipeline
di serving, sezione astrazioni. Colonna e indice `games.owner_token` lasciati nello schema —
rimozione fuori scope senza task DB dedicato.

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

**BILLING-00009 avviata (sessione 2026-08-02):** Francesco ha chiesto una vista per utente
(oltre a quella per gioco già esistente) e di riportare il modello usato per riga anziché nel
titolo pagina. Prima stesura: righe di distribuzione espandibili al click (dettaglio interazioni
con modello/i coinvolti). Vista `user_request_costs` guadagna `user_id` — primo tentativo di
migration falliva (`CREATE OR REPLACE VIEW` non permette di spostare colonne esistenti, 42P16),
corretto mettendo `user_id` in coda alla select list.

**BILLING-00009 rivista (stessa sessione):** Francesco è tornato sui suoi passi — righe
espandibili "poco significative". Sostituite con una terza tabella semplice "Distribuzione per
tipo di operazione" (`call_type`: embedding/generation/query_contextualization/
query_enhancement/reranking), stesso pattern delle altre due (chiamate, costo totale, costo
medio). `ExpandableCostTable.tsx` (Client Component) rimosso, sostituito da `CostTable.tsx`
(Server Component, tabella semplice riusata per le tre viste). `billing-aggregation.ts`:
`buildInteractionDetails` sostituita da `summarizeCostByCallType` (aggrega
`gemini_calls_costed` per tipo operazione). Titolo pagina "Costi Gemini" → "Costi", nessun
riferimento a "Gemini" nella UI.

**BILLING-00009 estesa (stessa sessione): top 10 richieste per costo.** Chiarito con Francesco
che "richiesta" = singola domanda utente, l'espansione mostra le chiamate Gemini che la
compongono (non altre interazioni) — diverso, e non un ritorno indietro, rispetto alle righe
espandibili tolte da gioco/utente: qui il dettaglio è un livello sotto la riga, non un
doppione dell'aggregato. Nuova `getTopRequestsByCost` + `TopRequestsTable.tsx` (Client
Component, unico con stato client nel pannello).

**BILLING-00009 aggiunta minore (stessa sessione): tooltip sul tipo di operazione.** Icona info
accanto al nome operazione (tabella distribuzione + dettaglio top 10) con spiegazione breve di
cosa fa quella chiamata. Consolidate le mappe `call_type` → etichetta duplicate in
`lib/billing/service/call-type-labels.ts`; `InfoTooltip.tsx` nuovo, prima versione solo CSS
(`group`/`group-hover`), poi convertita a Client Component con posizione `fixed` calcolata via
`getBoundingClientRect` — la versione `absolute` veniva tagliata dal clipping verticale
implicito di `overflow-x-auto` sulle tabelle. `tsc`/`eslint`/`vitest` puliti.

**BILLING-00009 chiusa (2026-08-02):** verifica manuale confermata da Francesco. Epica BILLING
senza altro lavoro attivo (prossimo task, BILLING-00003, aspetta un periodo di raccolta dati
reali) — spostata `progress/BILLING` → `todo/BILLING`.

**DESIGN-00004 chiusa (2026-08-02):** verifica manuale confermata da Francesco (migration
applicata, avatar/menu/saluto/profilo verificati). Epica DESIGN nuovamente completata,
`progress/DESIGN` → `done/DESIGN`.

**EXPANSIONS-00001 chiusa (2026-08-02):** verifica manuale confermata da Francesco (migration
applicata, SETI + Space Agencies ingestati, toggle base/espansione testato in `/game/{id}`).
Epica EXPANSIONS completata, `progress/EXPANSIONS` → `done/EXPANSIONS`.

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
