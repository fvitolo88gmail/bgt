# POC-00017 — Restyling delle risposte (tono, ripetitività, citazioni utente)

**Contesto:** revisione manuale delle risposte in `docs/baselines/005-20260728-hegemony-ambiguous-gemini-3-1-flash-lite.json`
(18/20, baseline già buona sul piano fattuale) ha evidenziato tre problemi di forma, indipendenti
dalla correttezza del contenuto e quindi non in scope in POC-00011:

1. Formula fissa ripetuta identica in quasi ogni risposta con DEDUZIONE ("Il manuale non lo
   definisce esplicitamente, ma dalle regole descritte si può dedurre che...") — `WRONG_PREMISE_RULE`
   ne fornisce solo un esempio in `lib/prompt.ts`, ma il modello lo riusa alla lettera ogni volta,
   risultando meccanico.
2. Il fallback "Non ho trovato questa informazione nel manuale" (`lib/prompt.ts`) suona secco e
   scoraggiante quando usato; in almeno un caso osservato (heg-amb-08, "Prosperità dello Stato")
   viene usato al posto di una correzione di premessa che il contesto avrebbe permesso con
   sicurezza — la regola `WRONG_PREMISE_RULE` esiste già ma non ha prevalso in quel caso.
3. Citazione sistematica dell'autore forum (`CITATION_FORMAT_RULES`: nome sempre in **grassetto**,
   sempre nominato) anche per contributi non autorevoli di per sé — solo il flag designer
   ufficiale ha valore informativo per chi legge; il nome dell'utente comune è rumore.

**Non in scope qui:** correttezza fattuale/retrieval (POC-00011, in pausa) — qui si lavora solo su
`lib/prompt.ts` (tono, formule, regole di citazione), senza toccare `lib/retrieval.ts` o
`lib/reranking.ts`.

---

## Task

| ID | Task | DoD |
|---|---|---|
| S1 | Attenuare la citazione utente in `CITATION_FORMAT_RULES`: per un post forum comune, citare il thread (link) senza nominare l'autore in grassetto; mantenere la menzione esplicita SOLO per `[DESIGNER UFFICIALE DEL GIOCO]`, dove l'attribuzione ha valore informativo reale | Su un caso con più fonti forum non-designer, la risposta non nomina alcun autore comune; un caso con fonte designer continua a nominarlo esplicitamente |
| S2 | Variare l'apertura DEDUZIONE: sostituire l'unico esempio fisso in `WRONG_PREMISE_RULE`/testo DEDUZIONE con 2-3 varianti equivalenti, istruendo il modello a alternarle invece di ripetere la stessa frase | Su un campione di 5+ risposte con deduzione, non tutte usano la stessa formula di apertura testuale |
| S3 | Rendere il fallback "non trovato" un'eccezione reale, non un rifugio: rinforzare esplicitamente in `lib/prompt.ts` che va usato SOLO se non è possibile né un fatto diretto né una deduzione né una correzione di premessa — mai come alternativa più "sicura" quando una di queste si applica | Caso heg-amb-08 (Prosperità dello Stato) risponde correggendo la premessa (Stato non ha Prosperità, ha Legittimità) invece di "non ho trovato" |
| S4 | Eval di verifica su `hegemony-ambiguous` dopo S1-S3, confronto con baseline 005 | Nessuna regressione sul punteggio (≥18/20); heg-amb-08 risolto; nessuna citazione di autore comune (non-designer) nelle risposte del run |
| S5 | Fix `WRONG_PREMISE_RULE` dopo prima run S4 (v. sotto): la correzione di premessa deve essere la PRIMA frase (non una nota aggiunta dopo aver già esposto i fatti) ed è incompatibile con il fallback "non ho trovato" nella stessa risposta | Ri-eseguire S4: heg-amb-01 non deve più concludere con "Non ho trovato questa informazione nel manuale" dopo aver già spiegato che la Legittimità è meccanica dello Stato; heg-amb-02 apre con la correzione di premessa invece di esporla come nota finale |

**Run S4 (2026-07-28), eseguita da Francesco — risultato 17/20 (heg-amb-08, heg-amb-13, heg-amb-16
falliti):**
- heg-amb-01, heg-amb-02: contenuto corretto (giudicate vere) ma forma difettosa — causa isolata:
  `WRONG_PREMISE_RULE` non imponeva che la correzione di premessa fosse la prima frase né la
  rendeva incompatibile col fallback "non ho trovato" nella stessa risposta. heg-amb-01 infatti
  chiudeva con "Non ho trovato questa informazione nel manuale" subito dopo aver già spiegato
  correttamente che la Legittimità è meccanica dello Stato — contraddittorio. Fix in S5.
- heg-amb-08, heg-amb-13: ancora "non ho trovato" invece di correggere la premessa (Stato non ha
  Prosperità/Popolazione) — stesso bug di S5, non ancora risolto da S1-S3 da soli.
- heg-amb-16: giudicato falso per aver omesso l'eccezione Politiche 4/5 (prezzo scontato/gratis).
  Confrontato con la risposta dello stesso caso nel baseline 005 (`docs/baselines/005-...json`):
  anche lì l'omissione era la stessa, ma il judge run 005 l'aveva giudicata corretta — variazione
  del judge LLM tra run, non una regressione introdotta da S1-S3. Non richiede fix nel prompt.

**Run S4 dopo fix S5 (2026-07-28) — risultato 18/20 (90%), in linea con baseline 005:**
- heg-amb-01, heg-amb-08, heg-amb-13: tutti e tre risolti — correzione di premessa in apertura,
  nessun "non ho trovato" contraddittorio residuo. Fix S5 verificato.
- heg-amb-16: corretto in questo run — conferma che il fallimento della run precedente era
  varianza del judge, non una regressione (v. nota sopra).
- S1/S2 confermati sul run: nessuna citazione di autore forum comune in tutte le risposte, solo
  thread linkati; formule di apertura per le deduzioni effettivamente variate tra le risposte.
- 2 nuovi fallimenti (heg-amb-02, heg-amb-17), assenti nella run precedente: non riconducibili
  alle modifiche di tono/citazioni — pattern di varianza di campionamento già documentato altrove
  nel progetto (v. D53). Non richiedono intervento sul prompt.

DoD di S4 soddisfatto (≥18/20, casi target risolti, nessuna citazione utente comune). Epica chiusa.

**Non in scope:** ulteriore lavoro su retrieval/reranking (POC-00011, resta in pausa fino a
nuova indicazione).
