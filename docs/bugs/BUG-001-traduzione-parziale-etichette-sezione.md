# BUG-001 — Traduzione incoerente delle etichette di sezione manuale in risposte non italiane

**Stato:** noto, non risolto — accantonato dopo 3 tentativi di fix via prompt (v. sotto)
**Emerso in:** POC-00014 (chat multilingua), sessione 2026-07-29

## Sintomo

In una risposta generata in una lingua diversa dall'italiano (es. inglese), le etichette di
sezione del manuale citate tra parentesi quadre (es. `[Classe Lavoratrice — Strike]`) dovrebbero
essere tradotte nella lingua della risposta (es. `[Working Class — Strike]`) — sono etichette
editoriali interne assegnate dal nostro sistema, non testo letterale del manuale.

Il comportamento osservato è **incoerente all'interno della stessa risposta**: alcune citazioni
vengono tradotte correttamente, altre no. Esempio (risposta EN, stesso messaggio):

```
...as detailed in [Working Class — Buy Goods & Services (part 1)], page 14 and
[Middle Class — Buy Goods & Services], page 22.
Additionally, ... as explained in [Lo Stato — Action Phase], page 26.
```

Le prime due citazioni sono tradotte correttamente (incluso il suffisso "(part 1)", anch'esso
tradotto). La terza (`Lo Stato — Action Phase`) resta in italiano, nella stessa risposta.

## Tentativi di fix (tutti in `lib/prompt/shared.ts`, v. D61 e sessione 2026-07-29)

1. Aggiunta `RESPONSE_LANGUAGE_RULE` (istruzione generica: rispondi nella lingua della domanda,
   incluse le etichette di sezione) — non ha risolto, risposta restava in italiano.
2. Rinforzata `RESPONSE_LANGUAGE_RULE` (spostata come prima istruzione del prompt, aggiunta
   avvertenza anti-bias esplicita "queste istruzioni sono in italiano ma non è un segnale sulla
   lingua della risposta") — ha risolto il corpo della risposta (ora in EN), non le etichette di
   sezione tra parentesi quadre, rimaste in IT.
3. Trovata e rimossa una contraddizione diretta: `CITATION_FORMAT_RULES` diceva letteralmente di
   citare la sezione "esattamente come già presente nell'etichetta della fonte" — riscritta per
   istruire essa stessa la traduzione, con esempio concreto — ha risolto ALCUNE citazioni ma non
   tutte nella stessa risposta.
4. Aggiunto un promemoria con esempio concreto direttamente adiacente al blocco `CONTESTO:` (per
   sfruttare la vicinanza al punto dove il modello legge le etichette grezze) — ha risolto il
   caso "(parte N)" → "(part N)" testato in isolamento, ma il problema di incoerenza persiste su
   altre etichette nella stessa risposta (es. "Lo Stato").

## Ipotesi

Il comportamento non sembra un problema di istruzione mancante (le istruzioni ci sono, sono
esplicite, ripetute, con esempi) ma di **affidabilità del modello** (`gemini-3.1-flash-lite`) nel
seguire una regola di trasformazione testuale in modo uniforme su TUTTE le occorrenze in un
output lungo con più citazioni — plausibilmente perché copia il testo delle etichette dal
CONTESTO man mano che genera, senza applicare la trasformazione in modo sistematico a ogni
occorrenza indipendente. Una scelta di prompt engineering non sembra più la leva giusta: servirebbe
o (a) un modello più capace per questo task, o (b) spostare la traduzione fuori dal path di
generazione (es. nomi di sezione canonici multilingua salvati in DB, o un post-processing
deterministico sul testo della risposta).

## Impatto

Basso-medio: il corpo della risposta è comunque nella lingua corretta (L1 di POC-00014 è
soddisfatto), il problema è limitato alle etichette di sezione tra parentesi quadre nelle
citazioni manuale — un dettaglio cosmetico, non una perdita di informazione o un errore fattuale.

## Prossimi passi (non ancora pianificati)

Da affrontare in una sessione dedicata, possibilmente:
- Backfill di un nome sezione canonico in inglese in DB (richiede migration + traduzione dei
  dati esistenti — v. `chunks.section`), da preferire alla traduzione a runtime.
- In alternativa, accettare il limite e basta.

Non aprire un task in un'epica finché non si decide la direzione.
