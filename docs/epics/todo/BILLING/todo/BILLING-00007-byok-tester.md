# BILLING-00007 — BYOK per gruppo ristretto di tester

**Stato:** todo

## Task

**BYOK** per il gruppo ristretto di tester (amici): l'utente inserisce la propria chiave
Gemini, cifrata at-rest, mai loggata in chiaro, usata solo runtime per la singola chiamata.
Include analisi di fattibilità: è possibile, in fase di registrazione, collegare l'account
Google dell'utente e generare/settare automaticamente la chiave Gemini in un wizard guidato
(invece dell'inserimento manuale)?

## DoD

Modalità BYOK funzionante end-to-end per i tester; analisi del flusso
wizard-collegamento-account documentata (fattibile/non fattibile, con motivazione e eventuali
limiti API Google riscontrati).
