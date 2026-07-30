# AUTH-00011 — Estensione route protette a tutta l'app

**Stato:** in corso — verifica DoD con Francesco

**Blocca:** AUTH-00004, AUTH-00005

## Task

AUTH-00004 proteggeva solo `/admin` (placeholder, nessuna route esistente richiedeva login
all'epoca, D68). Dopo aver verificato login/logout (AUTH-00005), Francesco ha deciso che l'intera
app deve richiedere sessione attiva — supera D68 (che manteneva l'accesso anonimo a giochi
condivisi/chat) limitatamente alla protezione delle route: l'uso anonimo dell'app non è più
ammesso, coerente con la registrazione solo su invito (AUTH-00008).

## Implementazione

`proxy.ts`: la logica si inverte da allowlist di route protette (`PROTECTED_PATH_PREFIXES`) ad
allowlist di route pubbliche (`PUBLIC_PATH_PREFIXES`), tutto il resto richiede sessione:

- `/login` — deve restare accessibile, altrimenti nessuno potrebbe autenticarsi
- `/request-invite` — chi non ha ancora un account deve poter chiedere l'invito senza loggarsi
- `/api/invite-requests` — l'endpoint usato dal form di `/request-invite`, stessa ragione

Le chiamate verso `/api/*` non pubbliche rispondono con `401` JSON invece del redirect verso
`/login` usato per le pagine: un client `fetch` non gestisce bene una risposta HTML al posto del
JSON atteso. Le pagine restano rimandate a `/login?redirect=<path>`.

**Non modificato in questo task (nota):** le RLS su `games`/`chat_sessions`/tabelle derivate
(AUTH-00003) mantengono le policy di accesso anonimo come difesa in profondità — con la
protezione a livello di route diventano codice morto nel flusso normale, ma restano lì; non
richiesto esplicitamente di rimuoverle, e farlo tocca lo schema DB (fuori scope senza task
dedicato).

## DoD

Senza sessione attiva, qualunque route diversa da `/login`/`/request-invite`/
`/api/invite-requests` (incluse `/home`, `/game/[id]`, `/api/chat`) rimanda a `/login`. Con
sessione attiva, tutto resta accessibile come prima.

**Verificato (tsc/lint/build):** puliti, nessun nuovo errore/warning rispetto alla baseline.

**Da verificare manualmente con Francesco:** riavviare il dev server (`proxy.ts` modificato),
poi senza login provare `/home` e `/game/[id]` (redirect a `/login` atteso) e confermare che con
sessione attiva l'uso resti invariato.
