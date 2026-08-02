# Epica EXPANSIONS — Espansioni collegate al gioco base

**Stato:** ✅ completata (2026-08-02) — verifica manuale confermata

## Contesto

Nata durante l'ingest di SETI (Space Agencies): senza un modo per distinguere i chunk di
un'espansione da quelli del gioco base, il retrieval li tratta come se fossero sempre regole
valide — rischio concreto di risposte scorrette quando si gioca solo la versione base. Vedi D75
per il confronto tra le opzioni di modellazione considerate.

**Decisione di modello dati (D75):** ogni espansione è una propria riga `games` (proprio
`bgg_id`, `manual_ready`, `visibility`), collegata al gioco base tramite `games.base_game_id`
(self-referencing FK, nullable). `chunks` resta invariata — i chunk di un'espansione sono
scoped per il suo game_id, esattamente come per qualunque altro gioco. Il retrieval
(`match_chunks`, `lib/retrieval.ts`) accetta un insieme di game_id invece di uno solo, per
poter includere base + espansioni attive nella sessione corrente.

## Task

| ID | Titolo | Stato |
|---|---|---|
| EXPANSIONS-00001 | Modello dati base/espansione + retrieval multi-game + toggle chat | ✅ |

## Note aperte

- Selezione delle espansioni attive non persistita (per-sessione, si azzera a ogni refresh
  della pagina chat) — accettabile per l'uso attuale, da rivalutare se serve continuità.
- Nessuna gestione forum per le espansioni ancora implementata: se in futuro un'espansione
  avrà un proprio forum BGG, la pipeline esistente si applica invariata (stessa riga `games`,
  proprio `forum_ready`).
