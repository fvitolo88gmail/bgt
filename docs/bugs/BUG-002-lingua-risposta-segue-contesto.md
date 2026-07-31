# BUG-002 — La risposta segue la lingua del CONTESTO recuperato invece della domanda

**Stato:** noto, fix proposto in `lib/prompt/shared.ts` (`RESPONSE_LANGUAGE_RULE`) — da riverificare
**Emerso in:** sessione 2026-07-31, chat su gioco con manuale ingested in inglese (Alien Species Space Agencies), modalità `conversation`

## Sintomo

In un turno in cui il CONTESTO recuperato (chunk manuale + forum) è quasi interamente in inglese,
la risposta esce in inglese anche se sia la DOMANDA dell'utente sia l'intero STORICO passato nel
prompt sono in italiano.

Transcript repro:

```
Utente: Cosa sono i glifidi?
Assistente (IT): Non ho trovato questa informazione nel manuale...

Utente: Cerca ora
Assistente (IT): Non ho trovato questa informazione nel manuale...

Utente: intendevo i glifidi
Assistente (EN): I apologize for the confusion. The "Glyphids" are an alien species...
```

Storico passato al prompt per il terzo turno (verificato nei log):

```
Utente: Cosa sono i glifidi?
Assistente: Non ho trovato questa informazione nel manuale...
Utente: Cerca ora
Assistente: Non ho trovato questa informazione nel manuale...
```

Sia domanda ("intendevo i glifidi") che storico sono in italiano. L'unico segnale in inglese nel
prompt di quel turno è il CONTESTO recuperato (etichette fonte tipo "Alien Species Space Agencies:
Glifidi — Obtaining Glyph Markers", tutte in EN perché il manuale è stato ingested in EN).

## Causa ipotizzata

`RESPONSE_LANGUAGE_RULE` (v. `lib/prompt/shared.ts`) istruisce esplicitamente a ignorare la lingua
delle istruzioni e (in `conversation.ts`) dello storico, ma non menziona il CONTESTO come possibile
segnale competitivo. Il blocco CONTESTO è posizionato subito prima della sezione RISPOSTA nel
prompt — vicinanza che, come già osservato in BUG-001 per le etichette di citazione, sembra pesare
più delle istruzioni esplicite quando il modello genera testo copiando/parafrasando da fonti in
un'altra lingua.

## Fix applicato

Aggiunta a `RESPONSE_LANGUAGE_RULE` una clausola esplicita che nomina il CONTESTO come possibile
segnale da ignorare, allo stesso modo di istruzioni e storico — v. `lib/prompt/shared.ts`.

## Verifica

Da riverificare da Francesco riproducendo lo stesso scambio (o un caso equivalente: domanda IT su
manuale EN, con storico IT).
