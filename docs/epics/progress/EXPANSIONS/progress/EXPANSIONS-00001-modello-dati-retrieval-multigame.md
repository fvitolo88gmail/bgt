# EXPANSIONS-00001 — Modello dati base/espansione + retrieval multi-game + toggle chat

**Stato:** in verifica (codice completo, migration/ingest/verifica manuale da fare in locale —
questo sandbox non ha accesso di rete a Supabase/Gemini)

## Task

Permettere di ingestare un'espansione senza che i suoi contenuti vengano sempre trattati come
regole valide: modellarla come propria riga `games` collegata al gioco base, e far sì che il
retrieval includa i suoi chunk solo quando l'utente lo richiede esplicitamente in chat.

## DoD

- Migration applicata: `games.base_game_id` (FK nullable), `match_chunks` accetta
  `match_game_ids uuid[]`.
- `lib/retrieval.ts`: `matchChunks`/`matchChunksForPrompt`/`queryChunksByEmbedding` accettano
  `string | string[]`; `expandForumThread` usa il `game_id` del match, non un id esterno fisso.
- `/api/chat` accetta `expansionGameIds?: string[]`, sempre unito al `gameId` base.
- UI chat (`app/game/[id]/page.tsx`): carica le espansioni collegate (`base_game_id = id`),
  mostra un checkbox per ciascuna, di default nessuna selezionata.
- Verificato manualmente: con SETI ingested (base + Space Agencies), a checkbox disattivata le
  risposte non citano mai contenuto dell'espansione; a checkbox attivata sì.

## Implementazione

- Migration `20260730010000_games_base_game_id.sql`.
- `lib/retrieval.ts`, `app/api/chat/route.ts`, `app/game/[id]/page.tsx` aggiornati per
  ricerca/filtro su più `game_id`.
- `docs/architecture.md` (schema `games`, descrizione `match_chunks`) e `docs/ingest-pdf.md`
  (nota su come creare la riga `games` di un'espansione) aggiornati di conseguenza.
- `tsc --noEmit` e `eslint` puliti.

## Verifica

- Locale, da fare da Francesco: applicare la migration, creare le righe `games` di SETI (base)
  e Space Agencies (`base_game_id` = id di SETI), ingestare entrambi i manuali, testare il
  toggle in `/game/{id}` con e senza espansione attiva.
