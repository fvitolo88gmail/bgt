# CHAT-LISTING-00004 — Limite configurabile di risposte per conversazione

**Stato:** todo

## Task

Configurare un limite al numero di risposte (turni) che è possibile inviare, per contenere il
consumo di quota/costo Gemini. Da chiarire l'ambito esatto del limite (per conversazione, per
utente, o globale/periodo — v. nota aperta in `CHAT-LISTING.md`) prima di implementare.

## DoD

Limite configurabile (non hardcoded — valore in configurazione); superato il limite, l'utente
riceve un messaggio chiaro invece di un errore generico; comportamento verificato con test
manuale end-to-end.
