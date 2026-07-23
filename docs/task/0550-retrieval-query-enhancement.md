# Epica Q (numerazione provvisoria 0550) — Retrieval query enhancement

**Stato:** non iniziato — proposto in sessione 2026-07-23, dopo osservazione
diretta del problema su Brass Birmingham

## Contesto

Durante i test manuali su Brass Birmingham (post-F5), osservato un limite
del retrieval attuale: `matchChunksForPrompt` cerca per similarità sulla
domanda dell'utente così com'è formulata. Due classi di domande soffrono:

1. **Domande composte** — uniscono più meccaniche di gioco in un'unica
   interazione specifica (es. "dopo aver cementificato l'industria di un
   altro giocatore, posso vendere dalla mia?" — unisce Cementificazione +
   Vendita). Il retrieval trova chunk pertinenti a ciascuna meccanica
   singolarmente, ma raramente quello che descrive esplicitamente la LORO
   interazione, se un chunk simile esiste.
2. **Domande lessicalmente distanti dal manuale** — l'utente usa
   linguaggio colloquiale ("vendere dalla mia") mentre il manuale usa
   terminologia di regole ("Azione di Vendita", "Tessera Industria",
   "girare la tessera"). Verificato empiricamente: la stessa
   informazione, se la query è riformulata in linguaggio più vicino al
   manuale, emerge correttamente nel top-k; con linguaggio colloquiale,
   spesso no (osservato confrontando due domande sulla stessa area di
   regole, una risolta bene una no).

**Nota di scope:** questo non è (necessariamente) un problema di sintesi —
verificato in sessione che il modello di generazione SA combinare
correttamente più fonti quando gli arrivano (vedi test "cosa può fare la
nuova industria dopo Cementificazione", sintesi corretta cross-fonte). Il
collo di bottiglia è a monte, nel retrieval: i chunk giusti a volte non
arrivano nemmeno al modello.

## Opzioni valutate in sessione

1. **Decomposizione della query** — un passaggio LLM leggero scompone la
   domanda composta nei concetti costituenti (es. "Cementificazione" +
   "vendita" + eventualmente "1 tessera per località"), esegue retrieval
   separato per ciascun concetto, unisce i risultati (deduplicando) prima
   di passarli al modello di generazione.
2. **HyDE (Hypothetical Document Embeddings)** — invece di embeddare la
   domanda utente così com'è, si genera prima con l'LLM una risposta
   ipotetica in linguaggio simile al manuale, e si embedda quella per il
   retrieval — una risposta ipotetica tende ad avvicinarsi lessicalmente
   al testo reale delle fonti più della domanda grezza dell'utente.
3. *(scartata per ora, più costosa)* grafo di riferimenti incrociati a
   ingest-time tra sezioni del manuale — risolverebbe collegamenti che non
   esistono in NESSUNA formulazione lessicale, ma richiede un secondo
   passaggio di ingest e una rappresentazione dei collegamenti nello
   schema. Non scelta perché i due problemi osservati finora sembrano
   entrambi risolvibili a livello di query, non di dati.

**Nessuna decisione presa in sessione tra 1 e 2** — vanno discusse/provate
prima di implementare.

## Task proposti

| ID | Task | DoD |
|---|---|---|
| Q1 | Raccogliere 5-10 domande "di interazione" reali (concetti che si toccano nel gioco ma non sono mai discussi insieme esplicitamente nel manuale) come mini-fixture di regressione, PRIMA di scegliere quale opzione implementare | fixture salvata, sia per Brass sia idealmente per un secondo gioco quando disponibile |
| Q2 | Decidere tra opzione 1 (decomposizione) e 2 (HyDE), o entrambe in sequenza — con quale criterio: costo per query (1 chiamata LLM aggiuntiva in entrambi i casi), complessità di merge dei risultati (più alta per la 1, che produce N ricerche invece di 1) | decisione loggata in decision-log.md |
| Q3 | Implementare l'opzione scelta in `lib/retrieval.ts`, senza rompere il comportamento esistente per query semplici (probabile: attivare il meccanismo solo sopra una soglia di lunghezza/complessità della domanda, o sempre — da decidere in Q2) | passa la fixture Q1 con miglioramento misurabile rispetto a oggi |
| Q4 | Misurare il costo reale in latenza (chiamata LLM extra prima del retrieval, percepibile dall'utente) e quota (1 chiamata generazione in più per domanda, oltre a quella finale) | numeri concreti raccolti, non stimati |

## Note

- Dipende concettualmente da `lib/gemini.ts` (`geminiClient.generate`), già
  esistente — nessuna nuova integrazione di modello richiesta
- Se si opta per Tier 1 (nota aperta in progress.md), il costo per query
  aggiuntiva diventa trascurabile — rende meno urgente ottimizzare Q3 per
  minimizzare le chiamate, ma non cambia la scelta architetturale tra 1 e 2
- Va tenuto separato dal discorso "domande di chiarimento" (idea emersa
  nella stessa sessione, poi giudicata un problema diverso — ambiguità
  della domanda, non debolezza del retrieval — e scartata per ora per
  mancanza di stato conversazionale, dipendenza da Epica 0900)