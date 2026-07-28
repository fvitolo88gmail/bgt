# GAME-REQUEST-00001 — Form di richiesta gioco + notifica admin

**Stato:** todo (ex-S3.7 di `POC-00013`)

## Task

Se la ricerca di un gioco (`search-game`, v. `ADMIN-CONSOLE-00004`/ex-S3.3) non trova risultati, o
il gioco esiste ma non è ancora ingested, mostrare un form che permette all'utente di segnalare la
richiesta invece di offrire un upload self-service (fuori scope, v. D03/D16 — copyright).

## DoD

Richiesta salvata (tabella `game_requests`) e/o notificata via email all'admin; nessun upload
diretto lato utente reso possibile da questo flusso.
