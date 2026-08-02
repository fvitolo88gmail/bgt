# BILLING-00002 — Pannello admin-only costi

**Stato:** in progress — revisione post-chiusura: la prima versione non seguiva il design di
riferimento (trovato dopo, spostato in `docs/design-reference/`) ed era raggiungibile solo
navigando a mano l'URL. Rifatta con la shell del reference, in attesa di riverifica manuale.

**Blocca:** BILLING-00001, AUTH-00001 — entrambe ✅ done

## Task

Pannello admin-only (protetto da `role = 'admin'`, dipende da AUTH-00001) con costo
medio/query, distribuzione per gioco, andamento nel tempo.

## Implementazione

- Migration `supabase/migrations/20260731010000_user_request_costs_view.sql`: vista
  `user_request_costs` (una riga per interazione con il costo totale già sommato da
  `gemini_calls_costed`) — pre-aggregazione lato DB, evita di rifare la somma a ogni query del
  pannello. `security_invoker` per rispettare le RLS admin-only ereditate da
  `user_requests`/`gemini_calls`. Non ancora applicata al DB.
- `lib/repositories/usage-tracking.repository.ts`: aggiunta `getUserRequestCosts` (lettura,
  prende il client del chiamante — a differenza delle scritture di BILLING-00001, sempre
  service client — così la RLS resta l'enforcement reale, non solo il controllo ruolo in
  pagina).
- `lib/repositories/profiles.repository.ts` (nuovo): `isAdmin(supabase, userId)`, prima verifica
  ruolo lato app (nessun codice la faceva finora, solo la RLS a livello DB).
- `lib/billing-aggregation.ts` (nuovo, funzioni pure, testate in
  `lib/billing-aggregation.test.ts`): `summarizeOverallCost` (costo medio/query),
  `summarizeCostByGame` (per gioco, ordinato per costo totale decrescente),
  `summarizeCostByDay` (bucket per giorno UTC) — separate dalla lettura DB apposta per essere
  testabili senza un client Supabase; il volume di dati è ancora troppo piccolo per RPC di
  aggregazione dedicate.
- `app/admin/costs/page.tsx` (Server Component): verifica ruolo admin, card KPI (interazioni,
  costo totale, costo medio/query) in stile mono/uppercase, tabella dense per gioco, grafico
  andamento nel tempo.

**Revisione (sessione 2026-07-31, dopo feedback di Francesco):** trovato il design di
riferimento per il pannello admin (spostato da `docs/epics/done/DESIGN/reference/` a
`docs/design-reference/` nel frattempo — sezione "ADMIN" del file, non vista prima). Mostra una
shell con sidebar scura ("BGT Admin" + voci Giochi/Ingest/Log & Audit/Impostazioni/Costi), card
KPI in font mono, tabelle dense — pensata per la console admin generale (ADMIN-CONSOLE), non
solo per i costi. Su richiesta esplicita di Francesco: shell completa costruita ora, voci non
ancora funzionanti (tutte tranne "Costi") presenti ma disabilitate con etichetta
"(prossimamente)", non link morti.
- `app/theme.css`: nuovi token `--admin-sidebar`/`--admin-sidebar-active`/`--admin-sidebar-ink`/
  `--admin-sidebar-ink-muted` — palette neutra distinta dal tema "Ludico Vivace" del resto
  dell'app, per fedeltà al reference (dashboard interna, "meno gufo, più dati").
- `components/admin/AdminShell.tsx` (nuovo): sidebar + contenuto, riusabile da `ADMIN-CONSOLE`
  quando le altre voci verranno costruite davvero (basta togliere `comingSoon` e collegare la
  pagina).
- `app/admin/page.tsx`: non più un placeholder con link — `/admin` ora redirige a `/admin/costs`
  (unico punto d'ingresso reale oggi), così è raggiungibile direttamente.
- `components/ui/Header.tsx`: link "Admin" visibile solo per utenti con `role = 'admin'` (prima
  mancava qualunque punto d'accesso dalla UI, solo URL diretto).

Verificato: `npx tsc --noEmit`, `npx eslint`, `npx vitest run` (22 test, incluso
`billing-aggregation.test.ts`) puliti.

**Seconda revisione (stessa sessione, dopo ulteriore feedback):** tolta l'etichetta
"(prossimamente)" dalle voci sidebar non pronte — restano visibili ma solo disabilitate, senza
spiegazione testuale (scelta esplicita di Francesco). Aggiunto `components/ui/UserMenu.tsx`
(Client Component): avatar in fondo all'Header, click espande nome utente + voci abilitate
("Admin" solo se il ruolo lo prevede, poi "Esci") — sostituisce l'email/link testuali che
c'erano prima direttamente nell'Header. `Header.tsx` resta Server Component (risolve
utente/ruolo), passa i dati al menu client.

Verificato: `npx tsc --noEmit`, `npx eslint` puliti.

## DoD

Visualizzazione funzionante su dati reali raccolti da BILLING-00001. **Verificato manualmente da
Francesco** (2026-08-02): shell/card/tabella coerenti col reference, avatar menu nell'Header,
`/admin` che redirige correttamente. Task chiuso.
