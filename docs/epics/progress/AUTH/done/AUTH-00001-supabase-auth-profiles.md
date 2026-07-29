# AUTH-00001 — Supabase Auth + tabella profiles

**Stato:** done

## Task

Abilita Supabase Auth (email/password); crea tabella `profiles` (1:1 con `auth.users`) con
colonna `role` (enum `admin` \| `user`).

## DoD

Signup/login funzionante in locale; riga `profiles` creata automaticamente al signup (trigger
o hook).

## Risoluzione

- `@supabase/ssr` aggiunto; `lib/supabase.ts` guadagna `createBrowserSupabaseClient` e
  `createServerSupabaseClient` (cookie-based) accanto ai client esistenti, invariati — v. D66.
- Migration `20260729010000_auth_profiles.sql`: enum `user_role`, tabella `profiles`, RLS
  abilitata senza policy (deferred ad AUTH-00003), trigger `handle_new_user`.
- Migration applicata al DB da Francesco (Supabase SQL Editor, come `postgres`/privilegiato).
- DoD verificato manualmente in Supabase Studio: utente di test creato da Authentication → Users,
  riga `profiles` comparsa automaticamente (`role = 'user'`) — trigger confermato funzionante.
