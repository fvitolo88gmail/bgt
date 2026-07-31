# DESIGN-00004 — Menu avatar utente + pagina profilo

**Stato:** in progress — migration applicata da Francesco, revisione dopo primo feedback
(saluto solo nome, pagina profilo senza bordi, notifiche via componente Toast), in attesa di
riverifica

## Task

Sostituire l'avatar/menu utente introdotto in BILLING-00002 (icona gufo + dropdown minimale)
con la versione definitiva, e aggiungere il concetto di profilo utente (nome/cognome), finora
assente — oggi `profiles` ha solo `id`/`role`.

Sotto-task:

- Migration: `profiles` guadagna `first_name`/`last_name` (nome/cognome).
- Pagina profilo per inserirli/modificarli (tipicamente dopo la registrazione, ma riapribile
  in ogni momento).
- Pagina profilo raggiungibile da una voce nel menu avatar (non solo via URL diretto).
- Avatar: cerchio bianco, bordo bold, iniziali dell'utente all'interno, colori dalla palette
  (`theme.css`) — sostituisce l'`OwlMark` usato provvisoriamente in BILLING-00002.
- Homepage (`/home`): sopra il dropdown di selezione gioco esistente, un saluto grande
  "Bentornato ⟨nome utente⟩!" e un sottotitolo più piccolo "A cosa giochiamo oggi".
- Menu avatar ristrutturato: primo item non cliccabile con Nome Cognome + email, poi i link
  cliccabili — Profilo, poi Admin (solo se `role = 'admin'`), poi Esci.

## Implementazione

- Migration `supabase/migrations/20260801000000_profiles_name.sql`: `profiles` guadagna
  `first_name`/`last_name` (nullable — un utente esistente non li ha finché non passa dalla
  pagina profilo). Non ancora applicata al DB.
- `lib/repositories/profiles.repository.ts`: `isAdmin` ora usa `getProfile` internamente (non
  duplica la query); aggiunte `getProfile` e `updateProfileName` (quest'ultima si appoggia alla
  RLS `profiles_update_own_or_admin` già esistente — il trigger anti-escalation riguarda solo
  `role`, non tocca questi campi).
- `lib/profile-display.ts` (nuovo, funzioni pure, testate in `lib/profile-display.test.ts`):
  `getDisplayName` (nome+cognome, o uno dei due, o parte locale dell'email come fallback) e
  `getInitials` (iniziali nome+cognome, o prime due lettere del nome visualizzato).
- `components/ui/Avatar.tsx` (nuovo): cerchio bianco, bordo bold (`border-ink`), iniziali in
  `text-primary` — sostituisce l'`OwlMark` provvisorio di BILLING-00002.
- `components/ui/UserMenu.tsx`: primo item non cliccabile (nome + email), poi Profilo → Admin
  (solo se admin) → Esci.
- `components/profile/ProfileForm.tsx` + `app/profile/page.tsx`: form nome/cognome, salvataggio
  via client Supabase (sessione, non service role — l'utente scrive solo la propria riga).
- `app/home/page.tsx`: saluto "Bentornato ⟨nome⟩!" + sottotitolo "A cosa giochiamo oggi" sopra
  il dropdown esistente, fail-soft su "Bentornato!" se il profilo non si legge.

**Revisione (stessa sessione, dopo primo feedback di Francesco):**
- `/home`: saluto ora solo con il nome (`getGreetingName`, nuova funzione in
  `lib/profile-display.ts`), mai il cognome — distinta da `getDisplayName` (nome completo,
  ancora usata altrove) e da `getInitials`.
- `app/profile/page.tsx`: non più un form dentro una `Card` bordata — layout aperto sulla
  pagina (`bg-paper` di sfondo), avatar grande in cima con l'email sotto, form senza box
  attorno.
- `components/ui/Toast.tsx` (nuovo): notifica in basso a destra, sparisce da sola dopo 3s
  (`onDismiss` richiamato sia a timeout scaduto sia se il chiamante vuole chiuderla prima).
  `ProfileForm` non mostra più "Salvato"/errore inline, usa `Toast`.

Verificato: `npx tsc --noEmit`, `npx eslint`, `npx vitest run` (31 test, incluso
`getGreetingName` in `profile-display.test.ts`) puliti.

## DoD

- `profiles.first_name`/`profiles.last_name` esistono, valorizzabili da una pagina profilo
  raggiungibile solo autenticati — ✅ migration applicata.
- Avatar nell'Header mostra le iniziali (non il gufo) su sfondo dalla palette, con bordo bold.
- Menu avatar aperto mostra, in ordine: Nome Cognome + email (non cliccabile) → Profilo →
  Admin (solo se admin) → Esci.
- `/home` mostra il saluto (solo nome) e il sottotitolo sopra il dropdown di selezione gioco
  esistente, nessuna regressione sul flusso di selezione.

**Ancora da verificare manualmente**: aprire `/profile`, salvare nome/cognome e controllare che
la notifica appaia e sparisca da sola, che l'avatar mostri le iniziali giuste, che il menu
mostri nome+email non cliccabili seguiti da Profilo/Admin/Esci, e che `/home` mostri solo il
nome nel saluto.

**Aggiunte minori (stessa sessione), UX finiture:**
- Cursore a manina sull'avatar e su tutti i `Button`/`Dropdown` (mancava su alcuni controlli
  cliccabili).
- "Esci" allineato a destra nel menu avatar.
- Nome/cognome aggiunti anche al form di richiesta accesso (`invite_requests`, migration
  `20260801010000_invite_requests_name.sql`) — l'admin che rivede la coda ora sa a chi sta per
  inviare l'invito, non solo l'email. Toccato `AUTH-00008` (già chiusa) per questo — v. nota in
  `AUTH.md`, non riaperta per un'aggiunta così piccola.
- `/login`: link "Non hai un account? Richiedi accesso" verso `/request-invite` (dal reference,
  che mostra "Registrati" — adattato perché l'app non ha signup pubblico, solo richiesta
  d'invito, AUTH-00008).

`tsc`/`eslint`/`vitest` da riverificare dopo queste aggiunte (fatto, puliti).
