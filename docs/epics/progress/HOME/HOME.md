# Epica HOME — Redesign della home page

**Stato:** in corso — HOME-00001 in lavorazione

## Contesto

Nuovo mockup della home (`BGT Design System/BGT Home Page.dc.html`, variante **1b "Chiedi
subito"`) sostituisce l'attuale `/home` (saluto + dropdown gioco chiuso + scelta modalità prima
di poter fare qualsiasi domanda). Il campo domanda diventa il contenuto centrale della pagina: si
scrive la domanda, si sceglie il gioco con un chip sotto l'input, l'invio porta direttamente in
chat con la domanda già inviata — nessuna pagina intermedia. Sotto, una sezione "riprendi" mostra
le conversazioni recenti dell'utente su tutti i giochi.

Le altre due varianti del mockup (1a "Scaffale dei giochi", 1c) non sono nello scope di questa
epica — restano solo riferimento visivo scartato.

## Task

Vedi directory `HOME/` per i task singoli.

| ID | Titolo | Stato |
|---|---|---|
| HOME-00001 | Home "Chiedi subito": form domanda+gioco, ripresa conversazioni recenti | in corso |

## Note aperte

- Le "domande d'esempio" del mockup (specifiche per gioco, dati inventati nel mockup — non esiste
  una fonte dati reale per esempi per-gioco) sono state rimosse su richiesta di Francesco: non
  aggiungevano abbastanza per giustificare lo spazio, specie su mobile.
- La modalità (domande/conversazione) non è scelta con un radio prominente come nella vecchia
  home, ma resta scegliebile: una checkbox secondaria sotto gli esempi ("ricorda i turni
  precedenti") — di default "domande" (qa). Ripristinata dopo la prima versione del task, che
  l'aveva rimossa seguendo alla lettera il mockup 1b (che assume il toggle "dentro la chat", mai
  esistito in questa forma nel codice) — senza, non c'era più modo di avviare dalla home una
  conversazione con storico. La ripresa di una conversazione precedente riapre comunque sempre in
  modalità "conversazione" (coerente con lo schema esistente: `chat_sessions` non ha una colonna
  "modalità").
- Badge di stato fonte (Manuale/Community) disattivati temporaneamente in `QuestionHomeForm`
  (flag `SHOW_SOURCE_BADGES`, non rimossi) — la loro posizione accanto a chip/bottone non ha
  retto su mobile a più iterazioni di fix, da ripensare da zero.
