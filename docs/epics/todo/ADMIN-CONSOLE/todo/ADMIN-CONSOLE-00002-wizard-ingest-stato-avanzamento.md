# ADMIN-CONSOLE-00002 — Wizard di ingest con stato di avanzamento

**Stato:** todo

**Blocca:** ADMIN-CONSOLE-00001

## Task

Wizard guidato per l'ingest di un nuovo gioco (manuale PDF, forum BGG) dalla console admin, con
stato di avanzamento visibile step per step (upload → parsing → chunking → embedding →
completato), invece di dover lanciare script da riga di comando e seguirne i log manualmente.

## DoD

Un admin può avviare un ingest completo dalla UI e vedere lo stato di avanzamento in tempo
reale; un errore in uno step è visibile in UI con indicazione dello step fallito, non solo nei
log.
