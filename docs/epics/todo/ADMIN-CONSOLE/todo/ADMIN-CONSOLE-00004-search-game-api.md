# ADMIN-CONSOLE-00004 — API di ricerca gioco (BGG)

**Stato:** todo (ex-S3.3 di `POC-00013`)

**Relazione:** usata da `ADMIN-CONSOLE-00002` (wizard di ingest) per cercare un gioco su BGG e
recuperarne nome/bgg_id/anno come primo step del wizard, prima di avviare l'ingest.

## Task

`GET /api/search-game?q={nome}` — ricerca su BGG (`lib/bgg.ts`, `searchGame`) e restituisce la
lista di risultati candidati.

## DoD

Lista giochi con nome + bgg_id + anno; usata dal wizard di ingest come step di selezione del
gioco da ingested.
