# Epica F — Forum BGG

**Stato:** in corso — F1-F5 completati (F4 verificato anche su Hegemony); F6 (parziale), F7, F8 restano

## Task

| ID | Task | DoD |
|---|---|---|
| F1 | ✅ `lib/bgg.ts`: client BGG con auth Bearer token, rate limiting 5s, retry su 500/503 | fetcha thread senza ban, gestisce errori |
| F2 | ✅ Resolver designer: match esatto case-insensitive `author_username` vs `credits.designers[]` | nessun fuzzy/lista manuale — falso negativo noto e accettato (nome reale ≠ username forum) |
| F3 | ✅ Pipeline 3 fasi (discover/fetch/ingest, D27), storage "small-to-big" (D28) | 675 radici in `chunks`, 4964 post in `forum_posts` per Brass Birmingham |
| F4 | ✅ Script `scripts/forum/sync-forum.ts`: aggiornamento incrementale | confronta `reply_count` live BGG vs `forum_threads` (stato ultimo ingest); thread nuovi aggiunti a `discover.json`, thread aggiornati rifetchati via `fetchForumPosts(gameSlug, refetchIds)`, poi `ingestForumPosts` idempotente. `forum-fetch.ts`/`forum-ingest.ts` refactorizzati per esporre le fasi come funzioni riusabili. Aggiunto `lib/games.ts::verifyGameIdentity` (con test, `lib/games.test.ts`) contro mismatch slug/game-id. Verificato end-to-end su Hegemony (sessione 2026-07-26): 1 thread aggiornato rilevato e re-ingestato correttamente, 2 post nuovi salvati, 0 errori |
| F5 | ✅ Espansione runtime `lib/retrieval.ts` (`matchChunksForPrompt`): ricostruzione thread intero da `forum_posts` quando una radice vince il retrieval | verificato manualmente su Brass Birmingham, contesto espanso arriva correttamente al prompt |
| F6 | 🟡 Label provenienza in UI: badge "risposta del designer" + etichetta "Forum — {subject}" fatti in `app/game/[id]/page.tsx`; stile visivo differenziato manuale/community/designer non ancora rifinito | parziale |
| F7 | Fixture `eval/fixtures/hegemony.json`: 15 Q&A forum-dipendenti | non iniziato |
| F8 | Eval su Hegemony, confronto con baseline MVP | non iniziato |
- ✅ `forum_posts.is_designer_response` — verificato in sessione
  2026-07-25: migration applicata, backfill presente, flag calcolato sia
  su ogni post sia sulla radice, `ForumPostRow`/`expandForumThread` lo
  espongono correttamente in espansione runtime.

## Bug post-F1 trovati durante l'ingest reale (sessione 2026-07-23)

- `lib/bgg.ts`, `isArray`: doveva distinguere via `jPath` i tag `forum`/
  `thread` come radice singola (`/forum`, `/thread`) vs elemento ripetuto
  (`forums.forum`, `forum.threads.thread`) — altrimenti zero thread/post
  recuperati silenziosamente. Corretto.
- `lib/bgg.ts`, `getThread`: mancava `count: '1000'` esplicito — rischio di
  troncamento silenzioso su thread lunghi. Corretto.

## Bug trovati durante l'implementazione/test di F4 (sessione 2026-07-26)

- `--game-slug` e `--game-id` erano flag CLI indipendenti in `forum-ingest.ts`,
  senza alcuna verifica incrociata: un mismatch scriveva silenziosamente il
  forum di un gioco sotto il `game_id` di un altro (nessun errore esplicito,
  corruzione visibile solo a posteriori in chat). Corretto con
  `lib/games.ts::verifyGameIdentity` (confronto `games.bgg_id` vs `bggId`
  atteso dallo slug), chiamata a inizio di `forum-ingest.ts` e
  `sync-forum.ts` prima di ogni lettura/scrittura.
- In quel controllo era emerso anche un problema di dato preesistente:
  `games.bgg_id` per "Brass: Birmingham" risultava 28720 (id di *Brass:
  Lancashire*, gioco diverso) invece di 224517 — non un bug di codice, un
  errore di inserimento a monte. Brass va re-ingestato da capo (manuale +
  forum), non ancora fatto.
- `forum-ingest.ts`: il set "post/radici già presenti" (usato per il dedup
  prima di insert/embed) veniva letto con una singola `.select()` senza
  paginazione, troncata al limite di default di PostgREST (1000 righe). Su
  giochi con più di 1000 post (Hegemony, ~841 thread) il set risultava
  incompleto: post realmente già in `forum_posts` venivano ritentati in
  insert, fallendo con `duplicate key`. Nessuna corruzione (l'insert
  multi-riga fallisce per l'intero batch in caso di conflitto), ma nessun
  aggiornamento reale veniva salvato. Corretto con `fetchExistingArticleIds`
  (paginazione esplicita via `.range()`), verificato su Hegemony: rilancio
  pulito, 0 errori.
- `sync-forum.ts` aveva un flag `--bgg-id` mai usato in `main()` (dead code,
  fuorviante — il valore effettivo per il controllo viene da
  `discover.json`). Rimosso dalla CLI.

## Da fare, non ancora applicato (vedi artifact sessione)

- Decodifica entità HTML su `thread.subject` (mai passato da
  `decodeHtmlEntities`, visibile es. `Overbuilding one&#039;s industy`)