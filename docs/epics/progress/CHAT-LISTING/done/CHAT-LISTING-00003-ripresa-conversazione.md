# CHAT-LISTING-00003 — Ripresa di una conversazione dalla sidebar

**Stato:** ✅ done

**Blocca:** CHAT-LISTING-00002

## Task

Cliccando una conversazione nella sidebar, caricare la relativa history (`chat_messages`) e
riprenderla, invece di partire da una chat vuota.

## DoD

Selezionare una conversazione passata mostra i messaggi precedenti e permette di continuare la
conversazione mantenendo il contesto (coerente con `POC-00016`, modalità `conversation`).

## Implementazione

- `lib/chat/repository/chat-history.repository.ts`: nuova `fetchMessagesForDisplay` — tutti i
  messaggi della sessione in ordine cronologico con `id`/`feedback` (a differenza di
  `fetchRecentHistory`, che resta limitata e senza id, usata solo per costruire il prompt)
- `GET /api/chat/sessions/[sessionId]/messages`: client con sessione via cookie, RLS come
  enforcement reale (stesso pattern di `GET /api/chat/sessions`, D77)
- `app/game/[id]/page.tsx`: `handleSelectConversation` ora carica davvero la history (prima si
  limitava a svuotare la chat locale) — stati `loadingHistory`/`historyError` distinti da
  `loading` (attesa risposta), errore mostrato esplicitamente in chat, non silenzioso.
  Continuare a scrivere nella conversazione ripresa funziona senza modifiche: `sessionId` è già
  quello selezionato, `getOrCreateSession` è idempotente
- Nota: le fonti non sono persistite in `chat_messages` (mai state nello schema) — i messaggi
  assistant ricaricati da una conversazione precedente non mostrano le fonti, solo il testo.
  Comportamento preesistente allo schema, non una regressione di questo task

## Verifica

- `npx vitest run lib/__tests__` — 52/52 ✅ (3 nuovi test su `fetchMessagesForDisplay`)
- `npx tsc --noEmit` pulito, `eslint` pulito
- Non verificabile in sandbox: comportamento reale a runtime (`next dev` non regge, limite noto)
