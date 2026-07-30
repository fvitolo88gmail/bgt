# AUTH-00006 — Deprecazione formale di owner_token

**Stato:** ✅ done

**Blocca:** AUTH-00002

## Task

Deprecazione formale di `owner_token` come meccanismo primario.

## Implementazione

Nessun codice da toccare: riconfermato (coerente con D67/AUTH-00002) che `owner_token` non è
mai stato popolato in produzione e nessun client lo genera (`lib/owner-token.ts` vuoto). Lavoro
interamente documentale in `docs/architecture.md`:

- Principio "DB condiviso, isolamento per proprietà": da `owner_token` a `user_id` + RLS.
- Diagramma di topologia: "owner_token in cookie/localStorage" → sessione Supabase Auth (proxy.ts).
- Schema `games`: riga `owner_token` marcata deprecata; aggiunta riga `user_id` (mai documentata
  da quando l'ha introdotta AUTH-00003).
- Pipeline di serving: rimosso `owner_token` dal flusso, sostituito con verifica visibilità via RLS.
- Sezione "Astrazioni chiave": `owner_token` riscritta come meccanismo deprecato, mai usato.
- Indice `games(owner_token)`: commento inline, legacy — non rimosso (tocca lo schema, fuori
  scope senza task dedicato).

## DoD

Documentato in `architecture.md` — ✅. Nuovo utente non genera più `owner_token` come identità
primaria — ✅, già vero prima di questo task (mai implementato, D67), ora formalizzato in doc.
