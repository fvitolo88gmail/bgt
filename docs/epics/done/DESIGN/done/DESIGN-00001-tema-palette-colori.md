# DESIGN-00001 — Scelta tema e palette colori

**Stato:** todo

## Task

Scegliere un tema visivo per l'app e definire la palette colori (primari, secondari, stati
semantici — successo/errore/warning), tipografia e spacing scale. Formalizzare come CSS
variables/design tokens in un file unico (es. `app/theme.css` o `lib/theme.ts`).

## DoD

File unico con tutti i token del tema; nessun colore/font/spacing hardcoded fuori da questo
file per il nuovo lavoro; palette e tema documentati (screenshot o riferimento) in
`decision-log.md` se comportano una scelta rilevante (es. libreria/framework di componenti).
