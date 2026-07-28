# Epica POC — Proof of concept RAG per regole di giochi da tavolo

**Stato:** in corso — nucleo iniziale (POC-00001..00010) chiuso, lavoro di raffinamento
(POC-00011..00016) in corso/da fare

## Contesto

Raggruppa tutto il lavoro sull'assistente RAG a partire dal progetto vuoto: setup, ingest,
retrieval, citazioni, forum BGG, refactor tecnico, query enhancement, lingua/HyDE, ingest
manuale migliorato, reranking/ricerca ibrida, link BGG, fase 3 (ricerca/selezione gioco), chat
multilingua, UI uplifting, chat con contesto. Prima della riorganizzazione in cartelle
todo/progress/done (v. `decision-log.md` D56), questo lavoro era diviso in epiche numeriche
separate (0000–0900); ogni ex-epica è ora un singolo task di questa epica, per eliminare
l'ambiguità tra ID short-form di epiche diverse (es. R1 di un'ex-epica vs D3 di un'altra).

## Task

Ogni file sotto `{todo,progress,done}/` (dentro questa directory) è un task completo, lasciato nel formato originale
(narrativo, con eventuale tabella interna di sotto-step) per non perdere il contesto storico
delle decisioni prese durante l'implementazione:

| ID | Titolo | Stato |
|---|---|---|
| POC-00001 | Setup | ✅ done |
| POC-00002 | Eval harness | ✅ done |
| POC-00003 | Ingest PDF | ✅ done |
| POC-00004 | Retrieval e risposta | ✅ done |
| POC-00005 | Citazioni, fallback, deploy, selezione gioco | ✅ done |
| POC-00006 | Forum BGG | ✅ done |
| POC-00007 | Refactor tecnico (package, doc, decision-log) | ✅ done |
| POC-00008 | Retrieval query enhancement | ✅ done |
| POC-00009 | Retrieval: lingua HyDE e recall manuale | ✅ done |
| POC-00010 | Miglioramento ingest manuale | ✅ done |
| POC-00011 | Reranking e ricerca ibrida lessicale+semantica | in corso (priorità assoluta, v. D52) |
| POC-00012 | Link BGG nelle citazioni | in corso (caso principale ✅, caso per-post aperto) |
| POC-00013 | Fase 3 (continua): S3.2–S3.5, S3.7 | todo (S3.4 variante minima già ✅) |
| POC-00014 | Chat multilingua | todo |
| POC-00015 | UI Uplifting | todo |
| POC-00016 | Chat con contesto (server-side) | in corso, in pausa (C1-C3 ✅, C4-C5 todo) |

## Note aperte

- Brass Birmingham rimosso dal DB (manuale + forum) in attesa di un re-ingest migliorato dopo
  la correzione di `games.bgg_id` — v. `done/POC-00006-forum-bgg.md`, sezione bug F4.
- Limite di retrieval emerso dall'eval Hegemony (`heg-09`, v. `done/POC-00006-forum-bgg.md`): quando
  due thread genuini coprono lo stesso argomento con angolazioni diverse, il retrieval può
  portare in contesto solo il più generico. Da valutare in POC-00011 (topK più alto su query
  specifiche, o query rewriting mirato).
- Baseline eval 003 (impatto D21) resta deferred — v. `done/POC-00002-eval-harness.md` e
  `docs/baselines/`.
- Ordine di lavoro consigliato per POC-00011: un reranking su chunk ancora diluiti (v.
  POC-00010) avrebbe meno segnale su cui lavorare — chiudere prima quello.
