# POC-00013 — Fase 3 (continua): S3.2–S3.5, S3.7

**Stato:** da riprendere al termine dell'epica `0500-forum-bgg.md` (D22) — S3.4 anticipata
in versione minima (D41), resto della sequenza invariato

## Task

| ID | Task | DoD |
|---|---|---|
| S3.2 | Fallback esplicito: nessun chunk sopra soglia similarità → "non trovato nel manuale" | domanda fuori-scope produce fallback, non invenzione |
| S3.3 | API route `GET /api/search-game?q={nome}` | lista giochi con nome + bgg_id + anno |
| S3.4 | ✅ (variante minima, D41) `app/home/page.tsx` + `components/home/GameSelectForm.tsx`: dropdown sui giochi con `manual_ready`/`forum_ready` true, redirect a `/game/[id]` | navigazione funzionante, verificato con `tsc`/eslint (build locale non eseguibile in sandbox: `next/font/google` richiede rete verso fonts.googleapis.com, non disponibile — da confermare con `npm run dev` in locale). Non implementata la ricerca testuale originale (nessun bisogno con solo 2 giochi ingested); se il catalogo cresce, S3.3 (search API) resta disponibile per evolvere il dropdown in ricerca |
| S3.5 | API route `GET /api/game-status?gameId=` | `{ manual_ready, forum_ready }` corretto |
| S3.7 | UI "richiedi caricamento gioco": se `search-game` non trova risultati (o gioco non ingested), form che notifica l'admin (email/tabella `game_requests`) invece di permettere upload self-service | richiesta salvata/notificata, nessun upload diretto lato utente |
