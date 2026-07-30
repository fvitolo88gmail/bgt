# BUG-003 — Match "designer ufficiale" sui post forum inaffidabile

**Stato:** mitigato (citazione disabilitata), causa profonda non risolta
**Emerso in:** uso reale con SETI + espansione Space Agencies, sessione 2026-07-30

## Sintomo

L'assistente cita occasionalmente un post del forum come proveniente dal "designer ufficiale del
gioco", ma l'utente che ha scritto quel post non è affatto il designer reale.

## Causa

`isDesignerResponse()` in `scripts/forum/forum-ingest.ts` calcola `is_designer_response`
confrontando, per uguaglianza di stringa case-insensitive, il nome e cognome del designer
accreditato su BGG (`getThing()` in `lib/bgg.ts`, campo `boardgamedesigner`) con lo
`author_username` del post forum:

```ts
function isDesignerResponse(authorUsername: string, designers: string[]): boolean {
    const normalizedAuthor = authorUsername.trim().toLowerCase();
    return designers.some((name) => name.trim().toLowerCase() === normalizedAuthor);
}
```

Non esiste alcun legame verificato tra il nome accreditato su BGG e l'account forum realmente
usato dal designer: se il designer posta con un nickname diverso dal proprio nome (il caso più
comune), il match è un falso negativo; se un altro utente ha per caso nome e cognome coincidenti
con quelli del designer, è un falso positivo. Il flag risultante non è quindi un segnale
attendibile su cui basare una citazione in una risposta.

## Fix (v1, interim)

Rimossa ogni menzione del ruolo "designer" dal prompt LLM-facing: `lib/retrieval.ts`
(`expandForumThread` non include più il tag `[DESIGNER UFFICIALE DEL GIOCO]` nel contenuto
passato al modello), `lib/prompt/shared.ts` (`CITATION_FORMAT_RULES` vieta esplicitamente di
attribuire il ruolo di designer a chiunque, indipendentemente da tono/contenuto/argomento del
thread), `lib/prompt/qa.ts` (istruzione finale aggiornata per non citare mai lo username di chi
posta nel forum). Verificato `tsc --noEmit`/`eslint` puliti.

Non toccati in questo fix: il calcolo e lo storage di `is_designer_response` in
`forum-ingest.ts`/DB restano invariati, così come il badge "Designer" in UI
(`components/chat/SourcesList.tsx`/`components/ui/Badge.tsx`), che non era in scope per
l'istruzione che ha aperto questo bug.

## Note aperte

Una soluzione definitiva richiederebbe una fonte di verità diversa per il legame
designer↔account forum (es. verifica manuale caso per caso, o un flag ufficiale BGG se mai
disponibile via API) — non esiste oggi un modo affidabile per derivarlo automaticamente dal solo
nome accreditato. Finché non c'è, il flag `is_designer_response` esiste in DB ma non va usato per
alcuna citazione o badge senza un disclaimer sulla sua affidabilità.
