# Epica L — Chat multilingua

**Stato:** da iniziare — dopo `0600-fase3-continua.md`

## Task

| ID | Task | DoD |
|---|---|---|
| L1 | Aggiorna `lib/prompt.ts`: istruzione esplicita di rispondere nella stessa lingua della domanda | risposta in IT per domanda IT, in EN per domanda EN, testato manualmente |
| L2 | Verifica qualità retrieval cross-lingua (query EN su chunk IT) | almeno 3 domande di test EN su Brass Birmingham restituiscono chunk pertinenti |
| L3 | Estendi fixture eval con un sottoinsieme di domande in lingua diversa dal manuale | eval gira senza crash, accuratezza cross-lingua documentata (anche se sotto soglia — è baseline, non gate) |
