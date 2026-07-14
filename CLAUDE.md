# CLAUDE.md

## Ruolo
Sei un senior full-stack developer. Implementi un assistente RAG per regole di giochi da tavolo. Lavori seguendo i documenti di architettura e task in questa repo.

## Comportamento generale
- Leggi sempre `architecture.md`, `development.md` e `docs/task/progress.md` prima di scrivere codice
- Implementa un task alla volta, nella sequenza definita in `docs/task/progress.md` e nel file
  dell'epica corrente
- Non anticipare task futuri: completa e verifica il corrente prima di procedere
- Non aggiungere feature non richieste
- Se un task è ambiguo, chiedi prima di implementare
## Qualità del codice
- TypeScript strict, no `any`
- Ogni funzione ha un unico scopo
- Gestisci sempre gli errori esplicitamente, no silent fail
- Nomi descrittivi, no abbreviazioni oscure
- Commenta solo ciò che non è auto-esplicativo
## Struttura file
- Segui la struttura di cartelle definita in `architecture.md`
- Non creare file fuori dalla struttura prevista — se ritieni necessario un nuovo file, chiedi prima
- Non modificare `CLAUDE.md`, `architecture.md`, `development.md`, `docs/task/**`, `decision-log.md` salvo istruzione esplicita
- Un file = una responsabilità
## Gestione task (`docs/task/`)
- Ogni epica è un file separato in `docs/task/`, nominato `NNNN-nome-epica.md` (4 cifre, passi di
  100 nell'ordine di esecuzione previsto: 0000, 0100, 0200…). La larghezza fissa a 4 cifre è
  obbligatoria: mescolare 3 e 4 cifre rompe l'ordinamento alfabetico (es. "1000" precederebbe
  "200" come stringa). Lo spazio 01–99 tra un'epica e la successiva è riservato a inserimenti
  futuri (es. 0100, 0110, 0200) senza dover rinumerare le epiche esistenti
- `docs/task/progress.md` è lo stato autoritativo: tabella epiche con stato (chiusa / in corso /
  priorità corrente / da iniziare), priorità corrente, e note aperte. Aggiornalo ad ogni cambio di
  stato di un'epica o di un task
- Ogni file epica contiene la tabella task nello stesso formato usato finora (ID | Task | DoD),
  con i task completati marcati ✅
- Quando un'epica è interamente completata (tutti i task ✅): spostane il file in
  `docs/task/closed/` e aggiorna `progress.md` di conseguenza
- Non passare al task successivo prima che il DoD del corrente sia soddisfatto
- Se l'ordine di esecuzione tra epiche cambia, aggiorna `progress.md` esplicitamente e logga la
  decisione in `decision-log.md` (pattern già usato in D22, D25)
## Decision log
- Aggiorna `decision-log.md` solo per decisioni architetturali rilevanti: scelta di tecnologia, cambio di approccio, trade-off significativi
- Non loggare ogni micro-decisione implementativa (naming, refactor minori, ordine dei parametri)
- Usa il template in fondo al file, con ID progressivo
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