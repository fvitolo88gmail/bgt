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

### D26 — Auth Bearer token per BGG XMLAPI2 in `lib/bgg.ts`
**Contesto:** `docs/task/0500-forum-bgg.md` (F1) richiedeva auth Bearer token per `lib/bgg.ts`,
citando un riferimento "D23-BGG" mai effettivamente loggato in questo file — un dangling
reference. Verifica in sessione: `lib/bgg.ts` (commit `01e65aa`) era stato implementato senza
alcun header di autenticazione, nonostante `.env.local` contenesse già `BGG_TOKEN`, mai
referenziato nel codice. F1 non era marcato ✅.
**Opzioni:** lasciare l'API pubblica senza auth (rischio: BGG può bloccare le richieste se il
token è davvero richiesto) · wire `BGG_TOKEN` come header `Authorization: Bearer` su ogni
richiesta, fail-fast a import-time se assente
**Scelta:** seconda opzione — `bggToken` letto da `process.env.BGG_TOKEN` con throw immediato se
mancante (stesso pattern di `lib/gemini.ts`), header `Authorization: Bearer ${bggToken}` aggiunto
a `fetchBggXml`. F1 marcato ✅ in `0500-forum-bgg.md`, riferimento fantasma "D23-BGG" sostituito
con questa entry.
**Motivazione:** Francesco ha confermato che BGG richiede il token per questi endpoint. La
presenza già pronta di `BGG_TOKEN` in env (mai wired) indicava un'implementazione incompleta, non
solo documentazione disallineata — coerente con la disciplina del progetto di non lasciare gap
silenziosi tra DoD dichiarato e codice.

---

### D27 — Pipeline ingest forum multi-fase
**Contesto:** una singola run di forum-ingest.ts per un gioco popolare implica
centinaia di chiamate BGG con rate limit 5s (15-25+ minuti), rendendo un
crash a metà (rete, sleep, 503 non gestito) costoso da recuperare.
**Opzioni:** script singolo con checkpoint interni · 3 script separati con
file JSON intermedi su disco, ciascuno rilanciabile e idempotente
**Scelta:** 3 script — forum-discover.ts (forumlist+forum, filtro reply_count>0)
→ forum-fetch.ts (fetch thread + pulizia, incrementale/resumable) →
forum-ingest.ts (embedding + insert Supabase, idempotente su
chunks.bgg_article_id e forum_posts.bgg_article_id già unique).
**Motivazione:** stesso pattern già collaudato per il PDF (estrazione →
markdown → ingest), nessuna chiamata Gemini prima della fase 3, crash
recuperabile senza rifare il lavoro già fatto. Le cartelle `ingest/{slug}/`
sono escluse da git (come i manuali PDF).

---

### D28 — Chunking forum "small-to-big": solo radice embeddata, espansione a runtime
**Contesto:** un chunk = un post isolato produce match semantici deboli su
risposte brevi ("Sì è corretto"); un chunk = albero conversazionale
(costruito euristicamente via match autore/citazione) richiede assunzioni
fragili e complessità di schema per gestire multi-autore. Serviva una
soluzione che non richiedesse ricostruire la struttura della conversazione
a ingest-time.
**Opzioni:** 1 post = 1 chunk · albero conversazionale (parent/child via
quotedAuthor + fallback lineare) · solo la radice del thread embeddata,
resto del thread recuperato per intero a runtime quando la radice vince
**Scelta:** solo la radice di ogni thread viene embeddata e inserita in
`chunks` (source='forum'); tutti i post (radice inclusa) vengono salvati
senza embedding in una nuova tabella `forum_posts`. A runtime (F5), quando
una radice vince il retrieval, il thread intero viene recuperato da
`forum_posts` e ricostruito in ordine cronologico per il prompt di
generazione — nessun filtro di similarità aggiuntivo, nessun tetto di
espansione.
**Motivazione:** analisi quantitativa su Brass Birmingham (675 thread, 4635
post) mostra che il 92.7% dei thread ha meno di 15 post, e solo una
manciata (~1%, verificato a campione: "Commonly missed rules" e simili)
sono genuinamente multi-argomento — il rischio di perdere recall su una
domanda "sepolta" a metà thread è raro, non la norma. Elimina interamente
il bisogno di euristiche di parent-matching (fragili, verificato durante
lo sviluppo che il fallback lineare produceva catene che mescolavano
argomenti scollegati). Riduce anche il numero di chiamate embedding da
~4900 a ~675 per Brass.
**Nota collaterale:** `chunks.author_username` resta `text` (non
`text[]`/array) — la migration ad array, proposta durante un'iterazione
precedente della progettazione (albero conversazionale), non è mai stata
applicata, resa superflua da questa scelta finale.

---

### D29 — Bug ingest manuale: sezioni intere mancanti, fix parser sezioni
**Contesto:** confronto manuale tra `brass.md` (ingested, 306 righe) e una
trascrizione fedele del PDF originale (953 righe) ha rivelato 3 sezioni
azione intere mancanti dal markdown ingested: Azione - Vendita, Azione -
Ricognizione, Azione - Sviluppo. Causa probabile: nella Fase 1 (outline) di
`markdown-from-json.ts`, più sezioni compresse sulla stessa pagina fisica
del manuale originale (tutte `p. 11`: Prestito, Ricognizione, Sviluppo,
Espansione della Rete) sono state collassate/saltate invece di essere
trattate come confini distinti. La revisione manuale prevista da D19 non
le ha intercettate.
**Scelta:** non rieseguita la pipeline automatica (Fase 1+2) su Brass —
ricostruito a mano il markdown completo dal testo del PDF, con marcatori
pagina reali (`=== PAGINA N ===`) forniti dall'utente e mappati sugli
header `##`. Contestualmente, fix strutturale in `scripts/ingest-pdf.ts`
(`splitIntoSections`): il controllo apriva erroneamente una nuova sezione
anche su `###` (non solo `##`), causando sia perdita del riferimento
pagina sulle sottosezioni sia, con un fix incompleto intermedio, la riga
`### Titolo` che restava come testo letterale nel contenuto embeddato.
Corretto con regex `^##(?!#)\s` per il confine di sezione, e scarto
esplicito delle righe `###` dal contenuto accumulato.
**Verifica:** re-ingest completo (18 chunk, 0 errori, tutte le pagine
valorizzate), confermato via test di retrieval mirati (Cementificazione +
Vendita, Sviluppo) e successivamente via eval completo (vedi baseline 004).
**Effetto collaterale noto, non risolto qui:** trattare `###` come testo
muto invece che come confine di chunk ha causato la fusione di 5-7
sotto-argomenti eterogenei in singoli chunk grandi (es. `Concetti di
Gioco`), causando una regressione osservata su domande specifiche (bb-13,
bb-18, bb-20 nell'eval — vedi baseline 004 e nota 0560 aperta a riguardo).

### D30 — Link diretti a BGG nelle citazioni forum
**Contesto:** le citazioni forum in UI mostravano solo "Thread: {subject}"
come testo, senza modo di verificare la fonte originale su BGG.
**Scelta:** costruire l'URL a runtime da `bgg_thread_id`/`bgg_article_id`
(già presenti su `chunks` e `forum_posts`, nessuna migration necessaria),
formato verificato su un post reale BGG post-redesign: `https://
boardgamegeek.com/thread/{bgg_thread_id}/article/{bgg_article_id}#{bgg_article_id}`.
Helper `buildBggThreadUrl` aggiunto a `lib/bgg.ts`. `ChunkMatch` guadagna
`bggUrl`; `expandForumThread` (F5) ora restituisce anche l'elenco
strutturato `posts[]` con URL per-post (prima si perdeva nella
concatenazione in un'unica stringa), permettendo di linkare il post esatto
citato, non solo la radice del thread.
**UI:** `page.tsx` rende il link fonte sempre evidenziato (blu/sottolineato,
non solo su hover); il corpo della risposta (già renderizzato via
ReactMarkdown) ora stila anche i link generati inline dal modello e li apre
in nuova scheda.

### D31 — Epica Q (0550): query enhancement combinato decomposizione+HyDE
**Contesto:** verificato sperimentalmente (vedi 0550) che la decomposizione
pura di una query composta risolve la dilution (concetti diversi che si
annacquano a vicenda in un solo embedding) ma, se riformulata come
sotto-domanda anziché come prosa dichiarativa, può *peggiorare* il
retrieval — la similarità domanda-vs-domanda tra query e thread forum è
strutturalmente più alta di domanda-vs-prosa-dichiarativa del manuale, a
prescindere dal contenuto (rischio: allontanarsi dal lessico corretto del
gioco se l'LLM non lo conosce con precisione).
**Scelta:** le due tecniche unite in un solo step (`generateEnhancedQueries`
in `lib/retrieval.ts`), un solo prompt/chiamata Gemini che scompone la
domanda in massimo 3 concetti e per ciascuno genera un paragrafo
dichiarativo in stile manuale (non una sotto-domanda). Il risultato è
SEMPRE unito al retrieval sulla query originale (baseline), mai in
sostituzione — merge deduplicato per chunk id, tenendo la similarità più
alta osservata tra tutte le query. Fail-soft per design: se la
generazione fallisce (quota, parsing), si prosegue con la sola query
originale, senza far cadere la risposta.
**Verifica:** baseline pre-0550 post-fix-ingest = 70% (20/20 fixture,
6 fallimenti, vedi baseline "003" mai completata formalmente prima).
Baseline post-0550 = 85% (17/20) — vedi `docs/baselines/004-20260725.md`.

### D32 — Prompt: non introdurre argomenti non richiesti, non confondere fonte-diversa con deduzione
**Contesto:** osservato ripetutamente (3 varianti nello stesso pomeriggio)
che il modello, avendo altre fonti pertinenti nel contesto anche quando il
fatto diretto rispondeva già pienamente alla domanda, aggiungeva sezioni
"si può dedurre che..." con argomenti non richiesti (es. varianti di
gioco, casi speciali) — e in un caso etichettava come deduzione un fatto
in realtà dichiarato esplicitamente in una fonte diversa da quella
principale.
**Scelta:** rafforzate le istruzioni in `lib/prompt.ts`: (1) test esplicito
"questa frase è necessaria per la domanda o sto solo aggiungendo contenuto
perché disponibile? nel dubbio, ometti"; (2) chiarito che "fonte diversa da
quelle già citate" non equivale automaticamente a "deduzione" — se una
fonte lo dichiara esplicitamente, resta un fatto diretto anche se sta in
una sezione diversa.
**Verifica:** confermato risolto sul caso concreto osservato (domanda
"Chi vince a Brass?" non più seguita da divagazioni su partita
introduttiva). Nota aperta: variabilità naturale del query enhancement
(D31) può comunque far sì che risposte alla stessa domanda includano set
di fonti leggermente diversi tra una run e l'altra (es. "Vincere la
Partita" presente in alcune run e assente in altre) — non è un difetto
del prompt, è un effetto collaterale della non-determinismo del paragrafo
HyDE generato ad ogni chiamata. Da monitorare, non ancora da correggere.

---

## Sessione 7 — 2026-07-25 (ingest Hegemony)

### D33 — Rilevamento colonne PDF: da soglia fissa a quorum riga-per-riga
**Contesto:** l'ingest del manuale di Hegemony ha rivelato che
`cluster_columns` (extract-pdf.py) falliva sistematicamente su pagine a
due colonne con gutter stretto: il gap reale tra colonne era di soli
10px, quasi indistinguibile per larghezza assoluta dalla spaziatura
normale tra parole (5-8px). Diagnosticato con una serie di script
`scripts/diagnose/*` dedicati: prima ipotesi (elemento a ponte che azzera
il gap su tutta la pagina) smentita dai dati; causa reale isolata via
misura esatta del gap (`find-true-gap.py`). Tentativi con soglia fissa
calibrata (10px, poi 12px, poi Otsu 14.6px) hanno tutti fallito sulla
stessa pagina, perché nessuna soglia assoluta in px generalizza quando il
gutter reale è così vicino alla spaziatura normale.
**Opzioni:** soglia fissa calibrata per documento (con script di
calibrazione dedicato) · soglia fissa Otsu (clustering bimodale
automatico sull'intero documento) · rilevamento a quorum riga-per-riga
(matrice riga × posizione, gap valido se vuoto sulla maggioranza delle
righe, non su tutte)
**Scelta:** quorum riga-per-riga. `cluster_columns` riscritta: raggruppa
le parole in righe, poi per ogni banda verticale calcola la frazione di
righe che la occupano; una banda è un gap valido se `occupancy <=
GAP_MAX_OCCUPANCY` (0.05) e larga almeno `GAP_MIN_WIDTH` (6px). I gap che
toccano i bordi della pagina (margini, non separatori interni) sono
scartati.
**Motivazione:** una banda con occupancy ~0% è un segnale forte
indipendentemente dalla sua larghezza assoluta o dalla tipografia del
documento — elimina la necessità di calibrare una soglia per ogni nuovo
manuale. Tollera anche righe-eccezione (header a piena larghezza,
giustificazione estrema di una singola riga) senza far collassare il
rilevamento per l'intera pagina, il bug originale che aveva innescato
questa indagine.
**Verifica:** pagina critica di Hegemony (gutter 10px) risolta; nessun
falso positivo su pagine campione a strutture diverse (box multipli,
colonna singola, tabella). Script diagnostici temporanei creati durante
l'indagine (`check-word-spacing.py`, `calibrate-column-gap.py`,
`find-true-gap.py`, `diagnose-page-columns.py`) sono stati rimossi dopo
la convalida — la logica finale vive solo in `extract-pdf.py`.
`scripts/diagnose/matrix-column-preview.py` mantenuto come strumento
diagnostico per manuali futuri, importa `cluster_columns` direttamente
da `extract-pdf.py` (via `importlib`, dato il trattino nel nome file) per
evitare divergenza silenziosa dalla logica di produzione.

---

### D34 — Contenuto icona-dipendente: non automatizzabile da solo testo, verificato prima di rinunciare
**Contesto:** pagine con layout a griglia 2D icona+didascalia (lista
componenti, legenda simboli, diagramma di setup) producevano testo
disordinato e semanticamente inutile con l'estrazione testuale — il
significato è veicolato graficamente (icone, posizione), non ricostruibile
da coordinate x/y linearizzate in ordine di lettura.
**Opzioni:** clustering 2D delle parole in "celle" via posizione (icona +
didascalia vicine) · sfruttare bordi/linee vettoriali per table extraction
nativa di pdfplumber, se presenti · accettare il limite e trattare come
eccezione manuale
**Scelta (iniziale, poi superata da D36):** verificato con
`diagnose-graphics.py` che le pagine non hanno bordi/linee vettoriali
utilizzabili (solo curve bezier delle icone stesse) — niente table
extraction nativa possibile. Clustering 2D generico giudicato troppo
fragile per il valore (1-2 pagine su 39, contenuto di inventario più che
di regolamento) — sostituito con uno stub testuale esplicativo che rimanda
alla pagina originale, per non intasare il retrieval con testo spazzatura.
Componenti di pagina 2-3 riordinati a mano come eccezione una-tantum.
**Motivazione:** non automatizzare qualcosa che il testo non può
ricostruire in modo affidabile, invece di costruire un clustering 2D
fragile per un beneficio marginale e circoscritto a poche pagine.
**Nota:** questa limitazione è stata poi effettivamente risolta (non solo
aggirata) passando a ingest via vision — vedi D36.

---

### D35 — ingest-pdf.ts diventa idempotente (skip chunk già presenti)
**Contesto:** ingest manuale di Hegemony interrotto a metà da esaurimento
quota Gemini (55/61 chunk salvati, 6 falliti con 503/429 a cascata).
`ingest-pdf.ts`, a differenza di `forum-ingest.ts` (D27), non aveva
logica di skip per chunk già presenti — un rilancio avrebbe ri-embeddato
anche i 55 già andati a buon fine, sprecando quota già consumata (protetto
solo passivamente dal vincolo di unicità `(game_id, page, section) where
source='manual'` in Postgres, che evita duplicati ma non lo spreco di
chiamate).
**Scelta:** aggiunta lettura dei chunk esistenti per `(game_id,
source='manual')` prima del loop principale; skip di quelli il cui
`(page, section)` combacia già. Stesso pattern già validato in
`forum-ingest.ts`.
**Motivazione:** resilienza a interruzioni per quota/rete su ingest
lunghi, senza introdurre codice nuovo — riuso di un pattern già in
produzione.

---

### D36 — Ingest manuale: da testo estratto a vision PDF per-sezione (nuovo sotto-sistema `scripts/manual-parser/`)
**Contesto:** una sessione di debug estesa sulla pipeline testuale
(`markdown-from-json.ts`) ha prodotto una sequenza di bug via via diversi,
mai definitivamente convergente: sezioni intere mancanti dall'outline
(Fase 1, non deterministica — stesso bug di D29 su Brass, ricomparso qui),
falsi positivi nella deduplicazione post-generazione (Fix B ha scartato
un'intera sezione "Classe Lavoratrice" per similarità testuale con
"Classe Media", meccaniche di gioco deliberatamente a specchio tra classi
producono alta similarità lessicale senza essere duplicati), header `##`
spuri generati dentro il corpo di una sezione (rompendo il parsing a
valle in `ingest-pdf.ts`), lingua incoerente tra sezioni (alcune tradotte
in italiano nonostante l'istruzione esplicita di mantenere l'originale),
e il problema di fondo D34 (contenuto icona-dipendente irrecuperabile dal
solo testo). Il pattern comune: ogni sezione è generata da una chiamata
Gemini isolata, senza contesto delle altre — margine per bug sempre
diversi, non convergente rincorrendo un controllo euristico alla volta.
**Opzioni:** continuare a irrigidire la pipeline testuale con più
controlli euristici a valle · ingest via Gemini vision sull'intero PDF in
una chiamata · ingest via Gemini vision per-sezione (stesso schema "poco
contesto per chiamata" già validato per il testo in D19, ma applicato a
immagini di pagine reali invece che testo pre-estratto)
**Scelta:** vision per-sezione. Nuovo sotto-sistema `scripts/manual-parser/`:
- `types.ts` — interfacce condivise
- `pdf-utils.ts` — estrazione di sotto-PDF in memoria per un insieme di
  pagine fisiche, via `pdf-lib` (nuova dipendenza)
- `outline.ts` — Fase 1 (identificazione sezioni), invariata nella logica
  di fondo ma con i fix del prompt maturati in sessione (vedi sotto) e
  `checkPageCoverage` (nuovo controllo: verifica che l'unione dei range di
  pagina dell'outline copra ogni pagina del documento, segnalando
  esplicitamente quelle scoperte — invece di scoprire sezioni mancanti
  solo a campione)
- `generate-section.ts` — Fase 2 (generazione), ora riceve il PDF vero
  (sotto-insieme di pagine fisiche via `pdf-utils.ts`) invece di testo
  grezzo pre-estratto
- `verify-completeness.ts` — Fase 3, nuova (vedi D37)
- `regenerate-section.ts` — utility per rigenerare una singola sezione
  senza rifare l'intera Fase 1+2, per correzioni mirate
- `ingest-manual.ts` — orchestratore CLI

`extract-pdf.py` guadagna il campo `physicalPage` per ogni pagina (indice
0-based nel PDF originale), necessario per mappare i range di pagine
logiche dell'outline alle pagine fisiche da estrarre con `pdf-lib` — resta
comunque necessario per il rilevamento spread/pagine fisiche, non è stato
eliminato.
`lib/gemini.ts` guadagna `generateFromPdfBase64`, funzione separata che
NON tocca l'interfaccia `LLMClient` esistente (usata nel path di risposta
chat) — invia `contents` multipart con `inlineData` PDF via SDK
`@google/genai`.

Il `SECTION_PROMPT` per la Fase 2 vision aggiunge, rispetto alla versione
testuale: (0) istruzione esplicita e rinforzata di mantenere sempre la
lingua originale del PDF, mai tradurre — l'istruzione singola non era
sufficiente in isolamento, serve ripeterla nella chiamata specifica; (1)
divieto esplicito di usare `##`/`#` per sottosezioni interne, riservati al
titolo aggiunto dal codice chiamante; (7) istruzione di descrivere in
prosa il contenuto visivo (icone, simboli) invece di ometterlo o
inventare — ora possibile perché il modello vede le pagine reali.

Fix B (deduplicazione post-generazione per similarità testuale) è stato
RIMOSSO, non solo corretto — il rischio di falsi positivi su meccaniche di
gioco a specchio tra ruoli è strutturale, non risolvibile con una sola
soglia; sostituito da `checkPageCoverage` (ripetuto anche dopo eventuale
scarto di sezioni) più la nuova Fase 3 di verifica.
**Motivazione:** la vision legge le pagine reali (colonne, icone, tabelle,
box) invece di dover ricostruire l'ordine di lettura da coordinate
testuali pre-estratte e potenzialmente già rovinate — risolve alla radice
sia D33 (colonne) sia D34 (icone), non li aggira soltanto. Mantenere lo
schema "poco contesto per chiamata" (per-sezione, non intero documento in
una chiamata) resta valido indipendentemente dal fatto che l'input sia
testo o immagine — lo stesso rischio di riassunto/omissione osservato in
D19 su input testuale si applica anche a input immagine.
**Verifica:** rapporto parole markdown/testo-grezzo salito da ~59-68%
(pipeline testuale, iterazioni multiple) a 86.8% (vision) sullo stesso
manuale (Hegemony, 39 pagine). Copertura pagine completa dopo i fix
all'outline (solo indice a p.39 escluso, intenzionale — verificato).
**Costo:** consumo quota Gemini significativamente più alto per manuale
rispetto alla pipeline testuale (ogni chiamata di Fase 2 processa
un'immagine di pagina, non solo testo) — causa diretta di parte degli
errori di quota (503/429) verificatisi durante l'ingest finale in questa
sessione. Da tenere presente per manuali futuri più lunghi di 39 pagine.

---

### D37 — Fase 3 di verifica completezza post-generazione (`verify-completeness.ts`)
**Contesto:** la sequenza di bug diversi osservata in D36 ha reso chiaro
che continuare a irrigidire la generazione con controlli euristici mirati
non converge — ogni fix apre la porta a un nuovo tipo di errore non
previsto. Anticipato già in D19 come possibile evoluzione futura ("secondo
prompt LLM-as-judge che confronta markdown vs JSON grezzo") quando la
pipeline fosse scalata oltre il primo gioco.
**Scelta:** nuovo script `scripts/manual-parser/verify-completeness.ts`:
una singola chiamata Gemini che riceve l'INTERO testo grezzo e l'INTERO
markdown finale, e restituisce un array JSON di omissioni sospette
(numeri, vincoli, eccezioni, argomenti interi assenti), ciascuna con
`severity` (alta/bassa) e `sourceHint` (riferimento pagina). Non sostituisce
la revisione umana finale, ma la rende trattabile: invece di rileggere
l'intero documento, il revisore controlla solo i punti segnalati.
**Verifica:** su Hegemony ha segnalato 5 punti (3 alta gravità, 2 bassa).
Controllo manuale ha rivelato che **2 dei 3 "alta gravità" erano falsi
positivi** — contenuto effettivamente presente nel markdown finale, ma in
una sezione diversa da quella di riferimento incrociato nel testo grezzo
(es. "IMF Intervention" descritto per esteso in "Altre Regole" ma non
duplicato nel punto in cui "Check IMF" vi rimanda esplicitamente — comportamento
corretto, non omissione). Resta genuina solo 1 omissione minore
(posizionamento fisico di un componente di setup).
**Nota aperta:** il verificatore sembra confrontare in modo più locale
(pagina-per-pagina) che a piena consapevolezza dell'intero markdown
finale — da rinforzare nel prompt con l'istruzione esplicita di cercare
nell'INTERO markdown, non solo nella porzione plausibilmente corrispondente
alla stessa pagina del grezzo, prima di segnalare un'omissione. Non
corretto in questa sessione.
**Costo:** singola chiamata ma pesante in token (intero documento grezzo +
intero markdown nello stesso prompt, stimato 45-50k parole totali su
Hegemony) — da tenere presente per manuali più lunghi.

---

### D38 — `lib/retrieval.ts`: budget riservato per fonte manuale + fetch separato per fonte nel merge multi-query
**Contesto:** verificato su una domanda reale di Hegemony ("la Classe
Media può usare i propri beni per sé stessa?") che la risposta finale
presentava come "deduzione" un fatto in realtà dichiarato esplicitamente
nel manuale — violazione apparente di D32, ma diagnosticato con
`scripts/diagnose-full-context.ts` (nuovo, replica `matchChunksForPrompt`
esattamente come `/api/chat`, a differenza di `diagnose-retrieval.ts` che
non applica il query enhancement) che il chunk manuale corretto (score
isolato 68-70%, tra i migliori anche filtrando solo `source=manual`) non
arrivava affatto al contesto finale passato al prompt — non era un
problema di prompt/generazione, ma di assemblaggio del contesto a monte.
**Causa radice, due strati:**
1. Ogni chiamata `matchChunks(query, gameId, topK)` per ciascuna query
   (originale + varianti arricchite HyDE/decomposizione, D31) cercava
   SENZA filtro di fonte — quando un argomento è molto discusso sul forum
   (più thread pertinenti sullo stesso tema), il top-K misto di quella
   singola chiamata poteva già escludere l'unico chunk manuale pertinente,
   prima ancora del merge tra query.
2. Anche a valle del merge, chunk manuale simili tra loro (sezioni lunghe
   spezzate meccanicamente in "parte N", vedi D39) competevano per gli
   stessi slot — quale vincesse dipendeva da rumore nella formulazione
   della query più che dalla pertinenza reale dell'azione specifica
   richiesta.
**Opzioni per lo strato 1:** aumentare `topK` globale · fetch separato per
fonte con pool ampio, poi merge. **Opzioni per lo strato 2:** aumentare il
budget riservato manuale · affrontare la causa strutturale del chunking
(vedi D39, scelto in aggiunta)
**Scelta:**
- Fetch separato per fonte: `matchChunks` invocato due volte per ogni
  query (una volta `filterSource='manual'`, una volta `'forum'`), ciascuna
  con `RAW_CANDIDATES_PER_SOURCE=8` candidati, poi merge deduplicato come
  prima.
- `selectWithReservedBudget`: garantisce almeno `MIN_MANUAL_CHUNKS=2`
  chunk manuale nel set finale (i migliori per similarità tra i candidati
  manuale), MA solo se sopra `MIN_MANUAL_SIMILARITY=0.4` — per non forzare
  chunk manuale irrilevanti quando il manuale non ha nulla di pertinente
  per una data domanda (es. domanda fuori-scope, o specifica di una FAQ
  community). Sotto soglia, il budget non scatta e si torna alla
  selezione per similarità globale.
**Verifica:** dopo il fix, il numero di chunk manuale nel contesto finale
per la domanda di test è salito da 1/5 a 3-4/5. Il chunk esatto atteso
("Buy Goods & Services") non è comunque comparso fino a quando non è
stato applicato ANCHE D39 (chunking troppo grezzo lo faceva competere con
altre 7 "parti" della stessa sezione) — i due fix erano entrambi
necessari, nessuno dei due da solo sufficiente.
**Nota aperta:** `MIN_MANUAL_CHUNKS=2`, `MIN_MANUAL_SIMILARITY=0.4`,
`RAW_CANDIDATES_PER_SOURCE=8` sono stime a occhio dai dati osservati in
questa sessione (match pertinenti oggi: 65-79%), non validate
empiricamente su un campione ampio — stesso status del backlog
`SIMILARITY_THRESHOLD` (S3.2, ancora non implementato). Da rivedere
insieme in un giro di eval più esteso.

---

### D39 — `ingest-pdf.ts`: chunking a livello di sottosezione (`###`), non più sezione intera con fallback a 500 parole
**Contesto:** diagnosticato (vedi D38) che sezioni `##` lunghe (es. "Classe
Media", 8 azioni distinte) venivano spezzate meccanicamente in "parte
1..N" da `CHUNK_MAX_WORDS=500` con overlap, senza rispettare i confini
delle singole azioni di gioco — causa diretta della competizione
inter-chunk osservata in D38. Stesso problema già annotato come nota
aperta in `docs/task/0560-ingest-manuale-migliorato.md`, mai risolto prima
d'ora.
**Scelta:** `splitIntoSections` riscritta con due livelli di confine: `##`
apre una sezione/pagina come prima, ma ora anche `###` apre un nuovo
chunk DENTRO la sezione corrente, ereditandone la pagina dal `##` padre
più vicino (non più trattato come testo muto). Titolo del chunk combinato
`"Sezione — Sottosezione"`, per non perdere il contesto di quale area di
gioco appartiene anche con chunk piccoli. Header più profondi (`####`+)
restano contenuto piatto del chunk corrente — non aprono un ulteriore
livello. Il fallback a 500 parole resta come rete di sicurezza, ma ora
scatta solo su sottosezioni davvero lunghe, non sistematicamente.
**Verifica:** funziona bene per la maggioranza del documento (Componenti,
Anatomia dei Componenti, Setup, Overview per ciascuna classe — chunk
piccoli e mirati, non più "parte N" arbitrarie). NON risolve però i casi
in cui la pipeline vision (D36) ha usato convenzioni di header incoerenti
tra sezioni generate da chiamate isolate diverse — verificato che le
singole azioni di gioco sono marcate in modo non uniforme: a volte `###`,
a volte `####` (un livello più annidato del previsto), a volte solo testo
in **grassetto** su riga propria senza alcun header Markdown (16
occorrenze di questo pattern verificate nel documento finale). Un parser
basato solo su `###` non può essere robusto quando la struttura del
markdown stesso non è coerente.
**Sessione chiusa qui** — fix rimandato. Prossimo passo identificato ma
non implementato: trattare `###` e `####` come lo stesso livello di
confine (appiattire la gerarchia), E in aggiunta riconoscere una riga che
è interamente un'etichetta in grassetto (pattern
`^\*\*[A-Za-z][a-zA-Z &]*\*\*$`) come lo stesso tipo di confine — per
essere robusti a qualunque convenzione la vision abbia scelto per una data
sezione, invece di assumerne una sola.

## Template per sessioni future

```
### D[N] — Titolo decisione
**Contesto:** perché si è posta la questione
**Opzioni:** opzione A · opzione B · opzione C
**Scelta:** opzione scelta
**Motivazione:** perché questa e non le altre
```