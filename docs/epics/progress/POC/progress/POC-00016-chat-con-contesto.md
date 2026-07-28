# POC-00016 — Chat con contesto (server-side)

**Stato:** in corso — dopo `0800-ui-uplifting.md`

## Note di scope (decise con Francesco, 2026-07-27)

- **owner_token:** non ancora implementato in app/API (`lib/owner-token.ts` è vuoto, nessuna
  UI/route lo usa). Per questa epica la sessione è chiavata solo su `game_id` — una sessione
  per gioco, condivisa da chiunque apra quel `game_id`. `owner_token` resta nullable nello
  schema per compatibilità futura ma non viene popolato. Divergenza nota da
  `architecture.md`/D16 — da rivedere quando (e se) owner_token verrà implementato.
- **Modalità domande vs conversazione:** non è un toggle dentro la chat, ma una scelta fatta
  in `/home` al momento della selezione del gioco (in `GameSelectForm`), prima del redirect a
  `/game/[id]`. Default: **domande** (nessuna history, comportamento attuale). La modalità
  scelta viaggia come query param sulla route di destinazione (es. `/game/[id]?mode=conversation`)
  e va passata dal client ad ogni chiamata `POST /api/chat`. In modalità conversazione va
  mostrata una nota che spiega il maggior consumo di token/quota Gemini.

## Task

| ID | Task | DoD |
|---|---|---|
| C1 | Migration: tabella `chat_sessions` (id, game_id, created_at) e `chat_messages` (id, session_id, role, content, created_at) | migration applicata, tabelle visibili in dashboard | ✅ |
| C2 | `lib/session.ts`: crea/recupera sessione per `game_id` (una sessione per gioco, nessun owner_token) | sessione persistita e riletta correttamente tra richieste | ✅ |
| C3 | Estendi `POST /api/chat`: accetta `mode` (`qa` \| `conversation`); solo in `conversation` legge history da `chat_messages`, la inietta nel prompt e salva il nuovo turno; in `qa` comportamento invariato (nessuna history, nessuna scrittura in `chat_messages`) | risposta coerente con turni precedenti su test manuale multi-turno in `conversation`; `qa` invariato rispetto a oggi | ✅ |

### Bug trovato in verifica manuale di C3 (post-implementazione) e relativo fix

Su un follow-up tipo "dimmi di più su questo thread", il retrieval veniva fatto sulla
domanda grezza (nessun contenuto semantico proprio) e recuperava fonti totalmente estranee
al turno precedente — la history arrivava solo al modello di generazione, non al retrieval.
Inoltre il prompt (tarato per una domanda isolata, impalcatura FATTO DIRETTO/DEDUZIONE +
citazioni complete ripetute) dava un effetto "meccanico" su una conversazione.

Fix (deciso con Francesco, non tocca la modalità `qa`):
- `lib/query-contextualization.ts`: solo in `conversation`, prima del retrieval, riscrive la
  domanda in forma standalone usando la history (stesso pattern fail-soft di D31/query
  enhancement) — la domanda originale resta quella mostrata al modello e salvata in
  `chat_messages`, solo il retrieval usa la riscritta.
- `lib/prompt.ts`: nuova `buildConversationPrompt` (usata solo in `conversation`), che
  mantiene l'anti-allucinazione e le regole di citazione ma alleggerisce il formalismo
  FATTO DIRETTO/DEDUZIONE e usa esplicitamente lo storico per risolvere riferimenti impliciti
  invece di chiedere una disambiguazione generica. `buildPrompt` (usato in `qa`) resta
  invariato.
| C4 | Cap esplicito su numero di turni/token inclusi in history (solo rilevante in `conversation`, per contenere consumo quota Gemini) | oltre il cap, i turni più vecchi vengono troncati, nessun errore di quota in test manuale |
| C5 | In `/home`, scelta modalità (domande/conversazione, default domande) contestuale alla selezione del gioco, con nota sul maggior consumo in conversazione; la scelta determina il `mode` passato a `/game/[id]` e da lì ad ogni chiamata `/api/chat` | selezione funzionante da `/home`, comportamento diverso qa/conversation verificabile in `/game/[id]` |
