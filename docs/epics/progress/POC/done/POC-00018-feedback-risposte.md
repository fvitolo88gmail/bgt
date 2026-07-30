# POC-00018 — Pollice su/giù sulle risposte (feedback good/bad)

## Task

Aggiungere in chat un'icona pollice su/pollice giù sotto ogni risposta assistant, per
raccogliere un feedback esplicito dell'utente da poter analizzare in seguito. Click salva il
voto, un secondo click sullo stesso voto lo rimuove (toggle a `null`).

## DoD

- Colonna `feedback` (`good`/`bad`/`null`) su `chat_messages`, con policy RLS di update (mancava,
  senza la quale l'update veniva bloccato silenziosamente).
- Endpoint `PATCH /api/chat/feedback` per registrare/rimuovere il voto.
- UI: icone SVG inline (nessuna nuova dipendenza), bianche su sfondo neutro di default, verde
  pieno (ok) o rosso pieno (ko) quando quel voto è selezionato; cursore a manina; toggle a `null`
  ricliccando sul voto già attivo.
- Disponibile solo in modalità "conversation" (unica modalità che salva `chat_messages` oggi;
  "qa" resta senza feedback, per scelta esplicita).

## Implementazione

- `supabase/migrations/20260730020000_chat_messages_feedback.sql`: colonna `feedback`.
- `supabase/migrations/20260730030000_chat_messages_update_policy.sql`: policy RLS di update
  mancante, causa del primo tentativo di salvataggio silenziosamente fallito.
- `lib/chat-history.ts`: `appendMessage` ritorna l'id inserito; nuova `setMessageFeedback`
  (verifica righe aggiornate per non fallire in silenzio su un futuro blocco RLS).
- `app/api/chat/feedback/route.ts`: nuovo endpoint `PATCH`.
- `app/api/chat/route.ts`: la risposta include `messageId` (solo modalità conversation).
- `components/chat/types.ts`, `components/chat/MessageBubble.tsx`, `app/game/[id]/page.tsx`:
  icone pollice, stato locale ottimistico con rollback su errore, toggle a `null`.

## Verifica

- `tsc --noEmit` ed `eslint` puliti a ogni step.
- Bug reale scoperto e risolto durante il test manuale: primo salvataggio non persisteva per
  colonna RLS mancante — confermato via lettura policy esistenti, corretto con la migration
  dedicata.
