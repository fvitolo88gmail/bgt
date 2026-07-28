# POC-00005 — Citazioni, fallback, deploy, selezione gioco

**Stato:** ✅ chiusa

## Task

| ID | Task | DoD |
|---|---|---|
| S3.1 ✅ | Render citazioni in UI: pagina e sezione visibili sotto ogni risposta | fonte leggibile per ogni risposta — confermato: `app/api/chat/route.ts` restituisce `page`/`section` per fonte, `components/chat/SourcesList.tsx` li renderizza sotto ogni risposta via `sourceLabel` |
| S3.6 | ✅ Deploy completo su Vercel | URL pubblico funzionante end-to-end |

## Note

- Discrepanza D22 risolta il 2026-07-26: S3.1 confermato completo da Francesco dopo verifica nel
  codice, epica chiusa.
- S3.2–S3.5 e S3.7 sono stati spostati nell'epica `0600-fase3-continua.md`, da riprendere dopo il
  completamento dell'epica `0500-forum-bgg.md` (D22).
