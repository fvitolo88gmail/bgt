# AUTH-00012 — Redirect da /login se già loggato + scadenza sessione per inattività

## Task

Due fix richiesti da Francesco:
1. Un utente già autenticato che apre `/login` deve essere rimandato automaticamente a `/home`,
   non vedere di nuovo il form.
2. Introdurre una scadenza di sessione per inattività: logout automatico dopo 30 minuti senza
   interazione dell'utente, indipendente dalla scadenza/refresh del JWT Supabase.

## DoD

- Con sessione attiva, navigare a `/login` rimanda subito a `/home`.
- Senza interazione (mouse/tastiera/scroll/touch) per 30 minuti con sessione attiva, l'utente
  viene sloggato e rimandato a `/login`.
- Qualsiasi interazione resetta il timer di inattività.
- `tsc`/`eslint` puliti.

## Implementazione

- `proxy.ts`: aggiunto un check dopo quello esistente — se `pathname === '/login'` e `user` è
  presente, redirect a `/home`. Stesso client Supabase server-side già costruito lì per il check
  di route protette.
- `components/auth/InactivityLogout.tsx` (nuovo componente client, montato una sola volta in
  `app/layout.tsx` dentro `<body>`): timer resettato su `mousedown`/`keydown`/`scroll`/
  `touchstart`, attivo solo se esiste una sessione (`getSession()` + `onAuthStateChange`). Allo
  scadere: `supabase.auth.signOut()` poi redirect pieno a `/login` (stesso pattern di
  `LogoutButton.tsx`, non `router.push`).

## Verifica

- `tsc --noEmit` ed `eslint` puliti sui file toccati.
- Verifica manuale confermata da Francesco: redirect `/login`→`/home` con sessione attiva, logout
  automatico dopo 30 minuti di inattività. Task chiuso.
