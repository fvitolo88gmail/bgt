# CHAT-LISTING-00002 — Sidebar con elenco conversazioni

**Stato:** todo

**Blocca:** CHAT-LISTING-00001

## Task

Aggiungere un sider (sidebar) nella UI di chat con la lista delle conversazioni già avute
(titolo/anteprima, ordinate per ultimo messaggio).

**Nota (v. D59):** con conversazioni multiple per gioco, la scelta modalità domande/conversazione
(C5 di `POC-00016`, mai implementato) va decisa per conversazione — non più con un toggle globale
in `/home` legato a un'unica sessione per gioco. Da definire qui o in `CHAT-LISTING-00003` dove
esattamente nella UI va posta questa scelta (es. all'apertura di una nuova conversazione).

## DoD

Sidebar visibile in `/game/[id]`, elenco popolato da dati reali, nessuna regressione sulla chat
attiva.
