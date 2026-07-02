# task.md

## Regole
- Implementa i task nell'ordine definito
- Non passare al task successivo prima che il DoD del corrente sia soddisfatto
- Non iniziare la Fase 2 prima che E1 sia completato e produca una baseline
- Aggiorna questo file marcando i task completati con ✅
---

## Fase 0 — Setup

| ID | Task | DoD |
|---|---|---|
| S0.1 | Scaffold Next.js con TypeScript strict + Tailwind + ESLint + Prettier | `npm run dev` funziona, nessun errore di tipo |
| S0.2 | Configurazione Vercel: collega repo, configura env vars, deploy placeholder | URL pubblico live |
| S0.3 | Progetto Supabase: abilita pgvector, applica migration schema completo (games, chunks, forum_threads) | migration applicata senza errori, tabelle visibili in dashboard |
| S0.4 | Funzione RPC `match_chunks` in Supabase | chiamata RPC restituisce risultati con score su dati di test |
| S0.5 | Client Supabase in `lib/supabase.ts` | connessione verificata con query di test |
| S0.6 | Client Gemini in `lib/gemini.ts` con interfaccia `LLMClient` | embedding di testo di test restituisce array 768 float |
| S0.7 | Struttura cartelle completa + `.env.local` con tutti i campi (vuoti) | struttura corrisponde a `architecture.md` |
 
---

## Fase 1 — Ingest PDF

| ID | Task | DoD |
|---|---|---|
| S1.1 | Script Python `extract-pdf.py`: PDF → JSON con testo, sezione, n° pagina | JSON prodotto da brass.pdf contiene sezioni con testo e metadati |
| S1.2 | Script TS `ingest-pdf.ts`: legge JSON, applica chunking header-aware con overlap, costruisce content con prefisso `[Sezione · Pagina]` | chunk di dimensione controllata, nessun chunk > 600 parole |
| S1.3 | Integrazione embedding: per ogni chunk chiama `gemini.embed()`, salva in `chunks` con `source='manual'` | righe in DB con vettori non null |
| S1.4 | Verifica retrieval manuale: query di test su Supabase restituisce top-5 chunk pertinenti | risultati visivamente sensati per 3 domande di test |
 
---

## Fase 2 — Retrieval e risposta

| ID | Task | DoD |
|---|---|---|
| S2.1 | `lib/retrieval.ts`: funzione `matchChunks(query, gameId, topK)` | restituisce chunk con score, tipizzati |
| S2.2 | `lib/prompt.ts`: prompt grounded strict — risponde solo dal contesto, dichiara assenza se non trovato | testato manualmente: non inventa fuori contesto |
| S2.3 | API route `POST /api/chat`: riceve domanda + game_id, chiama retrieval + Gemini, restituisce `{ answer, sources[] }` in JSON | risposta JSON valida con array sources |
| S2.4 | UI chat minimale in `app/game/[id]/page.tsx`: input domanda, render risposta, render fonti | funziona in locale su Brass Birmingham |
| S2.5 | Wire end-to-end: upload → ingest → chat → risposta citata | flusso completo funzionante in locale |
 
---

## Fase 3 — Citazioni, fallback, deploy, selezione gioco

| ID | Task | DoD |
|---|---|---|
| S3.1 | Render citazioni in UI: pagina e sezione visibili sotto ogni risposta | fonte leggibile per ogni risposta |
| S3.2 | Fallback esplicito: se nessun chunk supera soglia similarità → risposta "non trovato nel manuale" | domanda fuori-scope produce fallback, non invenzione |
| S3.3 | API route `GET /api/search-game?q={nome}`: chiama BGG search, restituisce top-5 risultati | lista giochi con nome + bgg_id + anno |
| S3.4 | UI selezione gioco in `app/page.tsx`: input nome, lista risultati, selezione → redirect a `/game/[id]` | navigazione funzionante |
| S3.5 | API route `GET /api/game-status?gameId=`: restituisce `{ manual_ready, forum_ready }` | stato corretto per giochi noti e non noti |
| S3.6 | Deploy completo su Vercel con env vars configurate | URL pubblico funzionante end-to-end |
 
---

## Eval

| ID | Task | DoD |
|---|---|---|
| E1 | Fixture `eval/fixtures/brass-birmingham.json`: 20 Q&A con ground truth (domande con risposta certa nel manuale) | file JSON valido, domande coprenti edge case noti |
| E2 | Runner `eval/runner.ts`: esegue ogni domanda contro il RAG, confronta risposta, stampa accuratezza % e fallimenti | output leggibile con % e lista domande fallite |
| E3 | Baseline: esegui eval su MVP, documenta % accuratezza in questo file | baseline documentata → punto di riferimento per Fase 2 |

**Baseline MVP (da compilare dopo E3):**
```
Data:
Modello embedding:
Chunking strategy:
Accuratezza: __/20 (__%)
Note:
```
 
---

## Fase 2 — Forum BGG ⛔ non iniziare prima di E3

| ID | Task | DoD |
|---|---|---|
| F1 | `lib/bgg.ts`: client BGG con rate limiting 5s, retry su 429, parsing XML | fetcha thread senza ban, gestisce errori |
| F2 | Resolver designer: da bgg_id estrae credits.designers[], espone funzione `isDesigner(username, bggId)` | match corretto su giochi di test |
| F3 | Script `scripts/ingest-forum.ts`: flusso completo search → forumlist → forum → thread → post → chunk → embed → store | chunk forum in DB per Brass Birmingham |
| F4 | Script `scripts/sync-forum.ts`: aggiornamento incrementale basato su reply_count e fetched_at | solo thread nuovi/aggiornati vengono re-ingested |
| F5 | Estendi `matchChunks` per retrieval multi-fonte (manual + forum) | top-k include chunk da entrambe le fonti |
| F6 | Label provenienza in UI: distingui visivamente manuale / community / designer | tre stili visivi distinti |
| F7 | Fixture `eval/fixtures/ark-nova.json`: 15 Q&A forum-dipendenti (domande che il manuale non risolve) | file JSON valido |
| F8 | Esegui eval su Ark Nova, confronta con baseline MVP | delta accuratezza documentato |
 