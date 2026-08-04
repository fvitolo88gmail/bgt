# CHAT-LISTING-00005 — Layout unificato della pagina conversazione

**Stato:** in corso

**Dipende da:** CHAT-LISTING-00002, CHAT-LISTING-00003

## Task

La pagina `/game/[id]` in modalità `conversation` si legge come due pagine accostate invece che
come una sola schermata. Cause rilevate:

1. Due header sulla stessa riga con trattamenti opposti — la fascia sidebar (`--app-sidebar-header`,
   violetto pieno, mono uppercase) e l'header del gioco (paper, serif + sottotitolo).
2. Allineamento tra le due fasce ottenuto con `min-h-[75px]` sulla sidebar: si sfalsa non appena
   l'header del gioco cresce (checkbox espansioni).
3. Nessun bordo verticale tra le colonne: i `border-b` dell'header e `border-t` della barra di
   input si interrompono contro un salto di colore invece che su una linea.
4. Tre superfici in 220px (violetto pieno, violetto chiaro, paper) per una gerarchia a due livelli.
5. Ritmo orizzontale incoerente: `p-3.5` sidebar, `px-4 sm:px-8` header, `px-8` messaggi e input.
6. Pulsante "nuova conversazione" come tondo flottante (`absolute -top-16`) sospeso sopra i
   messaggi, senza appartenere ad alcun contenitore.
7. Su mobile tre fasce impilate prima del contenuto (header globale, bar "Conversazioni", header
   gioco).
8. Sotto la barra di input, il footer globale aggiunge una seconda fascia bordata consecutiva e
   taglia le colonne a piena altezza appena sopra di sé (emerso dopo la prima revisione).

Ristrutturare il layout portando l'header del gioco **sopra entrambe le colonne**, a piena
larghezza, e togliendo l'header proprio alla sidebar.

Scelte confermate con Francesco prima di implementare:

- Task collocato in `CHAT-LISTING` (non in una riapertura di `DESIGN`), eseguito prima di
  `CHAT-LISTING-00004` che resta il prossimo task funzionale dell'epica.
- Su mobile la seconda top bar "Conversazioni" sparisce: il pannello si apre da un'icona
  nell'header del gioco.

## DoD

- Una sola linea orizzontale continua in cima all'area, che non si sfalsa quando il gioco ha
  espansioni collegate.
- Sidebar e chat separate da un bordo verticale, non dal solo salto di colore.
- Due superfici invece di tre nel pannello laterale.
- Nessun elemento flottante sopra la lista messaggi.
- Su mobile una sola fascia sopra il contenuto, con accesso alle conversazioni dall'header.
- Una sola fascia in fondo alla schermata, con le colonne che arrivano fino al bordo inferiore.
- Nessuna regressione su selezione/ripresa/eliminazione conversazione e sull'invio di una domanda.

## Implementazione

- `app/game/[id]/page.tsx`: header del gioco estratto dalla colonna chat e portato a piena
  larghezza sopra la riga `sidebar + chat`; la riga interna diventa il contenitore `relative` a
  cui si ancora l'overlay mobile. Padding orizzontale uniformato a `px-4 sm:px-6` sulle tre
  fasce della colonna chat. Rimosso il tondo flottante "+" e il suo `absolute -top-16`.
- Stato di apertura del pannello mobile sollevato da `ConversationSidebar` a `page.tsx`: il
  trigger ora è un'icona nell'header del gioco, che deve restare visibile e cliccabile mentre
  l'overlay è aperto.
- `components/chat/ConversationSidebar.tsx`: rimossi la fascia header del pannello e la seconda
  top bar mobile; aggiunto `border-r border-line` alla colonna desktop; "Nuova conversazione"
  diventa la prima voce del pannello, sopra l'elenco. L'overlay mobile non ha più una propria
  riga titolo (il trigger nell'header assolve alla chiusura).
- `app/game/[id]/page.tsx`: aggiunto `relative` al contenitore scrollabile dei messaggi — lo
  scroll calcolato su `offsetTop` presuppone che l'`offsetParent` sia quel contenitore, non un
  antenato posizionato più in alto.
- `app/theme.css`: rimossi `--app-sidebar-header` e `--app-sidebar-header-ink` (e le mappature
  in `@theme inline`), senza più consumer.

## Revisione — footer (Francesco, stessa sessione)

- `components/ui/Footer.tsx`: da Server Component a Client Component, non renderizza nulla sulle
  route a piena altezza (oggi solo `/game/[id]`), riconosciute per pattern di path. La frase è
  ora una costante esportata, riusata dalla chat.
- `app/game/[id]/page.tsx`: il disclaimer compare sotto il campo di input, dentro lo stesso
  `max-w-3xl` e senza fascia né bordo propri. La barra di input torna a essere l'unica fascia in
  fondo alla schermata, e le colonne arrivano fino al bordo inferiore.

## Verifica

- `npx tsc --noEmit` pulito
- `npx eslint` pulito sui file toccati
- `npx vitest run lib/__tests__` — nessuna regressione (i test coprono i repository, non lo
  styling)
- **Da fare (Francesco):** verifica manuale a schermo largo e stretto — allineamento dell'header
  con e senza espansioni, apertura/chiusura pannello su mobile, selezione ed eliminazione di una
  conversazione, avvio di una nuova conversazione dal pannello, footer ancora presente sulle
  altre pagine (`/home`, `/login`, `/profile`, `/admin`) e assente sulla chat.
