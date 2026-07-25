# Epica (numerazione provvisoria 0560) — Miglioramento ingest manuale

**Stato:** nota aperta, da ragionare — non ancora un task con DoD definiti

**Contesto:** durante la sessione del 2026-07-24/25 abbiamo scoperto che la
pipeline automatica di porting PDF→Markdown (`markdown-from-json.ts`, D19-D20)
aveva silenziosamente omesso 3 sezioni azione intere (Vendita, Ricognizione,
Sviluppo) su un manuale di 12 pagine — la revisione manuale prevista da D19 non
le ha intercettate. Il fix applicato in sessione (ricostruzione manuale del
markdown + fix del parser `##`/`###` in `splitIntoSections`) ha risolto Brass
Birmingham, ma solleva tre domande più ampie sulla pipeline stessa, valide per
ogni futuro gioco ingested.

---

## 1. Come ottimizzare il porting PDF→MD? Il check manuale va reso obbligatorio?

**Il problema di oggi non era mancanza di processo — il processo (D19) già
prevedeva revisione a mano.** Il problema è che la revisione manuale è
un'istruzione documentata (`docs/ingest-pdf.md`), non un gate imposto dagli
strumenti: niente impedisce di saltarla, e su un manuale di 12 pagine con
sezioni compresse sulla stessa pagina fisica (tutte `p. 11` per 4 azioni
diverse), anche una revisione attenta può non notare che 3 sezioni intere sono
sparite dall'outline — perché non c'è nulla da "notare per differenza", il
contenuto è proprio assente, non deformato.

**Direzioni possibili da valutare:**
- **Check di completezza automatico**, da eseguire tra `markdown-from-json.ts`
  e `ingest-pdf.ts`: confrontare il numero di sezioni/pagine trovate
  dall'outline (Fase 1) contro un conteggio indipendente (es. pattern-match
  di titoli in maiuscolo nel testo grezzo estratto da `extract-pdf.py`, prima
  che Gemini intervenga). Se l'outline ne trova meno di quelli rilevabili nel
  testo grezzo, bloccare l'ingest con un warning esplicito invece di
  procedere silenziosamente.
- **Confronto di lunghezza grezza**: se il Markdown generato è sensibilmente
  più corto (es. <60%) del testo estratto originale a parità di pagine,
  flaggare per revisione — è un segnale euristico ma economico, nessuna
  chiamata LLM aggiuntiva.
- **Rendere il gate esplicito nello script stesso**: `ingest-pdf.ts` potrebbe
  richiedere un flag esplicito (`--reviewed`) o la presenza di un file di
  conferma prima di procedere, invece di fidarsi che l'operatore l'abbia
  fatto — sposta la disciplina dal "ricordarsi di fare X" al "lo strumento
  non parte senza X".
- Nessuna di queste sostituisce la revisione umana per errori di *contenuto*
  (numeri, eccezioni deformate) — solo per l'assenza strutturale di sezioni,
  che è il tipo di bug scoperto oggi.

**Da decidere:** quale di questi (o quale combinazione) vale il costo
implementativo, dato che finora è successo su 1 gioco su N ingested finora.

---

## 2. Troppo pochi chunk (18 per Brass) — come aumentarli?

**Causa diretta, verificata oggi:** il fix del parser (`##` vs `###`) ha
smesso di trattare le sottosezioni (`### Cementificazione`, `### Stendardi
Località`, ecc.) come confini di chunk separati — giustamente, perché prima
perdevano il riferimento di pagina. Ma l'effetto collaterale è che tutto il
contenuto di una sezione `##` (che può includere 5-7 sottosezioni tematiche
diverse, es. `## Concetti di Gioco`) finisce in 1-2 chunk grandi invece che
in chunk piccoli e mirati.

**Conseguenza misurata in sessione:** la domanda bb-13 ("livello massimo di
Rendita") non recupera più il chunk corretto neanche con query enhancement
(Epica Q) attivo — il contenuto c'è, ma è annegato insieme a Carbone, Ferro,
Birra, Rete, Località Collegate nello stesso chunk. Meno chunk non è solo
"meno dettaglio disponibile", è attivamente peggio per il retrieval quando i
chunk sono troppo eterogenei internamente.

**Direzione promettente da esplorare:** trattare `###` di nuovo come confine
di chunk (tornando a chunk più piccoli e mirati), ma **ereditando la pagina
dal `##` padre più vicino** invece di trattarlo come contenuto muto o
lasciarlo senza pagina — cioè risolvere il bug originale (pagina persa)
senza reintrodurre l'effetto collaterale (fusione eccessiva). Questo
richiede modificare `splitIntoSections`/`buildChunks` in `ingest-pdf.ts` per
tracciare due livelli di header con un'unica pagina ereditata a cascata,
invece del comportamento attuale binario (o è un confine con pagina propria,
o è testo piatto).

**Altra leva indipendente:** abbassare `CHUNK_MAX_WORDS` (attualmente 500,
D19-D20) forzerebbe più sub-divisioni anche dentro sezioni `##` singole, ma
è una leva più grezza — non risolve la fusione tematica, solo la lunghezza.

---

## 3. Small-to-big anche per il manuale, come già fatto per il forum (D28)?

Idea: invece di scegliere fissamente la granularità del chunk embeddato,
applicare lo stesso pattern già validato per il forum — un chunk piccolo e
mirato (es. a livello di paragrafo o `###`) viene embeddato e usato per il
retrieval, ma quando vince, il sistema espande a runtime recuperando l'intero
contesto del genitore (la sezione `##` completa, o anche l'intero capitolo)
da uno storage non-embeddato — esattamente come `forum_posts`/
`expandForumThread` fanno oggi per i thread.

**Perché è interessante:** risolverebbe simultaneamente i punti 2 e 3 sopra
— chunk piccoli e precisi per la ricerca (buon segnale embedding, niente
dilution), ma risposta finale comunque generata con il contesto completo del
paragrafo/sezione, non un frammento isolato che potrebbe mancare di
riferimenti impliciti a ciò che lo circonda.

**Cosa servirebbe, in bozza (da approfondire, non ancora una scelta):**
- Uno storage parallelo a `chunks` per il manuale, analogo a `forum_posts`:
  es. `manual_sections` con l'intero testo della sezione `##` per gioco,
  non embeddato
- Ogni chunk piccolo (embeddato, in `chunks`) porterebbe un riferimento al
  genitore (es. `parent_section_id` o semplicemente `section`+`page` già
  esistenti come chiave di join, se sufficientemente univoci)
- Una funzione `expandManualSection()` analoga a `expandForumThread()`,
  richiamata da `matchChunksForPrompt` quando un chunk `source='manual'`
  vince il retrieval

**Domanda aperta da risolvere prima di implementare:** qual è la giusta
unità "piccola" per il manuale? Il forum ha un'unità naturale (il post);
il manuale non ha un equivalente altrettanto netto — `###` è un candidato
ragionevole ma non tutte le sezioni hanno sottosezioni con questo livello di
granularità (alcune sono già brevi e piatte, come `Vincere la Partita`).
Andrebbe verificato che il pattern non introduca overhead senza beneficio
sulle sezioni già piccole.

---

## Relazione con altri task aperti

- Punto 2 è un prerequisito diretto per rendere pienamente efficace
  l'Epica Q (0550, query enhancement) — un query enhancement eccellente non
  può recuperare un chunk che semplicemente non esiste come unità distinta
  (vedi bb-13, non risolto dall'enhancement per questo motivo esatto)
- Punto 3, se implementato, renderebbe il punto 2 in parte superfluo (la
  fusione a chunk grandi diventerebbe un vantaggio anziché un problema, dato
  che il "grande" è recuperato solo a valle di un match preciso)
- Nessuno di questi tre punti è bloccante per la chiusura di 0550 — sono
  migliorie strutturali successive, da valutare con priorità dopo aver
  misurato l'impatto di 0550 sull'eval (baseline 004)
- **Evidenza aggiuntiva (baseline 004, 2026-07-25):** 3 fallimenti su 3
  residui post-0550 (bb-13, bb-18, bb-20) sono tutti riconducibili al
  punto 2 di questa nota (fusione chunk). Priorità alzata rispetto a
  quando questa nota è stata aperta.