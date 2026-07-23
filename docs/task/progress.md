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
| 0400 | `0400-fase3-citazioni-fallback-deploy-selezione-gioco.md` | Fase 3 — citazioni, fallback, deploy, selezione gioco | in corso |
| 0500 | `0500-forum-bgg.md` | Forum BGG | **priorità corrente** |
| 0600 | `0600-fase3-continua.md` | Fase 3 (continua) — S3.2–S3.5, S3.7 | dopo 0500 |
| 0700 | `0700-chat-multilingua.md` | Chat multilingua | dopo 0600 |
| 0800 | `0800-ui-uplifting.md` | UI Uplifting | dopo 0700 |
| 0900 | `0900-chat-con-contesto.md` | Chat con contesto | dopo 0800 |
| 1000 | `1000-ai-provider-adapters.md` | AI Provider Adapters | dopo 0900 |
| 1100 | `1100-teach-me-the-game.md` | Teach me the game | ultima |

## Priorità corrente

Epica **0500 — Forum BGG**: F1-F3 e F5 completati per Brass Birmingham
(verificato in chat, retrieval multi-fonte funzionante). Restano F4
(sync incrementale), F6 (rifinitura UI), F7-F8 (eval Ark Nova).

## Note aperte

- Epica 0400, task S3.1: non marcato ✅ ma le note di sessione lo indicano come completo —
  discrepanza da confermare prima di chiudere l'epica (D22).
- Baseline eval 003 (impatto D21) resta deferred — vedi `closed/0100-eval-harness.md` e
  `docs/baselines/`.
- Upgrade Tier 1 Gemini (a pagamento): dati di prezzo raccolti (embedding
    $0.15/1M token, generazione $0.25/$1.50 per 1M input/output), deciso di
    rimandare finché non si valida l'ingest su un secondo gioco oltre Brass.
    Potrebbe ridurre l'urgenza dell'Epica A (BYOK, D23) se il tetto RPD
    condiviso smette di essere un vincolo reale — da rivalutare quando si
    arriva a quell'epica, non prima.
- Qualità contenuto manuale Brass: la sezione "Cementificazione" risulta
  spezzata scorrettamente in due chunk durante il porting D19 (un
  condizionale "se è tua / se è dell'avversario" finito diviso tra due
  header diversi) — causa una generalizzazione errata osservata in test
  manuale. Fix rimandato a una revisione futura di Brass, non bloccante.
