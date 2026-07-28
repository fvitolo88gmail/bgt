# BILLING-00008 — AI Provider Adapters (solo generazione)

**Stato:** todo

## Contesto

Ex-epica separata (0561/"Epica A"), riclassificata come singolo task di BILLING: la scelta del
provider di generazione è una leva di costo/monetizzazione, non una feature a sé stante.

Scope confermato: embedding resta centralizzato su Gemini, gestito solo da admin in ingest.
Solo il modello di **generazione risposta** è selezionabile per utente/account.

## Task

- Generalizza `LLMClient`: interfaccia `generate()` implementabile da adapter multipli (Gemini,
  Claude, ChatGPT)
- Storage sicuro credenziali utente (BYOK per generazione): tabella con valori cifrati lato
  applicativo prima dell'insert
- UI settings: utente seleziona provider e inserisce la propria API key
- Fallback se l'utente non ha configurato nessun provider proprio

## DoD

Almeno 2 adapter concreti con la stessa interfaccia; chiave utente salvata mai in chiaro in DB
(verificato ispezionando la riga); selezione persistita e usata nella chiamata successiva a
`/api/chat`; utenti senza provider configurato usano Gemini di default (comportamento attuale),
nessun errore.
