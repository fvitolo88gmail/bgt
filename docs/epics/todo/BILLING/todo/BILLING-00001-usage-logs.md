# BILLING-00001 — Logging usage: tabella usage_logs

**Stato:** todo

## Task

Tabella `usage_logs` (schema `public`), **una riga per chiamata Gemini** (non per interazione
utente), nessun contenuto in chiaro. Schema: `interaction_id` (raggruppa tutte le chiamate di
una singola domanda utente: embedding + generation + eventuale espansione), `user_id`/
`owner_token`, `game_id`, `call_type` (`embedding` \| `generation` \| `expansion`),
`model_name`, `prompt_token_count`, `candidates_token_count`, `cached_token_count`,
`price_input_per_1m`/`price_output_per_1m` (snapshot del prezzo al momento della chiamata, non
ricalcolato a posteriori), `chunks_retrieved_count`, `status` (`success` \| `error` \|
`timeout`), `retry_count`, costo raw calcolato, timestamp.

## DoD

Ogni chiamata Gemini produce una riga; aggregando per `interaction_id` si ottiene il costo
totale di una domanda utente (embedding + generation + expansion sommati correttamente); una
chiamata fallita a metà con token già consumati risulta comunque loggata (`status = error`).
