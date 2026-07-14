# Epica A — AI Provider Adapters (solo generazione)

**Stato:** da iniziare — dopo `0900-chat-con-contesto.md`

Scope confermato (D23): embedding resta centralizzato su Gemini, gestito solo da admin in ingest.
Solo il modello di **generazione risposta** è selezionabile per utente/account.

## Task

| ID | Task | DoD |
|---|---|---|
| A1 | Generalizza `LLMClient`: interfaccia `generate()` implementabile da adapter multipli (Gemini, Claude, ChatGPT) | almeno 2 adapter concreti, stessa interfaccia |
| A2 | Storage sicuro credenziali utente (BYOK per generazione): tabella con valori cifrati lato applicativo prima dell'insert | chiave salvata mai in chiaro in DB, verificato ispezionando la riga |
| A3 | UI settings: utente seleziona provider e inserisce la propria API key | selezione persistita, usata nella chiamata successiva a `/api/chat` |
| A4 | Fallback se l'utente non ha configurato nessun provider proprio | usa Gemini di default (comportamento attuale), nessun errore per utenti che non configurano nulla |
