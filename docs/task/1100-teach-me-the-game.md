# Epica T — Teach me the game

**Stato:** da iniziare — ultima epica pianificata

## Task

| ID | Task | DoD |
|---|---|---|
| T1 | Definisci sequenza di prompt strutturata (setup → obiettivo → turno tipo → fine partita) in `lib/teach-prompt.ts` | costante separata, non inline, coerente con CLAUDE.md |
| T2 | API route `POST /api/teach`: orchestration multi-step usando chunk del manuale come contesto | risposta strutturata a step, testata su Brass Birmingham |
| T3 | Decisione caching: generato al volo ogni volta vs cache per gioco in DB | decisione documentata in decision-log, implementata di conseguenza |
| T4 | UI: entry point "Insegnami il gioco" separato dalla chat libera | funzionante in locale su Brass Birmingham |
