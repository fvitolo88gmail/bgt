# DESIGN-00002 — Generalizzazione stili/CSS componenti base

**Stato:** done

**Blocca:** DESIGN-00001

## Task

Generalizzare stili e CSS dei componenti classici riutilizzabili in tutta l'app: Button, Modal,
Header, Footer, e altri componenti base ricorrenti (Card, Badge, Input, ecc.), tutti basati sul
tema definito in DESIGN-00001.

## DoD

Componenti base implementati/refattorizzati in `components/ui/` (o percorso equivalente
concordato), nessun valore di stile hardcoded fuori dal tema, usati in almeno due punti diversi
dell'app per verificarne la riusabilità.
