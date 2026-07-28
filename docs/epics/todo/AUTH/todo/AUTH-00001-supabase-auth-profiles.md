# AUTH-00001 — Supabase Auth + tabella profiles

**Stato:** todo

## Task

Abilita Supabase Auth (email/password); crea tabella `profiles` (1:1 con `auth.users`) con
colonna `role` (enum `admin` \| `user`).

## DoD

Signup/login funzionante in locale; riga `profiles` creata automaticamente al signup (trigger
o hook).
