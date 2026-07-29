# AUTH-00009 — Stato utente enabled/disabled

**Stato:** todo

**Blocca:** AUTH-00001, AUTH-00003

## Task

Aggiungi colonna `status` (enum `enabled`/`disabled`, default `enabled`) su `profiles`, per
revocare l'accesso a un utente già registrato senza cancellarne l'account/dati. Un utente con
`status='disabled'` perde accesso ai propri giochi privati e sessioni chat anche se autenticato
(RLS — stesso pattern di `is_admin()` da AUTH-00003, nuova funzione `is_enabled()` riusata nelle
policy esistenti su `games`/`chat_sessions`/`chat_messages`).

## DoD

Un utente autenticato con `status='disabled'` non ottiene righe su una query diretta verso i
propri giochi privati o `chat_sessions` — verificato con un test manuale (due utenti, uno
disabilitato).
