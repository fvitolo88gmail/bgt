# Epica F — Forum BGG

**Stato:** priorità corrente — sbloccata, token BGG ricevuto

BGG ha autorizzato l'app: F1 è sbloccato, `BGG_TOKEN` disponibile in env.

## Task

| ID | Task                                                                                                                                                 | DoD |
|---|------------------------------------------------------------------------------------------------------------------------------------------------------|---|
| F1 | ✅ `lib/bgg.ts`: client BGG con auth Bearer token (`BGG_TOKEN`, fail-fast se assente), rate limiting 5s, retry su 500/503 (D26: throttle non usa 429) | fetcha thread senza ban, gestisce errori |
| F2 | Resolver designer: `isDesigner(username, bggId)` da `credits.designers[]`                                                                            | match corretto su giochi di test |
| F3 | Script `scripts/forum-ingest.ts`: search → forumlist → forum → thread → post → chunk → embed → store                                                 | chunk forum in DB per Brass Birmingham |
| F4 | Script `scripts/sync-forum.ts`: aggiornamento incrementale                                                                                           | solo thread nuovi/aggiornati re-ingested |
| F5 | Estendi `matchChunks` per retrieval multi-fonte (manual + forum)                                                                                     | top-k include chunk da entrambe le fonti |
| F6 | Label provenienza in UI: manuale / community / designer                                                                                              | tre stili visivi distinti |
| F7 | Fixture `eval/fixtures/ark-nova.json`: 15 Q&A forum-dipendenti                                                                                       | file JSON valido |
| F8 | Eval su Ark Nova, confronto con baseline MVP                                                                                                         | delta accuratezza documentato |
