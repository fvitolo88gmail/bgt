-- Epica BILLING — BILLING-00001
-- Tracking uso Gemini: un'interazione utente (user_requests) raggruppa tutte
-- le chiamate Gemini che la compongono (gemini_calls), embedding + generation
-- + chiamate di supporto al retrieval (contestualizzazione query, query
-- enhancement HyDE/decomposizione, reranking).
--
-- Prezzi in tabella a parte (model_pricing) con periodo di validità, non
-- congelati per riga su gemini_calls: un aggiornamento tardivo del prezzo
-- (scoperto dopo che è già cambiato) può correggere retroattivamente il
-- costo storico via il periodo corretto, invece di lasciare per sempre
-- sbagliate le righe già inserite con un prezzo snapshot.

create table user_requests (
    id uuid primary key default gen_random_uuid(),
    game_id uuid not null references games(id) on delete cascade,
    session_id uuid null references chat_sessions(id) on delete set null,
    user_id uuid null references profiles(id) on delete set null, -- nullable per coerenza con games/chat_sessions (on delete set null), sempre valorizzato in pratica: l'intera app richiede sessione (AUTH-00011)
    mode text not null, -- 'qa' | 'conversation'
    chunks_retrieved_count int null,
    status text not null default 'success', -- 'success' | 'error'
    created_at timestamptz not null default now()
);

create table gemini_calls (
    id uuid primary key default gen_random_uuid(),
    user_request_id uuid not null references user_requests(id) on delete cascade,
    call_type text not null, -- 'embedding' | 'generation' | 'query_contextualization' | 'query_enhancement' | 'reranking'
    model_name text not null,
    prompt_token_count int null,
    candidates_token_count int null,
    cached_token_count int null,
    status text not null, -- 'success' | 'error' | 'timeout'
    retry_count int not null default 0,
    created_at timestamptz not null default now()
);

-- prezzi per modello con periodo di validità: al più un periodo "aperto"
-- (effective_to null) per modello alla volta — chiudere il vecchio periodo
-- (impostare effective_to = now()) prima di inserirne uno nuovo quando
-- cambia un prezzo, processo manuale via Studio per ora (stesso pattern
-- interinale già usato da AUTH per gli inviti).
create table model_pricing (
    id uuid primary key default gen_random_uuid(),
    model_name text not null,
    price_input_per_1m numeric not null,
    price_output_per_1m numeric null, -- null per i modelli di solo embedding
    effective_from timestamptz not null default now(),
    effective_to timestamptz null,
    created_at timestamptz not null default now()
);

create unique index model_pricing_one_open_period on model_pricing (model_name) where effective_to is null;
create index on model_pricing (model_name, effective_from);

-- prezzi Tier 1 raccolti a tavolino (v. docs/epics/progress/BILLING/BILLING.md) — proiezione
-- usata anche mentre le chiamate reali girano sul piano free (costo reale $0).
insert into model_pricing (model_name, price_input_per_1m, price_output_per_1m, effective_from) values
    ('gemini-embedding-001', 0.15, null, now()),
    ('gemini-3.1-flash-lite', 0.25, 1.50, now());

-- costo per chiamata: join sul periodo di validità in vigore al momento
-- della chiamata, non un valore congelato — resta corretto se model_pricing
-- viene corretta a posteriori. security_invoker: la vista deve rispettare le
-- RLS admin-only di gemini_calls, non quelle del proprietario della vista.
create view gemini_calls_costed
    with (security_invoker = true)
    as
    select
        gc.*,
        mp.price_input_per_1m,
        mp.price_output_per_1m,
        (
            (coalesce(gc.prompt_token_count, 0) / 1000000.0) * coalesce(mp.price_input_per_1m, 0)
            + (coalesce(gc.candidates_token_count, 0) / 1000000.0) * coalesce(mp.price_output_per_1m, 0)
        ) as cost_usd
    from gemini_calls gc
    left join model_pricing mp
        on mp.model_name = gc.model_name
        and gc.created_at >= mp.effective_from
        and (mp.effective_to is null or gc.created_at < mp.effective_to);

-- costo totale per interazione: sum(cost_usd) from gemini_calls_costed group by user_request_id
create index on gemini_calls (user_request_id);
create index on user_requests (game_id, created_at);
create index on user_requests (session_id);
create index on user_requests (user_id);

-- RLS: log interni, nessun accesso diretto utente. Solo service role (bypassa RLS) o admin.
alter table user_requests enable row level security;
alter table gemini_calls enable row level security;
alter table model_pricing enable row level security;

create policy "user_requests_select_admin_only" on user_requests
    for select using (is_admin());

create policy "gemini_calls_select_admin_only" on gemini_calls
    for select using (is_admin());

create policy "model_pricing_select_admin_only" on model_pricing
    for select using (is_admin());
