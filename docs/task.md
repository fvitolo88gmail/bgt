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
| S0.1 | ✅ Scaffold Next.js con TypeScript strict + Tailwind + ESLint + Prettier | `npm run dev` funziona, nessun errore di tipo |
| S0.2 | ✅ Configurazione Vercel: collega repo, configura env vars, deploy placeholder | URL pubblico live |
| S0.3 | ✅ Progetto Supabase: abilita pgvector, applica migration schema completo (games, chunks, forum_threads) | migration applicata senza errori, tabelle visibili in dashboard |
| S0.4 | ✅ Funzione RPC `match_chunks` in Supabase | chiamata RPC restituisce risultati con score su dati di test |
| S0.5 | ✅ Client Supabase in `lib/supabase.ts` | connessione verificata con query di test |
| S0.6 | ✅ Client Gemini in `lib/gemini.ts` con interfaccia `LLMClient` | embedding di testo di test restituisce array 768 float |
| S0.7 | ✅ Struttura cartelle completa + `.env.local` con tutti i campi (vuoti) | struttura corrisponde a `architecture.md` |

---

## Fase 1 — Ingest PDF

| ID | Task | DoD |
|---|---|---|
| S1.1 | ✅ Script Python `extract-pdf.py`: PDF → JSON con testo, sezione, n° pagina | JSON prodotto da brass.pdf contiene sezioni con testo e metadati |
| S1.2 | ✅ Script TS `ingest-pdf.ts`: legge JSON, applica chunking header-aware con overlap, costruisce content con prefisso `[Sezione · Pagina]` | chunk di dimensione controllata, nessun chunk > 600 parole |
| S1.3 | ✅ Integrazione embedding: per ogni chunk chiama `gemini.embed()`, salva in `chunks` con `source='manual'` | righe in DB con vettori non null |
| S1.4 | ✅ Verifica retrieval manuale: query di test su Supabase restituisce top-5 chunk pertinenti | risultati visivamente sensati per 3 domande di test |

---

## Fase 2 — Retrieval e risposta

| ID | Task | DoD |
|---|---|---|
| S2.1 | ✅ `lib/retrieval.ts`: funzione `matchChunks(query, gameId, topK)` | restituisce chunk con score, tipizzati |
| S2.2 | ✅ `lib/prompt.ts`: prompt grounded strict — risponde solo dal contesto, dichiara assenza se non trovato | testato manualmente: non inventa fuori contesto |
| S2.3 | ✅ API route `POST /api/chat`: riceve domanda + game_id, chiama retrieval + Gemini, restituisce `{ answer, sources[] }` in JSON | risposta JSON valida con array sources |
| S2.4 | ✅ UI chat minimale in `app/game/[id]/page.tsx`: input domanda, render risposta, render fonti | funziona in locale su Brass Birmingham |
| S2.5 | ✅ Wire end-to-end: upload → ingest → chat → risposta citata | flusso completo funzionante in locale |

---

## Fase 3 — Citazioni, fallback, deploy, selezione gioco

| ID | Task | DoD |
|---|---|---|
| S3.1 | Render citazioni in UI: pagina e sezione visibili sotto ogni risposta | fonte leggibile per ogni risposta |
| S3.2 | Fallback esplicito: se nessun chunk supera soglia similarità → risposta "non trovato nel manuale" | domanda fuori-scope produce fallback, non invenzione |
| S3.3 | API route `GET /api/search-game?q={nome}`: chiama BGG search, restituisce top-5 risultati | lista giochi con nome + bgg_id + anno |
| S3.4 | UI selezione gioco in `app/page.tsx`: input nome, lista risultati, selezione → redirect a `/game/[id]` | navigazione funzionante |
| S3.5 | API route `GET /api/game-status?gameId=`: restituisce `{ manual_ready, forum_ready }` | stato corretto per giochi noti e non noti |
| S3.6 | ✅ Deploy completo su Vercel con env vars configurate | URL pubblico funzionante end-to-end |

---

## Eval

| ID | Task | DoD |
|---|---|---|
| E1 | ✅ Fixture `eval/fixtures/brass-birmingham.json`: 20 Q&A con ground truth (domande con risposta certa nel manuale) | file JSON valido, domande coprenti edge case noti |
| E2 | ✅ Runner `eval/runner.test.ts`: esegue ogni domanda contro il RAG, confronta risposta con LLM-as-judge (Gemini), stampa accuratezza % e fallimenti | output leggibile con % e lista domande fallite |
| E3 | ✅ Baseline: esegui eval su MVP, documenta % accuratezza in questo file | baseline documentata → punto di riferimento per Fase 2 |

**Baseline MVP — storico:**

```
[001 — 2026-07-03, pre D19/D20]
Chunking strategy: pagina-based, 500 parole, overlap fisso (S1.2 originale)
Accuratezza: 9/20 (45%)
Soglia target: 80% (non raggiunta)
Log completo: docs/baselines/001-20260703.md
Note: 3 domande su 20 "non trovato" nonostante l'informazione fosse presente (bb-07, bb-13, bb-20)
  → problema di retrieval. 1 domanda (bb-18) con risposta che contraddice la regola corretta
  → allucinazione da chunk mal tagliato. Causa radice diagnosticata in D19: chunking meccanico
  per pagina, indipendente dalla struttura semantica del documento.
```

```
[002 — 2026-07-03, post D19/D20]
Modello embedding: gemini-embedding-001 (outputDimensionality: 768)
Modello generazione: gemini-3.1-flash-lite
Metodo di valutazione: LLM-as-judge (gemini-3.1-flash-lite), confronto semantico risposta vs expected_answer
Chunking strategy: sezione-based via Gemini a due fasi, D19 (estrattore PDF con rilevamento
  spread/colonne + markdown-from-json.ts + ingest-pdf.ts riscritti)
Accuratezza: 16/20 (80%) — dopo correzione di bb-18 (ground truth incompleta: non distingueva
  Periodo dei Canali da Periodo delle Ferrovie sul limite di Tessere Industria per località;
  la risposta del RAG era corretta, la fixture era sbagliata — vedi eval/fixtures/brass-birmingham.json)
Soglia target: 80% (RAGGIUNTA ✅)
Fix rilevante durante questa sessione: D20, indice ivfflat (lists=100) inefficace su dataset
  piccolo (23 chunk) causava "non trovato" sistematico su query nuove non identiche a embedding
  già indicizzati — rimosso l'indice, ora scansione sequenziale.
Fallimenti residui (5, poi 4 dopo fix bb-18): principalmente omissioni di dettagli minori
  (eccezioni, distinzioni di periodo) più che errori sostanziali — nessuna allucinazione grave
  residua rilevata nei test manuali.
```

**Nota per la prossima sessione — D21 non ancora misurata:**
Dopo la baseline 002, `lib/prompt.ts` è stato riscritto (D21) per permettere deduzioni dichiarate
esplicitamente (invece del solo binario fatto-diretto / "non trovato"), a seguito di falsi negativi
osservati in test manuali (es. "Cos'è una Tessera Collegamento?" → prima "non trovato", ora risposta
corretta con deduzione dichiarata). Questo cambiamento **non è ancora stato misurato con l'eval
harness** — probabile che il judge in `eval/runner.test.ts` vada rivisto per riconoscere risposte
con deduzione dichiarata come corrette quando ben fondate, non penalizzarle. Prossimo passo:
rilanciare `npx vitest run eval/runner.test.ts` e documentare baseline 003.
```

---

## Fase 2 — Forum BGG ✅ sbloccata (baseline 002: 16/20, 80%, soglia raggiunta — 2026-07-03)

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