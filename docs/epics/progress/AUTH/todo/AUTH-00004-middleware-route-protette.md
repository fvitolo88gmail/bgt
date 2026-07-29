# AUTH-00004 — Middleware Next.js per route protette

**Stato:** todo

**Blocca:** AUTH-00001

## Task

Middleware Next.js (App Router) per proteggere le route server-side che richiedono sessione
attiva.

## DoD

Route protette rispondono 401/redirect a login se non autenticato; nessun bypass client-side.
