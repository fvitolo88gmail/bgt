# AUTH-00003 — RLS policy sulle tabelle utente-specifiche

**Stato:** todo

**Blocca:** AUTH-00001

## Task

Scrivi le RLS policy sulle tabelle utente-specifiche: accesso solo a `auth.uid() = user_id`,
eccezione per `role = 'admin'` dove serve.

## DoD

Query dirette su Supabase con utente non autorizzato non ritornano righe; test con due utenti
diversi confermano isolamento.
