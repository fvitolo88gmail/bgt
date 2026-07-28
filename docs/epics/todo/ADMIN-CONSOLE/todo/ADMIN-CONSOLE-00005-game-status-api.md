# ADMIN-CONSOLE-00005 — API stato gioco

**Stato:** todo (ex-S3.5 di `POC-00013`)

**Relazione:** dato necessario sia a `ADMIN-CONSOLE-00001` (gestione stato giochi) sia a
`ADMIN-CONSOLE-00002` (avanzamento del wizard di ingest).

## Task

`GET /api/game-status?gameId=` — restituisce `{ manual_ready, forum_ready }` per il gioco
indicato.

## DoD

Risposta corretta verificata su un gioco con manuale/forum ingested e su uno senza.
