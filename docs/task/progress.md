# progress.md

*Stato di avanzamento delle epiche. Aggiornato ad ogni chiusura o spostamento di epica — vedi
`CLAUDE.md` per le regole di gestione.*

## Epiche

| # | File | Epica | Stato |
|---|---|---|---|
| 0000 | `closed/0000-setup.md` | Setup | ✅ chiusa |
| 0100 | `closed/0100-eval-harness.md` | Eval harness | ✅ chiusa |
| 0200 | `closed/0200-ingest-pdf.md` | Ingest PDF | ✅ chiusa |
| 0300 | `closed/0300-retrieval-risposta.md` | Retrieval e risposta | ✅ chiusa |
| 0400 | `closed/0400-fase3-citazioni-fallback-deploy-selezione-gioco.md` | Fase 3 — citazioni, fallback, deploy, selezione gioco | ✅ chiusa |
| 0500 | `0500-forum-bgg.md` | Forum BGG | **priorità corrente** |
| 0510 | `closed/0510-refactor-tech-debt.md` | Refactor tecnico (package, doc, decision-log) | ✅ chiusa |
| 0550 | `0550-retrieval-query-enhancement.md` | Retrieval query enhancement | quasi chiusa (resta Q4) |
| 0560 | `0560-ingest-manuale-migliorato.md` | Miglioramento ingest manuale | punto 1 ✅, punto 2 ✅ (D40), punto 3 aperto |
| 0570 | `0570-link-bgg-citazioni.md` | Link BGG nelle citazioni | parziale (aperto caso link per-post) |
| 0600 | `0600-fase3-continua.md` | Fase 3 (continua) — S3.2–S3.5, S3.7 | dopo 0500 |
| 0700 | `0700-chat-multilingua.md` | Chat multilingua | dopo 0600 |
| 0800 | `0800-ui-uplifting.md` | UI Uplifting | dopo 0700 |
| 0900 | `0900-chat-con-contesto.md` | Chat con contesto | dopo 0800 |
| 1000 | `1000-ai-provider-adapters.md` | AI Provider Adapters | dopo 0900 |
| 1100 | `1100-teach-me-the-game.md` | Teach me the game | ultima |

## Priorità corrente

Epica **0500 — Forum BGG**: F1-F5 completati (F4 verificato end-to-end su Hegemony,
sessione 2026-07-26 — v. `0500-forum-bgg.md` per i bug trovati e corretti nel processo).
Restano F6 (rifinitura UI), F7-F8 (eval Hegemony). Brass Birmingham va re-ingestato da
capo (manuale + forum): `games.bgg_id` risultava errato (28720, id di Brass: Lancashire,
invece di 224517). Epica 0510 (refactor tecnico) chiusa — v.
`closed/0510-refactor-tech-debt.md`.
Epica 0550 (query enhancement) quasi chiusa, resta solo Q4 (misurazione costo/latenza).

## Note aperte

- Brass Birmingham da re-ingestare da capo (manuale + forum) dopo la correzione di
  `games.bgg_id` — v. `0500-forum-bgg.md`, sezione bug F4. Non ancora pianificato come task.
- Baseline eval 003 (impatto D21) resta deferred — vedi `closed/0100-eval-harness.md` e
  `docs/baselines/`.
- Upgrade Tier 1 Gemini (a pagamento): dati di prezzo raccolti (embedding
    $0.15/1M token, generazione $0.25/$1.50 per 1M input/output), deciso di
    rimandare finché non si valida l'ingest su un secondo gioco oltre Brass.
    Potrebbe ridurre l'urgenza dell'Epica A (BYOK, D23) se il tetto RPD
    condiviso smette di essere un vincolo reale — da rivalutare quando si
    arriva a quell'epica, non prima.
- Puntatore a `docs/task/0560-ingest-manuale-migliorato.md` — punto 1
    (check completezza) risolto da D36/D37, punto 2 (granularità chunk)
    risolto da D39+D40 (confine appiattito `###`/`####` + grassetto) — non
    ancora rivalutato con un eval completo dopo il fix. Punto 3
    (small-to-big manuale) resta aperto, priorità da confermare.
- Puntatore a `docs/task/0900-riferimenti-visivi.md` — nice to have, in
  coda dopo 1100.
- Puntatore a `docs/task/0570-link-bgg-citazioni.md` — fatto per il caso
  principale, aperto il caso dei link per-post nei thread espansi.
- Nota su D32 (prompt: non introdurre argomenti non richiesti): verificato
  su un caso concreto, da ri-controllare con un eval completo quando si
  riprende il lavoro — potrebbe migliorare ulteriormente bb-09 (Epica Q).