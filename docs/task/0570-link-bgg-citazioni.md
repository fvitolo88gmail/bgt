# Epica (numerazione provvisoria 0570) — Link BGG nelle citazioni

**Stato:** ✅ implementato (D30) per il caso principale — parzialmente
aperto per un caso secondario

## Fatto
- `buildBggThreadUrl` in `lib/bgg.ts`, formato verificato su BGG reale:
  `https://boardgamegeek.com/thread/{bgg_thread_id}/article/{bgg_article_id}#{bgg_article_id}`
- `ChunkMatch.bggUrl` esposto end-to-end fino alla UI
- `expandForumThread` restituisce anche `posts[]` con URL per-post
- UI: link fonte sempre evidenziato, link inline nel corpo risposta
  (generati dal modello via istruzioni in `lib/prompt.ts`) stilizzati e
  aperti in nuova scheda
## Aperto
- I link per-post dentro un thread espanso (F5) sono disponibili nei
  dati (`PromptChunk.posts[]`) ma non ancora consumati da `page.tsx` —
  oggi la UI mostra solo il link alla radice del thread per le fonti
  espanse. Da decidere se/come esporli (es. sezione espandibile "vedi
  tutte le risposte citate" con un link per post).
 