# BILLING-00005 — Gestione atomica saldo crediti

**Stato:** todo (condizionale — solo se BILLING-00004 introduce crediti/pay-per-use)

**Blocca:** BILLING-00004

## Task

Se la decisione include crediti/pay-per-use: gestione atomica del saldo (lock/transazione DB),
prevenzione race condition su richieste parallele, gestione errori a metà chiamata.

## DoD

Test di richieste concorrenti non permettono saldo negativo oltre la soglia di tolleranza
definita.
