# progress.md

*Stato di avanzamento delle epiche. Aggiornato ad ogni cambio di stato di epica o task — vedi
`CLAUDE.md` per le regole di gestione (D56: epiche parallele, nomi parlanti, cartelle
todo/progress/done).*

## Epiche

| Epica | Directory | Stato |
|---|---|---|
| POC | `progress/POC/` | in corso (nucleo POC-00001..00010 chiuso, POC-00011..00016 in corso/todo) |
| AUTH | `todo/AUTH/` | da iniziare |
| BILLING | `todo/BILLING/` | da iniziare |
| TEACH | `todo/TEACH/` | da iniziare |
| VISUAL | `todo/VISUAL/` | nice to have, in coda |
| DESIGN | `todo/DESIGN/` | da iniziare |
| CHAT-LISTING | `todo/CHAT-LISTING/` | da iniziare |
| ADMIN-CONSOLE | `todo/ADMIN-CONSOLE/` | da iniziare |

## Priorità corrente

**POC-00011 — Reranking e ricerca ibrida** (v. D49, D52) resta priorità assoluta, sopra ogni
altro lavoro, finché non risolta in modo affidabile. Innescata da una regressione osservata:
"Come guadagna Legittimità la Classe Media?" (già corretta) ha ricominciato ad attribuire
erroneamente alla Classe Media un meccanismo dello Stato, dopo l'alzata di `MIN_MANUAL_CHUNKS`
a 6 (D51). Il primo sotto-step ha già risolto la regressione principale (D52/D53); restano da
fare full-text search e traduzione query — v. `progress/POC/progress/POC-00011-reranking-ricerca-ibrida.md` per il
dettaglio dei sotto-step.

**POC-00016 — Chat con contesto** resta in pausa (C1-C3 fatti, C4-C5 da fare) finché POC-00011
non è chiuso.

**Baseline 005 (2026-07-28, post-D53/D55):** eval `hegemony-ambiguous` 18/20 (90%), sopra
soglia — v. `docs/baselines/005-20260728-hegemony-ambiguous-gemini-3-1-flash-lite.json`. Eval
non va più in timeout (D55). 2 fallimenti residui, entrambi noti: heg-amb-01 (Legittimità
Classe Media — risposta ambigua invece di correggere con sicurezza) e heg-amb-08 (Prosperità
dello Stato — "non trovato" invece di correggere, v. D54, non un'allucinazione ma subottimale).
Non ancora affrontati in questa sessione.

**Nuove epiche (sessione 2026-07-28, D56):** aggiunte `AUTH` (access management, Supabase Auth +
RLS + OAuth Google) e `BILLING` (modello di costo e monetizzazione, con l'ex-epica "AI Provider
Adapters" ridotta a un singolo task BILLING-00008). Entrambe da iniziare, nessuna priorità
assegnata ancora rispetto a POC-00011/POC-00016.

**Nuove epiche (sessione 2026-07-28, seconda tranche):** aggiunte `DESIGN` (tema, palette,
generalizzazione componenti UI base — sovrappone `POC-00015`, da riconciliare), `CHAT-LISTING`
(sidebar conversazioni + limite risposte configurabile — dipende dal modello dati di
`POC-00016`) e `ADMIN-CONSOLE` (gestione stato giochi, wizard ingest, UI diagnostica — dipende
da `AUTH-00001`, sovrappone `BILLING-00002`). Tutte da iniziare, nessuna priorità assegnata.

## Note aperte

- Brass Birmingham rimosso dal DB (manuale + forum) in attesa di un re-ingest migliorato dopo
  la correzione di `games.bgg_id` — v. `progress/POC/done/POC-00006-forum-bgg.md`. Non ancora
  pianificato come task.
- Limite di retrieval emerso dall'eval Hegemony (`heg-09`, v.
  `progress/POC/done/POC-00006-forum-bgg.md`): quando due thread genuini coprono lo stesso argomento con
  angolazioni diverse (regola generale vs eccezione di una carta specifica), il retrieval può
  portare in contesto solo il più generico. Da valutare in POC-00011 (topK più alto su query
  specifiche, o query rewriting mirato).
- Baseline eval 003 (impatto D21) resta deferred — v. `progress/POC/done/POC-00002-eval-harness.md` e
  `docs/baselines/`.
- Upgrade Tier 1 Gemini (a pagamento): dati di prezzo raccolti (embedding $0.15/1M token,
  generazione $0.25/$1.50 per 1M input/output), deciso di rimandare finché non si valida
  l'ingest su un secondo gioco oltre Brass. Potrebbe ridurre l'urgenza di BILLING-00007 (BYOK)
  se il tetto RPD condiviso smette di essere un vincolo reale.
- Puntatore a `progress/POC/todo/POC-00013-fase3-continua.md` (Fase 3 continua) — S3.4 anticipata in versione
  minima (D41), resto della sequenza (S3.2, S3.3, S3.5, S3.7) da fare.
- Puntatore a `todo/VISUAL/todo/VISUAL-00001-scoping-approccio.md` — nice to have, in coda dopo TEACH.
- Puntatore a `progress/POC/progress/POC-00012-link-bgg-citazioni.md` (Link BGG citazioni) — fatto per il caso
  principale, aperto il caso dei link per-post nei thread espansi.
- Nota su D32 (prompt: non introdurre argomenti non richiesti): verificato su un caso concreto,
  da ri-controllare con un eval completo quando si riprende il lavoro — potrebbe migliorare
  ulteriormente heg-amb-01/08.
