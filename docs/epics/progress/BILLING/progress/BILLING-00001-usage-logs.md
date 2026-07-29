# BILLING-00001 — Logging usage: tabelle user_requests / gemini_calls

**Stato:** in progress — schema definito, migration bozza sotto (SQL pronto, non ancora un file in
`supabase/migrations/`: rimosso da lì il 2026-07-29 perché il suo timestamp precedeva quello di
una migration AUTH-00001 nel frattempo creata **ed eseguita**, rompendo l'ordine cronologico
file↔esecuzione reale — v. `docs/epics/progress.md`). Da ricreare come migration con timestamp
aggiornato quando riprende l'istrumentazione del codice. Istrumentazione ancora da fare.

## Task

Due tabelle invece di un'unica `usage_logs` flat: `user_requests` (una riga per interazione
utente — una domanda) e `gemini_calls` (una riga per chiamata Gemini, FK `user_request_id` →
`user_requests`, on delete cascade). Nessun contenuto in chiaro in nessuna delle due.

`user_requests`: `game_id`, `session_id` (FK `chat_sessions`, valorizzato solo in modalità
`conversation`), `owner_token`, `user_id` (non referenziato: nessuna tabella utenti finché AUTH
non parte — campo forward-compatible), `mode` (`qa` \| `conversation`),
`chunks_retrieved_count`, `status` (`success` \| `error`), `created_at`.

`gemini_calls`: `user_request_id`, `call_type` (`embedding` \| `generation` \|
`query_contextualization` \| `query_enhancement` \| `reranking` — un valore per ogni chiamata
`generate()`/`embed()` reale nel codice, non un bucket unico "expansion": permette a
BILLING-00003 di vedere subito quale tecnica pesa di più sul costo, senza doverle disambiguare
in un secondo momento), `model_name`, `prompt_token_count`, `candidates_token_count`,
`cached_token_count`, `price_input_per_1m`/`price_output_per_1m` (snapshot del prezzo al
momento della chiamata, non ricalcolato a posteriori), `cost_usd` (calcolato dall'app
all'inserimento), `status` (`success` \| `error` \| `timeout`), `retry_count` (tentativi
assorbiti da `withGeminiRetry` prima dell'esito finale), `created_at`.

Chiamate reali da strumentare (`app/api/chat/route.ts` e a cascata):
- `contextualizeQueryForRetrieval` (`lib/query-contextualization.ts`) → `query_contextualization`, solo modalità `conversation`
- `generateEnhancedQueries` (`lib/retrieval.ts`) → `query_enhancement`
- `geminiClient.embed` per ogni query di ricerca, originale + arricchite (`lib/retrieval.ts`) → `embedding`
- `rerankByRelevance` (`lib/reranking.ts`) → `reranking`
- `geminiClient.generate(prompt)` finale (`app/api/chat/route.ts`) → `generation`

Nota implementativa aperta: `withGeminiRetry` (`lib/gemini.ts`) oggi non espone né il numero di
tentativi né eventuali token consumati su un tentativo fallito — va esteso per restituire
questi dati al chiamante prima di poter popolare `retry_count`/token su righe `status = error`.

## DoD

Ogni chiamata Gemini produce una riga in `gemini_calls`; aggregando per `user_request_id` si
ottiene il costo totale di una domanda utente (embedding + generation + chiamate di supporto al
retrieval sommate correttamente); una chiamata fallita a metà con token già consumati risulta
comunque loggata (`status = error`).

## Migration (bozza SQL, da ricreare con timestamp aggiornato)

```sql
-- Epica BILLING — BILLING-00001
-- Tracking uso Gemini: un'interazione utente (user_requests) raggruppa tutte
-- le chiamate Gemini che la compongono (gemini_calls), embedding + generation
-- + eventuali chiamate di supporto al retrieval (contestualizzazione query,
-- query enhancement HyDE/decomposizione, reranking).

create table user_requests (
                              id uuid primary key default gen_random_uuid(),
                              game_id uuid not null references games(id) on delete cascade,
                              session_id uuid null references chat_sessions(id) on delete set null,
                              owner_token uuid null,
                              user_id uuid null, -- non referenziato: nessuna tabella utenti finché AUTH non parte
                              mode text not null, -- 'qa' | 'conversation'
                              chunks_retrieved_count int null,
                              status text not null default 'success', -- 'success' | 'error'
                              created_at timestamptz not null default now()
);

create table gemini_calls (
                             id uuid primary key default gen_random_uuid(),
                             user_request_id uuid not null references user_requests(id) on delete cascade,
                             call_type text not null, -- 'embedding' | 'generation' | 'query_contextualization' | 'query_enhancement' | 'reranking'
                             model_name text not null,
                             prompt_token_count int null,
                             candidates_token_count int null,
                             cached_token_count int null,
                             price_input_per_1m numeric null, -- snapshot al momento della chiamata, mai ricalcolato a posteriori
                             price_output_per_1m numeric null,
                             cost_usd numeric null, -- calcolato dall'app all'inserimento
                             status text not null, -- 'success' | 'error' | 'timeout'
                             retry_count int not null default 0,
                             created_at timestamptz not null default now()
);

-- costo totale per interazione: sum(cost_usd) group by user_request_id
create index on gemini_calls (user_request_id);
create index on user_requests (game_id, created_at);
create index on user_requests (session_id);
```

Nota: `user_id` è già presente e nullable — forward-compatible con AUTH-00002/00003, nessuna
modifica allo schema qui prevista quando si ricrea la migration.
