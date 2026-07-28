# POC-00012 — Link BGG nelle citazioni

**Stato:** ✅ done — caso principale (D30), link diretto al post per fonti
espanse (F5) e numero di pagina nelle citazioni manuale (F9) tutti chiusi.

## Fatto
- `buildBggThreadUrl` in `lib/bgg.ts`, formato verificato su BGG reale:
  `https://boardgamegeek.com/thread/{bgg_thread_id}/article/{bgg_article_id}#{bgg_article_id}`
- `ChunkMatch.bggUrl` esposto end-to-end fino alla UI
- `expandForumThread` restituisce anche `posts[]` con URL per-post
- UI: link fonte sempre evidenziato, link inline nel corpo risposta
  (generati dal modello via istruzioni in `lib/prompt.ts`) stilizzati e
  aperti in nuova scheda
- F5: `matchChunksForPrompt` (`lib/retrieval.ts`) — il campo `url` della
  fonte principale per un thread espanso ora riusa direttamente
  `match.bggUrl` (già costruito con `bggArticleId`, il post radice
  effettivamente recuperato, D28) invece di ricalcolare un link generico
  alla radice del thread senza articolo. `posts[]` resta disponibile per
  un'eventuale UI a parte, ma il link principale già punta al post giusto.
- F9: `sourceLabel` per fonti manuale ora combina sempre sezione e pagina
  quando entrambe disponibili ("Nome Sezione, pagina 9"), non solo quando
  manca la sezione — prima il dato pagina veniva scartato nel caso comune
  nonostante `CITATION_FORMAT_RULES` lo prevedesse esplicitamente.

| ID | Task | DoD |
|---|---|---|
| F9 | ✅ Includere sempre la pagina nell'etichetta delle fonti manuale, non solo quando manca la sezione | Un chunk manuale con sezione E pagina produce un'etichetta tipo "Nome Sezione, pagina 9"; una risposta che cita quel chunk riporta esplicitamente il numero di pagina |
