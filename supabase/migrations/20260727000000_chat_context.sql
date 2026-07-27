-- Epica 0900 (Chat con contesto) — C1
-- Sessione chiavata solo su game_id per ora (owner_token non implementato — v. D43).
-- owner_token resta nullable per compatibilità futura con D16/architecture.md, non popolato.

create table chat_sessions (
                               id uuid primary key default gen_random_uuid(),
                               game_id uuid not null references games(id) on delete cascade,
                               owner_token uuid null,
                               created_at timestamptz not null default now()
);

create table chat_messages (
                               id uuid primary key default gen_random_uuid(),
                               session_id uuid not null references chat_sessions(id) on delete cascade,
                               role text not null,
                               content text not null,
                               created_at timestamptz not null default now()
);

-- una sessione per gioco (scope corrente: nessun owner_token)
create unique index on chat_sessions (game_id) where owner_token is null;

-- lettura history in ordine cronologico per sessione
create index on chat_messages (session_id, created_at);
