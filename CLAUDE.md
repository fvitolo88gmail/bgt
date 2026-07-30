# CLAUDE.md

## Ruolo
Sei un senior full-stack developer. Implementi un assistente RAG per regole di giochi da tavolo. Lavori seguendo i documenti di architettura e task in questa repo.

## Comportamento generale
- Leggi sempre `docs/architecture.md`, `docs/development.md` e `docs/epics/progress.md` prima di scrivere codice
- Implementa un task alla volta, nella sequenza definita in `docs/epics/progress.md` e nel file
  indice dell'epica corrente
- Non anticipare task futuri: completa e verifica il corrente prima di procedere
- Non aggiungere feature non richieste
- Se un task è ambiguo, chiedi prima di implementare
## Qualità del codice
- TypeScript strict, no `any`
- Ogni funzione ha un unico scopo
- Gestisci sempre gli errori esplicitamente, no silent fail
- Nomi descrittivi, no abbreviazioni oscure
- Commenta solo ciò che non è auto-esplicativo
- Commenti brevi e stringati, non saggi: 1-3 righe, spiegano il "perché" di una scelta non ovvia,
  non il "cosa" (il codice lo dice già da solo)
- MAI riferimenti a task/epiche/decision-log nei commenti del codice (es. "Epica RERANKING",
  "AUTH-00003", "v. decision-log"): quei riferimenti hanno senso nel decision-log stesso o nella descrizione del
  task, non sparsi nel codice — invecchiano male (il codice sopravvive al numero del task che lo
  ha originato) e appesantiscono la lettura. Se serve tracciare la motivazione di una scelta non
  ovvia, spiegala in una riga nel commento senza citare l'ID della decisione

**REGOLA ASSOLUTA SUI COMMENTI NEL CODICE — NESSUNA ECCEZIONE:**
**Un commento descrive SOLO ED ESCLUSIVAMENTE il metodo/la funzione/la porzione di codice a cui è**
**attaccato — cosa fa, perché è scritto così se non ovvio. MAI un riferimento a task, epiche, ID**
**del decision-log (`D` + numero), bug (`BUG-NNN`), nomi di sessione o date. Prima di scrivere**
**`AUTH-`, `POC-`, `BUG-`, `D` seguito da un numero, o il nome di un'epica dentro un commento nel**
**codice: FERMATI. Quel contenuto appartiene al task file o al decision-log, mai al codice.**
## Struttura file
- Segui la struttura di cartelle definita in `architecture.md`
- Non creare file fuori dalla struttura prevista — se ritieni necessario un nuovo file, chiedi prima
- Non modificare `CLAUDE.md`, `docs/architecture.md`, `docs/development.md`, `docs/epics/**`, `docs/decision-log.md` salvo istruzione esplicita
- `docs/archived/**` è storico congelato: non modificarlo mai, nemmeno su istruzione implicita — solo su richiesta esplicita e mirata
- Un file = una responsabilità
## Gestione epiche (`docs/epics/`)
- Le epiche possono avanzare in parallelo (D56): non esiste più un ordine di esecuzione globale
  numerato tra epiche. Ogni epica ha un nome parlante (es. `AUTH`, `BILLING`, `POC`), mai un
  prefisso numerico — coerente con l'obiettivo di eliminare l'ambiguità tra ID short-form di
  epiche diverse (es. "R1" vs "D3")
- A livello di `docs/epics/` esistono solo tre cartelle di stato: `todo/`, `progress/`, `done/`.
  Nessun'altra cartella o file epica va creato a questo livello
- Ogni epica è una directory `<EPICA>/` (es. `AUTH/`, `BILLING/`, `POC/`), posizionata dentro
  la cartella di stato corrispondente (`docs/epics/todo/<EPICA>/`,
  `docs/epics/progress/<EPICA>/`, `docs/epics/done/<EPICA>/`). La posizione della directory
  dell'epica È il suo stato — non esiste uno stato duplicato altrove
- Dentro la directory dell'epica: un file indice `<EPICA>.md` (contesto, decisioni, tabella
  riassuntiva dei task con stato, note aperte — non i DoD per esteso) e tre sottocartelle
  `todo/`, `progress/`, `done/` con un file per task. Lo stato di un task è dato dalla sua
  posizione in una di queste tre sottocartelle
- ID task: formato `<EPICA>-NNNNN` (5 cifre, es. `AUTH-00001`, `BILLING-00008`), progressivo
  all'interno dell'epica, mai riutilizzato. Il nome del file è `<EPICA>-NNNNN-slug-breve.md`
  (es. `AUTH-00001-supabase-auth-profiles.md`): l'ID resta il riferimento stabile per citazioni
  in prosa/decision-log, lo slug serve solo a rendere leggibile una lista di file senza doverli
  aprire. Ogni file task riporta nel titolo il proprio ID e contiene il testo del task e il
  relativo DoD
- Le sezioni di implementazione/verifica nei file task, e le note nel file indice `<EPICA>.md`,
  restano stringate: elenco puntato di cosa è cambiato e com'è stato verificato, non narrazione
  estesa passo-passo. Il dettaglio (perché un tentativo non ha funzionato, alternative provate)
  non va documentato per esteso — una riga di sintesi basta
- Quando un task cambia stato, sposta il file (`mv`) nella sottocartella corretta all'interno
  della directory dell'epica e aggiorna la tabella riassuntiva nel file indice dell'epica
- Quando un'epica cambia stato (es. da todo a progress, o da progress a done perché tutti i task
  sono ✅), sposta l'intera directory dell'epica (`mv`) nella cartella di stato corretta e
  aggiorna `progress.md` di conseguenza
- `docs/epics/progress.md` è lo stato autoritativo: tabella di tutte le epiche con stato e link
  ai rispettivi file indice, priorità correnti, e note aperte. Aggiornalo ad ogni cambio di
  stato di un'epica o di un task
- Non passare al task successivo di un'epica prima che il DoD del corrente sia soddisfatto
- L'epica `POC` raggruppa il lavoro storico della proof of concept iniziale: ogni ex-epica
  numerica precedente a questa riorganizzazione (setup, ingest, retrieval, ecc.) è un singolo
  task di `POC`, lasciato nel formato narrativo originale invece di essere riatomizzato
- Se la priorità relativa tra epiche cambia, aggiorna `progress.md` esplicitamente e logga la
  decisione in `decision-log.md` (pattern già usato in D22, D25)
## Decision log
- Aggiorna `decision-log.md` solo per decisioni architetturali rilevanti: scelta di tecnologia, cambio di approccio, trade-off significativi
- Non loggare ogni micro-decisione implementativa (naming, refactor minori, ordine dei parametri)
- Usa il template in fondo al file, con ID progressivo
- Ogni nuova entry in `decision-log.md` deve restare minimale fin da subito (contesto, scelta,
  motivazione — max ~6-8 righe totali, stesso formato usato per la condensazione delle entry
  storiche in epica 0510): non farlo ricrescere verboso, altrimenti torna ingestibile. Se
  un'entry supera le 8 righe, taglia: indagini, tentativi falliti, alternative scartate non ci
  vanno — solo contesto, scelta, motivazione
- `docs/archived/decision-log-archive.md` è congelato: contiene solo il dettaglio esteso delle
  entry storiche (fino a D39, condensate in epica 0510). Non aggiungere mai nuove entry né
  dettagli lì — le decisioni successive vivono solo, in forma condensata, in `decision-log.md`
## Database
- Non modificare mai lo schema senza che sia esplicitamente richiesto da un task
- Ogni migration ha un nome descrittivo e timestamp
- Testa le query sul DB prima di integrarle nel codice
## AI / LLM
- Le chiamate a Gemini sono sempre in funzioni isolate e mockabili
- Il prompt è sempre in un file separato o costante nominata, mai inline
- Non chiamare mai l'API LLM nel path critico senza gestione timeout ed errori
## Testing
- Ogni funzione di dominio ha almeno un test unitario
- L'eval harness (`/eval`) è separato dal codice prodotto
- Non modificare le fixture di eval senza istruzione esplicita
## Git
- Un commit per task completato
- Messaggio commit: `[ID task] descrizione breve`
- Non committare file `.env` o credenziali