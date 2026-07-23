-- supabase/migrations/{timestamp}_forum_posts.sql
create table forum_posts (
                             id uuid primary key default gen_random_uuid(),
                             game_id uuid not null references games(id) on delete cascade,
                             bgg_thread_id int not null references forum_threads(bgg_thread_id),
                             bgg_article_id int not null,
                             author_username text not null,
                             quoted_author text,
                             post_date timestamptz,
                             body_clean text not null,
                             created_at timestamptz default now()
);

create unique index on forum_posts (bgg_article_id);
create index on forum_posts (bgg_thread_id);