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
| 0500 | `closed/0500-forum-bgg.md` | Forum BGG | ✅ chiusa |
| 0510 | `closed/0510-refactor-tech-debt.md` | Refactor tecnico (package, doc, decision-log) | ✅ chiusa |
| 0550 | `closed/0550-retrieval-query-enhancement.md` | Retrieval query enhancement | ✅ chiusa |
| 0551 | `closed/0551-retrieval-lingua-hyde.md` | Retrieval: lingua HyDE e recall manuale | ✅ chiusa (parziale — fix lingua ok, causa dominante era il chunking, v. 0560) |
| 0560 | `closed/0560-ingest-manuale-migliorato.md` | Miglioramento ingest manuale | ✅ chiusa (punto 1 ✅, punto 2 ✅ D40, punto 3 ✅ D50/D51) |
| 0561 | `0561-reranking-ricerca-ibrida.md` | Reranking e ricerca ibrida lessicale+semantica | in corso (priorità assoluta, v. D52) |
| 0570 | `0570-link-bgg-citazioni.md` | Link BGG nelle citazioni | parziale (aperto caso link per-post) |
| 0600 | `0600-fase3-continua.md` | Fase 3 (continua) — S3.2–S3.5, S3.7 | dopo 0500 (S3.4 anticipata, D41) |
| 0700 | `0700-chat-multilingua.md` | Chat multilingua | dopo 0600 |
| 0800 | `0800-ui-uplifting.md` | UI Uplifting | dopo 0700 |
| 0900 | `0900-chat-con-contesto.md` | Chat con contesto | in corso (priorità corrente) — C1 |
| 1000 | `1000-ai-provider-adapters.md` | AI Provider Adapters | dopo 0900 |
| 1100 | `1100-teach-me-the-game.md` | Teach me the game | ultima |

## Priorità corrente

Epica **0500 — Forum BGG** chiusa (sessione 2026-07-27) — v. `closed/0500-forum-bgg.md`.
F1-F8 completati; eval Hegemony 14/15 (93.3%), sopra soglia 80% (D15/E3), 1 fallimento
documentato come limite noto di retrieval (non un bug), non risolto in questa epica.

**D41:** anticipata una versione minima di S3.4 (0600) prima della chiusura di 0500 —
`/home` con dropdown di selezione gioco (`manual_ready`/`forum_ready` true) e redirect a
`/game/[id]`. Resto di 0600 (S3.2, S3.3, S3.5, S3.7) resta da fare. V. `0600-fase3-continua.md`
e decision-log.

Epica **0550 — Retrieval query enhancement** chiusa (sessione 2026-07-27) — Q4 (misurazione
latenza/costo) skipped su decisione esplicita, v. D42. File spostato in
`closed/0550-retrieval-query-enhancement.md`.

Epica **0551 — Retrieval: lingua HyDE e recall manuale** chiusa (sessione 2026-07-27/28) —
v. `closed/0551-retrieval-lingua-hyde.md`. Fix lingua (L1+L2) verificato e in produzione; L3/L4
chiusi come non risolutivi — la causa dominante del caso che aveva aperto l'epica è la
granularità del chunking, non la lingua.

Epica **0560 — Miglioramento ingest manuale** chiusa (sessione 2026-07-28) — v.
`closed/0560-ingest-manuale-migliorato.md`. Punto 3 risolto con chunking fine-grained su
bullet-titolo (D50) + aggiustamento `MIN_MANUAL_CHUNKS`/`topK` (D51), verificato end-to-end sul
caso originale (D46): "Classe Media — Buy Goods & Services" ora nel contesto finale.

Priorità corrente: **0561 — Reranking e ricerca ibrida** (v. D49, D52) — interrompe di nuovo 0900.
Decisione esplicita di Francesco (sessione 2026-07-28): la capacità dell'agente di rispondere
correttamente a domande ambigue/con premessa errata è priorità assoluta, sopra ogni altro lavoro,
finché non è risolta in modo affidabile. Innescata da una regressione osservata: "Come guadagna
Legittimità la Classe Media?" (già corretta a inizio sessione) ha ricominciato ad attribuire
erroneamente alla Classe Media un meccanismo dello Stato, dopo l'alzata di `MIN_MANUAL_CHUNKS`
a 6 (D51) — verificato con `diagnose-full-context.ts`: le fonti corrette (4 chunk "Lo Stato")
sono nel contesto, ma insieme a 2 chunk "Middle Class" irrilevanti alla domanda (rumore da
riserva a soglia fissa, non da mancanza di informazione) che probabilmente inducono priming
scorretto. **0900 — Chat con contesto** resta in pausa.
Restano comunque candidate per dopo: 0560 punto 3, 0570 caso link per-post, 0600 resto dopo
S3.4, oltre al re-ingest di Brass Birmingham.

## Note aperte

- Brass Birmingham rimosso dal DB (manuale + forum) in attesa di un re-ingest migliorato
  dopo la correzione di `games.bgg_id` — v. `closed/0500-forum-bgg.md`, sezione bug F4.
  Non ancora pianificato come task; script/fixture di default che puntavano a questo
  gioco sono stati rimossi nel frattempo (v. decision-log).
- Limite di retrieval emerso dall'eval Hegemony (`heg-09`, v.
  `closed/0500-forum-bgg.md`): quando due thread genuini coprono lo stesso argomento con
  angolazioni diverse (regola generale vs eccezione di una carta specifica), il retrieval
  può portare in contesto solo il più generico. Da valutare in una futura epica di
  retrieval (topK più alto su query specifiche, o query rewriting mirato).
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