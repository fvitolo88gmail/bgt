# Epica AUTH — Access management

**Stato:** in corso

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
| AUTH-00001 | Supabase Auth + tabella `profiles` | ✅ done |
| AUTH-00002 | Migrazione soft da `owner_token` a `user_id` | ⏭️ chiuso, non applicabile |
| AUTH-00003 | RLS policy sulle tabelle utente-specifiche | in progress |
| AUTH-00004 | Middleware Next.js per route protette | todo |
| AUTH-00005 | UI minima login/signup/logout | todo |
| AUTH-00006 | Deprecazione formale di `owner_token` | todo |
| AUTH-00007 | OAuth Google (finale, obbligatoria) | todo |

## Note aperte

- Ruoli custom/permessi granulari (tabella `roles`/`user_roles` many-to-many) non necessari
  per ora: `role` enum su `profiles` è sufficiente per lo scope attuale.
- AUTH-00001 chiusa: migration `20260729010000_auth_profiles.sql` applicata al DB, DoD verificato
  manualmente in Supabase Studio (utente di test → riga `profiles` auto-creata, `role='user'`) —
  v. `done/AUTH-00001-supabase-auth-profiles.md` e D66.
- Email advisory Supabase (26/07/2026, `rls_disabled_in_public`) segnala `games`/`chunks`/
  `forum_threads`/`forum_posts`/`chat_sessions`/`chat_messages` senza RLS — gap noto, atteso, si
  chiude ad AUTH-00003. Nessuna azione fuori sequenza decisa esplicitamente da Francesco. Nota
  per quando si arriva ad AUTH-00003: `chunks`/`forum_threads`/`forum_posts` non hanno una
  colonna utente propria, l'ownership è ereditata da `games` via `game_id` — le policy lì
  richiedono un `exists` join su `games`, non un confronto diretto `auth.uid() = user_id` come
  scritto oggi nel task.
- AUTH-00002 chiusa senza implementazione: `owner_token` non è mai stato popolato in produzione
  (D43, D65, verificato via grep — v. `done/AUTH-00002-migrazione-owner-token.md`), nessuna
  conversazione legacy da collegare al login — v. D67.
- AUTH-00003 avviata: confermato con Francesco che l'accesso anonimo resta per `games`
  `shared` e per la chat (nessun login obbligatorio per l'uso base); `user_id` aggiunto solo su
  `games`/`chat_sessions`, le tabelle derivate (`chunks`/`forum_threads`/`forum_posts`/
  `chat_messages`) usano policy con `exists` join, nessuna colonna propria — v. D68 e
  `progress/AUTH-00003-rls-policy.md` per i dettagli (inclusa la verifica pre-apply su
  `games.visibility` da fare prima di eseguire la migration).
