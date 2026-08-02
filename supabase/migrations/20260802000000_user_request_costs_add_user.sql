-- BILLING-00009: aggiunge user_id a user_request_costs, necessario per la
-- distribuzione per utente nel pannello admin (finora solo per gioco).
-- CREATE OR REPLACE VIEW: Postgres richiede che le colonne esistenti restino
-- nella stessa posizione, la nuova va aggiunta in coda (non tra game_id e
-- mode come nella prima stesura, che falliva con errore 42P16).
create or replace view user_request_costs
    with (security_invoker = true)
    as
    select
        ur.id as user_request_id,
        ur.game_id,
        ur.mode,
        ur.status,
        ur.created_at,
        coalesce(sum(gcc.cost_usd), 0) as total_cost_usd,
        ur.user_id
    from user_requests ur
    left join gemini_calls_costed gcc on gcc.user_request_id = ur.id
    group by ur.id, ur.game_id, ur.mode, ur.status, ur.created_at, ur.user_id;
