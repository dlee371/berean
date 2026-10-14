-- Phase 3: full-text verse search.
--
-- Takes a list of search terms (words or short phrases), matches verses containing
-- ANY of them, and ranks verses that match more terms (or match them closer together) higher.
--
--   select * from search_verses(array['anxious', 'worry', 'cast your burden'], 12);

create or replace function public.search_verses(terms text[], match_count int default 12)
returns table (
  id      integer,
  book_id smallint,
  chapter smallint,
  verse   smallint,
  text    text,
  rank    real
)
language sql
stable
set search_path = ''
as $$
  with query as (
    -- Turn each term into a phrase query ('cast your burden' → 'cast' <2> 'burden'),
    -- drop terms that are only stopwords ("the", "of"), and OR them together with |.
    -- The final ::tsquery cast parses the already-stemmed text without stemming it again.
    select nullif(
      string_agg('(' || q::text || ')', ' | '),
      ''
    )::tsquery as q
    from (
      select pg_catalog.phraseto_tsquery('english', term) as q
      from unnest(terms) as term
    ) as parts
    where q::text <> ''
  )
  select v.id, v.book_id, v.chapter, v.verse, v.text,
         pg_catalog.ts_rank_cd(v.search, query.q) as rank
  from public.verses as v, query
  where query.q is not null
    and v.search @@ query.q
  order by rank desc, v.id
  limit least(greatest(match_count, 1), 50);
$$;

-- Runs with the caller's permissions, so the verses table's read-only RLS still applies.
grant execute on function public.search_verses(text[], int) to anon, authenticated;
