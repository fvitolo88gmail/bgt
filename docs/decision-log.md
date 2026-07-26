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

## Template per sessioni future

```
### D[N] — Titolo decisione
**Contesto:** perché si è posta la questione
**Opzioni:** opzione A · opzione B · opzione C
**Scelta:** opzione scelta
**Motivazione:** perché questa e non le altre
```
