-- BILLING-00002: costo totale per interazione, pre-aggregato per il pannello
-- admin (costo medio/query, distribuzione per gioco, andamento nel tempo) —
-- evita di rifare la somma su gemini_calls_costed a ogni query del pannello.
-- security_invoker: rispetta le RLS admin-only ereditate da user_requests/
-- gemini_calls, non i permessi del proprietario della vista.
create view user_request_costs
    with (security_invoker = true)
    as
    select
        ur.id as user_request_id,
        ur.game_id,
        ur.mode,
        ur.status,
        ur.created_at,
        coalesce(sum(gcc.cost_usd), 0) as total_cost_usd
    from user_requests ur
    left join gemini_calls_costed gcc on gcc.user_request_id = ur.id
    group by ur.id, ur.game_id, ur.mode, ur.status, ur.created_at;
