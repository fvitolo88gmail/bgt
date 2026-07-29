-- richieste di accesso da chi vuole registrarsi (signup pubblico disabilitato lato config
-- Supabase Auth, non qui) — l'admin le rivede e invita chi approva col meccanismo nativo
-- Supabase (Studio o inviteUserByEmail), nessuna tabella custom per l'invito vero e proprio
create type invite_request_status as enum ('pending', 'invited', 'rejected');

create table invite_requests (
    id uuid primary key default gen_random_uuid(),
    email text not null,
    message text,
    status invite_request_status not null default 'pending',
    created_at timestamptz not null default now()
);

alter table invite_requests enable row level security;

-- chiunque, anche anonimo, può inserire una richiesta
create policy "invite_requests_insert_anyone" on invite_requests
    for insert with check (true);

-- solo l'admin legge/aggiorna la coda (is_admin() già definita in 20260729020000_rls_policies.sql)
create policy "invite_requests_select_admin" on invite_requests
    for select using (is_admin());

create policy "invite_requests_update_admin" on invite_requests
    for update using (is_admin())
    with check (is_admin());
