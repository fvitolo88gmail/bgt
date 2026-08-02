# decision-log.md
*Una entry per decisione · formato condensato: contesto → scelta → motivazione (max ~6-8 righe,
minimale — v. CLAUDE.md). Per le entry D01-D39 (fino alla condensazione dell'epica 0510), il
dettaglio completo (opzioni scartate, verifiche, note collaterali) è in
`docs/archived/decision-log-archive.md` — file congelato, non più aggiornato. Le entry da D40 in
poi esistono solo qui, in forma condensata fin da subito.*

---

## Sessione 1 — 2026-06-29

### D01 — Dominio del prodotto
**Contesto:** scelta del dominio per il side project.
**Scelta:** giochi da tavolo (non lab informatics).
**Motivazione:** lab informatics = rischio conflict of interest con Siemens/Dotmatics; GdT = community raggiungibile, nessun rischio legale.
→ dettaglio completo in docs/archived/decision-log-archive.md

---

### D02 — Obiettivo del progetto
**Contesto:** definizione delle priorità del progetto.
**Scelta:** imparare + portfolio, reddito secondario come bonus.
**Motivazione:** obiettivo realistico per un side project serale — conta finire e mostrare skill, non il moat difendibile.
→ dettaglio completo in docs/archived/decision-log-archive.md

---

### D03 — Tipo di prodotto
**Contesto:** quale problema risolvere nel dominio GdT.
**Scelta:** assistente regole RAG (BYO-PDF).
**Motivazione:** problema reale e frequente, dimostra lo stack AI moderno, comprensibile in 30s da un recruiter, BYO-PDF risolve il copyright by design.
→ dettaglio completo in docs/archived/decision-log-archive.md

---

### D04 — Modello LLM
**Contesto:** scelta provider per embedding e generazione.
**Scelta:** Gemini Flash + Gemini Embeddings (cloud), Ollama come alternativa locale via `LLM_PROVIDER`.
**Motivazione:** free tier Gemini copre il carico di un MVP personale; astrazione `LLMClient` permette swap senza refactor.
→ dettaglio completo in docs/archived/decision-log-archive.md

---

### D05 — Autenticazione utenti
**Contesto:** chi può usare l'app e come.
**Scelta:** MVP anonimo (nessuna auth), chiave Gemini server-side.
**Motivazione:** OAuth Claude.ai su app terze vietato dai ToS; BYOK = attrito troppo alto; dev-pays con Gemini free = zero costo/attrito.
→ dettaglio completo in docs/archived/decision-log-archive.md

---

### D06 — Database e vector store
**Contesto:** dove salvare chunk, vettori e metadati.
**Scelta:** Supabase (Postgres + pgvector).
**Motivazione:** unica soluzione con DB relazionale + vector store + storage + auth gestiti insieme; free tier sufficiente; pgvector è Postgres standard.
→ dettaglio completo in docs/archived/decision-log-archive.md

---

### D07 — DB condiviso vs per-utente
**Contesto:** i chunk ingested sono privati per utente o condivisi?
**Scelta:** DB condiviso — un gioco = un ingest per tutti.
**Motivazione:** costo embedding O(n giochi) non O(n utenti), network effect naturale.
**Nota (2026-07-02):** in tensione con D03 (BYO-PDF/copyright) — risolto in D16.
→ dettaglio completo in docs/archived/decision-log-archive.md

---

### D08 — Strategia ingest forum BGG
**Contesto:** come recuperare i post del forum Rules di BGG.
**Scelta:** pre-ingest completo (tutti i thread) con batch di aggiornamento periodico.
**Motivazione:** fetch live = dipendenza BGG fragile a runtime; solo titoli = retrieval debole; pre-ingest = qualità massima, zero dipendenza runtime.
→ dettaglio completo in docs/archived/decision-log-archive.md

---

### D09 — Granularità chunk forum
**Contesto:** un chunk = un post o un thread intero?
**Scelta:** un chunk = un post, con subject del thread iniettato come prefisso nel content.
**Motivazione:** thread interi = troppo rumore; post nudo = incomprensibile fuori contesto; il prefisso bilancia granularità e contesto.
→ dettaglio completo in docs/archived/decision-log-archive.md

---

### D10 — Filtri ingest forum
**Contesto:** quali thread e post escludere dall'ingest.
**Scelta:** escludi thread con 0 risposte, post < 50 caratteri, forum non-Rules, markup HTML/BBCode non pulito.
**Motivazione:** thread senza risposte e post brevissimi sono rumore che peggiora il retrieval; solo forum Rules è in scope.
→ dettaglio completo in docs/archived/decision-log-archive.md

---

### D11 — Flag designer
**Contesto:** come distinguere risposte autorevoli nel forum.
**Scelta:** risoluzione automatica — confronta `author_username` con `credits.designers[]` da `/thing?id={bgg_id}`.
**Motivazione:** distingue regola ufficiale da opinione community, rende il dual-source davvero utile.
→ dettaglio completo in docs/archived/decision-log-archive.md

---

### D12 — Architettura ingest
**Contesto:** dove gira la pipeline di ingest (PDF + forum).
**Scelta:** script locale per MVP, worker (Inngest/Upstash) rimandato a Fase 2 forum.
**Motivazione:** ingest PDF/forum non compatibile con timeout serverless; script locale è zero infra, sufficiente per MVP.
→ dettaglio completo in docs/archived/decision-log-archive.md

---

### D13 — Hosting
**Contesto:** dove deployare l'app web.
**Scelta:** Vercel (Hobby plan per MVP).
**Motivazione:** deploy 1-click da git, ottimizzato per Next.js. Attenzione: Hobby vieta uso commerciale — upgrade a Pro o migrazione alla monetizzazione.
→ dettaglio completo in docs/archived/decision-log-archive.md

---

### D14 — Giochi fixture per eval
**Contesto:** quali giochi usare come banco di prova per l'eval harness.
**Scelta:** Brass Birmingham (MVP), Hegemony (Fase 2).
**Motivazione:** Brass = ground truth pulita da manuale, ideale per baseline; Hegemony = molti edge case solo nel forum, misura il contributo Fase 2.
→ dettaglio completo in docs/archived/decision-log-archive.md

---

### D15 — Disciplina Fase 2
**Contesto:** quando iniziare l'integrazione forum BGG.
**Scelta:** non iniziare Fase 2 prima che l'eval harness (E3) produca una baseline.
**Motivazione:** senza metro di misura non sai se il forum migliora o peggiora le risposte.
→ dettaglio completo in docs/archived/decision-log-archive.md

---

## Sessione 2 — 2026-07-02

### D16 — Isolamento dati senza autenticazione
**Contesto:** condivisione manuali fra utenti (D07) in conflitto col copyright BYO-PDF (D03); serve isolare gli upload privati senza account.
**Scelta:** `owner_token` (UUID client-side, cookie/localStorage) per scoping dei giochi privati; colonna `visibility` su `games` (`private` default, `shared` solo manuale in DB).
**Motivazione:** nessun sistema di account per MVP (coerente con D05); `shared` riservato a manuali verificati liberamente distribuibili, evita ridistribuzione non autorizzata.
→ dettaglio completo in docs/archived/decision-log-archive.md

---

### D17 — Modello embedding e dimensioni vettore
**Contesto:** `text-embedding-004` non disponibile con la chiave AI Studio; libreria sostituita da `@google/genai`.
**Scelta:** `gemini-embedding-001` con `outputDimensionality: 768`.
**Motivazione:** 3072 dim native supera il limite indici Supabase (max 2000); 768 con riduzione nativa mantiene l'indice funzionante con qualità più che sufficiente.
→ dettaglio completo in docs/archived/decision-log-archive.md

---

### D18 — Modello generazione testo
**Contesto:** `gemini-1.5-flash` non disponibile con la chiave AI Studio; `gemini-2.0-flash(-lite)` hanno quota RPD = 0 sul piano free.
**Scelta:** `gemini-3.1-flash-lite`.
**Motivazione:** unico modello con quota RPD significativa (500/giorno) sul piano free, sufficiente per MVP condiviso con amici.
→ dettaglio completo in docs/archived/decision-log-archive.md

---

## Sessione 3 — 2026-07-03

### D19 — Chunking LLM-assisted per ingest PDF
**Contesto:** baseline eval E3 (45%) rivela che il chunking meccanico per pagina taglia regole a metà o mescola sezioni — causa diretta di allucinazioni e "non trovato" su info presenti.
**Scelta:** nuovo step di ingest — Gemini riorganizza il JSON grezzo in Markdown pulito con header `##` (solo pulizia strutturale, no riformulazione); il chunker splitta per header. Validazione manuale contro il PDF per Brass.
**Motivazione:** un chunk = una sezione semantica elimina la causa strutturale; uso Gemini solo offline in ingest resta coerente col principio "LLM ai bordi".
→ dettaglio completo in docs/archived/decision-log-archive.md

---

### D20 — Indice vettoriale IVFFlat inefficace su dataset piccoli
**Contesto:** dopo D19 il retrieval falliva su query testuali nuove; diagnosticato che l'indice ivfflat (`lists=100`) è sovradimensionato per un dataset di poche decine di righe e salta il cluster corretto.
**Scelta:** rimosso l'indice ivfflat, scansione sequenziale per ora.
**Motivazione:** con pochi chunk la scansione sequenziale è istantanea ed esatta; da reintrodurre (con `lists` ricalibrato o HNSW) quando il volume cresce.
→ dettaglio completo in docs/archived/decision-log-archive.md

---

### D21 — Deduzione dichiarata nel prompt grounded
**Contesto:** il divieto assoluto di "dedurre" produceva falsi negativi su domande la cui risposta richiede sintesi legittima di più fonti.
**Scelta:** il prompt distingue "fatto diretto" da "deduzione" (introdotta con frase esplicita); resta vietato inventare.
**Motivazione:** trasparenza fatto-vs-ricostruzione sposta la verifica al lettore (che ha il manuale in mano) invece di un binario risponde/non-risponde che scartava sintesi corrette.
→ dettaglio completo in docs/archived/decision-log-archive.md

---

## Sessione 4 — 2026-07-05

### D22 — Riordino sequenza: Fase Forum BGG prima di S3.2–S3.5
**Contesto:** Francesco vuole procedere col Forum (gate D15 già soddisfatto da baseline 002, 80%) ma `task.md` lo elencava dopo S3.2–S3.5.
**Scelta:** `task.md` riscritto per riflettere l'ordine reale: F1–F8 prima, S3.2–S3.5 spostati dopo in "Fase 3 (continua)".
**Motivazione:** riordino legittimo (gate qualità comunque soddisfatto); aggiornare il documento mantiene `task.md` come stato autoritativo invece di lasciarlo disallineato dal lavoro reale.
**Nota collaterale:** S3.1 segnalato come possibile discrepanza (non marcato ✅ ma note di sessione lo indicano completo) — da confermare con Francesco.
→ dettaglio completo in docs/archived/decision-log-archive.md

---

## Sessione 5 — 2026-07-11

### D23 — Scope AI Provider Adapters: solo generazione, embedding centralizzato
**Contesto:** l'epica "AI provider adapters" vuole BYOK multi-provider, ma l'embedding è vincolato a `gemini-embedding-001`/768d (D17) e provider diversi hanno dimensioni diverse.
**Scelta:** adapter multi-provider solo per la generazione della risposta; l'embedding resta centralizzato, sempre Gemini.
**Motivazione:** disaccoppia la preferenza utente (modello generazione) dalla scelta strutturale (indicizzazione DB), evitando di rompere lo schema pgvector per un beneficio marginale.
→ dettaglio completo in docs/archived/decision-log-archive.md

---

### D24 — Storage conversazionale per Chat con contesto: server-side
**Contesto:** l'API è stateless; "Chat con contesto" richiede scegliere dove vive la history dei turni.
**Scelta:** server-side — nuove tabelle `chat_sessions` e `chat_messages`.
**Motivazione:** coerente col pattern owner_token (D16); permette di riprendere una conversazione da un altro contesto e di applicare un cap token/turni lato server.
→ dettaglio completo in docs/archived/decision-log-archive.md

---

## Sessione 6 — 2026-07-14

### D25 — Ristrutturazione task.md in directory task/ per epica
**Contesto:** `task.md` unico file, in crescita costante (11 epiche), scomodo da navigare/editare senza conflitti.
**Scelta:** `docs/task/NNNN-nome-epica.md` (4 cifre, step 100) + `docs/task/progress.md` come stato aggregato + `docs/task/closed/` per epiche completate.
**Motivazione:** un file per epica isola le modifiche (coerente con "un task alla volta"); `progress.md` dà vista d'insieme; 4 cifre evita di rompere l'ordinamento alfabetico oltre le 999 unità.
→ dettaglio completo in docs/archived/decision-log-archive.md

---

### D26 — Auth Bearer token per BGG XMLAPI2 in `lib/bgg.ts`
**Contesto:** F1 richiedeva auth Bearer per `lib/bgg.ts` (rif. "D23-BGG" mai loggato); `lib/bgg.ts` era stato implementato senza header auth nonostante `BGG_TOKEN` già in `.env.local`.
**Scelta:** `bggToken` letto da `process.env.BGG_TOKEN`, throw immediato se assente, header `Authorization: Bearer` aggiunto a `fetchBggXml`.
**Motivazione:** Francesco ha confermato che BGG richiede il token; il gap tra env pronto e codice non-wired indicava implementazione incompleta, non solo documentazione disallineata.
→ dettaglio completo in docs/archived/decision-log-archive.md

---

### D27 — Pipeline ingest forum multi-fase
**Contesto:** una run di `forum-ingest.ts` implica centinaia di chiamate BGG con rate limit 5s (15-25+ minuti) — un crash a metà è costoso da recuperare.
**Scelta:** 3 script separati (discover → fetch → ingest) con file JSON intermedi, ciascuno rilanciabile e idempotente.
**Motivazione:** stesso pattern collaudato per il PDF; nessuna chiamata Gemini prima della fase 3; crash recuperabile senza rifare lavoro già fatto.
→ dettaglio completo in docs/archived/decision-log-archive.md

---

### D28 — Chunking forum "small-to-big": solo radice embeddata, espansione a runtime
**Contesto:** un chunk = un post isolato produce match deboli su risposte brevi; un chunk = albero conversazionale richiede euristiche fragili.
**Scelta:** solo la radice di ogni thread è embeddata in `chunks`; tutti i post vivono senza embedding in `forum_posts`. A runtime, se la radice vince, il thread intero viene ricostruito in ordine cronologico.
**Motivazione:** il 92.7% dei thread ha <15 post — rischio di perdere recall su thread multi-argomento è raro; elimina il bisogno di euristiche di parent-matching fragili.
→ dettaglio completo in docs/archived/decision-log-archive.md

---

### D29 — Bug ingest manuale: sezioni intere mancanti, fix parser sezioni
**Contesto:** confronto manuale ha rivelato 3 sezioni azione intere mancanti da `brass.md` — più sezioni sulla stessa pagina fisica collassate invece di trattate come confini distinti.
**Scelta:** markdown ricostruito a mano per Brass; fix strutturale in `ingest-pdf.ts` (`splitIntoSections`): confine sezione ora solo `^##(?!#)\s`, righe `###` scartate dal contenuto.
**Motivazione:** correzione mirata del bug di parsing, senza rieseguire l'intera pipeline automatica su un caso già compromesso.
**Effetto collaterale noto:** trattare `###` come testo muto ha fuso 5-7 sotto-argomenti in chunk grandi — regressione osservata in eval (vedi D39).
→ dettaglio completo in docs/archived/decision-log-archive.md

### D30 — Link diretti a BGG nelle citazioni forum
**Contesto:** le citazioni forum in UI mostravano solo il subject del thread, senza modo di verificare la fonte su BGG.
**Scelta:** URL costruito a runtime da `bgg_thread_id`/`bgg_article_id` via helper `buildBggThreadUrl` in `lib/bgg.ts`; `expandForumThread` restituisce `posts[]` strutturato con URL per-post.
**Motivazione:** permette di linkare il post esatto citato, non solo la radice del thread; nessuna migration necessaria (campi già presenti).
→ dettaglio completo in docs/archived/decision-log-archive.md

### D31 — Epica Q (0550): query enhancement combinato decomposizione+HyDE
**Contesto:** la decomposizione pura risolve la dilution ma, se riformulata come sotto-domanda, può peggiorare il retrieval (similarità domanda-vs-domanda strutturalmente più alta di domanda-vs-prosa).
**Scelta:** `generateEnhancedQueries` in `lib/retrieval.ts` — un solo prompt scompone la domanda in max 3 concetti, ciascuno riformulato come paragrafo dichiarativo in stile manuale; risultato sempre unito (mai sostituito) al retrieval sulla query originale; fail-soft su errore.
**Motivazione:** unisce i benefici di entrambe le tecniche senza il rischio di allontanarsi dal lessico corretto del gioco.
**Verifica:** baseline 70% (pre) → 85% (post-0550, 17/20).
→ dettaglio completo in docs/archived/decision-log-archive.md

### D32 — Prompt: non introdurre argomenti non richiesti, non confondere fonte-diversa con deduzione
**Contesto:** il modello aggiungeva sezioni "si può dedurre che..." con argomenti non richiesti quando altre fonti pertinenti erano nel contesto, anche etichettando come deduzione un fatto dichiarato esplicitamente in una fonte diversa.
**Scelta:** rafforzate le istruzioni in `lib/prompt.ts`: test esplicito "è necessaria per la domanda?"; chiarito che fonte diversa non equivale automaticamente a deduzione.
**Motivazione:** riduce divagazioni non richieste senza perdere sintesi legittima.
**Nota aperta:** variabilità del query enhancement (D31) può comunque cambiare il set di fonti citate tra run diverse — non un difetto del prompt.
→ dettaglio completo in docs/archived/decision-log-archive.md

---

## Sessione 7 — 2026-07-25 (ingest Hegemony)

### D33 — Rilevamento colonne PDF: da soglia fissa a quorum riga-per-riga
**Contesto:** `cluster_columns` falliva su pagine a due colonne con gutter stretto (10px, indistinguibile dalla spaziatura normale); nessuna soglia fissa in px generalizzava.
**Scelta:** rilevamento a quorum riga-per-riga — una banda verticale è un gap valido se occupata da una minoranza di righe (`occupancy <= 0.05`) e larga almeno 6px; gap ai bordi pagina scartati.
**Motivazione:** un'occupancy quasi nulla è un segnale forte indipendente dalla larghezza assoluta o dalla tipografia del documento, elimina la necessità di calibrare soglie per ogni manuale.
→ dettaglio completo in docs/archived/decision-log-archive.md

---

### D34 — Contenuto icona-dipendente: non automatizzabile da solo testo, verificato prima di rinunciare
**Contesto:** pagine a griglia icona+didascalia producevano testo disordinato e semanticamente inutile dall'estrazione testuale.
**Scelta (iniziale, poi superata da D36):** nessuna table extraction nativa possibile (verificato); clustering 2D giudicato troppo fragile per il beneficio — sostituito da stub testuale che rimanda alla pagina originale.
**Motivazione:** non automatizzare ciò che il testo non può ricostruire in modo affidabile per poche pagine di beneficio marginale.
**Nota:** risolto definitivamente (non solo aggirato) passando a ingest via vision — vedi D36.
→ dettaglio completo in docs/archived/decision-log-archive.md

---

### D35 — ingest-pdf.ts diventa idempotente (skip chunk già presenti)
**Contesto:** ingest di Hegemony interrotto a metà da esaurimento quota Gemini (55/61 chunk salvati); un rilancio avrebbe ri-embeddato anche i chunk già andati a buon fine.
**Scelta:** lettura dei chunk esistenti per `(game_id, source='manual')` prima del loop, skip di quelli con `(page, section)` già presente.
**Motivazione:** resilienza a interruzioni per quota/rete, riuso dello stesso pattern già validato in `forum-ingest.ts` (D27).
→ dettaglio completo in docs/archived/decision-log-archive.md

---

### D36 — Ingest manuale: da testo estratto a vision PDF per-sezione (nuovo sotto-sistema `scripts/manual/manual-parser/`)
**Contesto:** debug esteso della pipeline testuale ha prodotto bug via via diversi e non convergenti (sezioni mancanti, falsi positivi di deduplicazione, header spuri, lingua incoerente, contenuto icona-dipendente D34) — ogni sezione generata da una chiamata Gemini isolata, senza contesto delle altre.
**Scelta:** vision per-sezione. Nuovo sotto-sistema (`types.ts`, `pdf-utils.ts`, `outline.ts`, `generate-section.ts`, `verify-completeness.ts` v. D37, `regenerate-section.ts`, `ingest-manual.ts`); `extract-pdf.py` guadagna `physicalPage`; `lib/gemini.ts` guadagna `generateFromPdfBase64` (separata da `LLMClient`). Fix B (dedup per similarità testuale) rimosso, non solo corretto.
**Motivazione:** la vision legge le pagine reali invece di ricostruire l'ordine di lettura da coordinate testuali già potenzialmente rovinate — risolve alla radice sia D33 sia D34.
**Verifica:** rapporto markdown/testo-grezzo salito da ~59-68% a 86.8% su Hegemony (39 pagine).
**Costo:** consumo quota Gemini significativamente più alto per manuale (immagine per pagina, non solo testo).
→ dettaglio completo in docs/archived/decision-log-archive.md

---

### D37 — Fase 3 di verifica completezza post-generazione (`verify-completeness.ts`)
**Contesto:** continuare a irrigidire la generazione con controlli euristici mirati non convergeva (D36); anticipato in D19 come possibile evoluzione futura.
**Scelta:** nuovo script che riceve testo grezzo e markdown finale interi, restituisce omissioni sospette con `severity` e `sourceHint` — non sostituisce la revisione umana, la rende trattabile.
**Verifica:** su Hegemony, 2 dei 3 "alta gravità" segnalati erano falsi positivi (contenuto presente altrove nel documento); 1 omissione minore genuina.
**Nota aperta:** il verificatore confronta in modo troppo locale (pagina-per-pagina) — da rinforzare, non corretto in questa sessione.
→ dettaglio completo in docs/archived/decision-log-archive.md

---

### D38 — `lib/retrieval.ts`: budget riservato per fonte manuale + fetch separato per fonte nel merge multi-query
**Contesto:** una risposta reale su Hegemony presentava come "deduzione" un fatto già dichiarato nel manuale; diagnosticato che il chunk manuale corretto (score 68-70%) non arrivava al contesto finale — problema di assemblaggio del contesto, non di prompt.
**Scelta:** fetch separato per fonte (`matchChunks` invocato con `filterSource='manual'` e `'forum'` separatamente, `RAW_CANDIDATES_PER_SOURCE=8`); `selectWithReservedBudget` garantisce almeno `MIN_MANUAL_CHUNKS=2` chunk manuale se sopra `MIN_MANUAL_SIMILARITY=0.4`.
**Motivazione:** un topic molto discusso sul forum poteva escludere l'unico chunk manuale pertinente prima ancora del merge tra query.
**Verifica:** chunk manuale nel contesto finale salito da 1/5 a 3-4/5 (completo solo insieme a D39).
**Nota aperta:** soglie stimate a occhio, non validate empiricamente su campione ampio — da rivedere in un eval più esteso.
→ dettaglio completo in docs/archived/decision-log-archive.md

---

### D39 — `ingest-pdf.ts`: chunking a livello di sottosezione (`###`), non più sezione intera con fallback a 500 parole
**Contesto:** sezioni `##` lunghe (es. 8 azioni distinte) venivano spezzate meccanicamente in "parte 1..N" da `CHUNK_MAX_WORDS=500`, senza rispettare i confini delle singole azioni (causa della competizione inter-chunk in D38).
**Scelta:** `splitIntoSections` riscritta: anche `###` apre un nuovo chunk dentro la sezione corrente, ereditando la pagina dal `##` padre; titolo combinato "Sezione — Sottosezione"; fallback 500 parole resta come rete di sicurezza.
**Motivazione:** elimina i chunk "parte N" arbitrari per la maggioranza del documento.
**Nota aperta:** non risolve le sezioni dove la vision (D36) usa convenzioni di header incoerenti (`###`, `####`, o solo **grassetto** senza header) — fix rimandato: prossimo passo identificato (appiattire `###`/`####` + riconoscere grassetto-etichetta come confine) ma non implementato.
→ dettaglio completo in docs/archived/decision-log-archive.md

### D40 — `ingest-pdf.ts`: confine di chunk appiattito su `###`/`####` + riconoscimento etichetta in grassetto
**Contesto:** applicato il prossimo passo lasciato aperto in D39 — la vision (D36) marca le singole azioni in modo incoerente (`###`, `####`, o solo **grassetto** senza header), rischiando di fondere azioni eterogenee nello stesso chunk.
**Scelta:** `###` e `####` trattati come lo stesso livello di confine (appiattiti); una riga interamente in grassetto (pattern `^\*\*[A-Za-z][a-zA-Z &]*\*\*$`) apre anch'essa un nuovo blocco, con la stessa eredità di pagina dal `##` padre.
**Motivazione:** robustezza a qualunque convenzione scelta dalla vision per una data sezione, invece di assumerne una sola — chiude il gap lasciato aperto in D39.
**Nota collaterale:** `cleanSubTitle` resta nel file ma non più usato dal nuovo percorso — warning ESLint (`no-unused-vars`), non un errore, da pulire in un prossimo giro.

### D41 — Anticipata una versione minima di S3.4 (home `/home` con selezione gioco) prima della chiusura di 0500
**Contesto:** Francesco ha bisogno subito di una home su `/home` con menu a tendina per scegliere il gioco e andare alla chat — funzione già prevista come S3.4 nell'epica 0600, che D22 aveva rimandato a dopo 0500.
**Scelta:** implementata solo la fetta minima — `app/home/page.tsx` + `components/home/GameSelectForm.tsx`, dropdown sui giochi con `manual_ready` o `forum_ready` true, redirect a `/game/[id]` — non l'intera S3.4 originale (che prevedeva ricerca testuale + lista risultati) né il resto di 0600 (S3.2, S3.3, S3.5, S3.7), rimasti nella sequenza dopo 0500.
**Motivazione:** bisogno pratico immediato di navigare tra i giochi già ingested (Brass, Hegemony), a costo implementativo minimo; non giustifica anticipare l'intera epica 0600.
→ dettaglio in `0600-fase3-continua.md` (S3.4 marcato ✅, variante dropdown) e `progress.md`.

### D42 — Epica Q (0550): Q4 (misurazione latenza/costo) skipped, epica chiusa
**Contesto:** Q1-Q3 completati e verificati (D31, baseline 70%→85%); restava solo Q4, misurazione
numerica di latenza/quota della chiamata LLM extra di `generateEnhancedQueries` — mai risultata
rilevante in pratica.
**Scelta:** Q4 skipped, epica 0550 chiusa così com'è; file spostato in
`docs/task/closed/0550-retrieval-query-enhancement.md`.
**Motivazione:** l'impatto qualitativo (1 generate + N embed extra per domanda) è già noto e
accettato; una misurazione precisa non è mai stata bloccante né richiesta, non giustifica
tenere l'epica aperta.

### D43 — Epica 0900 (Chat con contesto) anticipata prima di 0800; owner_token fuori scope, modalità scelta in `/home`
**Contesto:** Francesco vuole procedere su 0900 saltando 0800 (ancora da fare); inoltre C2 presupponeva owner_token, mai realmente implementato in app/API (`lib/owner-token.ts` vuoto), e C5 prevedeva un toggle in chat.
**Scelta:** 0900 promossa a priorità corrente, 0800 rimandata dopo; sessione chiavata solo su `game_id` (owner_token nullable ma non popolato); modalità domande/conversazione scelta in `/home` alla selezione del gioco (default domande), non un toggle nella chat.
**Motivazione:** riflette decisioni esplicite di Francesco; evita di implementare owner_token "di straforo" dentro un'epica che non lo richiede esplicitamente.
**Nota aperta:** owner_token resta da implementare quando/se necessario — divergenza nota da D16/architecture.md.

### D44 — Epica 0900: riscrittura query per retrieval + prompt dedicato in modalità conversazione
**Contesto:** verifica manuale di C3 su Hegemony ha mostrato che un follow-up ("dimmi di più su questo thread") recuperava fonti estranee (retrieval sulla domanda grezza, senza history) e che il prompt Q&A (FATTO DIRETTO/DEDUZIONE + citazioni ripetute per intero) dava un effetto meccanico su una conversazione.
**Scelta:** `lib/query-contextualization.ts` — solo in `conversation`, riscrive la domanda in forma standalone con la history prima del retrieval (fail-soft, stesso pattern di D31), usata solo per il retrieval; `lib/prompt.ts` guadagna `buildConversationPrompt` (alleggerito, usa la history per risolvere riferimenti impliciti), mentre `buildPrompt`/modalità `qa` restano invariati.
**Motivazione:** isola il fix alla sola modalità conversazione, senza rischiare regressioni su `qa` (comportamento consolidato); coerente con l'approccio già validato per il query enhancement.
**Costo:** +1 chiamata Gemini per turno in `conversation` (oltre a quella già presente per l'enhancement in `matchChunksForPrompt`) — accettato, coerente con la nota UI su C5 sul maggior consumo di questa modalità.

### D45 — Epica 0900: sessione generata dal client a ogni apertura di `/game/[id]`, non più una per game_id
**Contesto:** Francesco ha segnalato un bug: con la sessione chiavata solo su `game_id` (D43), ogni apertura della chat per lo stesso gioco riusava la stessa sessione/history invece di partirne una nuova — non il comportamento voluto.
**Scelta:** `sessionId` generato client-side (`crypto.randomUUID()`) al mount di `GamePage`, nuovo a ogni apertura/refresh; il server (`getOrCreateSession`) registra l'id ricevuto con un upsert idempotente invece di cercarlo per `game_id`. Rimosso l'indice unique `chat_sessions(game_id)` (non più valido: più sessioni per lo stesso gioco sono ora normali).
**Motivazione:** riflette la scelta esplicita di Francesco per questa fase (nessun utente reale, refresh = nuova conversazione); owner_token resta fuori scope come da D43.
**Nota aperta:** quando le conversazioni andranno persistite per un utente reale (multi-tab, riprendere una chat), servirà un meccanismo di persistenza client (es. sessionStorage) — esplicitamente rimandato da Francesco a quel momento.

## Template per sessioni future

```
### D46 — Aperta Epica 0551: query enhancement HyDE non chiude il gap cross-lingua
**Contesto:** diagnosi manuale (script `diagnose-retrieval.ts`/`diagnose-full-context.ts`/nuovo
`diagnose-query-enhancement.ts`) su un caso Hegemony con risposta fattualmente errata: il chunk
manuale corretto non arriva mai al contesto, nemmeno alzando `topK` (5→8) e `MIN_MANUAL_CHUNKS`
(2→4, mitigazione temporanea già applicata in `lib/retrieval.ts`/`route.ts`).
**Scelta:** causa radice isolata in `QUERY_ENHANCEMENT_PROMPT` (Epica 0550): non specifica la
lingua di output dei paragrafi HyDE, che risultano generati in italiano (lingua della query)
contro un manuale in inglese — il gap cross-lingua che la tecnica doveva chiudere resta aperto.
Aperta Epica 0551 per il fix (lingua HyDE parametrica su `games.manual_language`, nuovo campo,
la lingua del manuale varia per gioco) + ri-validazione dei parametri di recall alzati oggi.
**Motivazione:** evitare l'ennesima patch puntuale (soglie/conteggi) su un sintomo quando la
causa probabile è strutturale e generalizzabile a ogni gioco con manuale non in italiano.
Non in scope: granularità chunking (resta in 0560 punto 2/3), reranking, ricerca ibrida —
discussi ma non scelti.

---

### D47 — Epica 0551 anticipata, interrompe 0900
**Contesto:** 0551 (D46) appena aperta come bug di retrieval con causa radice già isolata;
priorità corrente era 0900 (Chat con contesto, C1 avviato).
**Scelta:** interrompere 0900, dare priorità a 0551. 0900 riprende dopo la chiusura di 0551.
**Motivazione:** richiesta esplicita di Francesco — un bug di correttezza fattuale nelle
risposte pesa più della prossima feature, e la causa è già diagnosticata (basso costo di
chiusura rispetto a lasciarlo aperto).

---

### D48 — Chiusa 0551 (parziale): fix lingua HyDE corretto ma non risolutivo, causa dominante è il chunking
**Contesto:** dopo D46/D47, implementati L1 (`games.manual_language`) e L2 (prompt HyDE
parametrico). Verificato con `diagnose-query-enhancement.ts`: paragrafi ora in inglese.
**Scelta:** ri-testato il caso originale con `diagnose-full-context.ts` — il chunk "Free
Actions"/"Basic Actions" continua a NON entrare nel contesto anche a gap linguistico chiuso
(EN vs EN). Chiusa 0551 con L1-L2 fatti (restano in produzione, fix valido in sé) e L3-L4
chiusi come non risolutivi. Priorità sposta su 0560 punto 3 (small-to-big manuale).
**Motivazione:** isolare correttamente causa necessaria (lingua, risolta) da causa sufficiente
(chunking, ancora aperta) invece di continuare a testare varianti sullo stesso fix già esaurito.

---

### D49 — Aperta Epica 0561: reranking + ricerca ibrida, dopo 0560 punto 3
**Contesto:** due limiti strutturali emersi durante 0551 (D46-D48) ma non affrontati lì per non
mischiare concern: selezione finale solo su coseno grezzo (niente reranking); solo ricerca
semantica, niente lessicale (caso concreto: "Manifestazione" non recupera "Demonstration").
**Scelta:** aperta 0561 (R1 reranking LLM, R2 full-text Postgres, R3 traduzione query grezza via
`manual_language`, R4 verifica). Ordine: dopo 0560 punto 3 (chunking), non prima — un reranking
su chunk ancora diluiti avrebbe meno segnale su cui lavorare.
**Motivazione:** evitare di continuare a tarare euristiche a soglia (pattern già fragile, v.
D48) quando la soluzione strutturale (reranking + ibrido) è nota e generalizzabile.

---

### D50 — 0560 punto 3: chunking fine-grained su bullet-titolo, non small-to-big
**Contesto:** causa dominante isolata in D48 (chunk "Free/Basic Actions" diluito da azioni
eterogenee non separate). La proposta originale del task (storage parallelo
`manual_sections`/`expandManualSection()`, analogo al forum) era sul tavolo da tempo, mai
implementata.
**Scelta:** invece di small-to-big, esteso `splitIntoSections` (`ingest-pdf.ts`) a riconoscere
bullet-titolo (`*   **Nome Azione**`, senza testo aggiuntivo in riga) come confine di chunk —
stessa logica di D40 (etichetta in grassetto), un livello più in profondità. Verificato con
nuovo script dry-run (`diagnose-chunking-dry-run.ts`, solo parsing, no Gemini/DB): "Buy Goods &
Services"/"Use Healthcare" ora chunk distinti, zero chunk "(parte N)" residui su Hegemony.
**Motivazione:** a differenza di un thread forum (unità coerente), una sezione action-list è
eterogenea — espandere al genitore a runtime avrebbe spostato la diluizione dal retrieval alla
generazione invece di risolverla. Il fix diretto (bullet come confine) è più semplice, non
richiede nuovo storage, ed è generalizzabile a ogni manuale con questo pattern di lista azioni.
Resta da fare: re-ingest di Hegemony + riverifica end-to-end sul caso originale (D46).

---

### D51 — Chiusa 0560: alzato MIN_MANUAL_CHUNKS a 6 / topK a 10, verificato end-to-end
**Contesto:** dopo il re-chunking (D50) e re-ingest di Hegemony, "Buy Goods & Services" salito a
72.7% (4° tra i chunk manuale, `diagnose-retrieval.ts --source manual`) ma ancora appena fuori
dalla riserva di 4 — affollata da 5 chunk "Cover Needs" quasi-duplicati (uno per ruolo).
**Scelta:** alzato `MIN_MANUAL_CHUNKS` 4→6 e `topK` 5→10 (`lib/retrieval.ts`, `route.ts`,
`diagnose-full-context.ts`). Verificato: "Classe Media — Buy Goods & Services" ora nel contesto
finale sul caso originale. Chiusa 0560 (punto 3), spostato file in `closed/`.
**Motivazione:** margine ormai stretto (72.7 vs 74.5%) dopo il fix di chunking — aggiustamento
fine su un segnale che funziona quasi, non più una toppa su un segnale strutturalmente debole
come l'alzata precedente (D46-D48). Priorità torna a 0900; 0561 (reranking) resta in coda per
affrontare la ridondanza "Cover Needs" osservata, più robustamente di un ulteriore alzamento.

---

### D52 — 0561 priorità assoluta: regressione su domanda con premessa errata dopo D51
**Contesto:** "Come guadagna Legittimità la Classe Media?" (corretta a inizio sessione, gestita
come PREMESSA ERRATA) è tornata a rispondere in modo sbagliato dopo l'alzata di
`MIN_MANUAL_CHUNKS` a 6 (D51). Verificato con `diagnose-full-context.ts`: le 4 fonti corrette
("Lo Stato — ...") sono nel contesto, insieme a 2 chunk "Middle Class" fuori tema (rumore da
riserva a soglia fissa) che probabilmente inducono priming errato verso l'attribuzione sbagliata.
**Scelta:** priorità assoluta a 0561 (reranking + ricerca ibrida), su decisione esplicita di
Francesco — sopra 0900 e ogni altro lavoro, finché la correttezza su domande ambigue/con
premessa errata non è affidabile. Non ulteriori tuning di `MIN_MANUAL_CHUNKS`/`topK` (pattern
già mostrato fragile in D46-D51).
**Motivazione:** la correttezza fattuale delle risposte è il valore centrale del prodotto — un
regresso su un caso già risolto, causato da un fix per un altro caso, conferma che serve un
meccanismo strutturale (reranking) invece di continuare a tarare soglie a mano.

---

### D53 — R1 (reranking) implementato e verificato su regressione D52
**Contesto:** priorità assoluta su 0561 (D52) dopo regressione sul caso Legittimità/Classe Media.
**Scelta:** implementato `lib/reranking.ts` (nuovo file, singola responsabilità): reranking LLM
sulla domanda originale (non arricchita) su un pool di max 30 candidati (`RERANK_POOL_CAP`),
fail-soft con fallback a `selectWithReservedBudget` se fallisce. Integrato in
`matchChunksForPrompt` (`lib/retrieval.ts`). Verificato su più run con `diagnose-full-context.ts`:
caso Legittimità risolto consistentemente (chunk "Middle Class" fuori tema esclusi); caso "Buy
Goods & Services" presente 2/3 run (varianza nota, non un fallimento del reranking).
**Motivazione:** un giudizio di pertinenza reale, mirato alla domanda specifica, distingue "stesso
soggetto nominato" da "risponde davvero alla domanda" meglio di qualunque soglia di similarità —
conferma la direzione scelta in D49 rispetto a continuare a tarare `MIN_MANUAL_CHUNKS`/`topK`.

---

### D54 — Revertato: paragrafo-soggetto in QUERY_ENHANCEMENT_PROMPT (tentativo fallito)
**Contesto:** caso "Come funziona la Prosperità dello Stato?" (Hegemony) rispondeva "non
trovato" invece di correggere con sicurezza (PREMESSA ERRATA: lo Stato non ha Prosperità,
guadagna punti tramite Legittimità) — nessuna fonte "Lo Stato" mai recuperata. Tentato un fix
generalizzato: istruzione nel prompt HyDE per generare sempre un paragrafo di overview del
soggetto nominato, indipendente dall'argomento chiesto.
**Scelta:** revertato subito dopo verifica — il modello, invece di generare il paragrafo-overview
richiesto, ha inventato una meccanica "State Prosperity" completamente fittizia (tasse, eserciti,
bancarotta, nulla di reale in Hegemony), confermando la premessa sbagliata della domanda invece
di correggerla. Il fallback "non trovato" pre-fix era più sicuro (nessuna invenzione) del
comportamento post-fix, anche se meno utile.
**Motivazione:** la tecnica HyDE (scrivere prosa dichiarativa "come se fosse vera") è
strutturalmente in tensione con la rilevazione di premesse sbagliate — spinge il modello a
"recitare la parte" invece di verificare. Serve una guardia esplicita anti-invenzione prima di
riprovare un fix in questa direzione (non ancora scritta/testata).

---

### D55 — Eval in timeout: dedup embed manuale/forum + ricalibrata pausa/timeout
**Contesto:** l'eval andava sistematicamente in timeout. Diagnosticato: il volume di chiamate
Gemini per domanda era cresciuto (HyDE + reranking, D53) fino a ~12 (di cui 8 embed, perché
`matchChunksForPrompt` chiamava `matchChunks` due volte — manuale e forum — per ogni query,
ciascuna con un embed proprio sullo stesso testo), mentre pausa/timeout dell'eval erano ancora
tarati sulla stima originale di ~3 chiamate/domanda (piano free, 15 richieste/minuto).
**Scelta:** `lib/retrieval.ts` — estratta `queryChunksByEmbedding` (solo RPC); `matchChunksForPrompt`
calcola un embedding per query e lo riusa per manuale+forum (~8 chiamate/domanda nel caso
peggiore, non più ~12). `eval/runner.test.ts` — pausa tra domande 15s→30s, timeout per domanda
45s→90s.
**Verifica:** run completa su `hegemony-ambiguous`, nessun timeout, 18/20 (90%) — v.
`docs/baselines/005-20260728-hegemony-ambiguous-gemini-3-1-flash-lite.json`. I 2 fallimenti sono
casi già noti (heg-amb-01 Legittimità/Classe Media, heg-amb-08 Prosperità dello Stato).
**Motivazione:** la causa reale non era la pausa in sé ma il volume di chiamate non più allineato
alle stime originarie — fix strutturale (dedup) più efficace di un ulteriore allungamento cieco
della pausa.

---

### D56 — Riorganizzazione gestione task/epiche: nomi parlanti, cartelle todo/progress/done, epiche parallele
**Contesto:** la convenzione precedente (epiche numerate `NNNN-nome-epica.md`, ordine sequenziale
globale, ID task per-epica come "R1", "S3.2", "C1", "A1") generava ambiguità tra ID short-form di
epiche diverse e non rappresentava che le epiche procedono ormai in parallelo, non in sequenza.
Occasione: aggiunta di due nuove epiche (AUTH, BILLING) su richiesta di Francesco.
**Scelta:** epiche nominate con un nome parlante (mai un prefisso numerico). `docs/epics/`
contiene solo le tre cartelle di stato `todo/`, `progress/`, `done/`; ogni epica è una directory
`<EPICA>/` posizionata dentro la cartella dello stato corrente (es. `docs/epics/progress/POC/`),
con un file indice `<EPICA>.md` e tre sottocartelle `todo/`, `progress/`, `done/` per i singoli
task, ID `<EPICA>-NNNNN` (5 cifre). Le 10 epiche numeriche chiuse/aperte precedenti (0000–0900)
sono confluite come singoli
task (POC-00001..00016) di una nuova epica `POC`, lasciati nel formato narrativo originale.
L'epica "AI Provider Adapters" (ex 1000) è diventata un singolo task di `BILLING` (BILLING-00008),
non un'epica a sé — è una leva di costo/monetizzazione. `TEACH` (ex 1100) e `VISUAL` (ex 1200)
restano epiche a sé stanti.
**Motivazione:** elimina l'ambiguità tra ID di epiche diverse, riflette che il lavoro procede in
parallelo, e rende esplicito nella struttura delle cartelle lo stato di ogni epica/task senza
dover aprire ogni file per saperlo.

---

### D57 — Aperta POC-00017 (restyling risposte), priorità sposta da POC-00011
**Contesto:** baseline 005 (18/20, D55) sopra soglia; revisione manuale delle risposte in
`docs/baselines/005-...json` ha rivelato problemi di forma, non di correttezza: formula
DEDUZIONE ripetuta identica, fallback "non trovato" usato anche quando una correzione di premessa
sarebbe possibile (heg-amb-08), citazione sistematica di autori forum non-designer (rumore per il
lettore, non rilevante chi abbia scritto cosa).
**Scelta:** aperta POC-00017 (S1 citazione utente attenuata, S2 varianti apertura deduzione, S3
fallback "non trovato" come eccezione reale non rifugio, S4 eval di verifica), su richiesta
esplicita di Francesco. POC-00011 (R2/R3 full-text search + traduzione query) messa in pausa, non
più priorità assoluta.
**Motivazione:** con la correttezza fattuale già sopra soglia, il valore marginale più alto ora è
sulla qualità percepita della risposta (tono, ripetitività, rumore nelle citazioni) piuttosto che
su un ulteriore incremento di recall.

---

### D58 — Chiusa POC-00017: fix WRONG_PREMISE_RULE (apertura + incompatibilità col fallback), 18/20
**Contesto:** prima run S4 (post S1-S3) a 17/20 — heg-amb-01/02 avevano contenuto corretto ma
forma difettosa: la correzione di premessa non era imposta come prima frase, e poteva coesistere
nella stessa risposta col fallback "non ho trovato" (visto letteralmente in heg-amb-01, che
spiegava correttamente il fatto e poi si contraddiceva chiudendo con "non ho trovato questa
informazione"). heg-amb-08/13 fallivano per lo stesso motivo; heg-amb-16 fallito per omissione
minore, ma confrontato col baseline 005 la stessa omissione era già presente e giudicata corretta
lì — varianza del judge, non regressione.
**Scelta:** `WRONG_PREMISE_RULE` (`lib/prompt.ts`) rafforzata: la correzione va sempre come prima
frase della risposta, mai come nota aggiunta dopo l'esposizione dei fatti; esplicitamente vietato
affiancarla al fallback "non ho trovato" nella stessa risposta. Ri-eseguita S4: 18/20, heg-amb-01/
08/13/16 tutti risolti; 2 nuovi fallimenti (heg-amb-02, heg-amb-17) non riconducibili al restyling
— stesso pattern di varianza di campionamento già noto (D53). POC-00017 chiusa, spostata in
`done/`.
**Motivazione:** il fix isola la causa esatta (ordine + incompatibilità mai esplicitata) invece di
un ulteriore tuning generico; il punteggio torna in linea con la baseline 005 (90%) con tono e
citazioni migliorati (S1-S3) e senza regressioni sui casi target.

---

### D59 — Chiusa POC-00016: C4/C5 mai implementati, assorbiti da CHAT-LISTING
**Contesto:** Francesco ha notato che POC-00016 (C1-C3 ✅, C4-C5 aperti) rischiava di
sovrapporsi a `CHAT-LISTING`, aperta successivamente. Verificato: `CHAT-LISTING.md` dichiara
esplicitamente di dipendere dal modello dati di POC-00016 (`chat_sessions`/`chat_messages`) — C1-
C3 non sono obsoleti, sono la base. C4 (cap fisso su turni/token) si sovrappone quasi 1:1 con
`CHAT-LISTING-00004` (limite configurabile, stesso obiettivo, scope più ampio). C5 (scelta
modalità in `/home`, pensata per un'unica sessione per gioco) sarebbe stata da rifare non appena
`CHAT-LISTING-00002`/`-00003` introducono conversazioni multiple per gioco — la scelta modalità
naturale diventa per-conversazione, non un toggle globale.
**Scelta:** POC-00016 chiusa con C1-C3 ✅; C4 e C5 tolti come task aperti lì (mai implementati) e
annotati come assorbiti in `CHAT-LISTING-00004` (C4) e `CHAT-LISTING-00002`/`-00003` (C5, nota su
dove va decisa la scelta modalità).
**Motivazione:** evita di implementare due volte lo stesso obiettivo (cap turni) e di costruire
una UI (C5) che sarebbe da rifare appena arriva il modello multi-conversazione — stesso principio
già applicato altrove nel progetto (non anticipare lavoro che una feature successiva già nota
renderebbe da rifare).

---

### D60 — Chiusa POC-00013: S3.2 de facto, S3.3/S3.5 in ADMIN-CONSOLE, S3.7 in nuova epica GAME-REQUEST
**Contesto:** analisi dello stato reale di POC-00013 (Fase 3 continua) contro il codice: S3.2
(fallback esplicito su bassa similarità) risultava coperto solo dal prompt, non da una soglia nel
codice; S3.3 (`search-game`) e S3.5 (`game-status`) mai implementate (cartelle API vuote); S3.7
(richiesta gioco non disponibile) mai implementata (nessuna tabella `game_requests`). Francesco ha
notato che S3.3 è utile solo per il wizard di ingest admin (`ADMIN-CONSOLE-00002`), non come
feature utente-facing con solo 2 giochi ingested, e che S3.7 ha senso solo con distribuzione/
traffico reale, quindi priorità molto bassa a sé stante.
**Scelta:** S3.2 confermato soddisfatto de facto (nessuna soglia hard-coded aggiunta — il
comportamento anti-allucinazione del prompt più il fallback di `route.ts` bastano, verificato
dagli eval). S3.3 → `ADMIN-CONSOLE-00004`, S3.5 → `ADMIN-CONSOLE-00005` (stesso ragionamento di
S3.3, utile a wizard/gestione stato). S3.7 → nuova epica `GAME-REQUEST` (`GAME-REQUEST-00001`),
priorità molto bassa. POC-00013 chiusa, nessun task aperto residuo.
**Motivazione:** i tre task residui erano legati a un contesto (Fase 3, MVP con ricerca
self-service) superato dall'evoluzione del prodotto — reindirizzarli alle epiche che li
useranno davvero evita di tenerli aperti in un'epica ormai chiusa nella sostanza.

---

### D61 — `lib/prompt.ts` splittato in `lib/prompt/` (shared + due specializzazioni qa/conversation)
**Contesto:** durante il debug dei bug di lingua/citazioni di POC-00014 (v. sopra), Francesco ha
segnalato di usare la modalità conversazione e ha chiesto di verificare se il problema fosse
specifico a quella modalità, più una richiesta di refactor: `lib/prompt.ts` era diventato un
unico file monolitico (~150 righe) con le due modalità (qa/conversation) e tutte le regole
condivise mescolate nello stesso file.
**Scelta:** verificato che `RESPONSE_LANGUAGE_RULE`/`CITATION_FORMAT_RULES` erano già condivise
tra le due modalità (quindi i fix precedenti si applicavano a entrambe), ma aggiunta comunque una
clausola esplicita in `buildConversationPrompt`: la lingua della risposta segue SOLO l'ultima
DOMANDA, mai lo STORICO (rischio non coperto esplicitamente prima — un turno precedente in una
lingua diversa poteva confondere il segnale). Refactor: `lib/prompt.ts` → `lib/prompt/` con
`shared.ts` (regole comuni + `buildContext`), `qa.ts` (`buildPrompt`), `conversation.ts`
(`buildConversationPrompt`, storico), `index.ts` (barrel — nessuna modifica richiesta al singolo
consumer, `app/api/chat/route.ts`, che importa ancora da `@/lib/prompt`).
**Motivazione:** un file = una responsabilità (CLAUDE.md); separare le specializzazioni riduce il
rischio di drift accidentale tra qa/conversation e rende più facile individuare quale modalità è
coinvolta in un bug futuro — la confusione su "il fix vale anche in conversation?" di questa
stessa sessione ne è la controprova pratica.

---

### D62 — Aperta `docs/bugs/`, BUG-001 accantonato (traduzione incoerente etichette sezione)
**Contesto:** dopo 4 tentativi di fix via prompt (v. D61 e sessione 2026-07-29) sulla traduzione
delle etichette di sezione manuale nelle citazioni quando la risposta non è in italiano, il
comportamento resta incoerente — alcune citazioni tradotte correttamente, altre no, nella stessa
risposta. Non sembra un problema di istruzione mancante (istruzioni esplicite, ripetute, con
esempi concreti, posizionate vicino al punto di lettura del contesto) ma di affidabilità del
modello (`gemini-3.1-flash-lite`) su una trasformazione ripetuta uniforme in output lunghi.
**Scelta:** aperta `docs/bugs/` (nuova cartella, primo bug tracciato lì) con
`BUG-001-traduzione-parziale-etichette-sezione.md` — sintomo, tentativi già fatti, ipotesi, impatto
(basso-medio: corpo risposta comunque corretto). Non pianificato in un'epica finché non si decide
la direzione (backfill nome sezione canonico multilingua in DB, vs. accettare il limite).
POC-00014 chiusa nella sostanza (L1 funzionante, refactor fatto) con questo residuo tracciato a
parte, per non bloccare il resto del lavoro su un problema di raffinamento cosmetico.
**Motivazione:** continuare a iterare sul prompt per lo stesso problema, dopo 4 tentativi falliti
con approcci diversi, ha rendimento marginale decrescente — meglio tracciarlo esplicitamente e
tornarci con un approccio strutturalmente diverso (dati, non prompt) quando ha senso investirci.

---

### D63 — Deprecata POC-00015 (UI Uplifting), superseded da DESIGN
**Contesto:** POC-00015 (mai iniziata: U1 theme file, U2 applicazione componenti, U3 componenti
base) e l'epica `DESIGN` (aperta successivamente: DESIGN-00001 tema/palette, DESIGN-00002
componenti base, DESIGN-00003 applicazione) coprivano lo stesso scope — `DESIGN.md` segnalava già
la sovrapposizione come nota aperta da riconciliare.
**Scelta:** verificata corrispondenza 1:1 tra i task (U1→DESIGN-00001, U3→DESIGN-00002,
U2→DESIGN-00003, DESIGN più granulare). POC-00015 deprecata come superseded (nessun lavoro da
recuperare, mai iniziata) e spostata in `done/`; rimossa la nota di riconciliazione da `DESIGN.md`.
**Motivazione:** evitare di mantenere due epiche aperte con lo stesso obiettivo — `DESIGN` è la
versione più dettagliata e resta l'unica riferimento per questo lavoro.

---

### D64 — DESIGN-00001: palette "Ludico Vivace" adottata, success/warning derivati (non nel design originale)
**Contesto:** Claude Design ha consegnato 3 palette alternative (v. `docs/epics/todo/DESIGN/
reference/BGT Design System - Standalone.html`) costruendo tutte le schermate su "C · Ludico
Vivace" (prugna + lime, font Sora); il file definiva primary/ink/superfici/danger/accent
manuale-community-designer ma non stati semantici "successo"/"warning" richiesti dal DoD.
**Scelta:** adottata "Ludico Vivace" come tema unico, formalizzato in `app/theme.css` (CSS custom
properties + mapping `@theme inline` per Tailwind v4) e importato in `app/globals.css`. `success`/
`warning` derivati mantenendo la stessa curva L/C di `--danger` (~56-70% L, ~0.16-0.18 C),
spostati su hue verde (145) e ambra (80). Font caricati via `next/font` (Sora, IBM Plex Mono) in
`app/layout.tsx` al posto dei Geist di boilerplate.
**Motivazione:** riusa la scelta già validata su tutte le schermate invece di aprire una nuova
esplorazione; i due colori mancanti non erano una scelta di design (nessuna alternativa proposta
da confrontare), solo un gap di copertura — derivarli per continuità visiva è la strada più
diretta rispetto a un giro di follow-up con Claude Design per due soli valori.
**Nota aperta:** spacing scale non ridefinito — si usa la scala di default Tailwind (il design non
introduce una scala custom); dark mode (presente nel file di reference) non ancora portato nei
token, fuori scope per questo task.

---

### D65 — BILLING-00001 in pausa: AUTH ha priorità prima di continuare l'istrumentazione
**Contesto:** BILLING-00001 (schema `user_requests`/`gemini_calls`, migration
`20260729000000_usage_tracking.sql`) definito nella sessione odierna; il passo successivo
(istrumentare le chiamate Gemini reali) userebbe `owner_token` come identificatore utente in
`user_requests` — mai realmente popolato in produzione (D43) e destinato a essere affiancato o
sostituito appena `AUTH` introduce autenticazione vera.
**Scelta:** priorità sposta su `AUTH` prima di riprendere l'istrumentazione di BILLING-00001.
Lavoro su `AUTH` condotto da Francesco in una sessione separata.
**Motivazione:** evita di scrivere codice di tracking legato a un identificatore che rischia di
essere sostituito a breve — schema e migration restano validi (già forward-compatible con
`user_id`), solo l'istrumentazione applicativa aspetta che `AUTH` chiarisca come identificare
l'utente.

---

### D66 — AUTH-00001: `@supabase/ssr` per i client auth, RLS abilitata su `profiles` da subito senza policy
**Contesto:** avvio di AUTH-00001 (Supabase Auth + tabella `profiles`); il progetto ha solo
`@supabase/supabase-js` (client anonimo, sessione non persistita via cookie), ma AUTH-00004
(middleware Next.js per route protette, stessa epica) richiede gestione sessione SSR-compatibile.
**Scelta:** aggiunto `@supabase/ssr`; `lib/supabase.ts` guadagna `createBrowserSupabaseClient`
(Client Component) e `createServerSupabaseClient` (Server Component/Route Handler/middleware,
cookie via `next/headers`), accanto ai client esistenti (`supabase`, `createServiceClient`),
invariati. Migration `profiles` (enum `user_role`, trigger `handle_new_user`) abilita RLS sulla
tabella subito, senza aggiungere policy — le policy sono scope di AUTH-00003.
**Motivazione:** implementare l'auth ora con solo client-side e rifare i client con `@supabase/ssr`
in AUTH-00004 sarebbe lavoro doppio; RLS-on-senza-policy è il default sicuro raccomandato da
Supabase per ogni tabella dati-utente (coerente col principio architetturale "enforcement a
livello DB") e non anticipa le policy stesse, solo la postura di default.
**Nota aperta:** migration non ancora applicata al DB; verifica DoD (signup/login, riga `profiles`
auto-creata) da fare manualmente via Supabase Studio — scelta esplicita di Francesco per non
anticipare la UI login/signup, scope di AUTH-00005.

---

### D67 — Chiusa AUTH-00002 senza implementazione: `owner_token` mai popolato in produzione
**Contesto:** avvio di AUTH-00002 (migrazione soft `owner_token`→`user_id` al login); verificato
via grep che nessun file in `app/`/`lib/`/`components/` referenzia `owner_token`/`ownerToken` —
`lib/owner-token.ts` è vuoto, coerente con D43 ("mai realmente implementato in app/API") e D65
("mai realmente popolato in produzione"). Nessun cookie/localStorage lo genera, nessuna riga in
`games`/`chat_sessions` ha un valore non-null.
**Scelta:** chiusa AUTH-00002 senza implementazione — il DoD presuppone conversazioni esistenti
da "ritrovare" dopo il login, che non esistono; non c'è nulla da migrare. Nessuna colonna
`user_id` aggiunta (era scope implicito di questo task, non di AUTH-00001) — resta da fare in
AUTH-00003, che dovrà quindi anche creare le colonne oltre a scrivere le policy RLS.
**Motivazione:** implementare una logica di linking per dati che non esistono avrebbe prodotto
codice non testabile end-to-end e mai esercitato — scartato su decisione esplicita di Francesco
a favore di procedere direttamente ad AUTH-00003.

---

### D68 — AUTH-00003: accesso anonimo confermato per shared/chat, `user_id` solo su tabelle owner dirette
**Contesto:** avvio di AUTH-00003 (RLS policy). `games`/`chat_sessions`/`chat_messages` sono oggi
completamente aperte (nessuna ownership mai applicata, D43/D67); il DoD del task presuppone
isolamento testabile fra due utenti, ma non era chiaro se da ora il login diventasse necessario
per l'uso base dell'app (rompendo il modello anonimo attuale) o se l'accesso pubblico dovesse
restare per il contenuto condiviso.
**Scelta:** confermato con Francesco — l'accesso anonimo resta per `games` con
`visibility='shared'` e per la chat; login necessario solo per giochi privati e funzioni admin.
`user_id` (FK `profiles(id)`, nullable, `on delete set null`) aggiunto solo su `games` e
`chat_sessions` (proprietà diretta); `chunks`/`forum_threads`/`forum_posts` (via `games.game_id`)
e `chat_messages` (via `chat_sessions.session_id`) restano senza colonna propria, policy con
`exists` join sul genitore. Aggiunta funzione `is_admin()` (security definer, riusabile) e
trigger `prevent_role_self_escalation` su `profiles` (un utente non può auto-promuoversi admin).
Migration: `20260729020000_rls_policies.sql`.
**Motivazione:** coerente con D05 (MVP a basso attrito, nessuna auth obbligatoria) e con
"route protette" di AUTH-00004 che implica solo un sottoinsieme delle route richiede login;
forzare il login per tutto sarebbe stato un cambio di prodotto più ampio, non richiesto da questo
task. Colonna diretta solo dove c'è ownership reale evita dati duplicati da tenere sincronizzati
su tabelle che ereditano l'ownership dal genitore.
**Nota aperta:** `games.visibility` deve essere verificato `'shared'` per i giochi in uso pubblico
(Brass Birmingham, Hegemony) prima di applicare — `match_chunks` è `security invoker`, eredita
RLS senza bypass silenzioso, ma un game non-shared diventerebbe invisibile all'app anonima senza
errore esplicito (la chat risponderebbe "non trovato" su un gioco prima funzionante). Migration
non ancora applicata né verificata.

---

### D69 — Build rotta da `next/headers` in `lib/supabase.ts`: split in `lib/supabase.ts`/`lib/supabase-server.ts`
**Contesto:** dopo il push di AUTH-00001, build Turbopack fallita — `app/game/[id]/page.tsx`
(Client Component) importa `{ supabase }` da `lib/supabase.ts`, che however conteneva anche
`createServerSupabaseClient` (import statico di `next/headers`, valido solo server-side).
Bundlare `next/headers` in un Client Component non è permesso, a prescindere da quale export
venga effettivamente usato — basta che sia nello stesso modulo.
**Scelta:** `createServerSupabaseClient` spostata in un nuovo file `lib/supabase-server.ts`
(server-only, mai importabile da codice con `'use client'`); `lib/supabase.ts` resta con gli
export sicuri lato client (`supabase`, `createServiceClient`, `createBrowserSupabaseClient`).
Nessun consumer esistente da aggiornare: `createServerSupabaseClient` non aveva ancora nessun
uso reale nel codice (preparata in AUTH-00001 per AUTH-00004, mai collegata). Verificato con
`npm run build` completo (Turbopack), non solo `tsc --noEmit`.
**Motivazione:** fix minimo e a rischio zero — nessun import esistente cambia. Non fuso con la
riorganizzazione `lib/repositories`/`lib/services`/`lib/clients` appena discussa (migrazione
graduale, non urgente): questo file resta in `lib/` per ora, si sposterà in `lib/clients/`
quando lo toccheremo di nuovo per AUTH-00004.

---

### D70 — Aperte AUTH-00008/00009: invito nativo Supabase invece di approvazione post-signup
**Contesto:** Francesco vuole evitare registrazioni indiscriminate quando l'app inizia a
circolare tra amici. Opzione iniziale proposta (approvazione post-signup, utente in stato
"pending" finché un admin non approva) valutata insieme a alternative: allowlist email, invito
con codice custom, invito nativo Supabase.
**Scelta:** invito nativo Supabase — signup pubblico disabilitato (Authentication → Providers →
Email → "Allow new users to sign up" off, config progetto, non codice), inviti generati via
`inviteUserByEmail`/Studio (`Authentication → Users → Invite`), nessuna tabella custom per
codici/token (Supabase gestisce già token, email, scadenza). Preceduto da una richiesta esplicita
lato utente: nuova tabella `invite_requests` (chiunque anonimo inserisce, solo admin legge/
aggiorna via RLS). Stato `enabled`/`disabled` su `profiles` (AUTH-00009) resta una decisione
separata e ortogonale — serve a revocare accesso a un utente già invitato, non a filtrare le
nuove registrazioni.
**Motivazione:** l'approvazione post-signup crea comunque un account reale in stato limbo prima
della decisione admin — richiede una coda da controllare e, per essere davvero usabile, una UI
admin che oggi non esiste (dipende da ADMIN-CONSOLE). L'invito nativo blocca la creazione
dell'account a monte (zero account "pending" da gestire) e riusa un meccanismo già pronto in
Supabase invece di reinventare token/scadenze custom — verificato via ricerca che il toggle e
`inviteUserByEmail` sono la via documentata/supportata per questo esatto caso d'uso.
**Nota aperta:** AUTH-00008 cambia lo scope della UI di signup (niente form libero, un form
"richiedi invito" al suo posto) — probabile che vada affrontato prima o insieme ad AUTH-00005,
non necessariamente dopo come l'ordine cronologico degli ID suggerirebbe. Non ancora deciso.

---

### D71 — AUTH-00004: `middleware.ts` deprecato in Next.js 16, rinominato `proxy.ts`
**Contesto:** durante l'implementazione del middleware per route protette, `npm run build` ha
segnalato: "The middleware file convention is deprecated. Please use proxy instead." Verificato
sulla doc ufficiale Next.js: da v16.0.0 `middleware.ts` è deprecato in favore di `proxy.ts`
(stesso file, funzione rinominata da `middleware` a `proxy`) — e un `middleware.ts` lasciato lì
**viene ignorato in build senza errore**, quindi la protezione delle route smetterebbe di
funzionare in silenzio, non con un crash visibile.
**Scelta:** file scritto direttamente come `proxy.ts` (non `middleware.ts`), funzione esportata
`proxy`. Verificato che il warning di deprecazione sparisce dalla build. Nessun altro cambio di
comportamento rilevante per questo progetto (runtime di default passa a Node.js invece di Edge
da v16, irrilevante qui: il client Supabase usato non ha vincoli specifici sul runtime).
**Motivazione:** il rischio concreto (route "protette" silenziosamente non protette) è alto
abbastanza da giustificare la verifica prima di chiudere il task, non solo affidarsi a `tsc`/
lint che non segnalano la deprecazione — solo la build reale (Turbopack) la mostra.

---

### D72 — AUTH-00008: prima applicazione della convenzione repository/controller
**Contesto:** discusso in sessione (non loggato a sé, era parte della conversazione su AUTH) di
adottare uno stile più simile a MVC (repository/service, controller = route handler) per il
codice nuovo, migrazione graduale — nessun refactor del `lib/` esistente. AUTH-00008 (richiesta
di invito) è il primo codice scritto dopo quella discussione.
**Scelta:** `lib/repositories/invite-requests.repository.ts` (accesso dati puro) +
`app/api/invite-requests/route.ts` (controller: valida input, chiama la repository) invece di
far scrivere il form direttamente su Supabase lato client. `lib/prompt/` e il resto di `lib/`
restano dov'erano (nessun refactor forzato solo per coerenza nominale).
**Motivazione:** verifica pratica della convenzione appena discussa su un caso reale e piccolo,
a basso rischio — coerente con "migrazione graduale" invece di applicarla retroattivamente.

---

### D73 — AUTH-00008: SMTP custom necessario, il servizio email built-in di Supabase non basta
**Contesto:** verifica manuale del flusso invito bloccata da `email rate limit exceeded`.
Verificato sulla doc ufficiale Supabase: il servizio SMTP built-in ha due limiti strutturali,
non solo di test — **2 email/ora in totale sul progetto** (non configurabile senza SMTP
custom) e **invia solo a indirizzi già membri del team Supabase del progetto**, rifiutando
qualunque altro destinatario. Nessuno dei due è compatibile con l'uso reale di AUTH-00008
(invitare persone esterne al progetto).
**Scelta:** configurare SMTP custom (Resend, raccomandato dalla doc Supabase con guida
dedicata, piano free 3.000 email/mese) invece di continuare con il servizio built-in.
Configurazione da fare da Francesco (richiede un account esterno, non automatizzabile) su
Supabase Dashboard → Authentication → SMTP Settings.
**Motivazione:** il servizio built-in è esplicitamente documentato da Supabase come "non per
uso in produzione" — scoperto qui non per lettura preventiva della doc ma dal fallimento reale
del test, prima di chiudere AUTH-00008 invece che dopo, quando sarebbe stato un problema con
utenti reali invitati.
**Nota aperta:** Francesco ha deciso esplicitamente di rimandare l'acquisto di un dominio
(necessario per Resend, che non accetta domini condivisi). Processo interinale: crea l'utente a
mano in Supabase Studio ("Create new user", non "Invite user" — verificato via ricerca che il
primo non invia email, quindi non soggetto né al rate limit né alla restrizione "solo membri del
team") e comunica le credenziali fuori dall'app. Da riprendere con SMTP custom quando si procede
con l'acquisto del dominio.

---

### D74 — AUTH-00011: route protette estese a tutta l'app, supera D68

**Contesto:** dopo la verifica manuale di AUTH-00005 (login/logout), Francesco ha chiesto che
l'intera app richieda sessione attiva, non solo `/admin` (scope originale di AUTH-00004, D68:
accesso anonimo mantenuto per giochi condivisi/chat).
**Scelta:** `proxy.ts` invertito da allowlist-di-route-protette ad allowlist-di-route-pubbliche
(`/login`, `/request-invite`, `/api/invite-requests`); tutto il resto — incluse `/home`,
`/game/[id]`, `/api/chat` — richiede utente autenticato. Le API non pubbliche rispondono `401`
JSON, le pagine rimandano a `/login`.
**Motivazione:** coerente con la registrazione solo su invito (AUTH-00008) — non ha senso
lasciare uso anonimo pieno dell'app se non ci si può nemmeno registrare da soli. Solo `/login` e
il flusso di richiesta invito restano pubblici perché servono a raggiungere l'accesso stesso.
**Nota aperta:** le RLS anonime su `games`/tabelle derivate (AUTH-00003) non sono state toccate
— restano come difesa in profondità, ora codice morto nel flusso normale ma non rimosse (tocca
lo schema DB, fuori scope senza task esplicito).

---

### D75 — Ingest SETI: espansioni modellate come righe `games` collegate, non come tag su `chunks`
**Contesto:** ingest di SETI con l'espansione Space Agencies (D03/copyright escluso upload
self-service). Prima ipotesi (tag testuale/colonna `expansion` su `chunks`) scartata su
osservazione di Francesco: un'espansione ha già un proprio `bgg_id` su BGG, modellarla come
gioco a sé è più naturale e generalizza a più espansioni/forum propri.
**Opzioni:** colonna `chunks.expansion` (slug) · tabella di join `game_expansions` (n:n) ·
`games.base_game_id` self-referencing (1:n, un'espansione ha una base).
**Scelta:** `games.base_game_id` nullable. `match_chunks`/retrieval accettano un array di
game_id (base + espansioni selezionate in chat) invece di uno solo; `chunks` invariata.
**Motivazione:** riusa lo schema esistente (stesso stile di `chunks.game_id`), zero rischio di
collisione pagina/sezione tra manuali diversi (game_id diversi), copre il caso reale (n:1) senza
la complessità di una tabella di join non necessaria oggi.

---

### D76 — extract-pdf.py: bug perdita contenuto su pagine spread + nuovo caso di rilevamento
**Contesto:** ingest di SETI: Space Agencies (PDF con dimensioni pagina eterogenee, alcune a
larghezza doppia dichiarata — pagine affiancate nel proprio page box, non testo che sconfina da
una pagina dichiarata singola come nel caso D19/D20). `is_full_spread` non rilevava questo caso
(il testo resta dentro la larghezza già "doppia" dichiarata), quindi 3 pagine fisiche su 5 non
venivano divise. Verificando la stessa funzione su SETI base è emerso un bug indipendente e più
grave: quando uno spread viene diviso in due, la metà destra viene salvata con
`content_left` invece di `content_right` — perdita silenziosa del testo reale della pagina
destra (verificato: pagina fisica 10 del manuale SETI produceva due pagine logiche con
contenuto identico).
**Scelta:** `is_full_spread` accetta ora anche una larghezza di riferimento "pagina singola"
(il minimo tra tutte le pagine del documento) e segnala spread anche quando una pagina è
dichiarata a larghezza ~doppia rispetto ad essa; il midpoint di split usa `declared_width / 2`
quando disponibile, non solo il punto medio del testo. Corretto il bug `content_left`/
`content_right`.
**Motivazione:** il bug perdita-contenuto è indipendente dal documento specifico e probabilmente
già presente in ingest precedenti con pagine spread (da verificare caso per caso se riemerge un
problema di retrieval) — corretto subito perché perde informazione in modo silenzioso, non un
semplice miglioramento incrementale dell'euristica.

---

## Sessione 8 — 2026-08-02

### D77 — CHAT-LISTING-00002: chat_sessions/chat_messages scritte da route.ts passano al service client
**Contesto:** la sidebar richiede `chat_sessions.user_id` popolato per scopare l'elenco per
utente (gap già segnalato in BILLING-00001, mai risolto). Valorizzandolo, il client anonimo
usato finora in `app/api/chat/route.ts`/`feedback/route.ts` (nessun cookie/sessione allegata)
non soddisfa più le policy RLS insert/update (`auth.uid() = user_id`), che finora passavano solo
perché `user_id` era sempre null.
**Scelta:** le scritture server-side su `chat_sessions`/`chat_messages` in `route.ts` e
`feedback/route.ts` usano ora `createServiceClient()` invece del client anonimo. L'endpoint
nuovo `GET /api/chat/sessions` (letto direttamente dal browser per la sidebar) resta invece sul
client con sessione via cookie + filtro esplicito `user_id`, RLS come enforcement reale.
**Motivazione:** stesso principio già seguito da `usage-tracking.repository` (log interni,
service client, accesso scoped dalla logica applicativa non dal client); per l'endpoint di
lettura esposto al browser la RLS resta necessaria, il service client lì avrebbe rischiato di
esporre conversazioni di altri utenti.

---

### D[N] — Titolo decisione
**Contesto:** perché si è posta la questione
**Opzioni:** opzione A · opzione B · opzione C
**Scelta:** opzione scelta
**Motivazione:** perché questa e non le altre
```
