# Epica 0551 — Retrieval: lingua HyDE e recall manuale

**Contesto:** diagnosi in sessione (2026-07-27/28) partita da un errore fattuale osservato su
Hegemony ("la Classe Media può usare i beni nei magazzini per soddisfare i bisogni?" → risposta
"sì" generalizzata in modo scorretto). Isolato con `scripts/diagnostics/diagnose-retrieval.ts`,
`diagnose-full-context.ts` e (nuovo) `diagnose-query-enhancement.ts`:

1. Il chunk manuale con la regola corretta (`Classe Media — Free Actions`/`Basic Actions`, righe
   870-905 di `ingest/hegemony/manual.md`) non arriva mai al contesto finale, nemmeno alzando
   `topK`/`MIN_MANUAL_CHUNKS` — perde sistematicamente il confronto di similarità anche contro
   altri chunk manuale più generici (Cover Needs, Overview).
2. Causa radice identificata: `QUERY_ENHANCEMENT_PROMPT` (`lib/retrieval.ts`, Epica 0550) non
   specifica la lingua di output dei paragrafi HyDE. Verificato con
   `diagnose-query-enhancement.ts`: per una query in italiano, i paragrafi generati sono anche
   loro in italiano — mentre il manuale Hegemony è in inglese. Il query enhancement (nato per
   chiudere il gap lessicale) non chiude il gap cross-lingua, il vantaggio principale della
   tecnica per questo corpus non scatta mai.
3. La lingua del manuale non è un campo esistente in `games` — può variare da gioco a gioco
   (constatato con Francesco), quindi il fix non può essere una stringa fissa nel prompt.

**Relazione con altri task aperti:** punto 2 del task `0560-ingest-manuale-migliorato.md`
(granularità chunk) resta la causa concorrente non affrontata qui — chunk troppo eterogenei
("Basic Actions parte N") restano un problema anche a gap linguistico chiuso. Questa epica non
lo duplica: si limita al fix lingua + ri-validazione dei parametri di recall già toccati in
sessione diagnostica.

---

## Task

| ID | Task | DoD |
|---|---|---|
| L1 | Aggiungere `manual_language` a `games` (migration, default `'en'`, backfill dei giochi esistenti) | ✅ Migration `20260728000000_games_manual_language.sql` creata (default `'en'` copre Hegemony via backfill automatico su colonna NOT NULL DEFAULT) |
| L2 | `QUERY_ENHANCEMENT_PROMPT` riceve `manual_language` ed esplicita la lingua di output dei paragrafi HyDE | ✅ Verificato con `diagnose-query-enhancement.ts`: paragrafi generati in inglese per Hegemony (prima erano in italiano) |
| L3 | Ri-validare `MIN_MANUAL_CHUNKS`/`topK` dopo L2 | ❌ **Chiuso come non risolutivo**: `diagnose-full-context.ts` sulla domanda test conferma che il chunk "Free Actions"/"Basic Actions" NON entra nel contesto finale nemmeno con lingua allineata (EN query-enhancement vs EN manuale) — la causa dominante non era il gap linguistico ma la diluizione del chunk stesso (v. L4/relazione con 0560) |
| L4 | Ripassare a mano le altre domande diagnosticate in sessione | Non eseguito — rimandato: la causa radice residua (chunking) va risolta prima di considerare la ri-verifica significativa |

## Esito

**Chiusa parzialmente riuscita (sessione 2026-07-27/28).** Il fix lingua (L1+L2) è corretto,
verificato, e resta in produzione — buona pratica generalizzabile a ogni gioco con manuale non
italiano, indipendentemente dal problema che segue. Non basta però a risolvere il caso che aveva
aperto l'epica: confermato che la causa dominante è la granularità del chunking (sezioni ad
azioni multiple diluite in frammenti "parte N" — punto 2/3 di `0560-ingest-manuale-migliorato.md`),
non la lingua. Prossimo passo: riprendere `0560` punto 3 (small-to-big per il manuale) come lavoro
attivo, non più solo nota aperta.

**Temi identificati ma non affrontati qui, da valutare separatamente:**
- Selezione finale basata solo su similarità coseno, senza reranking a valle.
- Ricerca solo semantica, nessuna componente lessicale/keyword — rilevante per terminologia
  specifica di gioco (es. "Manifestazione" vs "Demonstration" su Hegemony, osservato in sessione).
