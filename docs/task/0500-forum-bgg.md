# Epica F — Forum BGG

**Stato:** in corso — F1-F3, F5 completati per Brass Birmingham; F4, F6 (parziale), F7, F8 restano

## Task

| ID | Task | DoD |
|---|---|---|
| F1 | ✅ `lib/bgg.ts`: client BGG con auth Bearer token, rate limiting 5s, retry su 500/503 | fetcha thread senza ban, gestisce errori |
| F2 | ✅ Resolver designer: match esatto case-insensitive `author_username` vs `credits.designers[]` | nessun fuzzy/lista manuale — falso negativo noto e accettato (nome reale ≠ username forum) |
| F3 | ✅ Pipeline 3 fasi (discover/fetch/ingest, D27), storage "small-to-big" (D28) | 675 radici in `chunks`, 4964 post in `forum_posts` per Brass Birmingham |
| F4 | Script `scripts/sync-forum.ts`: aggiornamento incrementale | solo thread nuovi/aggiornati re-ingested — non ancora implementato |
| F5 | ✅ Espansione runtime `lib/retrieval.ts` (`matchChunksForPrompt`): ricostruzione thread intero da `forum_posts` quando una radice vince il retrieval | verificato manualmente su Brass Birmingham, contesto espanso arriva correttamente al prompt |
| F6 | 🟡 Label provenienza in UI: badge "risposta del designer" + etichetta "Forum — {subject}" fatti in `app/game/[id]/page.tsx`; stile visivo differenziato manuale/community/designer non ancora rifinito | parziale |
| F7 | Fixture `eval/fixtures/ark-nova.json`: 15 Q&A forum-dipendenti | non iniziato |
| F8 | Eval su Ark Nova, confronto con baseline MVP | non iniziato |

## Bug post-F1 trovati durante l'ingest reale (sessione 2026-07-23)

- `lib/bgg.ts`, `isArray`: doveva distinguere via `jPath` i tag `forum`/
  `thread` come radice singola (`/forum`, `/thread`) vs elemento ripetuto
  (`forums.forum`, `forum.threads.thread`) — altrimenti zero thread/post
  recuperati silenziosamente. Corretto.
- `lib/bgg.ts`, `getThread`: mancava `count: '1000'` esplicito — rischio di
  troncamento silenzioso su thread lunghi. Corretto.

## Da fare, non ancora applicato (vedi artifact sessione)

- `forum_posts.is_designer_response` (nuova colonna + backfill Brass +
  aggiornamento `forum-ingest.ts`/`lib/retrieval.ts`) — per marcare il
  designer per singolo post durante l'espansione, non solo sulla radice
- Decodifica entità HTML su `thread.subject` (mai passato da
  `decodeHtmlEntities`, visibile es. `Overbuilding one&#039;s industy`)