# Epica DESIGN — Nuovo design dell'app

**Stato:** ✅ completata (2026-08-02) — DESIGN-00004 chiusa, verifica manuale confermata

## Contesto

Definire un design system coerente per l'app (oggi stili sparsi/inline senza un tema unico) e
generalizzare i componenti UI classici (Button, Modal, Header, Footer, ecc.) su quel tema.

**Relazione con altre epiche:** copre integralmente lo scope di `POC-00015` (UI Uplifting) —
deprecata come superseded da questa epica (v. D63,
`progress/POC/done/POC-00015-ui-uplifting.md`). Nessun lavoro da recuperare da lì.

## Task

Vedi directory `DESIGN/` per i task singoli.

| ID | Titolo | Stato |
|---|---|---|
| DESIGN-00001 | Scelta tema e palette colori | ✅ |
| DESIGN-00002 | Generalizzazione stili/CSS componenti base | ✅ |
| DESIGN-00003 | Applicazione del nuovo design ai componenti esistenti | ✅ |
| DESIGN-00004 | Menu avatar utente + pagina profilo | ✅ |

## Note aperte

- Il `Modal` (`components/ui/Modal.tsx`) è pronto ma non ancora agganciato a nessuna schermata —
  nessun flusso attuale (login/admin) lo richiede ancora.
- `app/page.tsx` (root, boilerplate `create-next-app`) resta fuori scope: non è nel flusso di
  navigazione dell'app (v. `architecture.md`) e non era nell'elenco pagine di DESIGN-00003.
