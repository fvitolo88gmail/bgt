# AUTH-00002 — Migrazione soft da owner_token a user_id

**Stato:** chiuso — non applicabile (v. Risoluzione)

**Blocca:** AUTH-00001

## Task

Al primo login, collega il token esistente (cookie/localStorage) all'account nuovo, copiando la
ownership sulle righe esistenti (`chat_sessions`, `chat_messages`, altre tabelle con
`owner_token`).

## DoD

Un utente che aveva conversazioni via `owner_token` le ritrova dopo il login; nessuna riga
orfana.

## Risoluzione

Chiuso senza implementazione: `owner_token` non è mai stato realmente popolato in produzione
(D43, D65) — `lib/owner-token.ts` è vuoto, nessun file in `app/`/`lib/`/`components/` lo
referenzia (verificato via grep). Nessun cookie/localStorage lo genera, nessuna riga in `games`
o `chat_sessions` ha un valore non-null. Il DoD presuppone conversazioni esistenti da
"ritrovare" dopo il login — non esistono, quindi non c'è nulla da migrare. V. D67.

**Nota per AUTH-00003:** questo task non aggiunge colonne `user_id` a `games`/`chat_sessions`
(era scope di "migrazione dati", non di schema). AUTH-00003 (RLS policy con
`auth.uid() = user_id`) dovrà aggiungere quelle colonne come parte del proprio scope, non solo
scrivere le policy — non ancora chiarito con Francesco quando si arriva a quel task.
