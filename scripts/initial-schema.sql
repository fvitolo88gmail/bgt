-- enable pgvector
create extension if not exists vector;

-- games
create table games (
                       id uuid primary key default gen_random_uuid(),
                       bgg_id int unique,
                       name text not null,
                       owner_token uuid null,
                       visibility text not null default 'private',
                       manual_ready boolean not null default false,
                       forum_ready boolean not null default false,
                       last_forum_sync timestamptz,
                       created_at timestamptz not null default now()
);

-- chunks
create table chunks (
                        id uuid primary key default gen_random_uuid(),
                        game_id uuid not null references games(id) on delete cascade,
                        source text not null,
                        content text not null,
                        embedding vector(768),
                        model_version text,
                        page int,
                        section text,
                        bgg_thread_id int,
                        bgg_article_id int,
                        thread_subject text,
                        author_username text,
                        is_designer_response boolean,
                        post_date timestamptz,
                        created_at timestamptz not null default now()
);

-- forum_threads
create table forum_threads (
                               id uuid primary key default gen_random_uuid(),
                               game_id uuid not null references games(id) on delete cascade,
                               bgg_thread_id int unique not null,
                               subject text,
                               reply_count int,
                               fetched_at timestamptz
);

-- indici
create index on chunks using ivfflat (embedding vector_cosine_ops) with (lists = 100);
create index on chunks (game_id, source);
create index on games (owner_token);
create index on games (visibility);
create unique index on chunks (game_id, page, section) where source = 'manual';
create unique index on chunks (bgg_article_id) where source = 'forum';