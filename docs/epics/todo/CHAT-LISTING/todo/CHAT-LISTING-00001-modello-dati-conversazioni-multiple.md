# CHAT-LISTING-00001 — Modello dati: conversazioni multiple per utente/gioco

**Stato:** todo

## Task

Estendere il modello dati di `chat_sessions` (oggi una sessione per `game_id`, v.
`POC-00016`) per supportare più conversazioni distinte per lo stesso gioco, associate a un
utente/owner (titolo conversazione, timestamp ultimo messaggio).

## DoD

Migration applicata; una sessione esistente resta accessibile come prima conversazione senza
perdita di dati; possibile creare una nuova conversazione sullo stesso gioco senza sovrascrivere
quella precedente.
