# decision-log.md
*Una entry per decisione · formato: contesto → opzioni → scelta → motivazione*

---

## Sessione 1 — 2026-06-29

### D01 — Dominio del prodotto
**Contesto:** scelta del dominio su cui costruire il side project  
**Opzioni:** lab informatics (Dotmatics) · giochi da tavolo  
**Scelta:** giochi da tavolo  
**Motivazione:** lab informatics = rischio conflict of interest con Siemens/Dotmatics (IP assignment, non concorrenza). GdT = community raggiungibile, hobbisti paganti, nessun rischio legale, motivazione intrinseca garantisce il completamento.

---

### D02 — Obiettivo del progetto
**Contesto:** definizione delle priorità  
**Opzioni:** massimizzare ricavi · portfolio + apprendimento · reddito secondario  
**Scelta:** imparare + portfolio, reddito secondario  
**Motivazione:** obiettivo realistico per un side project serale. Cambia le metriche di successo: conta finire e mostrare skill, non il moat difendibile.

---

### D03 — Tipo di prodotto
**Contesto:** quale problema risolvere nel dominio GdT  
**Opzioni:** "cosa giochiamo stasera?" · generatore di teach · assistente regole RAG  
**Scelta:** assistente regole RAG (BYO-PDF)  
**Motivazione:** problema reale e frequente (dubbi a metà partita). Dimostra lo stack AI moderno (RAG, grounding, citazioni). Comprensibile in 30 secondi da un recruiter. BYO-PDF risolve il copyright by design.

---

### D04 — Modello LLM
**Contesto:** scelta provider per embedding e generazione  
**Opzioni:** Claude API · Gemini · Ollama locale · OpenRouter  
**Scelta:** Gemini Flash + Gemini Embeddings (cloud), Ollama come alternativa locale via `LLM_PROVIDER` env var  
**Motivazione:** Gemini free tier (1.500 req/giorno, no carta) copre abbondantemente il carico di un MVP personale. Ollama per sviluppo offline/privacy. Astrazione `LLMClient` permette swap senza refactor.

---

### D05 — Autenticazione utenti
**Contesto:** chi può usare l'app e come  
**Opzioni:** OAuth Claude.ai (piano free) · BYOK (utente porta la sua API key) · dev-pays (chiave del developer server-side)  
**Scelta:** MVP anonimo (nessuna auth), chiave Gemini server-side  
**Motivazione:** OAuth Claude.ai su app terze è esplicitamente vietato dai ToS Anthropic (feb 2026). BYOK = attrito troppo alto per MVP. Dev-pays con Gemini free = zero costo, zero attrito. Auth in v2 se serve libreria multi-gioco per utente.

---

### D06 — Database e vector store
**Contesto:** dove salvare chunk, vettori e metadati  
**Opzioni:** Pinecone · Weaviate · Supabase pgvector · Postgres raw + pgvector  
**Scelta:** Supabase (Postgres + pgvector)  
**Motivazione:** unica soluzione che unisce DB relazionale, vector store, storage file (PDF) e auth in un solo servizio gestito. Free tier sufficiente per MVP. Dashboard visuale utile durante sviluppo. pgvector è Postgres standard — skill trasferibile.

---

### D07 — DB condiviso vs per-utente
**Contesto:** i chunk ingested sono privati per utente o condivisi?  
**Opzioni:** DB per-utente (ogni utente ha i suoi chunk) · DB condiviso (un gioco = un ingest per tutti)  
**Scelta:** DB condiviso  
**Motivazione:** ingest una volta, usato da tutti. Costo embedding O(n giochi) non O(n utenti). Crea network effect naturale: ogni nuovo gioco aggiunto arricchisce il sistema per tutti. Primo utente su un gioco paga il costo, tutti i successivi no.  
**Nota (2026-07-02):** questa decisione è in tensione con D03 (BYO-PDF come soluzione al copyright) — vedi D16 per la risoluzione.

---

### D08 — Strategia ingest forum BGG
**Contesto:** come recuperare i post del forum Rules di BGG  
**Opzioni:** fetch live per ogni query · solo titoli thread + fetch on-demand · pre-ingest completo  
**Scelta:** pre-ingest completo (tutti i thread del forum Rules) con batch di aggiornamento periodico  
**Motivazione:** fetch live = dipendenza BGG a runtime, latenza variabile, fragile. Solo titoli = retrieval semantico debole (titoli BGG spesso vaghi). Pre-ingest = retrieval di qualità massima, zero dipendenza BGG a runtime. Volume gestibile (~800 thread × 5s = ~1 ora, job offline una tantum).

---

### D09 — Granularità chunk forum
**Contesto:** un chunk = un post o un thread intero?  
**Opzioni:** thread intero · singolo post · singolo post con prefisso thread  
**Scelta:** un chunk = un post, con subject del thread iniettato come prefisso nel content  
**Motivazione:** thread interi = chunk enormi con rumore. Singolo post senza contesto = incomprensibile fuori dal thread. Prefisso thread nel content bilancia granularità e contesto, permette citazione precisa (post specifico) e fa funzionare il retrieval anche quando il body del post è scarno.

---

### D10 — Filtri ingest forum
**Contesto:** quali thread e post escludere dall'ingest  
**Opzioni:** ingerire tutto · filtrare per qualità  
**Scelta:** filtrare — escludi thread con 0 risposte, post con body < 50 caratteri, forum non-Rules (General, News, Sessions), markup HTML/BBCode  
**Motivazione:** thread senza risposte = domanda aperta senza valore. Post brevissimi ("Thanks!", "Correct!") = rumore che peggiora il retrieval. Solo forum Rules è in scope per il prodotto.

---

### D11 — Flag designer
**Contesto:** come distinguere risposte autorevoli nel forum  
**Opzioni:** nessuna distinzione · flag manuale · risoluzione automatica da BGG credits  
**Scelta:** risoluzione automatica — confronta `author_username` del post con `credits.designers[]` da `/thing?id={bgg_id}`  
**Motivazione:** distingue "regola ufficiale confermata dal designer" da "opinione community". È il dettaglio che rende il dual-source davvero utile e dimostra cura nel design del prodotto.

---

### D12 — Architettura ingest
**Contesto:** dove gira la pipeline di ingest (PDF + forum)  
**Opzioni:** API route Vercel (serverless) · script locale · worker dedicato  
**Scelta:** script locale per MVP, worker (Inngest/Upstash) per Fase 2 forum  
**Motivazione:** ingest PDF = job da minuti, non compatibile con timeout serverless (anche con Fluid Compute). Forum BGG = ore per rate limit 5s. Script locale è zero infra, sufficiente per MVP. Worker si aggiunge solo quando serve ingest server-side triggered dall'utente.

---

### D13 — Hosting
**Contesto:** dove deployare l'app web  
**Opzioni:** Vercel · Netlify · Cloudflare Pages · VPS  
**Scelta:** Vercel (Hobby plan per MVP)  
**Motivazione:** deploy 1-click da git, URL pubblico automatico, Fluid Compute per funzioni lunghe, ottimizzato per Next.js. Attenzione: Hobby plan vieta uso commerciale — aggiornare a Pro (20$/mese) o migrare a Netlify/Cloudflare al momento della monetizzazione.

---

### D14 — Giochi fixture per eval
**Contesto:** quali giochi usare come banco di prova per l'eval harness  
**Opzioni:** Brass Birmingham · Ark Nova · Hegemony · SETI  
**Scelta:** Brass Birmingham (MVP), Ark Nova (Fase 2)  
**Motivazione:** Brass = regole spinose ma risolte nel manuale → ground truth pulita, ideale per baseline. Ark Nova = molti edge case risolti solo nel forum → ideale per misurare il contributo della Fase 2. Hegemony (asimmetria/scoping) e SETI tenuti come candidati per test futuri.

---

### D15 — Disciplina Fase 2
**Contesto:** quando iniziare l'integrazione forum BGG  
**Opzioni:** subito dopo MVP · dopo deploy · dopo eval baseline  
**Scelta:** non iniziare Fase 2 prima che l'eval harness (E3) produca una baseline  
**Motivazione:** senza metro di misura non sai se il forum migliora o peggiora le risposte. La baseline dell'MVP è il punto di riferimento per valutare il delta della Fase 2.

---

## Sessione 2 — 2026-07-02

### D16 — Isolamento dati senza autenticazione
**Contesto:** condivisione manuali fra utenti (D07) in conflitto con copyright BYO-PDF (D03); serve isolare gli upload privati senza costruire un sistema di account, per un MVP no-auth condiviso con amici  
**Opzioni:** schema/DB per-utente · auth completa ora · owner_token client-side + flag shared curato manualmente  
**Scelta:** owner_token (UUID generato client-side, salvato in cookie/localStorage) per scoping dei giochi privati; colonna `visibility` su `games` ('private' default, 'shared' impostabile solo manualmente in DB, mai self-service utente)  
**Motivazione:** nessun sistema di account per MVP (coerente con D05). owner_token isola i dati per browser/dispositivo senza login. `shared` riservato a manuali verificati come liberamente distribuiti dal publisher — evita che il DB condiviso redistribuisca testo protetto senza autorizzazione. Schema-per-tenant scartato: costo di migration e indici scala con utenti anziché con giochi, contraddice la motivazione originale di D07. Rivalutare con vera auth se il progetto scala oltre la cerchia di amici.

---

### D17 — Modello embedding e dimensioni vettore
**Contesto:** `text-embedding-004` (768 dim, previsto in development.md) non disponibile con la chiave Gemini AI Studio; libreria `@google/generative-ai` sostituita da `@google/genai`  
**Opzioni:** `gemini-embedding-001` nativo a 3072 dim · `gemini-embedding-001` con `outputDimensionality: 768` · `gemini-embedding-2` (preview)  
**Scelta:** `gemini-embedding-001` con `outputDimensionality: 768`  
**Motivazione:** 3072 dimensioni supera il limite di Supabase per indici ivfflat e hnsw (max 2000). 768 con riduzione dimensionale è supportato nativamente dal modello, mantiene l'indice vettoriale funzionante, e per testi di regole di giochi da tavolo la qualità è più che sufficiente.

---

### D18 — Modello generazione testo
**Contesto:** `gemini-1.5-flash` non disponibile con la chiave Gemini AI Studio; `gemini-2.0-flash` e `gemini-2.0-flash-lite` hanno quota RPD = 0 sul piano free  
**Opzioni:** `gemini-2.0-flash` · `gemini-2.0-flash-lite` · `gemini-3.1-flash-lite`  
**Scelta:** `gemini-3.1-flash-lite`  
**Motivazione:** unico modello con quota RPD significativa (500/giorno) sul piano free attuale. Sufficiente per MVP condiviso con amici (~250 domande/giorno considerando 2 chiamate per query).

---

## Sessione 3 — 2026-07-03

### D19 — Chunking LLM-assisted per ingest PDF
**Contesto:** baseline eval E3 (9/20, 45%) ha rivelato che il chunking meccanico per pagina (500 parole, overlap fisso, indipendente dalla struttura semantica) produce chunk che tagliano regole a metà o mescolano sezioni diverse — causa diretta di un'allucinazione grave (bb-18: risposta che contraddice la regola corretta) e di più "non trovato" su informazioni presenti nel manuale (bb-07, bb-13, bb-20). Il PDF sorgente ha layout a colonne complesso e l'estrazione OCR (`extract-pdf.py`) produce testo per pagina disordinato, senza struttura riconoscibile in modo affidabile da un semplice regex.
**Opzioni:** mantenere chunking per parole con soglia similarità · chunking automatico basato su euristiche di formattazione (es. header ALL CAPS) · markdown curato interamente a mano · markdown generato da Gemini in uno step di ingest dedicato, con revisione umana
**Scelta:** nuovo step nella pipeline di ingest — Gemini riorganizza il JSON grezzo per pagina in Markdown pulito con header di sezione (`##`), con istruzione esplicita di non correggere/dedurre/riformulare il contenuto delle regole, solo pulizia strutturale; il chunker viene riscritto per splittare per header invece che per conteggio parole. Per Brass Birmingham, il markdown generato viene validato manualmente contro il PDF originale prima dell'ingest definitivo.
**Motivazione:** un chunk = una sezione semantica elimina la causa strutturale delle allucinazioni osservate (regole tagliate a metà o mescolate). Usare Gemini solo per la *pulizia strutturale* (non per rispondere a domande) resta coerente con il principio "LLM ai bordi" di architecture.md — è un uso offline, in uno script di ingest, non nel path di risposta. La revisione manuale su Brass Birmingham è una fase di calibrazione, non la policy finale: serve a misurare quanto Gemini è affidabile su questo compito specifico, prima di decidere se e come automatizzare il controllo qualità per i prossimi giochi (es. secondo prompt LLM-as-judge che confronta markdown vs JSON grezzo, o campionamento invece di revisione integrale). Rivalutare la necessità di revisione umana quando si aggiungono nuovi giochi oltre Brass/Ark Nova — se il progetto scala, la fixture eval di ogni gioco resta comunque il paracadute finale prima che un manuale passi a `shared`.

---

### D20 — Indice vettoriale IVFFlat inefficace su dataset piccoli
**Contesto:** dopo il re-ingest con il nuovo chunking (D19), il retrieval falliva sistematicamente per query testuali nuove (es. "Cos'è l'azione di Costruzione?" → nessun match, nonostante il chunk corretto esistesse nel DB con contenuto pertinente). Diagnosi: `match_chunks` restituiva risultati corretti solo quando il vettore di query coincideva esattamente con un embedding già presente nel DB (self-similarity test), ma zero risultati per embedding generati al volo da testo nuovo. Confermato con test A/B (`enable_indexscan = off`): disattivando l'indice, la stessa query restituiva risultati corretti e ben ordinati per similarità (es. score 0.79 sul chunk giusto). Causa: l'indice `chunks_embedding_idx` (ivfflat, `lists=100`, creato in S0.4 su dati di test) è enormemente sovradimensionato per un dataset di 23 righe — con 100 cluster teorici su 23 punti, l'euristica IVFFlat che esplora solo i cluster "vicini" alla query spesso salta del tutto il cluster contenente il match corretto per vettori non già indicizzati.
**Opzioni:** mantenere `lists=100` · ricreare l'indice con `lists` proporzionato al numero di righe (es. `lists≈sqrt(rows)`) · rimuovere l'indice e affidarsi a scansione sequenziale
**Scelta:** rimosso l'indice ivfflat (`drop index chunks_embedding_idx`); scansione sequenziale per ora.
**Motivazione:** con poche decine/centinaia di chunk (un solo gioco ingested), la scansione sequenziale su `chunks` è istantanea ed esatta (non approssimata come ivfflat), quindi elimina il problema alla radice senza dover tarare un parametro delicato. Il valore `lists=100` era stato scelto in S0.4 senza considerare la scala reale del dataset MVP — errore di dimensionamento, non di concetto: pgvector raccomanda di ricalibrare `lists` (o passare a HNSW) quando il volume cresce. Da rivalutare quando il numero di chunk sale significativamente (es. con più giochi ingested o con l'aggiunta del forum BGG in Fase 2): a quel punto reintrodurre un indice con `lists` calcolato sul volume reale, o valutare HNSW (più robusto su dataset che crescono nel tempo, non richiede retuning di `lists`). Nota per il futuro: questo tipo di bug è silenzioso e pericoloso — non genera errori, solo risultati vuoti o parziali, quindi è facile scambiarlo per "il RAG non sa rispondere" invece che "il retrieval è rotto". Vale la pena, se il problema si ripresenta, testare sempre prima con scansione sequenziale forzata per isolare la causa.

---

### D21 — Deduzione dichiarata nel prompt grounded
**Contesto:** test manuali dopo D19/D20 hanno rivelato che il prompt originale ("non inventare, non dedurre") produceva falsi negativi su domande legittime la cui risposta richiede sintetizzare/riorganizzare informazione presente in più fonti del contesto, ma non dichiarata come singola frase esplicita nel manuale (es. "Cos'è una Tessera Collegamento?" → "non trovato", nonostante i chunk recuperati contenessero abbastanza informazione per una risposta corretta). Il divieto di "dedurre" era pensato per prevenire allucinazioni, ma bloccava anche sintesi legittima e utile.
**Opzioni:** mantenere il divieto assoluto di dedurre (accetta più falsi negativi, zero rischio di over-inference) · rimuovere il divieto e permettere deduzione libera (rischio di confondere sintesi legittima con invenzione) · permettere la deduzione ma richiedere che sia dichiarata esplicitamente come tale, distinta dai fatti riportati direttamente
**Scelta:** terza opzione — il prompt ora distingue esplicitamente "fatto diretto" (informazione dichiarata da una fonte, riportata normalmente) da "deduzione" (informazione ricostruita combinando più fonti, introdotta con una frase che segnala la ricostruzione, es. "Il manuale non lo definisce esplicitamente, ma si può dedurre che..."). Resta vietato in ogni caso inventare informazioni non presenti nel contesto.
**Motivazione:** il giocatore ha il manuale fisico in mano e può verificare le fonti citate — la trasparenza sulla natura della risposta (fatto vs ricostruzione) sposta la responsabilità di validazione al lettore invece di forzare il sistema a un binario "risponde/non risponde" che scartava sintesi utili e corrette. Coerente con il principio anti-allucinazione di architecture.md ("se la risposta non è nelle fonti, lo dichiara esplicitamente") esteso a un caso intermedio: non più solo "c'è / non c'è", ma anche "c'è ma va ricostruita". Impatto da verificare: la fixture di eval (in particolare il criterio del judge in eval/runner.test.ts) potrebbe dover essere aggiornata per riconoscere risposte che iniziano con "si può dedurre che..." come corrette quando la deduzione è ben fondata, non penalizzarle come se fossero omissioni o invenzioni.

---

## Sessione 4 — 2026-07-05

### D22 — Riordino sequenza: Fase Forum BGG prima di S3.2–S3.5
**Contesto:** Francesco vuole passare all'implementazione dei task Forum (F1–F8). Il gate D15
(baseline eval E3 ≥80%) è già soddisfatto dalla baseline 002 (16/20, 80%), quindi la Fase Forum
è formalmente sbloccabile — ma `task.md` la elencava comunque dopo S3.2–S3.5 (fallback soglia,
ricerca BGG, UI selezione gioco, game-status API), non ancora completati. Procedere senza
aggiornare `task.md` violerebbe la disciplina dichiarata in `CLAUDE.md` ("non anticipare task
futuri: completa e verifica il corrente prima di procedere") e in `task.md` stesso ("non passare
al task successivo prima che il DoD del corrente sia soddisfatto").
**Opzioni:** completare prima S3.2–S3.5, poi Forum · saltare avanti al Forum senza aggiornare la
documentazione · aggiornare esplicitamente `task.md` per riflettere il nuovo ordine di esecuzione
**Scelta:** terza opzione — `task.md` riscritto per riflettere l'ordine reale di esecuzione: F1–F8
prima, S3.2–S3.5 spostati in una tabella "Fase 3 (continua)" dopo F8. Contenuto dei task S3.2–S3.5
invariato, solo la posizione nel file.
**Motivazione:** la richiesta esplicita di Francesco è una decisione di scoping legittima (il gate
D15 è comunque soddisfatto, quindi non si sta bypassando un controllo di qualità, solo
riordinando lavoro entrambi non bloccante). Aggiornare il documento invece di ignorarlo mantiene
`task.md` come stato autoritativo (principio dichiarato altrove nel progetto) — evita che il file
diventi disallineato dal lavoro reale, cosa che altrimenti richiederebbe una verifica manuale ad
ogni sessione futura per capire cosa è davvero prossimo. S3.2–S3.5 restano comunque da fare, non
sono stati eliminati né riclassificati come opzionali.
**Nota collaterale:** durante la verifica è emerso che S3.1 in `task.md` non è marcato ✅ mentre le
note di sessione lo indicano come completo — discrepanza segnalata a Francesco, non corretta
d'autorità in questa modifica (serve conferma che sia effettivamente completo prima di marcarlo).

---

## Sessione 5 — 2026-07-11

### D23 — Scope AI Provider Adapters: solo generazione, embedding centralizzato
**Contesto:** l'epica "AI API adapters" richiede di generalizzare i provider LLM per singolo
utente (Gemini/Claude/ChatGPT con account propri). L'embedding usato in ingest e retrieval è però
vincolato a `gemini-embedding-001` con `outputDimensionality: 768` (D17), e lo schema `chunks` ha
una colonna vettoriale a dimensione fissa — provider diversi hanno dimensioni diverse (OpenAI,
Claude non offre nemmeno embedding nativi), rendendo BYOK esteso all'embedding incompatibile con
lo schema attuale senza una migration multi-colonna/multi-tabella.
**Opzioni:** BYOK completo (generazione + embedding) con migration schema · adapter solo per
generazione, embedding centralizzato gestito da admin
**Scelta:** adapter multi-provider solo per la generazione della risposta; l'embedding resta
un'operazione di ingest centralizzata, sempre Gemini, mai selezionabile dall'utente. Per i giochi
non ancora presenti, l'utente può richiedere il caricamento (nuovo task S3.7) invece di fare
self-service upload.
**Motivazione:** disaccoppia una scelta cosmetica/di preferenza utente (che modello genera la
risposta) da una scelta strutturale del sistema (come è indicizzato il DB), evitando di rompere
lo schema pgvector esistente per un beneficio marginale. Centralizzare l'ingest mantiene anche
invariato il principio "ingest offline, mai in path utente" di `architecture.md`.

---

### D24 — Storage conversazionale per Chat con contesto: server-side
**Contesto:** l'architettura attuale (`architecture.md`) è stateless lato API — ogni chiamata a
`/api/chat` non ha memoria dei turni precedenti. La feature "Chat con contesto" richiede di
scegliere se lo stato conversazionale vive lato client (rimandato ad ogni richiesta) o lato server
(persistito in Supabase).
**Opzioni:** client-side (browser rimanda history) · server-side (nuove tabelle Supabase)
**Scelta:** server-side — nuove tabelle `chat_sessions` e `chat_messages`.
**Motivazione:** coerente con il pattern owner_token già esistente (D16): lo stato è legato al
dispositivo/browser ma vive nel DB condiviso, non solo nel client, permettendo eventualmente di
riprendere una conversazione da un altro contesto e di applicare un cap esplicito su token/turni
lato server (necessario per contenere il consumo della quota Gemini free tier).

---

## Sessione 6 — 2026-07-14

### D25 — Ristrutturazione task.md in directory task/ per epica
**Contesto:** `task.md` era un unico file con tutte le epiche, in crescita costante ad ogni
sessione (11 epiche a questo punto). Diventava scomodo da navigare e da editare senza rischiare
conflitti/rumore su epiche non toccate nella sessione corrente.
**Opzioni:** mantenere `task.md` unico · directory `docs/task/` con un file per epica, numerato,
più `progress.md` per lo stato aggregato e `closed/` per le epiche completate
**Scelta:** seconda opzione — `docs/task/NNNN-nome-epica.md` (4 cifre, numerazione a passi di 100
nell'ordine di esecuzione: 0000, 0100, 0200…), `docs/task/progress.md` come stato autoritativo
aggregato, `docs/task/closed/` per le epiche interamente completate (Setup, Eval harness, Ingest
PDF, Retrieval e risposta spostate lì in questa sessione). `CLAUDE.md` aggiornato con una sezione
dedicata alla gestione di questa struttura.
**Motivazione:** un file per epica isola le modifiche (meno rumore nei diff quando si lavora su
una sola epica alla volta, coerente con la regola "un task alla volta" di `CLAUDE.md`).
`progress.md` dà una vista d'insieme senza dover aprire tutti i file. La cartella `closed/` separa
visivamente lavoro concluso da lavoro attivo, mantenendo comunque lo storico consultabile. La
numerazione a passi di 100 lascia spazio per inserire epiche future senza rinumerare quelle
esistenti. La larghezza fissa a 4 cifre (invece di 3) è stata scelta dopo aver notato che con 12
epiche a step 100 si superano le 999 unità — mescolare larghezze diverse (es. "900" e "1000")
romperebbe l'ordinamento alfabetico dei file nel filesystem.

---

## Template per sessioni future

```
### D[N] — Titolo decisione
**Contesto:** perché si è posta la questione
**Opzioni:** opzione A · opzione B · opzione C
**Scelta:** opzione scelta
**Motivazione:** perché questa e non le altre
```