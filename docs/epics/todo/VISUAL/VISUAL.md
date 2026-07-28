# Epica VISUAL — Riferimenti visivi

**Stato:** nice to have — in coda a tutte le epiche prioritarie

## Contesto

Alcune regole fanno riferimento a componenti/callout visivi (es. lettere A-N nel manuale Brass
per Birrifici Rurali, spazi Mercante, ecc.) che il testo da solo non rende comprensibili —
osservato ricostruendo `brass_manual_organized.md` a mano (sessione 2026-07-24), dove alcuni
riferimenti a lettere di legenda sono stati omessi perché privi di senso senza l'immagine
associata.

`gemini-embedding-001` è solo testuale — non esiste embedding diretto immagine→stesso spazio
vettoriale dei chunk attuali. Due strade possibili:

1. Descrizioni testuali generate via Gemini vision a ingest-time, trattate poi come chunk
   normali — pattern già in uso per la pulizia Markdown ("LLM ai bordi").
2. Embedding multimodale separato con retrieval/merge dedicato — più complesso, richiede
   modifica schema.

## Task

Vedi directory `VISUAL/` per i task singoli.

| ID | Titolo | Stato |
|---|---|---|
| VISUAL-00001 | Scoping con esempi reali e scelta approccio | todo |

## Note aperte

- Nice to have, non bloccante — priorità bassa rispetto alle altre epiche.
