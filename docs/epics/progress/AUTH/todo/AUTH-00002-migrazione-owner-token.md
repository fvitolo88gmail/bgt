# AUTH-00002 — Migrazione soft da owner_token a user_id

**Stato:** todo

**Blocca:** AUTH-00001

## Task

Al primo login, collega il token esistente (cookie/localStorage) all'account nuovo, copiando la
ownership sulle righe esistenti (`chat_sessions`, `chat_messages`, altre tabelle con
`owner_token`).

## DoD

Un utente che aveva conversazioni via `owner_token` le ritrova dopo il login; nessuna riga
orfana.
