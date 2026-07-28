# POC-00013 — Fase 3 (continua): S3.2–S3.5, S3.7

**Stato:** ✅ done (v. D60) — tutti i punti residui chiusi o riassegnati, nessun task aperto qui.

## Task

| ID | Task | Esito |
|---|---|---|
| S3.2 | Fallback esplicito: nessun chunk sopra soglia similarità → "non trovato nel manuale" | ✅ soddisfatto de facto — non c'è una soglia hard-coded nel codice, il comportamento è garantito dalle regole anti-allucinazione del prompt (`WRONG_PREMISE_RULE`, eccezione "non ho trovato" in `lib/prompt.ts`) e dal fallback quando `matchChunksForPrompt` non trova nulla (`route.ts`) — verificato indirettamente dagli eval (nessuna allucinazione osservata su `hegemony-ambiguous`) |
| S3.3 | API route `GET /api/search-game?q={nome}` | → spostata in `ADMIN-CONSOLE-00004` (v. D60): unico consumatore reale è il wizard di ingest admin, non una feature utente-facing con solo 2 giochi ingested |
| S3.4 | ✅ (variante minima, D41) `app/home/page.tsx` + `components/home/GameSelectForm.tsx`: dropdown sui giochi con `manual_ready`/`forum_ready` true, redirect a `/game/[id]` | ✅ fatto |
| S3.5 | API route `GET /api/game-status?gameId=` | → spostata in `ADMIN-CONSOLE-00005` (v. D60), stesso ragionamento di S3.3 |
| S3.7 | UI "richiedi caricamento gioco" | → spostata in nuova epica `GAME-REQUEST-00001` (v. D60), priorità molto bassa: ha senso solo con distribuzione/traffico reale |
