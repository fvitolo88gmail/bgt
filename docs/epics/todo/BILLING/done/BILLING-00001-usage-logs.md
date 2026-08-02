# BILLING-00001 — Logging usage: tabelle user_requests / gemini_calls

**Stato:** ✅ done — verificato manualmente da Francesco su due interazioni reali in `/game/[id]`
(sessione 2026-07-31)

## Task

Due tabelle invece di un'unica `usage_logs` flat: `user_requests` (una riga per interazione
utente — una domanda) e `gemini_calls` (una riga per chiamata Gemini, FK `user_request_id` →
`user_requests`, on delete cascade). Nessun contenuto in chiaro in nessuna delle due. RLS
abilitata su entrambe, solo admin in lettura (log interni, scrittura sempre da service role).

`user_requests`: `game_id`, `session_id` (FK `chat_sessions`, valorizzato solo in modalità
`conversation`), `user_id` (FK `profiles`, nullable per coerenza con `games`/`chat_sessions` ma
sempre valorizzato in pratica — l'intera app richiede sessione da AUTH-00011), `mode` (`qa` \|
`conversation`), `chunks_retrieved_count`, `status` (`success` \| `error`), `created_at`.

`gemini_calls`: `user_request_id`, `call_type` (`embedding` \| `generation` \|
`query_contextualization` \| `query_enhancement` \| `reranking`), `model_name`,
`prompt_token_count`, `candidates_token_count`, `cached_token_count`,
`status` (`success` \| `error` \| `timeout`), `retry_count`, `created_at`. Niente prezzo/costo
sulla riga.

`model_pricing` (nuova, sessione 2026-07-31 su richiesta di Francesco): `model_name`,
`price_input_per_1m`, `price_output_per_1m` (null per modelli di solo embedding),
`effective_from`/`effective_to` (periodo di validità, `effective_to null` = periodo in vigore).
Il costo di ogni chiamata si calcola a lettura via la vista `gemini_calls_costed` (join
`gemini_calls`↔`model_pricing` sul periodo in vigore a `gemini_calls.created_at`), non più
congelato per riga: un aggiornamento prezzo registrato in ritardo corregge retroattivamente il
costo storico invece di lasciarlo sbagliato per sempre. Aggiornare un prezzo resta un processo
manuale via Studio (chiudere il periodo aperto con `effective_to = now()`, poi inserire la riga
nuova) — nessun'automazione per recuperare i prezzi Gemini (nessuna API ufficiale di Google per
farlo, solo una pagina web).

Migration: `supabase/migrations/20260731000000_usage_tracking.sql`, applicata al DB.

## Implementazione

- `lib/repositories/usage-tracking.repository.ts` (nuovo, convenzione repository di D72):
  `createUserRequest`, `updateUserRequestOutcome`, `logGeminiCall` — sempre via
  `createServiceClient()`, mai col client anonimo/sessione (log interni). Nessun calcolo di
  prezzo/costo qui: `gemini_calls` registra solo i token, il costo si legge da
  `gemini_calls_costed` (join con `model_pricing`, v. sotto).
- `lib/gemini.ts`: `embed`/`generate` accettano un `GeminiCallContext` opzionale
  (`{ userRequestId, callType }`) e loggano la chiamata internamente (successo o errore) —
  wrapper centralizzato, i call site passano solo il context. `withGeminiRetry` ora espone il
  numero di tentativi assorbiti (`GeminiRetryError`, retry_count reale anche su esito finale di
  errore, non più un placeholder). Token count embedding: l'API `embedContent` (chiave AI
  Studio) non restituisce un conteggio reale — approssimazione caratteri/4
  (`estimateTokenCount`), documentata nel codice. Logging sempre fail-soft
  (`logGeminiCallSafely`): un errore di tracking non blocca mai la chiamata Gemini.
  `generateFromPdfBase64` (ingest PDF, script locale) resta fuori da questo tracking di
  proposito — mai dentro una richiesta utente.
- `lib/retrieval.ts`, `lib/reranking.ts`, `lib/query-contextualization.ts`: `userRequestId`
  opzionale propagato a ogni chiamata (`generateEnhancedQueries` → `query_enhancement`, embed
  per query di ricerca → `embedding`, `rerankByRelevance` → `reranking`,
  `contextualizeQueryForRetrieval` → `query_contextualization`). Assente (`undefined`/`null`) per
  i chiamanti fuori da un'interazione utente (script diagnostici, `matchChunks` standalone) —
  nessuna riga da loggare lì, comportamento invariato.
- `app/api/chat/route.ts`: risolve l'utente autenticato via `createServerSupabaseClient()`
  (gap colmato: la route usava solo il client anonimo, non leggeva mai l'utente nonostante
  `proxy.ts` garantisca sessione valida da AUTH-00011) — fail-soft, `user_id` resta nullable se
  la risoluzione fallisce. Crea `user_requests` a inizio richiesta, propaga l'id a
  contestualizzazione/retrieval/generazione, aggiorna `chunks_retrieved_count`/`status` a fine
  richiesta (anche nel path "non trovato" e nel catch generale → `status = 'error'`).
  `getOrCreateSession`/`chat_sessions.user_id` non toccati, resta il gap noto (fuori scope,
  v. nota sessione 2026-07-31 in `docs/epics/progress.md`).

Verificato: `npx tsc --noEmit` e `npx eslint` su tutti i file toccati, puliti. `npm run build`
non eseguibile in sandbox (nessun accesso di rete a Google Fonts per `next/font`, non collegato
a queste modifiche).

## Verifica (sessione 2026-07-31)

Due interazioni reali in `/game/[id]` (una `qa`, una `conversation` — quest'ultima con
`query_contextualization` presente, l'unico `call_type` non coperto dalla prima). Per entrambe:
una riga per chiamata Gemini (`query_enhancement`, 3× `embedding`, `reranking`, `generation`,
+ `query_contextualization` sulla seconda), costi in `gemini_calls_costed` ricalcolati a mano e
tutti esatti (es. interazione 1: totale ≈ $0.00588). `price_output_per_1m = null` solo sulle
righe `embedding` — atteso, `gemini-embedding-001` non ha token di output. Path di errore
(chiamata fallita → `status = error`) verificato per lettura del codice
(`lib/gemini.ts`, ogni `catch` logga prima di rilanciare), non su un fallimento reale forzato —
rischio residuo giudicato basso, non bloccante per un progetto personale.

## DoD

Ogni chiamata Gemini produce una riga in `gemini_calls`; aggregando per `user_request_id` si
ottiene il costo totale di una domanda utente (embedding + generation + chiamate di supporto al
retrieval sommate correttamente, via la vista `gemini_calls_costed`) — ✅ verificato. Una chiamata
fallita a metà con token già consumati risulta comunque loggata (`status = error`) — verificato
solo per lettura del codice, non su un fallimento reale (nota aperta, non bloccante).
