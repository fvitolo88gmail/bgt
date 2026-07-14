# Epica 3b — Fase 3 (continua): S3.2–S3.5

**Stato:** da riprendere al termine dell'epica `0500-forum-bgg.md` (D22)

## Task

| ID | Task | DoD |
|---|---|---|
| S3.2 | Fallback esplicito: nessun chunk sopra soglia similarità → "non trovato nel manuale" | domanda fuori-scope produce fallback, non invenzione |
| S3.3 | API route `GET /api/search-game?q={nome}` | lista giochi con nome + bgg_id + anno |
| S3.4 | UI selezione gioco: input nome, lista risultati, redirect a `/game/[id]` | navigazione funzionante |
| S3.5 | API route `GET /api/game-status?gameId=` | `{ manual_ready, forum_ready }` corretto |
| S3.7 | UI "richiedi caricamento gioco": se `search-game` non trova risultati (o gioco non ingested), form che notifica l'admin (email/tabella `game_requests`) invece di permettere upload self-service | richiesta salvata/notificata, nessun upload diretto lato utente |
