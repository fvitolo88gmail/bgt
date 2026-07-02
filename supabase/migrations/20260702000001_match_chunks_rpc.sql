create or replace function match_chunks(
  query_embedding vector(768),
  match_game_id uuid,
  match_count int default 5,
  filter_source text default null
)
returns table (
  id uuid,
  game_id uuid,
  source text,
  content text,
  page int,
  section text,
  bgg_thread_id int,
  bgg_article_id int,
  thread_subject text,
  author_username text,
  is_designer_response boolean,
  post_date timestamptz,
  similarity float
)
language sql stable
as $$
select
    c.id,
    c.game_id,
    c.source,
    c.content,
    c.page,
    c.section,
    c.bgg_thread_id,
    c.bgg_article_id,
    c.thread_subject,
    c.author_username,
    c.is_designer_response,
    c.post_date,
    1 - (c.embedding <=> query_embedding) as similarity
from chunks c
         inner join games g on g.id = c.game_id
where
    c.game_id = match_game_id
  and (filter_source is null or c.source = filter_source)
order by c.embedding <=> query_embedding
  limit match_count;
$$;