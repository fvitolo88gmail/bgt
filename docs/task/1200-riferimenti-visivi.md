# Epica (numerazione provvisoria 0900) — Riferimenti visivi

**Stato:** nice to have — in coda a tutte le epiche prioritarie, dopo 1100
"Teach me the game"

## Problema
Alcune regole fanno riferimento a componenti/callout visivi (es. lettere
A-N nel manuale Brass per Birrifici Rurali, spazi Mercante, ecc.) che il
testo da solo non rende comprensibili — osservato ricostruendo
`brass_manual_organized.md` a mano (sessione 2026-07-24), dove alcuni
riferimenti a lettere di legenda sono stati omessi perché privi di senso
senza l'immagine associata.

## Fattibilità (nota preliminare)
`gemini-embedding-001` è solo testuale — non esiste embedding diretto
immagine→stesso spazio vettoriale dei chunk attuali. Due strade:

1. **Descrizioni testuali generate via Gemini vision a ingest-time**,
   trattate poi come chunk normali — pattern già in uso per la pulizia
   Markdown ("LLM ai bordi").
2. **Embedding multimodale separato** con retrieval/merge dedicato — più
   complesso, richiede modifica schema.

## Priorità
Nice to have, non bloccante — da affrontare dopo che tutte le epiche
prioritarie attuali (0500, 0550, 0560, Phase 3 rimanente) sono chiuse.

## Prossimo passo quando si riprende
Scoping con 2-3 esempi concreti reali (non ipotetici) prima di scegliere
l'approccio — stesso principio già seguito per l'Epica Q (fixture prima
di implementare).