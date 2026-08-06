# HOME-00001 — Home "Chiedi subito"

## Task

Sostituire `/home` (saluto + dropdown gioco + scelta modalità) con il layout "Chiedi subito" del
mockup (`BGT Home Page.dc.html`, variante 1b):

- Input domanda in evidenza, con chip sotto per scegliere il gioco (default: primo gioco
  disponibile).
- Chip di esempi di domande generiche (non legate a un gioco specifico — nessuna fonte dati per
  esempi reali).
- Invio → naviga direttamente a `/game/[id]?mode=qa&q=<domanda>`, che precompila e invia subito
  la prima domanda (nessuna pagina intermedia).
- Sezione "Riprendi" sotto: fino a poche conversazioni recenti dell'utente, su tutti i giochi
  (titolo, nome gioco, quando) — link a `/game/[id]?mode=conversation&sessionId=<id>`, che
  ricarica la history reale.
- Riuso di componenti esistenti (`Card`, `Button`, `Input`, `Badge`, `OwlMark`) — nessuno stile
  ad hoc fuori da `theme.css`.

## DoD

- [x] `app/game/[id]/page.tsx` supporta `?sessionId=` (precarica la history, forza modalità
      conversation) e `?q=` (precompila e invia la prima domanda in automatico).
- [x] Nuova funzione repository per l'elenco delle sessioni recenti di un utente su tutti i
      giochi (non solo un gameId) — `listRecentSessionsForUser`.
- [x] Nuovi componenti `QuestionHomeForm` e `ResumeConversations` in `components/home/`.
- [x] `app/home/page.tsx` aggiornata al nuovo layout, `GameSelectForm` rimosso (non più usato).
- [x] `tsc --noEmit` ed `eslint` puliti.
- [ ] Verifica manuale: home carica, submit domanda porta in chat con la domanda già inviata,
      ripresa conversazione ricarica la history corretta — da fare in locale con `next dev`
      (sandbox non riesce a tenerlo in vita, stesso limite già noto per altri task).

## Implementazione

- `handleSubmit` in `app/game/[id]/page.tsx` accetta ora un `questionOverride` opzionale, usato
  sia dal bootstrap da `?q=` sia dal click/invio normale.
- Bootstrap all'apertura di `/game/[id]` (sessionId da riprendere o prima domanda) in un unico
  `useEffect` con ref di guardia contro il doppio run di React Strict Mode.
- Esempi di domande in `QuestionHomeForm` volutamente generici (non per-gioco, v. note aperte in
  `HOME.md`).
- Feedback di Francesco sulla prima versione (chip troppo grande/stile diverso, box domanda
  senza bordo colorato, card conversazioni diverse dal mockup, manca il divider "oppure
  riprendi"): aggiunto `GameChipSelect` (chip pill compatto invece del `Dropdown` generico, che
  è pensato per un campo di form a sé stante, non per un dettaglio dentro l'input), bordo
  `border-primary` + `ring-primary-soft` sul box domanda, card "riprendi" con icona in
  riquadro colorato e divider testuale tra input ed elenco — tutto dentro `QuestionHomeForm`,
  `ResumeConversations` ridotto a divider+lista (il titolo di sezione mono-uppercase è sparito).
