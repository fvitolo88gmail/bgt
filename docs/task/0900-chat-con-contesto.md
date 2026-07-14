# Epica C — Chat con contesto (server-side)

**Stato:** da iniziare — dopo `0800-ui-uplifting.md`

## Task

| ID | Task | DoD |
|---|---|---|
| C1 | Migration: tabella `chat_sessions` (id, game_id, owner_token, created_at) e `chat_messages` (id, session_id, role, content, created_at) | migration applicata, tabelle visibili in dashboard |
| C2 | `lib/session.ts`: crea/recupera sessione per game_id + owner_token | sessione persistita e riletta correttamente tra richieste |
| C3 | Estendi `POST /api/chat`: legge history da `chat_messages`, la inietta nel prompt, salva nuovo turno | risposta coerente con turni precedenti su test manuale multi-turno |
| C4 | Cap esplicito su numero di turni/token inclusi in history (per contenere consumo quota Gemini) | oltre il cap, i turni più vecchi vengono troncati, nessun errore di quota in test manuale |
| C5 | Toggle UI "usa contesto conversazione" con nota su maggior consumo risorse | toggle funzionante, comportamento diverso on/off verificabile |
