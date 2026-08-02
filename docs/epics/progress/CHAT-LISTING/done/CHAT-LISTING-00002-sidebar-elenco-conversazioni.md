# CHAT-LISTING-00002 — Sidebar con elenco conversazioni

**Stato:** ✅ done

**Blocca:** CHAT-LISTING-00001

## Task

Aggiungere un sider (sidebar) nella UI di chat con la lista delle conversazioni già avute
(titolo/anteprima, ordinate per ultimo messaggio).

**Nota (v. D59):** con conversazioni multiple per gioco, la scelta modalità domande/conversazione
(C5 di `POC-00016`, mai implementato) va decisa per conversazione — non più con un toggle globale
in `/home` legato a un'unica sessione per gioco. Da definire qui o in `CHAT-LISTING-00003` dove
esattamente nella UI va posta questa scelta (es. all'apertura di una nuova conversazione).

## DoD

Sidebar visibile in `/game/[id]`, elenco popolato da dati reali, nessuna regressione sulla chat
attiva.

## Implementazione

- Gap colmato (necessario per scopare l'elenco per utente): `getOrCreateSession` accetta ora
  `userId` e lo valorizza alla creazione della sessione — `route.ts` lo risolve già per il
  tracking costi, riordinato per risolverlo prima della creazione sessione
- D77: le scritture `chat_sessions`/`chat_messages` in `route.ts`/`feedback/route.ts` passano al
  service client (il client anonimo non soddisfa più le policy RLS ora che `user_id` è
  valorizzato) — v. decision-log per il dettaglio
- `lib/chat/repository/session.repository.ts`: nuova `listSessionsForGame(supabase, gameId,
  userId)`, filtro esplicito `user_id` (non lasciato alla sola RLS: le righe legacy con
  `user_id` null sarebbero altrimenti visibili a chiunque)
- `GET /api/chat/sessions?gameId=...`: nuova route, client con sessione via cookie (RLS come
  enforcement reale su questo endpoint esposto al browser), utente non autenticato → lista vuota
- `components/chat/ConversationSidebar.tsx`: elenco con titolo (fallback "Nuova conversazione"
  per sessioni senza turni ancora salvati) e timestamp ultimo messaggio, pulsante nuova
  conversazione, evidenzia la conversazione attiva
- `app/game/[id]/page.tsx`: sidebar visibile solo in modalità `conversation` (QA resta senza,
  come da flusso confermato in precedenza); `sessionId` ora mutabile — nuova conversazione genera
  un id fresco, selezione dalla sidebar passa alla sessione scelta (il caricamento della history
  precedente resta a `CHAT-LISTING-00003`, la chat locale riparte vuota per ora); refresh della
  lista dopo ogni risposta salvata, per far comparire titolo/conversazione appena creati

## Note aperte riportate

- Nota D59 sul task originale (dove collocare la scelta qa/conversation per-conversazione,
  invece del toggle globale in `/home`) resta non affrontata qui — la modalità è ancora letta
  dal query param `mode` come oggi. Da riprendere quando si torna su questo punto (non bloccava
  il DoD di questo task).

## Verifica

- `npx vitest run lib/__tests__` — 49/49 ✅ (nuovi test `listSessionsForGame` +
  `getOrCreateSession` con `user_id`)
- `npx tsc --noEmit` pulito, `eslint` pulito su tutti i file toccati
- Non verificabile in sandbox: comportamento reale della sidebar a runtime (`next dev` non
  restava in vita, limite già noto) e le policy RLS contro il DB reale — solo verifica statica
  (tipi, lint, unit test sulle funzioni di repository)

## Correzioni post-review (Francesco, stessa sessione)

- **Design non allineato al reference**: valori riletti da
  `docs/design-reference/BGT Design System - Standalone.html` (sezioni Chat/Conversazioni) e
  applicati — bubble asimmetriche (angolo "piatto" lato coda, radius 14px/3px), contenitore
  chat+sidebar in un unico riquadro bordato con ombra, sidebar `260px` su sfondo `paper-2`,
  voce elenco selezionata/non selezionata come da mockup, barra di input con bordo superiore.
  Corretto anche il raggio globale di `Button`/`Input`/`Card` (erano su `rounded-lg`, il token
  di design per bottoni/input è 8-10px = `rounded-sm` nella scala del progetto, non `rounded-lg`
  = 20px) — non solo la chat, coerenza con tutta l'app che li riusa
- **Rimosso il pulsante "+ Nuova conversazione"**: ridondante — la pagina parte già su una chat
  vuota (nessuna sessione con messaggi) ogni volta che si arriva su `/game/[id]`, e la
  conversazione viene registrata in DB solo alla prima domanda inviata (`getOrCreateSession`).
  Nessuna azione esplicita necessaria per ottenere quello stato
- Verifica: `tsc`/`eslint` puliti su tutti i file toccati, `vitest run lib/__tests__` 49/49 ✅
  (nessun test tocca lo styling, solo non-regressione logica)

## Seconda correzione post-review (Francesco, stessa sessione)

- **Coerenza di piattaforma**: rimosso il riquadro bordato/ombreggiato che confinava
  sidebar+chat — struttura ora mutuata da `AdminShell` (sidebar + contenuto a piena
  altezza/larghezza, nessun box separato), un max-width resta solo sul testo (`max-w-3xl`) per
  leggibilità, non sullo sfondo
- **Nuovo standard documentato** (`docs/architecture.md`, sezione "Convenzione colore pannelli
  laterali"): nero (`--admin-sidebar*`, esistente) per console admin e altri pannelli
  amministrativi utenti; violetto (nuovo `--app-sidebar*`, alias di `--primary`/`--primary-hover`
  in `app/theme.css`, stesso hue 320 del tema) per i pannelli di navigazione applicativi —
  `ConversationSidebar` è il primo caso reale, ristilizzata di conseguenza (era su `paper-2`
  neutro, ora `bg-app-sidebar`)
- Verifica: `tsc`/`eslint` puliti, `vitest run lib/__tests__` 49/49 ✅

## Terza correzione post-review (Francesco, stessa sessione)

- **Violetto troppo scuro/saturo** ("sembra troppo Slack"): `--app-sidebar` passa da
  `--primary` pieno a `--primary-soft` (violetto chiaro, più vicino al `paper-2` neutro usato
  nella prima versione ma ancora riconoscibile come violetto). Testo di conseguenza scuro
  (`--ink-soft`/`--ink-faint`) invece di bianco, item attivo `oklch(86% 0.045 320)` invece di
  `--primary-hover`
- **Pulsante contestuale**: quando la conversazione è vuota (solo in modalità `conversation`,
  in QA non esiste il concetto), il pulsante "Invia" diventa "Avvia nuova conversazione" — la
  registrazione della sessione avviene comunque solo al submit, nessun cambio di comportamento,
  solo l'etichetta
- **Rimosso** il placeholder "Fai una domanda sulle regole del gioco." mostrato a chat vuota
- Verifica: `tsc`/`eslint` puliti, `vitest run lib/__tests__` 49/49 ✅

## Quarta correzione post-review (Francesco, stessa sessione) — responsive

- **Sidebar responsive**: sotto `md` `ConversationSidebar` non stringe più la chat in uno
  spazio residuo, collassa in una seconda top bar (sotto quella con nome gioco/modalità) con
  hamburger — stesso pattern di `AdminShell` (coerenza di piattaforma, non solo di colore):
  top bar `md:hidden`, drawer a comparsa `md:hidden` con la stessa lista conversazioni, sidebar
  fissa `hidden md:flex` da `md` in su. Estratta `ConversationList` (markup condiviso tra drawer
  mobile e sidebar desktop, per non duplicarlo)
- `app/game/[id]/page.tsx`: wrapper sidebar+chat passa da `flex` a `flex-col md:flex-row`
- Verifica: `tsc`/`eslint` puliti, `vitest run lib/__tests__` 52/52 ✅

## Quinta correzione post-review (Francesco, stessa sessione)

- **Drawer mobile non scrollabile**: era un dropdown limitato a `max-h-64`, con molte
  conversazioni tronco e non consultabile. Sostituito con overlay `fixed inset-0` a tutto
  schermo, con propria top bar (titolo + chiusura) e area lista `flex-1 overflow-y-auto`
- Verifica: `tsc`/`eslint` puliti, `vitest run lib/__tests__` 52/52 ✅

## Sesta correzione post-review (Francesco, stessa sessione)

- **Header principale coperto dall'overlay**: l'header globale dell'app (`components/ui/Header.tsx`
  — logo + menu utente, sopra `<main>` in `app/layout.tsx`) veniva nascosto dall'overlay
  `fixed inset-0` delle conversazioni: un elemento `fixed` dipinge sopra il contenuto statico a
  prescindere dall'ordine nel DOM. Aggiunto `relative z-50` all'`<header>` (l'overlay resta
  `z-40`) — resta sempre visibile e cliccabile sopra l'overlay
- **Bordo mancante tra "Conversazioni" e la lista**: aggiunto `border-b` sotto il titolo, sia
  nella sidebar desktop (`hidden md:flex`) sia nella riga titolo+chiusura dell'overlay mobile
- Verifica: `tsc`/`eslint` puliti, `vitest run lib/__tests__` 52/52 ✅

## Settima correzione post-review (Francesco, stessa sessione)

- **Bar "Conversazioni" coperta dal proprio overlay**: stesso problema già risolto per l'header
  globale (D77-adiacente, sesta correzione) ma dimenticato sulla bar mobile stessa — non
  posizionata, quindi l'overlay `fixed z-40` la copriva quando aperto, nonostante sia lei il
  trigger per aprire/chiudere. Aggiunto `relative z-50` anche a questa bar
- Verifica: `tsc`/`eslint` puliti, `vitest run lib/__tests__` 52/52 ✅

## Decima correzione — eliminazione conversazione (Francesco, stessa sessione)

Non era nel DoD originale del task, richiesta esplicitamente da Francesco dopo la review.

- `lib/chat/repository/session.repository.ts`: nuova `deleteSession(supabase, sessionId,
  userId)` — filtro `user_id` esplicito nella query stessa (non lasciato al solo client/RLS,
  stesso principio di `listSessionsForGame`): anche usando il service client (D77) non si può
  eliminare la sessione di un altro utente. `.select().single()` dopo il delete per rilevare un
  delete bloccato (0 righe), stesso pattern già usato per il feedback
- Migration `20260803000000_chat_sessions_delete_policy.sql`: policy RLS `chat_sessions_delete`
  mancante (stesso gap già visto per l'update) — l'app usa il service client quindi non è
  l'enforcement reale oggi, ma completa lo schema
- `DELETE /api/chat/sessions/[sessionId]`: risolve l'utente dal client con sessione via cookie,
  elimina via service client con `user_id` esplicito
- `chat_messages` viene eliminata a cascata (FK esistente); `user_requests.session_id` resta
  `on delete set null` — lo storico dei costi non si perde (già chiarito in una domanda
  precedente di Francesco), solo il collegamento a questa conversazione
- UI: icona bidone per conversazione in `ConversationList` (sidebar desktop e overlay mobile),
  sempre visibile (non solo in hover — su touch l'hover non esiste, altrimenti sarebbe
  irraggiungibile da mobile), `window.confirm` prima di procedere (nessuna infrastruttura di
  modali in app). Se si elimina la conversazione aperta, `ConversationSidebar` chiama
  `onActiveConversationDeleted` — `page.tsx` riparte da una chat vuota (stesso stato
  dell'apertura pagina)
- Verifica: `npx vitest run lib/__tests__` 55/55 ✅ (3 nuovi test su `deleteSession`), `tsc`/
  `eslint` puliti
- Migration non applicabile in sandbox — da eseguire manualmente da Francesco, come le altre

## Undicesima correzione — ordinamento e palette header (Francesco, stessa sessione)

- **Ordinamento non affidabile**: `listSessionsForGame` si affidava solo a
  `.order('last_message_at', {ascending:false, nullsFirst:false})` lato DB (nullsFirst/nullslast
  su una colonna, tiebreak su un'altra — combinazione facile da rompere silenziosamente).
  Aggiunto un riordino difensivo lato applicazione (`Array.sort` per `lastMessageAt ??
  createdAt`, decrescente) subito dopo la lettura: più recente prima è garantito dal codice, non
  solo dalla query
- **Inconsistenza pagina larga**: l'header "Conversazioni" della sidebar desktop era più basso
  del bordo sfalsato rispetto all'header del gioco sulla stessa riga (padding/contenuto
  diversi, nessun vincolo di altezza tra i due). Ora un blocco header dedicato con
  `min-h-[75px]` e `border-b border-line` — stesso colore di bordo dell'header del gioco (non
  più un violetto dedicato), altezza allineata al caso comune (senza espansioni)
- **Nuovo colore header**: implementazione ormai divergente dal reference originale (violetto
  chiaro sull'intero pannello, dopo la terza correzione) — l'header "Conversazioni" rischiava di
  confondersi visivamente con i titoli delle conversazioni sotto, stesso trattamento chiaro.
  Nuovo token `--app-sidebar-header` (violetto pieno, `--primary`) + `--app-sidebar-header-ink`
  (testo chiaro) solo per la fascia header, in tutti e tre gli stati (bar mobile collassata,
  riga titolo dell'overlay, header sidebar desktop) — il corpo lista resta chiaro
  (`--app-sidebar`)
- Verifica: `tsc`/`eslint` puliti, `vitest run lib/__tests__` 55/55 ✅

## Tredicesima correzione — pulsante "nuova conversazione" quando una conversazione è caricata (Francesco, stessa sessione)

Il pulsante era stato rimosso nella terza correzione ragionando che la pagina parte già su chat
vuota — vero all'apertura, ma una volta ripresa una conversazione dalla sidebar (o inviato il
primo messaggio di una nuova) non c'era più modo di tornare a una chat vuota senza ricaricare la
pagina.

- `app/game/[id]/page.tsx`: nuovo `handleNewConversation` (id sessione fresco + chat locale
  svuotata, stessa logica già usata per `handleActiveConversationDeleted`), pulsante "+ Nuova
  conversazione" nell'header della chat, visibile solo quando `mode === 'conversation' &&
  messages.length > 0` — non a chat già vuota, dove sarebbe ridondante
- Verifica: `tsc`/`eslint` puliti, `vitest run lib/__tests__` 55/55 ✅

## Quattordicesima correzione — layout header ristretto (Francesco, stessa sessione)

- Sotto `sm` il pulsante "+ Nuova conversazione" andava a schiacciare il nome del gioco sulla
  stessa riga (poco spazio). Impilati (`flex-col`) invece che affiancati sotto `sm`, pulsante a
  piena larghezza invece che stretto sul contenuto; da `sm` in su torna il layout a riga
  (`sm:flex-row sm:justify-between`). Padding header anche ridotto `px-4` sotto `sm` (`sm:px-8`)
- Verifica: `tsc`/`eslint` puliti, `vitest run lib/__tests__` 55/55 ✅

## Quindicesima correzione — pulsante "nuova conversazione" ridotto a FAB (Francesco, stessa sessione)

Il pulsante testuale nell'header era "troppo in primo piano". Spostato: icona rotonda (solo "+"),
in basso a destra sopra la barra di input, stessa posizione a schermo largo e stretto (nessuna
variante responsive richiesta).

- `app/game/[id]/page.tsx`: rimosso il pulsante dall'header (torna alla versione senza `flex`
  wrapper attorno a titolo/sottotitolo). Nuovo bottone rotondo (`h-11 w-11 rounded-full
  bg-primary`, solo icona "+") ancorato con `absolute -top-16 right-4 sm:right-8` al
  contenitore della barra di input (`relative`) — non alla lista messaggi che scrolla: resta
  fisso appena sopra l'input indipendentemente da quanto la chat sopra sia scrollata
- Tooltip: attributo nativo `title="Nuova conversazione"` (+ `aria-label` per accessibilità) —
  nessun componente Tooltip esiste in app, costruirne uno per un solo pulsante sarebbe stato
  fuori scope
- Verifica: `tsc`/`eslint` puliti, `vitest run lib/__tests__` 55/55 ✅

## Dodicesima correzione — modale di conferma eliminazione (Francesco, stessa sessione)

- Sostituito `window.confirm`/`window.alert` con i primitivi UI già esistenti in app ma finora
  mai agganciati a un flusso reale: `components/ui/Modal.tsx` (era "pronto per login/
  registrazione e pannello admin", primo consumer effettivo) e `components/ui/Toast.tsx`
  (stesso pattern già usato in `ProfileForm`/`UpdatePasswordForm`) per l'errore di eliminazione
- `Modal` portato a `z-[70]`: deve restare sopra qualunque overlay/header già in uso nella pagina
  chat (header globale `z-[60]`, overlay mobile `z-40`/bar `z-50`) — una modale non deve mai
  poter essere coperta da un pannello sottostante
- Nuovo `deleteTarget` (sostituisce il confirm sincrono): apre la modale, `confirmDelete` esegue
  la chiamata solo al click su "Elimina" dentro la modale, con stato `deleting` per disabilitare
  i pulsanti ed evitare doppi invii. Chiusura bloccata (click fuori/Escape) mentre l'eliminazione
  è in corso
- Aggiunta variante `danger` a `components/ui/Button.tsx` (mancava, serviva per il pulsante
  "Elimina") invece di un override di classi via `className` — più affidabile: l'ordine di
  cascata CSS tra classi Tailwind non è garantito dall'ordine nella stringa `className`
- Verifica: `tsc`/`eslint` puliti, `vitest run lib/__tests__` 55/55 ✅

## Nona correzione post-review (Francesco, stessa sessione)

- **Header globale e bar "Conversazioni" allo stesso z-index (50)**: da ristretto, il menu
  utente (dropdown del `Header` globale) veniva coperto dalla bar "Conversazioni" — a z-index
  pari vince l'ultimo elemento nel DOM, e la bar viene dopo (dentro `<main>`). `Header` sale a
  `z-[60]` (valore arbitrario: 50 è il massimo della scala Tailwind di default, "z-60" da solo
  non genera nulla) — resta sopra sia la bar (z-50) sia l'overlay conversazioni (z-40)
- Verifica: `tsc`/`eslint` puliti, `vitest run lib/__tests__` 52/52 ✅

## Ottava correzione post-review (Francesco, stessa sessione)

- **Bordo mancante sulla bar "Conversazioni" da ristretto**: la bar collassata (mobile,
  non espansa) non aveva il `border-b` aggiunto invece al titolo della sidebar desktop e alla
  riga titolo dell'overlay — aggiunto anche lì, coerente nei tre stati (collassato, sidebar
  desktop, overlay espanso)
- **Scrollbar bianca in modalità espansa**: `color-scheme: light` (forzato globalmente,
  necessario altrove per gli input nativi) fa renderizzare uno scrollbar nativo chiaro/bianco
  ovunque — stonava sullo sfondo violetto del pannello. Nuova classe `.app-sidebar-scroll`
  (`app/theme.css`): track sempre trasparente, thumb visibile solo in `:hover` sul contenitore
  (`scrollbar-color`/`::-webkit-scrollbar-thumb`), applicata a entrambe le liste (sidebar
  desktop e overlay mobile)
- **Sfumatura in fondo**: nuovo hook `useBottomFade` (nel componente, non generalizzato altrove
  — unico consumer) — calcola via `scrollHeight - scrollTop - clientHeight` se c'è ancora
  contenuto sotto l'ultima voce visibile (ricalcolato su scroll/resize/cambio lista tramite
  `ResizeObserver`), e solo in quel caso applica una maschera CSS (`mask-image` gradiente) che
  sfuma gli ultimi 28px del contenitore. Sparisce da sola quando si scrolla fino in fondo — non
  è una decorazione fissa
- Verifica: `tsc`/`eslint` puliti, `vitest run lib/__tests__` 52/52 ✅
