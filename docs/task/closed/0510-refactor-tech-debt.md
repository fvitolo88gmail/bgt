# Epica 0510 — Refactor tecnico: package, documentazione, decision-log, permessi DB

**Stato:** ✅ chiusa (R1, R2, R3 completati — permessi DB estratti, trattati altrove, v. nota sotto)

## Contesto

L'approccio POC seguito finora ha accumulato debito tecnico in diverse aree
indipendenti tra loro:

1. `scripts/` e i componenti React inline non sono organizzati in package/moduli coerenti
2. `architecture.md`/`development.md` non riflettono più esattamente la struttura reale del progetto
3. `docs/decision-log.md` è cresciuto molto (40+ entry, diverse molto verbose) ed è diventato scomodo da consultare

Le tre aree sono indipendenti — possono essere eseguite in ordine diverso o in parallelo. Ordine consigliato: R1, poi R2 (dipende da R1), poi R3.

**Nota:** la questione dei permessi DB (RLS, esposizione anon key) è stata estratta da questa epica — trattata a parte, in un'altra sede.

## Istruzioni per l'esecutore (Gemini CLI)

- Leggi `CLAUDE.md`, `architecture.md`, `development.md` e `docs/decision-log.md` prima di iniziare
- Esegui un task alla volta, verifica la DoD prima di passare al successivo
- Questa epica autorizza esplicitamente la creazione/spostamento di file e cartelle — deroga puntuale alla regola generale di `CLAUDE.md` ("non creare file fuori dalla struttura prevista")
- Se un task è ambiguo o richiede una scelta architetturale non specificata qui, **fermati e chiedi** — non improvvisare, in particolare su R4
- Non toccare `eval/fixtures/**`; non modificare lo schema DB oltre a quanto specificato in R4
- Un commit per task completato, messaggio `[R#.#] descrizione breve`

---

## R1 — Organizzazione in package (scripts + components)

| ID | Task | DoD |
|---|---|---|
| R1.1 ✅ | Raggruppa `scripts/` per dominio: `scripts/forum/` (forum-discover.ts, forum-fetch.ts, forum-ingest.ts, sync-forum.ts), `scripts/manual/` (ingest-pdf.ts, markdown-from-json.ts, `manual-parser/` esistente spostato dentro), `scripts/diagnostics/` (diagnose-retrieval.ts, diagnose-full-context.ts, eventuali altri script `diagnose-*`) | Nessuno script rimane a livello radice di `scripts/` salvo utility davvero trasversali; tutti gli import relativi aggiornati; `npx ts-node --project scripts/tsconfig.json <nuovo-path>` funziona per ogni script spostato |
| R1.2 ✅ | Aggiorna gli script npm in `package.json` (es. `ingest:pdf`) con i nuovi path | `npm run ingest:pdf -- --json ... --game-id ...` funziona identico a prima |
| R1.3 ✅ | Estrai i componenti inline della chat (`app/game/[id]/page.tsx`) in `components/chat/`: almeno `MessageBubble`, `SourcesList`; valuta se separare anche l'input/composer se sufficientemente isolato | `page.tsx` importa i componenti da `components/chat/`; nessuna regressione visiva/funzionale in UI |
| R1.4 ✅ | Verifica build completa (`npm run build`) e tipo-check dopo tutti gli spostamenti | Build passa senza errori TypeScript — verificato con `tsc --noEmit` + `eslint` (0 errori); `next build` non eseguibile nel sandbox di verifica (manca binario swc linux, nessun accesso rete), da confermare con un `npm run build` locale |

---

## R2 — Documentazione (dipende da R1)

| ID | Task | DoD |
|---|---|---|
| R2.1 ✅ | Aggiorna il diagramma "Struttura cartelle" in `architecture.md` per riflettere R1 | Diagramma corrisponde esattamente all'output di `tree` sulla repo (esclusi `node_modules`, `.next`, `ingest/`) |
| R2.2 ✅ | Aggiorna `development.md` dove referenzia path di script spostati (sezione "Sviluppo locale") | Comandi copiati e incollati da `development.md` funzionano senza modifiche |
| R2.3 ✅ | Rileggi `CLAUDE.md` sezione "Struttura file" — verifica coerenza col nuovo layout, aggiorna se necessario | Nessuna contraddizione tra `CLAUDE.md` e la struttura reale — corretti riferimenti a `architecture.md`/`development.md`/`decision-log.md` (mancava il prefisso `docs/`) |

---

## R3 — Snellimento decision-log

| ID | Task | DoD |
|---|---|---|
| R3.1 ✅ | Crea `docs/decision-log-archive.md`: copia integrale delle entry attuali (versione completa, verbosa) come storico consultabile | File creato, contenuto identico all'attuale `decision-log.md` prima della modifica |
| R3.2 ✅ | Riscrivi `decision-log.md`: ogni entry ridotta a contesto (1 riga), scelta (1-2 righe), motivazione (1-2 righe) — max ~6-8 righe per entry, mantenendo ID e raggruppamento per sessione. In fondo a ogni entry: riferimento `→ dettaglio completo in decision-log-archive.md` | Ogni entry D01-D4x presente in forma condensata; nessuna decisione persa o alterata nel significato; il template in fondo al file resta invariato |
| R3.3 ✅ | Verifica leggibilità: il file condensato deve permettere di capire "cosa è stato deciso e perché" senza aprire l'archivio, per ciascuna entry | Lettura a campione di 5 entry (D07, D20, D28, D33, D38) confermata comprensibile da sole |

---

## Aggiornamento `progress.md`

Ad epica creata, aggiungere riga:

| # | File | Epica | Stato |
|---|---|---|---|
| 0510 | `0510-refactor-tech-debt.md` | Refactor tecnico (package, doc, decision-log, permessi DB) | **priorità corrente** |

Da decidere (non assunto qui): se mettere in pausa l'Epica 0500 o proseguirla in parallelo — chiedere conferma a Francesco prima di modificare lo stato di 0500 in `progress.md`.

**Nota successiva (2026-07-26):** `docs/decision-log-archive.md` (R3.1) è stato spostato in
`docs/archived/decision-log-archive.md` e congelato — non riceve più nuove entry. Regola aggiunta
in `CLAUDE.md`.