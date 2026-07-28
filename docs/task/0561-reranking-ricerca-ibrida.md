# Epica 0561 — Reranking e ricerca ibrida lessicale+semantica

**Contesto:** emerso durante la diagnosi di 0551 (D46-D48), non risolto lì per non mischiare
concern diversi. Due limiti strutturali distinti dell'attuale `matchChunksForPrompt`
(`lib/retrieval.ts`), entrambi osservati concretamente su Hegemony:

1. La selezione finale si basa solo su similarità coseno grezza, senza che nulla "legga"
   davvero la pertinenza di un chunk alla domanda specifica. Il sistema compensa con euristiche
   a soglia/conteggio (`MIN_MANUAL_CHUNKS`, `MIN_MANUAL_SIMILARITY`, `topK`) che vanno ritarate
   a mano ogni volta che emerge un caso nuovo — pattern già visto diventare fragile in
   `prompt.ts` (v. sessione 2026-07-27, categoria PREMESSA ERRATA).
2. Solo ricerca semantica, nessuna componente lessicale. Caso concreto osservato: la domanda
   "che differenza c'è tra Sciopero e Manifestazione?" (Hegemony) non recupera nulla sull'azione
   "Demonstration" — il termine italiano "Manifestazione" non ha garanzia di allinearsi
   all'embedding di "Demonstration" nel manuale inglese, un limite intrinseco degli embedding su
   terminologia di gioco poco frequente nel training. Risolto in sessione SOLO quando l'utente
   nominava esplicitamente "Demonstration" nella domanda — non è una soluzione, è che il caso di
   test aggirava il problema.

---

## Task

| ID | Task | DoD |
|---|---|---|
| R1 | Reranking a valle del retrieve ampio già esistente (`RAW_CANDIDATES_PER_SOURCE`): una chiamata LLM dedicata (batch di chunk + domanda originale, non arricchita) assegna un punteggio di pertinenza reale per candidato, sostituendo `selectWithReservedBudget` come meccanismo di selezione finale | ✅ Implementato (`lib/reranking.ts`, nuovo file, fail-soft) e verificato: caso Legittimità (D52, regressione) risolto in modo consistente su più run — i 2 chunk "Middle Class" fuori tema non entrano più; caso "Buy Goods & Services" presente in 2 run su 3 (varianza di campionamento nota, stessa categoria di HyDE — non un fallimento sistematico) |
| R2 | Full-text search Postgres (`tsvector`/`ts_rank`) come componente lessicale aggiuntiva nel merge di `matchChunksForPrompt`, accanto a pgvector | Una query con un termine esatto del manuale (es. "Demonstration") recupera il chunk giusto anche se l'embedding semantico lo classificherebbe più in basso |
| R3 | Traduzione della query grezza (non solo dei paragrafi HyDE) nella lingua del manuale (`games.manual_language`, Epica 0551), usata come query aggiuntiva per il retrieval di base | La domanda "che differenza c'è tra Sciopero e Manifestazione?" recupera il chunk "Demonstration" senza che l'utente debba nominarlo esplicitamente in inglese |
| R4 | Eval/verifica manuale su tutte le domande diagnosticate in sessione 2026-07-27/28 dopo R1-R3 | Nessuna regressione; caso Manifestazione/Demonstration e caso beni magazzino entrambi risolti |

**Non in scope qui:** granularità del chunking (0560) — le due epiche sono complementari, non
sostitutive: un chunk ben tagliato ma non recuperato per gap lessicale resta un fallimento, e
viceversa. Ordine di lavoro consigliato: chiudere prima 0560 punto 3, poi questa, perché un
reranking su chunk ancora diluiti avrebbe meno segnale su cui lavorare.
