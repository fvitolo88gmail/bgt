# progress.md

*Stato di avanzamento delle epiche. Aggiornato ad ogni cambio di stato di epica o task — vedi
`CLAUDE.md` per le regole di gestione (D56: epiche parallele, nomi parlanti, cartelle
todo/progress/done).*

## Epiche

| Epica | Directory | Stato |
|---|---|---|
| POC | `progress/POC/` | in corso (solo POC-00011 ancora aperto, in pausa; tutto il resto chiuso o deprecato) |
| AUTH | `todo/AUTH/` | da iniziare |
| BILLING | `todo/BILLING/` | da iniziare |
| TEACH | `todo/TEACH/` | da iniziare |
| VISUAL | `todo/VISUAL/` | nice to have, in coda |
| DESIGN | `done/DESIGN/` | completata (v. D64) |
| CHAT-LISTING | `todo/CHAT-LISTING/` | da iniziare |
| ADMIN-CONSOLE | `todo/ADMIN-CONSOLE/` | da iniziare |
| GAME-REQUEST | `todo/GAME-REQUEST/` | da iniziare, priorità molto bassa |

## Priorità corrente

**POC-00014 — Chat multilingua** chiusa nella sostanza (v. D61): il corpo della risposta segue
correttamente la lingua della domanda, refactor `lib/prompt.ts` → `lib/prompt/` (shared + due
specializzazioni qa/conversation). Residuo aperto: **BUG-001** — traduzione incoerente delle
etichette di sezione manuale tra parentesi quadre nelle citazioni, quando la risposta non è in
italiano (v. `docs/bugs/BUG-001-traduzione-parziale-etichette-sezione.md`), accantonato dopo 4
tentativi di fix via prompt — probabile limite del modello, non di istruzioni mancanti. Esecuzione
di L3 (`eval/fixtures/hegemony-ambiguous-en.json`) ancora da fare in locale (sandbox non riesce a
tenere in vita `next dev`).

**POC-00017 — Restyling delle risposte** chiusa (v. D57, D58): eval `hegemony-ambiguous` dopo il
fix 18/20 (90%), in linea con baseline 005 — v. `progress/POC/done/POC-00017-restyling-risposte.md`.

**POC-00011 — Reranking e ricerca ibrida** (v. D49, D52) resta in pausa, non priorità assoluta
(v. D57) — resta comunque da chiudere (R2 full-text search, R3 traduzione query) quando si
riprende. Il primo sotto-step ha già risolto la regressione principale osservata ("Come guadagna
Legittimità la Classe Media?", D52/D53) — v.
`progress/POC/progress/POC-00011-reranking-ricerca-ibrida.md` per il dettaglio dei sotto-step.

**POC-00016 — Chat con contesto** chiusa (C1-C3 ✅; C4-C5 mai implementati lì, assorbiti da
`CHAT-LISTING-00004` e da una nota in `CHAT-LISTING-00002`/`-00003` — v. D59).

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
generalizzazione componenti UI base — copre `POC-00015`, ora deprecata come superseded, v. D63),
`CHAT-LISTING`
(sidebar conversazioni + limite risposte configurabile — dipende dal modello dati di
`POC-00016`) e `ADMIN-CONSOLE` (gestione stato giochi, wizard ingest, UI diagnostica — dipende
da `AUTH-00001`, sovrappone `BILLING-00002`). Tutte da iniziare, nessuna priorità assegnata.

**Epica DESIGN completata (sessione 2026-07-29):** tema/palette "Ludico Vivace" formalizzato in
`app/theme.css` (DESIGN-00001, D64), componenti base in `components/ui/` (Button, Input, Select,
Badge, Card, Header, Footer, Modal, OwlMark — DESIGN-00002), applicati a tutte le pagine esistenti
(home, chat, citazioni — DESIGN-00003). `Modal` pronto ma non ancora agganciato a nessuna
schermata; nessuna pagina login/admin esiste ancora nel codice (solo nel mockup di riferimento).

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
- POC-00013 (Fase 3 continua) chiusa — v. `progress/POC/done/POC-00013-fase3-continua.md` e D60
  (S3.2 de facto, S3.3/S3.5 riassegnati ad `ADMIN-CONSOLE-00004`/`-00005`, S3.7 a
  `GAME-REQUEST-00001`).
- Puntatore a `todo/VISUAL/todo/VISUAL-00001-scoping-approccio.md` — nice to have, in coda dopo TEACH.
- POC-00012 (Link BGG citazioni) chiusa — v. `progress/POC/done/POC-00012-link-bgg-citazioni.md`.
- Nota su D32 (prompt: non introdurre argomenti non richiesti): verificato su un caso concreto,
  da ri-controllare con un eval completo quando si riprende il lavoro — potrebbe migliorare
  ulteriormente heg-amb-01/08.
