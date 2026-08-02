# BILLING-00009 — Viste per utente e per tipo di operazione nel pannello costi

**Blocca:** BILLING-00002 — ✅ done

## Task

Estendere il pannello `/admin/costs` (BILLING-00002):

- Nuova tabella "Distribuzione per utente" (stesso pattern di quella per gioco: interazioni,
  costo totale, costo medio), accanto a quella per gioco.
- Nuova tabella "Distribuzione per tipo di operazione" (embedding, generation,
  query_contextualization, query_enhancement, reranking): chiamate, costo totale, costo medio
  per chiamata.
- Rinominare la pagina/le etichette: togliere ogni riferimento esplicito a "Gemini" (es. "Costi
  Gemini" → titolo generico) — in vista di un possibile provider AI diverso in futuro (v.
  BILLING-00008, AI Provider Adapters).

**Revisione (stessa sessione, su richiesta di Francesco):** prima stesura aveva righe
espandibili (click su gioco/utente → elenco interazioni con modello per riga) — accantonata,
"poco significativa". Sostituita con una terza tabella semplice per tipo di operazione, più
diretta per capire dove va il costo senza uno step di interazione in più.

## Implementazione

- Migration `supabase/migrations/20260802000000_user_request_costs_add_user.sql`: `create or
  replace view user_request_costs` con `user_id` aggiunto in coda alla select list (Postgres
  rifiuta di spostare colonne esistenti con `CREATE OR REPLACE VIEW`, errore 42P16 — corretto
  dopo un primo tentativo fallito con `user_id` in mezzo). Non ancora applicata al DB.
- `lib/billing/repository/usage-tracking.repository.ts`: `UserRequestCostRow` guadagna `userId`;
  nuova `getGeminiCallCosts` legge `gemini_calls_costed` riga per riga (una per chiamata, con
  `model_name`/`call_type`) — base per la distribuzione per tipo di operazione.
- `lib/billing/service/billing-aggregation.ts`: nuova `summarizeCostByUser` (stesso pattern di
  `summarizeCostByGame`, esclude interazioni senza `user_id` risolto); nuova
  `summarizeCostByCallType` che aggrega `gemini_calls_costed` per `call_type` (chiamate, costo
  totale, costo medio per chiamata).
- `components/admin/CostTable.tsx` (nuovo, Server Component): tabella di distribuzione generica
  riusata per gioco/utente/tipo di operazione — riga semplice, nessuna interazione client.
- `app/admin/costs/page.tsx`: tre tabelle di distribuzione (gioco, utente, tipo di operazione —
  quest'ultima con etichette leggibili per i `call_type` interni). Titolo pagina "Costi Gemini" →
  "Costi", nessun riferimento a "Gemini" rimasto nella UI.

**Revisione (stessa sessione):** rimossa la prima versione con righe espandibili
(`ExpandableCostTable.tsx`, Client Component) su richiesta di Francesco — sostituita da
`CostTable.tsx`, tabelle semplici senza stato client, più la terza vista per tipo di operazione.

**Aggiunta minore (stessa sessione):** modello visibile anche nella tabella per tipo di
operazione — `summarizeCostByCallType` raggruppa per (`call_type`, `model_name`) invece che solo
`call_type`, per non perdere l'informazione se lo stesso tipo di operazione passa a un modello
diverso nel tempo (es. upgrade del modello di generazione). `CostTable` mostra la colonna
"Modello" solo se almeno una riga la valorizza (le tabelle per gioco/utente restano senza).

Verificato: `npx tsc --noEmit`, `npx eslint`, `npx vitest run` (8 test in
`billing-aggregation.test.ts`, incluse `summarizeCostByUser`/`summarizeCostByCallType`) puliti.

**Aggiunta (stessa sessione): top 10 richieste per costo.** Francesco ha chiarito che "richiesta"
= singola domanda utente (`user_request`, già atomica), non un raggruppamento — le righe
espandibili qui mostrano le singole chiamate Gemini (`gemini_calls`) che compongono quella
domanda, non altre interazioni. Nuova `getTopRequestsByCost` (ordina `user_request_costs` per
costo decrescente, prende le prime N — default 10). Nuovo `components/admin/TopRequestsTable.tsx`
(Client Component, righe espandibili): colonne data/utente/gioco/costo totale, espansione mostra
tipo operazione/modello/costo per ogni chiamata. Diverso da `ExpandableCostTable` (rimosso in
precedenza): qui l'espansione è utile perché il dettaglio è a un livello sotto la riga (chiamate
dentro una domanda), non un doppione dell'aggregato.

Verificato: `npx tsc --noEmit`, `npx eslint`, `npx vitest run` (10 test, incluso
`getTopRequestsByCost`) puliti.

**Aggiunta (stessa sessione): tooltip informativo sul tipo di operazione.** Icona "i" accanto al
nome operazione, sia nella tabella "Distribuzione per tipo di operazione" sia nel dettaglio
espanso della tabella top 10, con una breve spiegazione di cosa fa quella chiamata (embedding,
generazione, contestualizzazione query, ecc.). Consolidate le due mappe `CALL_TYPE_LABELS`
duplicate (`page.tsx` e `TopRequestsTable.tsx`) in un unico
`lib/billing/service/call-type-labels.ts` (`getCallTypeLabel`/`getCallTypeDescription`).
`components/admin/InfoTooltip.tsx` (nuovo): icona + tooltip solo CSS (`group`/`group-hover`),
nessuno stato client — utilizzabile sia da `CostTable` (Server Component) sia da
`TopRequestsTable` (Client Component).

Verificato: `npx tsc --noEmit`, `npx eslint`, `npx vitest run` (10 test) puliti.

## DoD

- `/admin/costs` mostra tre tabelle di distribuzione (gioco, utente, tipo di operazione, con
  modello per riga in quest'ultima) più la tabella "Top 10 richieste per costo" con utente,
  gioco, costo totale, espandibile per vedere le singole chiamate Gemini (tipo, modello, costo).
- Icona info con tooltip esplicativo accanto al tipo di operazione, sia nella tabella di
  distribuzione sia nel dettaglio espanso della top 10.
- Nessuna etichetta "Gemini" nella UI del pannello.
- `tsc`/`eslint`/`vitest` puliti.

**Da verificare manualmente**: applicare la migration corretta (`user_id` in coda), aprire
`/admin/costs`, controllare che le tre tabelle mostrino dati reali coerenti.
