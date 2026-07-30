# BUG-002 — Login bloccato in caricamento su mobile

**Stato:** risolto
**Emerso in:** uso reale post AUTH-00005/AUTH-00011, sessione 2026-07-30

## Sintomo

Da cellulare, dopo aver inserito email e password, a volte il bottone resta su "Accesso..." a
tempo indeterminato e la home non si renderizza mai. Nessun log anomalo su Vercel.

## Causa

`components/auth/LoginForm.tsx` chiamava `supabase.auth.signInWithPassword` senza `try/catch`.
Su una connessione mobile instabile, una fetch fallita può far lanciare un'eccezione invece di
restituire `{ error }` (comportamento diverso da un errore applicativo tipo credenziali errate).
L'eccezione non gestita interrompeva `handleSubmit` prima di `setSubmitting(false)`, lasciando il
bottone bloccato. Essendo una chiamata diretta al client Supabase lato browser, il fallimento non
tocca mai il backend — coerente con l'assenza di log su Vercel.

## Fix

Aggiunto `try/catch` attorno alla chiamata: in caso di eccezione, mostra "Connessione assente o
instabile. Riprova." e resetta sempre `submitting`. Verificato `tsc`/`lint` puliti.
