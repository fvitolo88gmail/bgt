# POC-00014 — Chat multilingua

**Stato:** ✅ done nella sostanza — L1 verificato funzionante (corpo della risposta nella lingua
corretta), L3 fixture pronta. Residuo: traduzione incoerente delle etichette di sezione tra
parentesi quadre nelle citazioni manuale — accantonato come **BUG-001**
(`docs/bugs/BUG-001-traduzione-parziale-etichette-sezione.md`) dopo 4 tentativi di fix via
prompt, da affrontare in una sessione dedicata con un approccio diverso (non più prompt-only).

**Nota su Brass Birmingham:** il task originale (L2) prevedeva il test su Brass Birmingham, ma
il gioco è oggi rimosso dal DB in attesa di re-ingest (v. `progress.md`, nota storica su
`games.bgg_id`). Test spostato su Hegemony (manuale in inglese, già ingested, `DEFAULT_GAME_IDS`
già mappato in `eval/runner.test.ts`).

**Nota su L2, direzione del test:** entrambi i manuali ingested (Brass, Hegemony) sono in
inglese — il caso "query in lingua diversa dal manuale" è già quello standard in produzione
(utente chiede in italiano su manuale inglese, gestito da HyDE+lingua manuale, D48). Il caso
davvero nuovo introdotto da L1 è l'opposto: una domanda in INGLESE, per cui prima di L1 la
risposta sarebbe stata comunque forzata in italiano (v. sotto). L2 verifica quindi che (a) il
retrieval funzioni normalmente su una domanda EN contro un manuale EN (nessuna sorpresa attesa)
e (b), soprattutto, che la risposta arrivi davvero in inglese dopo il fix L1.

## Task

| ID | Task | DoD |
|---|---|---|
| L1 | ✅ Aggiorna `lib/prompt.ts`: istruzione esplicita di rispondere nella stessa lingua della domanda | Prima del fix, `RISPOSTA (in italiano, ...)` era hardcoded in entrambi i prompt (`buildPrompt`/`buildConversationPrompt`) — la lingua della domanda veniva ignorata anche se l'utente scriveva in inglese. Aggiunta `RESPONSE_LANGUAGE_RULE` condivisa, chiusura prompt aggiornata in entrambe le modalità |
| L2 | Verifica qualità retrieval + lingua risposta su domande EN contro Hegemony (EN) | **In corso, verificata da Francesco in locale.** Primo test: risposta in inglese ✅ (dopo aver rinforzato `RESPONSE_LANGUAGE_RULE`, spostata come prima istruzione del prompt — il primo tentativo restava in italiano nonostante l'istruzione, probabile bias del modello verso la lingua dominante del prompt). 3 bug trovati e corretti nello stesso giro, v. sotto. Resta da fare un ultimo giro di verifica sui 3 fix |
| L3 | ✅ Estendi fixture eval con un sottoinsieme di domande in lingua diversa dal manuale | Creata `eval/fixtures/hegemony-ambiguous-en.json` (5 domande, traduzione EN di un sottoinsieme di `hegemony-ambiguous.json` con risposte attese già in EN). Esecuzione (accuratezza da documentare, non gate) demandata a Francesco — comando sotto |

## Bug trovati in L2 (2026-07-29) e fix applicati

Sulla domanda EN "How do you perform a Strike?" (Hegemony), tre problemi nella stessa risposta:

1. **Etichette di sezione manuale ancora in italiano** in una risposta EN (es. "[Classe Lavoratrice — Strike]") — le etichette di sezione sono editoriali interne, non testo letterale del manuale: `RESPONSE_LANGUAGE_RULE` ora istruisce a tradurle nella lingua della risposta; i titoli dei thread forum (testo reale BGG) restano invece invariati.
2. **Nome utente comune ancora citato** ("as explained by avyssaleos in the thread...") nonostante la regola di POC-00017 (S1) — `CITATION_FORMAT_RULES` rafforzata: vietata esplicitamente qualunque formula che nomini l'autore, non solo il grassetto.
3. **`poptasticboy` citato come "the designer"**, mai stato tale in nessuna risposta precedente (solo `avyssaleos` lo è, confermato in decine di citazioni passate) — **confermato da Francesco: nessun post del thread è di un designer**, quindi allucinazione pura del modello, non un bug nei dati (verificato anche che la rete sandbox non raggiunge Supabase, dominio non in allowlist — non potevo controllare il DB direttamente). Aggiunta regola esplicita: "designer" solo se il tag `[DESIGNER UFFICIALE DEL GIOCO]` compare letteralmente nel contesto accanto a quel post specifico, mai per inferenza da tono/argomento.

**Nota:** il test di L2 sopra usava `mode` di default (`qa`), non la modalità conversazione che
Francesco usa nell'app. Verificato che `RESPONSE_LANGUAGE_RULE`/`CITATION_FORMAT_RULES` sono
condivise tra le due modalità (i fix si applicano a entrambe), ma trovato un rischio specifico a
`conversation` non coperto esplicitamente: lo STORICO può contenere turni in una lingua diversa
dall'ultima domanda, e la regola diceva solo "segui la domanda" senza escludere esplicitamente lo
storico come segnale. Aggiunta clausola dedicata in `buildConversationPrompt` — v. D61.

## Refactor (v. D61)

`lib/prompt.ts` era un unico file monolitico con le due modalità e tutte le regole condivise
mescolate. Splittato in `lib/prompt/`:
- `shared.ts` — regole condivise (lingua, citazioni, premessa errata, ambiguità terminologica) + `buildContext`
- `qa.ts` — specializzazione "qa" (`buildPrompt`)
- `conversation.ts` — specializzazione "conversation" (`buildConversationPrompt`, storico)
- `index.ts` — barrel, nessuna modifica richiesta al consumer (`app/api/chat/route.ts`, importa ancora da `@/lib/prompt`)

Verificato con `tsc --noEmit` ed `eslint`, nessun errore.

## Bug trovati nel secondo giro di test — modalità conversazione (2026-07-29)

Sulla domanda di follow-up EN "what the first thread talk about?", due problemi residui:

4. **Testo fra parentesi quadre ancora in italiano** ("[Classe Lavoratrice — Strike]" in una risposta EN) — causa: `CITATION_FORMAT_RULES` diceva letteralmente di citare la sezione "esattamente come già presente nell'etichetta della fonte", in contraddizione diretta con l'istruzione di traduzione data in `RESPONSE_LANGUAGE_RULE` — essendo la regola più vicina al compito specifico di formattare la citazione, vinceva lei. Rimossa la contraddizione: `CITATION_FORMAT_RULES` ora istruisce essa stessa a tradurre il nome sezione, con esempio concreto (Classe Lavoratrice → Working Class).
5. **Solo il numero di pagina in grassetto, non la parola** — richiesto: "pagina"/"page" (anch'essa nella lingua della risposta) e il numero insieme in grassetto, es. `**page 14**` non `page **14**`. Corretto in `CITATION_FORMAT_RULES`. Rimosso anche il grassetto sulla pagina nel pannello Fonti (`SourcesList.tsx`) su richiesta di Francesco — resta solo nelle citazioni generate dal modello nel testo della risposta.

## Bug trovati nel terzo giro di test (2026-07-29) — traduzione ancora incoerente

Nuovo giro (dopo il fix 4): "(parte 1)" tradotto correttamente in "(part 1)" su un caso isolato,
ma su una risposta con più citazioni la traduzione resta **incoerente tra citazioni diverse nello
stesso messaggio** (es. "[Working Class — Buy Goods & Services (part 1)]" tradotto correttamente,
"[Lo Stato — Action Phase]" nella stessa risposta no). Non sembra più un problema di istruzione
mancante — accantonato come **BUG-001**, v. `docs/bugs/BUG-001-traduzione-parziale-etichette-sezione.md`
per il dettaglio dei 4 tentativi e l'ipotesi (limite di affidabilità del modello su questo tipo di
trasformazione ripetuta, non risolvibile con altro prompt engineering). Il corpo della risposta
resta comunque nella lingua corretta — impatto limitato alle etichette di sezione tra parentesi.

## Comandi per L2/L3 (da eseguire in locale)

```bash
# L2 — verifica manuale rapida (3 domande dirette all'API)
npm run dev
# in un altro terminale:
curl -s -X POST http://localhost:3000/api/chat -H "Content-Type: application/json" \
  -d '{"question":"How do you perform a Strike?","gameId":"d17ebf75-284a-4a4d-b3fa-0cc16287fce4"}'

# variante modalità conversazione (quella usata nell'app) — sessionId qualunque UUID
curl -s -X POST http://localhost:3000/api/chat -H "Content-Type: application/json" \
  -d '{"question":"How do you perform a Strike?","gameId":"d17ebf75-284a-4a4d-b3fa-0cc16287fce4","mode":"conversation","sessionId":"11111111-1111-1111-1111-111111111111"}'

# L3 — eval fixture EN
EVAL_FIXTURE=hegemony-ambiguous-en EVAL_GAME_ID=d17ebf75-284a-4a4d-b3fa-0cc16287fce4 npx vitest run eval/runner.test.ts
```

Verifica attesa: la risposta arriva in inglese (non più forzata in italiano), cita le fonti
correttamente (etichette sezione/thread restano nella lingua originale, non tradotte, per
`RESPONSE_LANGUAGE_RULE`), e i chunk recuperati sono pertinenti alla domanda.
