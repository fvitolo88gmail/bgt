# Epica CHAT-LISTING — Elenco conversazioni e limite risposte

**Stato:** in corso

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
| CHAT-LISTING-00001 | Modello dati: conversazioni multiple per utente/gioco | ✅ done |
| CHAT-LISTING-00002 | Sidebar con elenco conversazioni | ✅ done |
| CHAT-LISTING-00003 | Ripresa di una conversazione dalla sidebar | ✅ done |
| CHAT-LISTING-00004 | Limite configurabile di risposte per conversazione | todo |
| CHAT-LISTING-00005 | Layout unificato della pagina conversazione | in corso — verifica manuale da fare |

## Note aperte

- `CHAT-LISTING-00005` (layout) è stato eseguito prima di `CHAT-LISTING-00004`, che resta il
  prossimo task funzionale dell'epica: deroga esplicita all'ordine, concordata con Francesco —
  00004 è bloccato da una decisione ancora aperta (vedi nota qui sotto), 00005 non dipende da
  quella decisione.
- Da chiarire se il limite di risposte (CHAT-LISTING-00004) è per conversazione, per utente, o
  globale per periodo — impatta anche `BILLING` (consumo quota) e va deciso prima di
  implementare.
- Naming conversazione (deciso con Francesco, sessione 2026-08-02): titolo generato via Gemini
  dopo il primo turno, non troncamento del primo messaggio. Il generatore vero e proprio non è
  ancora implementato (solo colonna + metodi repository in CHAT-LISTING-00001) — va cablato nel
  task che introduce la sidebar/route (CHAT-LISTING-00002 o un task dedicato).
- Flusso confermato con Francesco: dopo la selezione gioco si atterra sul chat listing (nuova
  conversazione o ripresa di una precedente); la modalità QA salta il listing e va dritta alla
  chat corrente come oggi. Da tradurre in task/routing quando si affronta CHAT-LISTING-00002 (la
  nota D59 già presente lì sulla scelta qa/conversation per-conversazione va riletta insieme a
  questo).
