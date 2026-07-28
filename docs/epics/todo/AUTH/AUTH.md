# Epica AUTH — Access management

**Stato:** da iniziare

## Contesto

Migrazione dal modello no-auth (`owner_token` UUID) a utenze reali con login e ruoli, tramite
Supabase Auth.

**Decisioni:**
- Nessun multitenant a schema: tabella unica con `user_id`/`owner_id` + RLS
- Enforcement dei permessi a livello DB (Row Level Security), non solo applicativo
- OAuth (Google) è story finale **obbligatoria** di questa epica, non opzionale

## Task

Vedi directory `AUTH/` per i task singoli.

| ID | Titolo | Stato |
|---|---|---|
| AUTH-00001 | Supabase Auth + tabella `profiles` | todo |
| AUTH-00002 | Migrazione soft da `owner_token` a `user_id` | todo |
| AUTH-00003 | RLS policy sulle tabelle utente-specifiche | todo |
| AUTH-00004 | Middleware Next.js per route protette | todo |
| AUTH-00005 | UI minima login/signup/logout | todo |
| AUTH-00006 | Deprecazione formale di `owner_token` | todo |
| AUTH-00007 | OAuth Google (finale, obbligatoria) | todo |

## Note aperte

- Ruoli custom/permessi granulari (tabella `roles`/`user_roles` many-to-many) non necessari
  per ora: `role` enum su `profiles` è sufficiente per lo scope attuale.
