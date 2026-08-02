# BILLING-00009 — Vista per utente + dettaglio modello nel pannello costi

**Blocca:** BILLING-00002 — ✅ done

## Task

Estendere il pannello `/admin/costs` (BILLING-00002):

- Nuova tabella "Distribuzione per utente" (stesso pattern di quella per gioco: interazioni,
  costo totale, costo medio), accanto a quella per gioco.
- Ogni riga delle tabelle di distribuzione (per gioco e per utente) è espandibile: al click
  mostra l'elenco delle interazioni che la compongono, con modello/i usato/i per interazione
  (una interazione può coinvolgere più chiamate con modelli diversi — es. embedding +
  generazione).
- Rinominare la pagina/le etichette: togliere ogni riferimento esplicito a "Gemini" (es. "Costi
  Gemini" → titolo generico), il modello resta visibile a livello di riga/dettaglio, non nel
  nome pagina — in vista di un possibile provider AI diverso in futuro (v. BILLING-00008, AI
  Provider Adapters).

## Implementazione

- Migration `supabase/migrations/20260802000000_user_request_costs_add_user.sql`: `create or
  replace view user_request_costs` con `user_id` aggiunto (stessa definizione, una colonna in
  più) — necessario per aggregare per utente, non solo per gioco. Non ancora applicata al DB.
- `lib/billing/repository/usage-tracking.repository.ts`: `UserRequestCostRow` guadagna `userId`;
  nuova `getGeminiCallCosts` legge `gemini_calls_costed` riga per riga (una per chiamata, con
  `model_name`) — necessaria perché un'interazione può coinvolgere più modelli (embedding +
  generazione), non riassumibile in `user_request_costs`.
- `lib/billing/service/billing-aggregation.ts`: nuova `summarizeCostByUser` (stesso pattern di
  `summarizeCostByGame`, esclude interazioni senza `user_id` risolto); nuova
  `buildInteractionDetails` che unisce interazioni e chiamate per produrre, per ogni
  interazione, l'elenco dei modelli distinti coinvolti.
- `components/admin/ExpandableCostTable.tsx` (nuovo, Client Component): tabella di distribuzione
  generica (riusata per gioco e utente) con righe espandibili al click, che mostrano il dettaglio
  delle interazioni (data, modalità, modello/i, stato, costo).
- `app/admin/costs/page.tsx`: aggiunta la tabella "Distribuzione per utente" (label da
  nome/cognome profilo, fallback a id troncato se non ancora impostato); entrambe le tabelle
  (gioco, utente) ora espandibili via `ExpandableCostTable`. Titolo pagina "Costi Gemini" →
  "Costi", nessun riferimento a "Gemini" rimasto nella UI (resta solo nei nomi interni di
  funzioni/tabelle che riflettono lo schema DB).

Verificato: `npx tsc --noEmit`, `npx eslint`, `npx vitest run` (8 test in
`billing-aggregation.test.ts`, incluse `summarizeCostByUser`/`buildInteractionDetails`) puliti.

## DoD

- `/admin/costs` mostra due tabelle di distribuzione (gioco, utente), entrambe espandibili con
  il dettaglio delle interazioni e dei modelli coinvolti.
- Nessuna etichetta "Gemini" nella UI del pannello; il nome del modello compare solo a livello di
  singola chiamata/interazione nel dettaglio espanso.
- `tsc`/`eslint`/`vitest` puliti.

**Da verificare manualmente**: applicare la migration, aprire `/admin/costs`, controllare che la
tabella per utente compaia con dati reali, che entrambe le tabelle si espandano al click
mostrando modello/i e costo per interazione.
