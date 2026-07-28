# Epica CHAT-LISTING — Elenco conversazioni e limite risposte

**Stato:** da iniziare

## Contesto

Oggi (`POC-00016` — chat con contesto) esiste una sola sessione per `game_id`, nessun elenco di
conversazioni passate ripercorribile dall'utente. Questa epica aggiunge una UI per
elencare/riprendere conversazioni e un limite configurabile sul numero di risposte, per
contenere il consumo di quota Gemini.

**Relazione con altre epiche:** dipende dal modello dati di `POC-00016` (chat_sessions/
chat_messages) e presuppone conversazioni multiple per game_id/utente — oggi il modello è una
sessione per gioco; da rivalutare se serve un cambio di schema (sessione per utente+gioco invece
che solo gioco), verosimilmente legato ad `AUTH` per identificare l'utente proprietario di ogni
conversazione.

## Task

Vedi directory `CHAT-LISTING/` per i task singoli.

| ID | Titolo | Stato |
|---|---|---|
| CHAT-LISTING-00001 | Modello dati: conversazioni multiple per utente/gioco | todo |
| CHAT-LISTING-00002 | Sidebar con elenco conversazioni | todo |
| CHAT-LISTING-00003 | Ripresa di una conversazione dalla sidebar | todo |
| CHAT-LISTING-00004 | Limite configurabile di risposte per conversazione | todo |

## Note aperte

- Da chiarire se il limite di risposte (CHAT-LISTING-00004) è per conversazione, per utente, o
  globale per periodo — impatta anche `BILLING` (consumo quota) e va deciso prima di
  implementare.
