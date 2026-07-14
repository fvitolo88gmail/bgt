# Epica 1 — Ingest PDF

**Stato:** ✅ chiusa

## Task

| ID | Task | DoD |
|---|---|---|
| S1.1 | ✅ Script Python `extract-pdf.py` | JSON con sezioni, testo, metadati |
| S1.2 | ✅ Script TS `ingest-pdf.ts`: chunking header-aware con overlap | nessun chunk > 600 parole |
| S1.3 | ✅ Integrazione embedding, salvataggio `source='manual'` | righe in DB con vettori non null |
| S1.4 | ✅ Verifica retrieval manuale | risultati sensati per 3 domande test |
