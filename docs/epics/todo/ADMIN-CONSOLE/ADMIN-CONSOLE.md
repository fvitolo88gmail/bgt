# Epica ADMIN-CONSOLE — Console amministrativa

**Stato:** da iniziare

## Contesto

Console admin-only per gestire lo stato dei giochi (manual_ready/forum_ready, ecc.), un wizard
guidato per l'ingest con stato di avanzamento visibile, e una UI per invocare gli script di
diagnostica oggi eseguibili solo da riga di comando.

**Relazione con altre epiche:** protezione admin-only dipende da `AUTH` (colonna `role` su
`profiles`, v. `AUTH-00001`). Sovrappone in parte lo scope di `BILLING-00002` (pannello
admin-only costi) — probabile che quel pannello diventi una sezione di questa console invece di
una UI separata; da riconciliare quando si affronta questa epica.

## Task

Vedi directory `ADMIN-CONSOLE/` per i task singoli.

| ID | Titolo | Stato |
|---|---|---|
| ADMIN-CONSOLE-00001 | Gestione stato giochi | todo |
| ADMIN-CONSOLE-00002 | Wizard di ingest con stato di avanzamento | todo |
| ADMIN-CONSOLE-00003 | UI per invocare script di diagnostica | todo |

## Note aperte

- Riconciliare con `BILLING-00002` (pannello costi) quando si inizia questa epica: valutare se
  farlo confluire qui come sezione della console invece di restare separato.
