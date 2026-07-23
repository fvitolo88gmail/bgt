--1. Migration — designer flag per singolo post (richiede conferma esplicita, tocca schema)
alter table forum_posts add column is_designer_response boolean not null default false;

--Backfill per Brass Birmingham (dati già ingested, non serve rifare fetch/ingest)
update forum_posts
set is_designer_response = true
where game_id = '87bb1782-dac5-4e5e-a916-9a82efa00868'
  and lower(trim(author_username)) in ('gavan brown', 'matt tolman', 'martin wallace');