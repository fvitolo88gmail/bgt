# AUTH-00008 — Registrazione solo su invito

**Stato:** done — con eccezione nota (invito email non verificato end-to-end, v. sotto)

**Blocca:** AUTH-00001

## Task

Disabilita il signup pubblico in Supabase Auth (Authentication → Providers → Email → "Allow new
users to sign up" off — nessuna migration, è config del progetto). Aggiungi tabella
`invite_requests` (`email`, `message` opzionale, `status` `pending`/`invited`/`rejected`,
`created_at`) per chi vuole richiedere accesso: chiunque (anche anonimo) può inserire una
richiesta, solo l'admin la legge/aggiorna (RLS). L'invito vero e proprio usa il meccanismo
nativo di Supabase (Studio → Authentication → Users → Invite, o `inviteUserByEmail` da service
role) — nessuna tabella custom per codici invito, Supabase già gestisce token/email/scadenza.

## DoD

Un tentativo di signup pubblico via API fallisce (nessun account creabile senza invito); una
richiesta inserita da un utente anonimo compare in `invite_requests`, leggibile solo dall'admin;
un utente invitato completa la registrazione normalmente e ottiene una riga `profiles` (trigger
già esistente da AUTH-00001).

## Nota di scope (chiarita in sessione)

Il form "richiedi invito" fa parte di questo task (necessario perché il DoD sia testabile), non
di AUTH-00005. AUTH-00005 resta comunque necessaria: diventa "accetta invito (imposta password
dopo il link email) + login + logout" invece di "signup libero + login + logout" — va affrontata
dopo aver deciso la forma di questo task, non prima (altrimenti si costruirebbe un form di
signup libero poi da buttare).

## Implementazione

Prima applicazione della convenzione repository/controller per codice nuovo (v. D72):
- `supabase/migrations/20260730000000_invite_requests.sql` — enum `invite_request_status`,
  tabella `invite_requests`, RLS (insert chiunque, select/update solo `is_admin()`)
- `lib/repositories/invite-requests.repository.ts` — `createInviteRequest`
- `app/api/invite-requests/route.ts` — controller POST, valida email/messaggio
- `app/request-invite/page.tsx` + `components/invite/RequestInviteForm.tsx` — form pubblico
- verificato con `tsc --noEmit`, `eslint`, `npm run build` completo — nessun errore nuovo

## Da fare (non automatizzabile da qui)

1. ✅ Migration applicata.
2. ✅ Signup pubblico disabilitato — verificato via curl diretto su `/auth/v1/signup`:
   `{"code":422,"error_code":"signup_disabled",...}`.
3. ✅ Form su `/request-invito` scrive in `invite_requests`, confermato.
4. **Rimandato, non bloccante per la chiusura:** invito via Studio fallito con `email rate
   limit exceeded` — causa reale non solo il rate limit (2 email/ora sul servizio built-in
   Supabase) ma anche che quel servizio invia **solo a indirizzi già membri del team Supabase
   del progetto** (v. D73). Serve SMTP custom (Resend raccomandato) per l'uso reale, che a sua
   volta richiede un dominio di proprietà (Resend non accetta domini condivisi per l'invio
   reale) — Francesco ha scelto di rimandare l'acquisto del dominio, decisione esplicita presa
   in sessione. Task chiuso comunque: le tre parti verificabili senza dominio (gate signup,
   richiesta invito, RLS) sono confermate; resta traccata come nota aperta in `AUTH.md`
   l'unica parte non verificabile finché il dominio non esiste — l'invito vero e proprio non
   funzionerà con destinatari reali fino ad allora.
