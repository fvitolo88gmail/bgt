# ADMIN-CONSOLE-00001 — Gestione stato giochi

**Stato:** todo

**Blocca:** AUTH-00001

## Task

Sezione della console admin-only (protetta da `role = 'admin'`) per visualizzare e modificare
lo stato dei giochi (`manual_ready`, `forum_ready`, metadati come `bgg_id`, nome, anno).

## DoD

Un admin può vedere lo stato di tutti i giochi e modificarlo manualmente da UI; un utente non
admin non ha accesso alla pagina (401/redirect).
