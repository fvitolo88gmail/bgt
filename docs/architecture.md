# architecture.md

## Visione
Assistente conversazionale per regole di giochi da tavolo. L'utente seleziona un gioco, il sistema risponde a domande citando il manuale ufficiale e il forum BGG come fonti distinte. Nessuna allucinazione: se la risposta non è nelle fonti, lo dichiara esplicitamente.

---

## Principi architetturali

| Principio | Implicazione |
|---|---|
| LLM ai bordi | Gemini interviene solo per embedding e generazione risposta. Tutta la logica è codice deterministico |
| Fonti citate | Ogni risposta include riferimento a pagina/sezione (manuale) o thread/autore (forum) |
| Anti-allucinazione | Il prompt vieta al modello di rispondere fuori dal contesto fornito |
| DB condiviso, isolamento per proprietà | I giochi `shared` sono disponibili a tutti; i giochi `private` sono visibili solo a chi li ha caricati tramite owner_token — vedi D16 |
| Ingest offline | La pipeline di ingest non gira mai in una request utente — è sempre un job separato |
| Schema forward-compatible | Campi per Fase 2 (forum) presenti nello schema MVP anche se non usati subito |

---

## Topologia

```
Browser (owner_token in cookie/localStorage)
  └── Next.js App (Vercel)
        ├── UI chat (React)
        └── API routes (serving)
              ├── Gemini Embeddings  → vettore query
              └── Supabase pgvector  → retrieval chunk (scoped per owner_token/shared)
                        └── Gemini Flash → risposta citata

Script locale (ingest — mai su Vercel)
  ├── PDF parser → chunk → Gemini Embeddings → Supabase
  └── BGG crawler → chunk → Gemini Embeddings → Supabase
```

---

## Schema database (Supabase / Postgres + pgvector)

### `games`
| Campo | Tipo | Note |
|---|---|---|
| id | uuid PK | |
| bgg_id | int unique | id BGG per resolver forum |
| name | text | nome canonico |
| owner_token | uuid null | null = gioco `shared`; altrimenti identifica il browser/dispositivo che ha caricato il manuale (D16) |
| visibility | text | `private` (default) oppure `shared` — impostabile solo manualmente in DB, mai self-service utente (D16) |
| manual_ready | boolean | ingest PDF completato |
| forum_ready | boolean | ingest forum completato |
| last_forum_sync | timestamptz | ultimo aggiornamento forum |
| created_at | timestamptz | |

### `chunks`
| Campo | Tipo | Note |
|---|---|---|
| id | uuid PK | |
| game_id | uuid FK → games | |
| source | text | `manual` oppure `forum` |
| content | text | testo originale pulito — mai modificato |
| embedding | vector(768) | generato da Gemini Embeddings |
| model_version | text | versione modello embedding |
| page | int | solo source=manual |
| section | text | solo source=manual |
| bgg_thread_id | int | solo source=forum |
| bgg_article_id | int | solo source=forum |
| thread_subject | text | solo source=forum — iniettato nel content prima dell'embedding |
| author_username | text | solo source=forum |
| is_designer_response | boolean | solo source=forum |
| post_date | timestamptz | solo source=forum |
| created_at | timestamptz | |

### `forum_threads` (metadati crawler)
| Campo | Tipo | Note |
|---|---|---|
| id | uuid PK | |
| game_id | uuid FK → games | |
| bgg_thread_id | int unique | |
| subject | text | |
| reply_count | int | per rilevare nuove risposte in sync |
| fetched_at | timestamptz | |

### Indici
```sql
-- ricerca vettoriale
create index on chunks using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- filtro per gioco
create index on chunks (game_id, source);

-- filtro per proprietà/visibilità (D16)
create index on games (owner_token);
create index on games (visibility);

-- deduplicazione ingest — ogni upload privato crea una riga games propria,
-- quindi due utenti che caricano lo stesso manuale non collidono su questo vincolo
create unique index on chunks (game_id, page, section) where source = 'manual';
create unique index on chunks (bgg_article_id) where source = 'forum';
```

---

## Pipeline RAG

### Ingest PDF (script locale)
```
PDF
 → estrai testo + struttura (heading, n° pagina)
 → split per sezione, overlap se sezione > 500 parole
 → per ogni chunk: prependi [Sezione · Pagina]
 → Gemini Embeddings → vettore
 → INSERT in chunks (source='manual')
```

### Ingest Forum BGG (script locale)
```
bgg_id
 → /search → bgg_id (se non noto)
 → /forumlist → trova forum "Rules" → forum_id
 → /forum (paginato) → lista thread
 → filtra: reply_count > 0
 → per ogni thread: /thread → lista post
 → filtra: body > 50 caratteri
 → per ogni post:
     costruisci content:
       [Thread: subject]
       [Autore: username (⭐ se designer)]
       [Data: post_date]
       body pulito (strip HTML/BBCode)
 → Gemini Embeddings → vettore
 → INSERT in chunks (source='forum')
 → INSERT in forum_threads (metadati)
 → attendi 5s tra richieste BGG
```

### Risoluzione designer
```
/thing?id={bgg_id} → estrai credits.designers[]
confronta con author_username di ogni post
→ is_designer_response = true se match
```

### Serving (API route Vercel)
```
domanda utente + game_id + owner_token (da cookie/localStorage)
 → verifica visibilità: games.owner_token = owner_token OR games.visibility = 'shared'
 → Gemini Embeddings → vettore query
 → match_chunks(vettore, game_id, top_k=5)
 → costruisci prompt con chunk come contesto
 → Gemini Flash → risposta JSON { answer, sources[] }
 → render in UI con citazioni
```

---

## Struttura cartelle

```
/
├── CLAUDE.md
├── architecture.md
├── development.md
├── task.md
├── .env.local
│
├── app/                        # Next.js app router
│   ├── page.tsx                # home: selezione gioco
│   ├── game/[id]/
│   │   └── page.tsx            # chat UI
│   └── api/
│       ├── search-game/        # ricerca gioco su BGG
│       │   └── route.ts
│       ├── chat/               # query RAG
│       │   └── route.ts
│       └── game-status/        # manual_ready / forum_ready
│           └── route.ts
│
├── lib/
│   ├── supabase.ts             # client Supabase
│   ├── gemini.ts               # client Gemini (embeddings + chat)
│   ├── retrieval.ts            # match_chunks
│   ├── prompt.ts               # prompt grounded
│   ├── owner-token.ts          # generazione/lettura owner_token client-side (D16)
│   └── bgg.ts                  # client BGG XML API2
│
├── scripts/                    # ingest — mai su Vercel
│   ├── ingest-pdf.ts
│   ├── ingest-forum.ts
│   └── sync-forum.ts           # aggiornamento periodico
│
├── supabase/
│   └── migrations/             # schema SQL versionato
│
└── eval/                       # separato dal prodotto
    ├── fixtures/
    │   ├── brass-birmingham.json   # Q&A con ground truth
    │   └── ark-nova.json
    └── runner.ts               # esegue eval, stampa accuratezza
```

---

## Astrazioni chiave

### LLMClient
Interfaccia unica per embedding e generazione. Il provider è configurabile via env var. Permette di swappare Gemini con Ollama senza modificare il codice chiamante.

### match_chunks (Supabase RPC)
Funzione SQL che prende vettore query + game_id + top_k e restituisce chunk ordinati per similarità coseno con score. Filtro opzionale per source (manual | forum | entrambi).

### owner_token
UUID generato lato client (cookie o localStorage) al primo utilizzo dell'app, senza login. Identifica il "proprietario" dei giochi caricati privatamente. Non è autenticazione: è un identificatore di dispositivo/browser, sufficiente per un MVP condiviso con una cerchia ristretta di persone (D16).

### Prompt grounded
Costante in `lib/prompt.ts`. Istruisce il modello a rispondere esclusivamente dal contesto fornito e a dichiarare esplicitamente quando la risposta non è presente nelle fonti.

---

## Fase 2 — Forum BGG
Lo schema è già pronto (campi bgg_* in chunks, tabella forum_threads). La Fase 2 aggiunge:
- Script `ingest-forum.ts` e `sync-forum.ts`
- Retrieval su source=forum in aggiunta a source=manual
- Label provenienza in UI (ufficiale vs community vs designer)
- Eval fixture con domande forum-dipendenti (Ark Nova)

**Regola:** non iniziare Fase 2 prima che l'eval harness (task E1) giri e produca una baseline.