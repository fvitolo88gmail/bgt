# Epica BILLING — Modello di costo e monetizzazione

**Stato:** in corso — BILLING-00001 in pausa (schema `user_requests`/`gemini_calls` definito,
migration creata; istrumentazione codice sospesa in attesa di AUTH, v. D65)

## Contesto

Gemini rappresenta l'unico costo variabile del progetto (a differenza di infra tipo
Vercel/Supabase, più fissa/a scaglioni). Prima di poter tarare qualsiasi piano (abbonamento,
pacchetti crediti, soglia free-tier) serve conoscere il costo reale per query, misurato — non
stimato a tavolino.

**Decisioni:**
- BYOK utile per una fase di test con gruppo ristretto di amici (trust model accettabile per
  quel gruppo), non come modello di business scalabile
- Se si passa a chiave propria + monetizzazione: modello ibrido probabile (free tier a quota
  bassa + subscription flat come opzione principale; pay-per-token/crediti solo se emerge
  domanda reale)
- Nessun problema di reselling/ToS: usare Gemini come motore sotto un prodotto con valore
  aggiunto proprio (RAG, UX) è uso commerciale standard, non richiede accordi speciali

## Task

Vedi directory `BILLING/` per i task singoli.

| ID | Titolo | Stato |
|---|---|---|
| BILLING-00001 | Logging usage: tabelle `user_requests`/`gemini_calls` | in progress |
| BILLING-00002 | Pannello admin-only costi | todo |
| BILLING-00003 | Calcolo costo medio reale per query | todo |
| BILLING-00004 | Decisione modello di pricing | todo |
| BILLING-00005 | Gestione atomica saldo crediti (se applicabile) | todo |
| BILLING-00006 | Verifica compliance vendita crediti/abbonamento | todo |
| BILLING-00007 | BYOK per gruppo ristretto di tester | todo |
| BILLING-00008 | AI Provider Adapters (generazione, selezionabile per utente) | todo |

## Note aperte

- Rate limiting lato Gemini Tier1 (RPM) non ancora affrontato: da valutare se emerge come
  problema reale con l'aumento degli utenti
- Privacy sui log: valutare se `user_requests`/`gemini_calls` devono restare solo metadati
  aggregati (no contenuto query, già così nello schema attuale) se il prodotto scala oltre la
  cerchia di utenti fidati attuale
- **Proiezione costi con modello più evoluto (collegata a BILLING-00003)**: riapplicare i
  prezzi di un modello superiore (es. Gemini Pro) ai `prompt_token_count`/
  `candidates_token_count` già loggati con Flash-Lite dà una stima di prima approssimazione del
  costo/abbonamento con quel modello. Non è però un 1:1 esatto: tokenizer e lunghezza output
  possono differire tra modelli, e il prompt stesso potrebbe cambiare passando a un modello più
  capace. Da validare con un campione reale di chiamate sul modello superiore prima di fissare
  un prezzo definitivo — la proiezione sui log Flash-Lite serve solo da stima iniziale, non da
  numero finale. Nota collegata: la decisione se valga la pena il modello più costoso va presa
  con un A/B sull'eval harness esistente (qualità), non solo sul costo proiettato.
