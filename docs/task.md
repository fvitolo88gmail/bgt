# task.md

## Regole
- Implementa i task nell'ordine definito dentro ogni epica
- Non passare al task successivo prima che il DoD del corrente sia soddisfatto
- Le epiche stesse sono ordinate per priorità (vedi indice sotto); l'ordine tra epiche può
  essere rinegoziato esplicitamente, ma va sempre documentato con una entry in `decision-log.md`
  (pattern già usato in D22)
- Aggiorna questo file marcando i task completati con ✅

## Indice epiche (ordine di esecuzione corrente)

| # | Epica | Stato |
|---|---|---|
| 0 | Setup | ✅ completata |
| 1 | Ingest PDF | ✅ completata |
| 2 | Retrieval e risposta | ✅ completata |
| 3 | Fase 3 — Citazioni, fallback, deploy, selezione gioco | in corso (S3.2-S3.5 posticipati, D22) |
| F | Forum BGG | **priorità corrente** — sbloccata, token BGG ricevuto |
| 3b | Fase 3 (continua) — S3.2-S3.5 | dopo Forum |
| L | Chat multilingua | dopo Fase 3 |
| U | UI Uplifting | dopo Chat multilingua |
| C | Chat con contesto | dopo UI Uplifting |
| A | AI Provider Adapters | dopo Chat con contesto |
| T | Teach me the game | ultima |

---

## Epica 0 — Setup ✅

| ID | Task | DoD |
|---|---|---|
| S0.1 | ✅ Scaffold Next.js con TypeScript strict + Tailwind + ESLint + Prettier | `npm run dev` funziona, nessun errore di tipo |
| S0.2 | ✅ Configurazione Vercel: collega repo, configura env vars, deploy placeholder | URL pubblico live |
| S0.3 | ✅ Progetto Supabase: abilita pgvector, applica migration schema completo | migration applicata senza errori |
| S0.4 | ✅ Funzione RPC `match_chunks` in Supabase | chiamata RPC restituisce risultati con score |
| S0.5 | ✅ Client Supabase in `lib/supabase.ts` | connessione verificata |
| S0.6 | ✅ Client Gemini in `lib/gemini.ts` con interfaccia `LLMClient` | embedding restituisce array 768 float |
| S0.7 | ✅ Struttura cartelle completa + `.env.local` | struttura corrisponde a `architecture.md` |

---

## Epica 1 — Ingest PDF ✅

| ID | Task | DoD |
|---|---|---|
| S1.1 | ✅ Script Python `extract-pdf.py` | JSON con sezioni, testo, metadati |
| S1.2 | ✅ Script TS `ingest-pdf.ts`: chunking header-aware con overlap | nessun chunk > 600 parole |
| S1.3 | ✅ Integrazione embedding, salvataggio `source='manual'` | righe in DB con vettori non null |
| S1.4 | ✅ Verifica retrieval manuale | risultati sensati per 3 domande test |

---

## Epica 2 — Retrieval e risposta ✅

| ID | Task | DoD |
|---|---|---|
| S2.1 | ✅ `lib/retrieval.ts`: `matchChunks(query, gameId, topK)` | chunk con score, tipizzati |
| S2.2 | ✅ `lib/prompt.ts`: prompt grounded strict | non inventa fuori contesto |
| S2.3 | ✅ API route `POST /api/chat` | JSON valida con `sources[]` |
| S2.4 | ✅ UI chat minimale | funziona in locale su Brass Birmingham |
| S2.5 | ✅ Wire end-to-end | flusso completo in locale |

---

## Epica 3 — Citazioni, fallback, deploy, selezione gioco

| ID | Task | DoD |
|---|---|---|
| S3.1 | Render citazioni in UI: pagina e sezione visibili sotto ogni risposta | fonte leggibile per ogni risposta — **da confermare se già completo, vedi nota D22** |
| S3.6 | ✅ Deploy completo su Vercel | URL pubblico funzionante end-to-end |

---

## Epica F — Forum BGG (priorità corrente)

BGG ha autorizzato l'app: F1 è sbloccato, `BGG_API_TOKEN` disponibile in env.

| ID | Task | DoD |
|---|---|---|
| F1 | `lib/bgg.ts`: client BGG con auth Bearer token, rate limiting 5s, retry su 500/503 (D23-BGG: comportamento reale diverge dalla doc — throttle non usa 429) | fetcha thread senza ban, gestisce errori |
| F2 | Resolver designer: `isDesigner(username, bggId)` da `credits.designers[]` | match corretto su giochi di test |
| F3 | Script `scripts/ingest-forum.ts`: search → forumlist → forum → thread → post → chunk → embed → store | chunk forum in DB per Brass Birmingham |
| F4 | Script `scripts/sync-forum.ts`: aggiornamento incrementale | solo thread nuovi/aggiornati re-ingested |
| F5 | Estendi `matchChunks` per retrieval multi-fonte (manual + forum) | top-k include chunk da entrambe le fonti |
| F6 | Label provenienza in UI: manuale / community / designer | tre stili visivi distinti |
| F7 | Fixture `eval/fixtures/ark-nova.json`: 15 Q&A forum-dipendenti | file JSON valido |
| F8 | Eval su Ark Nova, confronto con baseline MVP | delta accuratezza documentato |

---

## Epica 3b — Fase 3 (continua): S3.2–S3.5

Da riprendere al termine di F8 (D22).

| ID | Task | DoD |
|---|---|---|
| S3.2 | Fallback esplicito: nessun chunk sopra soglia similarità → "non trovato nel manuale" | domanda fuori-scope produce fallback, non invenzione |
| S3.3 | API route `GET /api/search-game?q={nome}` | lista giochi con nome + bgg_id + anno |
| S3.4 | UI selezione gioco: input nome, lista risultati, redirect a `/game/[id]` | navigazione funzionante |
| S3.5 | API route `GET /api/game-status?gameId=` | `{ manual_ready, forum_ready }` corretto |
| S3.7 | UI "richiedi caricamento gioco": se `search-game` non trova risultati (o gioco non ingested), form che notifica l'admin (email/tabella `game_requests`) invece di permettere upload self-service | richiesta salvata/notificata, nessun upload diretto lato utente |

---

## Epica L — Chat multilingua

| ID | Task | DoD |
|---|---|---|
| L1 | Aggiorna `lib/prompt.ts`: istruzione esplicita di rispondere nella stessa lingua della domanda | risposta in IT per domanda IT, in EN per domanda EN, testato manualmente |
| L2 | Verifica qualità retrieval cross-lingua (query EN su chunk IT) | almeno 3 domande di test EN su Brass Birmingham restituiscono chunk pertinenti |
| L3 | Estendi fixture eval con un sottoinsieme di domande in lingua diversa dal manuale | eval gira senza crash, accuratezza cross-lingua documentata (anche se sotto soglia — è baseline, non gate) |

---

## Epica U — UI Uplifting

| ID | Task | DoD |
|---|---|---|
| U1 | Definisci theme file (`lib/theme.ts` o `app/theme.css`): palette, spacing, tipografia come CSS variables | file unico, nessun colore/spacing hardcoded fuori da questo file |
| U2 | Applica il theme ai componenti esistenti (chat, citazioni, selezione gioco) | nessuna regressione visiva, coerenza cromatica su tutte le pagine |
| U3 | Componenti base riutilizzabili (Button, Card, Badge per provenienza fonte) | almeno chat UI e game list li usano |

---

## Epica C — Chat con contesto (server-side)

| ID | Task | DoD |
|---|---|---|
| C1 | Migration: tabella `chat_sessions` (id, game_id, owner_token, created_at) e `chat_messages` (id, session_id, role, content, created_at) | migration applicata, tabelle visibili in dashboard |
| C2 | `lib/session.ts`: crea/recupera sessione per game_id + owner_token | sessione persistita e riletta correttamente tra richieste |
| C3 | Estendi `POST /api/chat`: legge history da `chat_messages`, la inietta nel prompt, salva nuovo turno | risposta coerente con turni precedenti su test manuale multi-turno |
| C4 | Cap esplicito su numero di turni/token inclusi in history (per contenere consumo quota Gemini) | oltre il cap, i turni più vecchi vengono troncati, nessun errore di quota in test manuale |
| C5 | Toggle UI "usa contesto conversazione" con nota su maggior consumo risorse | toggle funzionante, comportamento diverso on/off verificabile |

---

## Epica A — AI Provider Adapters (solo generazione)

Scope confermato (D23): embedding resta centralizzato su Gemini, gestito solo da admin in ingest.
Solo il modello di **generazione risposta** è selezionabile per utente/account.

| ID | Task | DoD |
|---|---|---|
| A1 | Generalizza `LLMClient`: interfaccia `generate()` implementabile da adapter multipli (Gemini, Claude, ChatGPT) | almeno 2 adapter concreti, stessa interfaccia |
| A2 | Storage sicuro credenziali utente (BYOK per generazione): tabella con valori cifrati lato applicativo prima dell'insert | chiave salvata mai in chiaro in DB, verificato ispezionando la riga |
| A3 | UI settings: utente seleziona provider e inserisce la propria API key | selezione persistita, usata nella chiamata successiva a `/api/chat` |
| A4 | Fallback se l'utente non ha configurato nessun provider proprio | usa Gemini di default (comportamento attuale), nessun errore per utenti che non configurano nulla |

---

## Epica T — Teach me the game

| ID | Task | DoD |
|---|---|---|
| T1 | Definisci sequenza di prompt strutturata (setup → obiettivo → turno tipo → fine partita) in `lib/teach-prompt.ts` | costante separata, non inline, coerente con CLAUDE.md |
| T2 | API route `POST /api/teach`: orchestration multi-step usando chunk del manuale come contesto | risposta strutturata a step, testata su Brass Birmingham |
| T3 | Decisione caching: generato al volo ogni volta vs cache per gioco in DB | decisione documentata in decision-log, implementata di conseguenza |
| T4 | UI: entry point "Insegnami il gioco" separato dalla chat libera | funzionante in locale su Brass Birmingham |

---

## Eval ✅

| ID | Task | DoD |
|---|---|---|
| E1 | ✅ Fixture `brass-birmingham.json`: 20 Q&A | file JSON valido |
| E2 | ✅ Runner con LLM-as-judge | output leggibile con % e fallimenti |
| E3 | ✅ Baseline MVP documentata | punto di riferimento per Fase 2 |

**Baseline MVP — storico:** vedi versione precedente di questo file / `docs/baselines/` per il
dettaglio di baseline 001 (45%) e 002 (80%). Baseline 003 (impatto D21) resta deferred.