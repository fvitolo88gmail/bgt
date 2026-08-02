-- Epica CHAT-LISTING — CHAT-LISTING-00001 (naming conversazione)
-- Nessun vincolo DB su call_type (solo text not null, v. 20260731000000):
-- aggiorna solo il commento di documentazione con il nuovo valore usato dal
-- generatore di titolo del primo turno (lib/chat/service/title-generation.ts).

comment on column gemini_calls.call_type is
    'embedding | generation | query_contextualization | query_enhancement | reranking | title_generation';
