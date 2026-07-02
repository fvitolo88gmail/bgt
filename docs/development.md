# development.md

## Stack

| Layer | Tecnologia | Versione minima |
|---|---|---|
| Framework | Next.js (App Router) | 14+ |
| Linguaggio | TypeScript | 5+ strict mode |
| Stile | Tailwind CSS | 3+ |
| DB + vettori | Supabase (Postgres + pgvector) | client v2 |
| Embedding + LLM | Google Gemini | @google/generative-ai |
| PDF parsing | pdfplumber (Python) | 0.10+ |
| Deploy | Vercel | Hobby plan |
 
---

## Dipendenze principali

### Runtime (app)
```
@supabase/supabase-js     → client DB e storage
@google/generative-ai     → Gemini embeddings + Flash
```

### Script ingest (dev/local only)
```
pdfplumber                → estrazione testo PDF (Python)
fast-xml-parser           → parsing XML API BGG
```

### Dev
```
typescript
eslint
prettier
vitest                    → unit test e eval runner
```
 
---

## Variabili d'ambiente

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=     # solo script ingest, mai client-side
 
# Gemini
GEMINI_API_KEY=
 
# Config
EMBEDDING_MODEL=text-embedding-004
EMBEDDING_DIMENSIONS=768
CHAT_MODEL=gemini-1.5-flash
LLM_PROVIDER=gemini             # gemini | ollama
OLLAMA_BASE_URL=                # solo se LLM_PROVIDER=ollama
```
 
---

## Gemini — modelli da usare

| Uso | Modello | Note |
|---|---|---|
| Embedding | `text-embedding-004` | 768 dimensioni, free tier |
| Generazione risposta | `gemini-1.5-flash` | free tier, 1.500 req/giorno |
 
---

## Supabase — setup iniziale

1. Crea progetto su supabase.com
2. Abilita estensione pgvector: `create extension if not exists vector`
3. Applica migrations da `/supabase/migrations/` in ordine
4. Crea funzione RPC `match_chunks` (definita in architecture.md)
5. Configura storage bucket `manuals` (privato)
---

## BGG XML API2

| Endpoint | Uso |
|---|---|
| `/xmlapi2/search?query={nome}&type=boardgame` | risolve nome → bgg_id |
| `/xmlapi2/thing?id={bgg_id}` | dettagli gioco + designer credits |
| `/xmlapi2/forumlist?id={bgg_id}&type=thing` | lista forum del gioco |
| `/xmlapi2/forum?id={forum_id}` | lista thread (paginata, param `page`) |
| `/xmlapi2/thread?id={thread_id}` | tutti i post del thread |

Rate limit: attendere 5 secondi tra richieste. Gestire 429 con retry + backoff.
Nessuna autenticazione richiesta. Nessun full-text search disponibile.
 
---

## Eval harness

- Cartella: `/eval`
- Fixture: JSON array `[{ question, expected_answer, source_page? }]`
- Runner: esegue ogni domanda contro il RAG, confronta risposta con expected
- Output: percentuale di risposte corrette + log dei fallimenti
- Giochi fixture: Brass Birmingham (MVP), Ark Nova (Fase 2)
- Soglia minima accettabile: da definire dopo prima run baseline
---

## Configurazione Vercel

- Piano: Hobby (non commercial — aggiornare a Pro se si monetizza)
- Fluid Compute: abilitare per gestire timeout su ingest PDF lato server
- Environment variables: configurare da dashboard Vercel
- Le cartelle `/scripts` e `/eval` sono escluse dal bundle Vercel
---

## Sviluppo locale

```bash
# installa dipendenze
npm install
 
# avvia dev server
npm run dev
 
# esegui ingest PDF (richiede Python + pdfplumber)
npx ts-node scripts/ingest-pdf.ts --pdf ./manuals/brass.pdf --game-id {uuid}
 
# esegui eval
npx vitest run eval/runner.ts
```
 
---

## Note operative

- I PDF dei manuali non vanno committati in repo (copyright)
- Le fixture eval contengono solo domande e risposte, non testo estratto
- Lo script di ingest va eseguito localmente e scrive direttamente su Supabase Cloud
- Supabase free tier: progetto si mette in pausa dopo 7 giorni di inattività — configurare un ping periodico esterno