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
| DB condiviso, isolamento per proprietà | I giochi `shared` sono disponibili a tutti; i giochi `private` sono visibili solo al proprietario, tramite `user_id` + RLS (AUTH-00003) — `owner_token` (D16) è deprecato, mai popolato in produzione (AUTH-00006, D67) |
| Ingest offline | La pipeline di ingest non gira mai in una request utente — è sempre un job separato |
| Schema forward-compatible | Campi per Fase 2 (forum) presenti nello schema MVP anche se non usati subito |

---

## Topologia

```
Browser (sessione Supabase Auth via cookie — proxy.ts, AUTH-00011)
  └── Next.js App (Vercel)
        ├── UI chat (React)
        └── API routes (serving)
              ├── Gemini Embeddings  → vettore query
              └── Supabase pgvector  → retrieval chunk (scoped per user_id/shared, RLS — AUTH-00003)
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
| base_game_id | uuid null | self-referencing FK → games(id). null = gioco base/standalone; valorizzato = questa riga è un'espansione del gioco puntato. Ogni espansione resta una riga `games` a sé (proprio bgg_id, manual_ready, visibility), i chunk restano scoped per game_id — nessun campo aggiuntivo su `chunks` (D75) |
| owner_token | uuid null | **deprecato (AUTH-00006)** — mai popolato in produzione (D67), non generato da alcun client. Isolamento reale via `user_id` (AUTH-00003). Colonna lasciata nello schema, nessuna rimozione richiesta |
| user_id | uuid null → profiles(id) | proprietario reale del gioco (AUTH-00003); null = gioco `shared` o riga pre-auth. RLS: visibile a chi lo possiede, ad admin, o se `visibility = 'shared'` |
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

### `forum_posts`
| Campo | Tipo | Note |
|---|---|---|
| id | uuid PK | |
| game_id | uuid FK → games | |
| bgg_thread_id | int FK → forum_threads(bgg_thread_id) | |
| bgg_article_id | int unique | id del post BGG |
| author_username | text | |
| quoted_author | text null | autore citato (reply-with-quote), se presente |
| post_date | timestamptz | |
| body_clean | text | testo pulito, nessun embedding — solo storage grezzo per espansione a runtime |
| created_at | timestamptz | |

Contiene **tutti** i post di ogni thread (radice inclusa), senza vettore —
usata da F5 per ricostruire il thread intero quando la radice (l'unico
chunk embeddato per thread) vince il retrieval. Vedi D28.

### Indici
```sql
-- ricerca vettoriale
create index on chunks using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- filtro per gioco
create index on chunks (game_id, source);

-- filtro per proprietà/visibilità
create index on games (owner_token); -- legacy, colonna deprecata (AUTH-00006), non rimosso: fuori scope senza task dedicato sullo schema
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
domanda utente + game_id (sessione utente verificata da proxy.ts, AUTH-00011)
 → visibilità applicata da RLS: games.user_id = auth.uid() OR games.visibility = 'shared' OR is_admin()
 → Gemini Embeddings → vettore query
 → match_chunks(vettore, game_id, top_k=5)
 → per ogni chunk vincente con source='forum': espandi SEMPRE
   recuperando l'intero thread da forum_posts (filtro per bgg_thread_id),
   ricostruito in ordine cronologico — vedi D28. I chunk source='manual'
   passano invariati.
 → costruisci prompt con chunk come contesto
 → Gemini Flash → risposta JSON { answer, sources[] }
 → render in UI con citazioni
```

---

## Struttura cartelle

```
/
├── CLAUDE.md
├── docs/
│   ├── architecture.md
│   ├── development.md
│   ├── decision-log.md
│   ├── baselines/
│   └── epics/
│       ├── progress.md
│       └── todo/ | progress/ | done/   # SOLO cartelle di stato a questo livello
│           └── <EPICA>/                # dir epica, posizionata nella cartella del suo stato
│               ├── <EPICA>.md          # indice epica (contesto, decisioni, note aperte)
│               └── todo/ | progress/ | done/   # un file per task (<EPICA>-NNNNN.md)
├── .env.local
├── proxy.ts                    # ex middleware.ts (Next.js 16 l'ha rinominato, D71) — refresh
│                                # sessione + gate su tutta l'app tranne PUBLIC_PATH_PREFIXES
│                                # (login, request-invite; AUTH-00011, D74)
│
├── app/                        # Next.js app router
│   ├── page.tsx                # ancora boilerplate create-next-app, non riutilizzata
│   ├── home/
│   │   └── page.tsx            # selezione gioco: dropdown + redirect a /game/[id] (D41)
│   ├── game/[id]/
│   │   └── page.tsx            # chat UI
│   ├── admin/
│   │   └── page.tsx            # placeholder, in attesa di ADMIN-CONSOLE (ora protetto come tutta l'app)
│   ├── request-invite/
│   │   └── page.tsx            # form pubblico "richiedi accesso" (AUTH-00008)
│   ├── login/
│   │   └── page.tsx            # wrapper server, <LoginForm /> dentro Suspense (AUTH-00005)
│   └── api/
│       ├── chat/               # query RAG
│       │   └── route.ts
│       └── invite-requests/    # controller — valida input, chiama la repository
│           └── route.ts
│
├── components/
│   ├── chat/                   # componenti UI estratti da app/game/[id]/page.tsx (R1.3)
│   │   ├── MessageBubble.tsx
│   │   ├── SourcesList.tsx
│   │   └── types.ts
│   ├── home/                   # dropdown selezione gioco (D41)
│   │   ├── GameSelectForm.tsx
│   │   └── types.ts
│   ├── invite/                 # form richiesta invito (AUTH-00008)
│   │   └── RequestInviteForm.tsx
│   └── auth/                   # login/logout (AUTH-00005)
│       ├── LoginForm.tsx       # 'use client' — signInWithPassword, redirect via ?redirect=
│       └── LogoutButton.tsx    # 'use client' — signOut + redirect a /home
│
├── lib/
│   ├── supabase.ts             # client Supabase (anon, service, browser — safe da Client Component)
│   ├── supabase-server.ts      # client Supabase con cookie (next/headers) — SOLO Server Component/Route Handler/middleware
│   ├── repositories/           # accesso dati puro, zero logica di business (convenzione da AUTH-00008, D72 —
│   │   │                       # migrazione graduale: il resto di lib/ non è ancora stato spostato qui)
│   │   └── invite-requests.repository.ts
│   ├── gemini.ts               # client Gemini (embeddings + chat)
│   ├── retrieval.ts            # match_chunks
│   ├── prompt/                 # prompt grounded, split per specializzazione (D61)
│   │   ├── index.ts            # barrel — punto d'ingresso per i consumer (@/lib/prompt)
│   │   ├── shared.ts           # regole condivise (lingua, citazioni, anti-premessa-errata) + buildContext
│   │   ├── qa.ts                # specializzazione "qa" — buildPrompt
│   │   └── conversation.ts     # specializzazione "conversation" — buildConversationPrompt, storico
│   ├── owner-token.ts          # generazione/lettura owner_token client-side (D16)
│   └── bgg.ts                  # client BGG XML API2
│
├── ingest/                     # artefatti locali di ingest, gitignored (D27)
│   └── {game-slug}/
│       ├── manuals/            # json/md intermedi del PDF
│       └── forum/              # discover.json, posts.json
│
├── scripts/                    # ingest — mai su Vercel, raggruppati per dominio (R1.1)
│   ├── tsconfig.json
│   ├── forum/
│   │   ├── forum-discover.ts   # fase 1/3 — D27
│   │   ├── forum-fetch.ts      # fase 2/3 — D27
│   │   ├── forum-ingest.ts     # fase 3/3 — D27
│   │   └── sync-forum.ts       # aggiornamento periodico incrementale (F4)
│   ├── manual/
│   │   ├── extract-pdf.py
│   │   ├── markdown-from-json.ts  # pipeline testuale, superata da manual-parser/ (D36)
│   │   └── manual-parser/         # pipeline vision (D36) — v. docs/ingest-pdf.md
│   │       ├── ingest-manual.ts
│   │       ├── outline.ts
│   │       ├── generate-section.ts
│   │       ├── regenerate-section.ts
│   │       ├── verify-completeness.ts
│   │       ├── pdf-utils.ts
│   │       └── types.ts
│   └── diagnostics/
│       ├── diagnose-retrieval.ts
│       ├── diagnose-full-context.ts
│       ├── diagnose-columns.py
│       ├── diagnose-graphics.py
│       ├── matrix-column-preview.py
│       └── test-gemini-available.ts
│
├── supabase/
│   └── migrations/             # schema SQL versionato
│
└── eval/                       # separato dal prodotto
    ├── fixtures/
    │   ├── brass-birmingham.json   # Q&A con ground truth
    │   └── hegemony.json
    └── runner.test.ts          # esegue eval, stampa accuratezza
```

---

## Astrazioni chiave

### LLMClient
Interfaccia unica per embedding e generazione. Il provider è configurabile via env var. Permette di swappare Gemini con Ollama senza modificare il codice chiamante.

### match_chunks (Supabase RPC)
Funzione SQL che prende vettore query + un array di game_id (gioco base + eventuali espansioni selezionate, D75) + top_k e restituisce chunk ordinati per similarità coseno con score. Filtro opzionale per source (manual | forum | entrambi).

### owner_token (deprecato — AUTH-00006)
Meccanismo originario (D16): UUID generato lato client per identificare il "proprietario" dei giochi privati senza login, pensato per un MVP a bassissimo attrito. Mai arrivato in produzione (D67) — superato da autenticazione reale (`user_id` + RLS, AUTH-00003) prima di essere usato. Colonna `games.owner_token` resta nello schema mai popolata, `lib/owner-token.ts` vuoto, nessun client la genera.

### Prompt grounded
Costante in `lib/prompt.ts`. Istruisce il modello a rispondere esclusivamente dal contesto fornito e a dichiarare esplicitamente quando la risposta non è presente nelle fonti.

---

## Fase 2 — Forum BGG
Lo schema è già pronto (campi bgg_* in chunks, tabella forum_threads). La Fase 2 aggiunge:
- Script `forum-ingest.ts` e `sync-forum.ts`
- Retrieval su source=forum in aggiunta a source=manual
- Label provenienza in UI (ufficiale vs community vs designer)
- Eval fixture con domande forum-dipendenti (Hegemony)

**Regola:** non iniziare Fase 2 prima che l'eval harness (task E1) giri e produca una baseline.