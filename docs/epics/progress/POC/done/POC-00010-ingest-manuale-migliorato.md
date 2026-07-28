# POC-00010 — Miglioramento ingest manuale

**Stato:** parzialmente superata dagli sviluppi successivi (D36-D40) — punto
1 e punto 2 risolti (da un percorso in parte diverso da quello proposto qui),
punto 3 ancora del tutto aperto. Aggiornato il 2026-07-26, vedi note per
punto sotto ogni sezione.

**Contesto (originale, 2026-07-24/25):** durante la sessione abbiamo scoperto
che la pipeline automatica di porting PDF→Markdown (`markdown-from-json.ts`,
D19-D20) aveva silenziosamente omesso 3 sezioni azione intere (Vendita,
Ricognizione, Sviluppo) su un manuale di 12 pagine — la revisione manuale
prevista da D19 non le ha intercettate. Il fix applicato in sessione
(ricostruzione manuale del markdown + fix del parser `##`/`###` in
`splitIntoSections`) ha risolto Brass Birmingham, ma solleva tre domande più
ampie sulla pipeline stessa, valide per ogni futuro gioco ingested.

**Nota importante:** la pipeline `markdown-from-json.ts` discussa qui è stata
nel frattempo sostituita da un sotto-sistema diverso, `scripts/manual/manual-parser/`
(ingest via vision PDF, D36) — non più testo pre-estratto. Alcuni dei problemi
sollevati sotto sono stati risolti come effetto collaterale del cambio di
pipeline, non implementando le soluzioni proposte qui punto per punto.

---

## 1. Come ottimizzare il porting PDF→MD? Il check manuale va reso obbligatorio? ✅ risolto (percorso diverso)

**Aggiornamento 2026-07-26:** risolto, ma non tramite le direzioni proposte
sotto (mai implementate). La pipeline vision (D36) elimina la causa radice —
`checkPageCoverage` in `scripts/manual/manual-parser/outline.ts` verifica che
l'unione dei range di pagina dell'outline copra ogni pagina del documento,
segnalando esplicitamente quelle scoperte, invece di scoprire sezioni mancanti
solo a campione. In più, `verify-completeness.ts` (D37, Fase 3) confronta
l'intero testo grezzo con l'intero markdown finale e restituisce un elenco
mirato di omissioni sospette (severità alta/bassa), rendendo trattabile la
revisione umana finale invece di sostituirla. Verificato su Hegemony: 5 punti
segnalati, di cui 2/3 "alta gravità" erano falsi positivi (contenuto presente
altrove) — resta genuina solo 1 omissione minore. **Non ancora risolto:** il
verificatore confronta in modo troppo locale (pagina-per-pagina) invece che a
piena consapevolezza dell'intero markdown finale (nota aperta in D37).

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

## 2. Troppo pochi chunk (18 per Brass) — come aumentarli? ✅ risolto

**Aggiornamento 2026-07-26:** implementata la "direzione promettente"
descritta sotto — vedi D39. `splitIntoSections` in
`scripts/manual/ingest-pdf.ts` tratta `###` come confine di chunk dentro la
sezione `##` corrente, ereditandone la pagina dal `##` padre più vicino
(titolo combinato "Sezione — Sottosezione"). Funziona bene per la
maggioranza del documento.

**Aggiornamento successivo (D40):** il gap lasciato aperto da D39 — la
pipeline vision (D36) genera sezioni con convenzioni di header incoerenti
tra chiamate isolate diverse (a volte `###`, a volte `####`, a volte solo
testo in **grassetto** senza header Markdown) — è stato chiuso: `###` e
`####` sono ora trattati come lo stesso livello di confine (appiattiti), e
una riga interamente in grassetto (pattern `^\*\*[A-Za-z][a-zA-Z &]*\*\*$`)
apre anch'essa un nuovo blocco. Il punto 2 di questa nota è considerato
risolto.

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

## 3. Small-to-big anche per il manuale, come già fatto per il forum (D28)? ✅ risolto (percorso diverso da quello proposto)

**Aggiornamento 2026-07-28 (D50):** risolto, ma NON con lo storage parallelo
`manual_sections`/`expandManualSection()` proposto sotto (mai implementato).
Durante la diagnosi di 0551 (D46-D48) è emerso un problema concreto e più
specifico di quanto ipotizzato qui: sezioni come "Basic Actions"/"Free
Actions" della Classe Media (Hegemony) elencano azioni eterogenee con bullet
propri (`*   **Buy Goods & Services**`, `*   **Use Healthcare**`...) che
`splitIntoSections` (`ingest-pdf.ts`) non riconosceva come confine di
chunk — restavano testo muto dentro il blocco della sottosezione `###`/`####`
corrente, diluendo l'embedding esattamente come il problema già risolto da
D39/D40 un livello più in alto.

**Causa diretta, generalizzata (non specifica a Hegemony):** `splitIntoSections`
riconosceva come confine solo header Markdown (`###`/`####`) ed etichette
INTERAMENTE in grassetto senza bullet (`**Titolo**`). Non riconosceva il
pattern, molto comune nei manuali di giochi da tavolo per liste di azioni,
`*   **Titolo Azione**` (bullet + titolo in grassetto, nessun altro testo
sulla riga, descrizione nei paragrafi seguenti).

**Fix applicato:** nuovo pattern di confine in `splitIntoSections` per bullet
di questo tipo (regex `^\*\s+\*\*([A-Za-z][a-zA-Z0-9 &/'’,()-]*)\*\*:?\s*$`),
trattato esattamente come l'etichetta in grassetto già gestita da D40 — stessa
logica, un livello di annidamento più profondo. Non tocca i bullet con testo
aggiuntivo sulla stessa riga (es. glossario "* **Industria**: Indicato dal
colore.").

**Perché questo invece del small-to-big proposto originariamente:** verificato
che espandere al "genitore" (l'intera sezione `##`/sottosezione `###`) qui
sarebbe stato controproducente — a differenza di un thread forum (unità
topicamente coerente, tutti i post sulla stessa domanda), una sezione come
"Basic Actions" è un contenitore eterogeneo (Propose Bill, Build Company, Buy
Goods & Services...). Espandere a quel "genitore" avrebbe semplicemente
spostato la diluizione dalla fase di retrieval a quella di generazione
(prompt gonfiato di azioni irrilevanti). Il chunking fine-grained come unità
finale (senza storage parallelo né espansione a runtime) risolve la causa
diretta senza questa complessità aggiuntiva.

**Verificato con dry-run** (`scripts/diagnostics/diagnose-chunking-dry-run.ts`,
nuovo — parsing puro, nessuna chiamata Gemini/DB) su Hegemony: "Classe Media
— Buy Goods & Services" (437 parole) e "Classe Media — Use Healthcare" (69
parole) ora chunk distinti; **zero chunk "(parte N)"** residui su tutto il
manuale (prima ce n'erano diversi); "Strike"/"Demonstration" (già corretti da
D40) restano corretti, nessuna regressione visibile su 226 sezioni totali.
**Chiuso definitivamente (2026-07-28, D51):** re-ingest di Hegemony eseguito.
Verificato con `diagnose-retrieval.ts --source manual`: "Classe Media — Buy
Goods & Services" salito da ~69% (fuori top-10 misto) a 72.7% (4° tra i soli
chunk manuale) grazie al solo re-chunking. Restava appena fuori dalla riserva
di 4 (affollata da chunk "Cover Needs" quasi-duplicati per ruolo) — alzata
`MIN_MANUAL_CHUNKS` a 6 e `topK` a 10 (D51, aggiustamento fine su un segnale
ormai vicino, non più una toppa su un segnale strutturalmente troppo debole
come l'alzata precedente). Verificato con `diagnose-full-context.ts` sul
caso originale: "Classe Media — Buy Goods & Services" ora nel contesto
finale. Caso chiuso end-to-end.

---

## Relazione con altri task aperti

- Punto 2 (risolto da D39 + D40) era un prerequisito diretto per rendere
  pienamente efficace l'Epica Q (0550, query enhancement) — un query
  enhancement eccellente non può recuperare un chunk che semplicemente non
  esiste come unità distinta; ora che il parsing è robusto a `###`/`####`/
  grassetto, questo limite dovrebbe essere rimosso
- Punto 3 resta l'unico aperto in questa nota. Se implementato, renderebbe
  il punto 2 sostanzialmente superfluo (la fusione a chunk grandi
  diventerebbe un vantaggio anziché un problema, dato che il "grande" è
  recuperato solo a valle di un match preciso) — ma con D39/D40 già in
  produzione, non più bloccante nel breve termine
- **Evidenza storica (baseline 004, 2026-07-25):** prima dei fix D39/D40, 3
  fallimenti su 3 residui post-0550 (bb-13, bb-18, bb-20) erano tutti
  riconducibili al punto 2 di questa nota (fusione chunk) — non ancora
  rivalutato con un eval completo dopo il fix (da fare, per confermare il
  miglioramento).