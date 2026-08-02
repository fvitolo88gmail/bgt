# CHAT-LISTING-00001 — Modello dati: conversazioni multiple per utente/gioco

**Stato:** ✅ done — migration applicata da Francesco (2026-08-02)

## Task

Estendere il modello dati di `chat_sessions` (oggi una sessione per `game_id`, v.
`POC-00016`) per supportare più conversazioni distinte per lo stesso gioco, associate a un
utente/owner (titolo conversazione, timestamp ultimo messaggio).

## DoD

Migration applicata; una sessione esistente resta accessibile come prima conversazione senza
perdita di dati; possibile creare una nuova conversazione sullo stesso gioco senza sovrascrivere
quella precedente.

## Implementazione

- `supabase/migrations/20260802000000_chat_sessions_title.sql`: `chat_sessions` guadagna
  `title` e `last_message_at` (nullable), backfill da `max(chat_messages.created_at)` per le
  sessioni esistenti, indice `(user_id, game_id, last_message_at desc)` per l'ordinamento
  sidebar (CHAT-LISTING-00002), policy `chat_sessions_update` mancante finora (solo
  select/insert esistevano)
- Nessun cambio al vincolo di unicità: più conversazioni per lo stesso `game_id` già ammesse
  dal 2026-07-27 — il DoD "nuova conversazione senza sovrascrivere quella precedente" era già
  soddisfatto dallo schema esistente
- `lib/chat/repository/session.repository.ts`: aggiunte `setSessionTitle` (titolo + touch
  `last_message_at`) e `touchSessionLastMessage` (solo timestamp, turni successivi)
- Naming deciso con Francesco: titolo generato via Gemini dopo il primo turno (non
  troncamento). Generatore implementato: `lib/chat/prompt/title.ts` (prompt separato,
  convenzione `CLAUDE.md`) + `lib/chat/service/title-generation.ts` (`generateSessionTitle`,
  fail-soft come `query-contextualization.ts` — un fallimento lascia la conversazione senza
  titolo invece di rompere la risposta). Cablato in `app/api/chat/route.ts`
  (`finalizeSessionTitleSafely`, chiamata su entrambi i path che salvano messaggi in modalità
  conversazione): primo turno → genera e salva il titolo, turni successivi → solo
  `touchSessionLastMessage`
- Tracking costi (richiesto esplicitamente da Francesco): la chiamata di generazione titolo
  passa per lo stesso `lib/shared/gemini.ts`/`logGeminiCall` di embedding/generazione/reranking
  — nuovo `call_type` `'title_generation'` in `GeminiCallType`
  (`lib/billing/repository/usage-tracking.repository.ts`), agganciato allo `user_request_id`
  della domanda che ha innescato il primo turno (nessuna riga `user_requests` dedicata: è la
  stessa interazione). Nessun vincolo DB su `call_type` da migrare (solo `text not null`) —
  migration `20260802010000_gemini_calls_title_generation_comment.sql` aggiorna solo il
  commento di documentazione della colonna. Il costo compare quindi automaticamente nel
  pannello admin via `gemini_calls_costed`/`getGeminiCallCosts`, senza altre modifiche

## Verifica

- `npx vitest run lib/__tests__/chat/repository/session.repository.test.ts
  lib/__tests__/chat/service/title-generation.test.ts` — 12/12 ✅
- `npx tsc --noEmit` pulito, `eslint` pulito su tutti i file toccati
- Suite completa `lib/__tests__` girata come verifica di non-regressione: 46/46 ✅. Nel
  passaggio, corretto un bug preesistente non legato a questo task in
  `lib/__tests__/chat/service/query-contextualization.test.ts`: `vi.mock('./gemini', ...)`
  puntava a un path relativo sbagliato rispetto al file di test (mai intercettava il modulo
  reale, richiedendo `NEXT_PUBLIC_SUPABASE_URL`/`GEMINI_API_KEY` validi per non esplodere) →
  corretto in `vi.mock('../../../shared/gemini', ...)`, stesso pattern del nuovo
  `title-generation.test.ts`; ora gira senza env reali
- Migration non eseguibile in sandbox (nessun accesso al Supabase del progetto) — da applicare
  manualmente da Francesco, come già per `20260731000000_usage_tracking.sql`
