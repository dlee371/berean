-- Phase 3: full-text verse search.
--
-- Takes a list of search terms (words or short phrases) and returns verses that match
-- any of them, ranked by how RARE the matched terms are across the whole Bible.
--
-- Why rarity: a verse containing the uncommon word "anxious" is far more likely to be about
-- anxiety than one containing the very common word "afraid". Each term is weighted by
-- ln(total verses / verses containing it), the classic IDF ("inverse document frequency")
-- idea behind search engines. A verse's score is the sum of the weights of the distinct
-- terms it contains, so verses matching several rare terms rise to the top. Matches in the
-- 2 verses on either side also count, so whole passages about the topic rank highest.
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
  with term_queries as (
    -- Each term becomes a phrase query ('cast your burden' → 'cast' <2> 'burden').
    -- Terms made only of stopwords ("the", "of") produce an empty query and are dropped.
    select distinct pg_catalog.phraseto_tsquery('english', term) as q
    from unnest(terms) as term
  ),
  usable as (
    select q from term_queries where q::text <> ''
  ),
  matches as (
    -- Every (verse, term) pair where the verse contains the term. Uses the GIN index.
    select v.id, u.q
    from usable as u
    join public.verses as v on v.search @@ u.q
  ),
  weights as (
    -- IDF weight per term: rare terms get big weights, common terms small ones.
    select q, ln((select count(*) from public.verses)::numeric / count(*)) as weight
    from matches
    group by q
  ),
  verse_scores as (
    -- Score of each matching verse on its own.
    select m.id, sum(w.weight) as score
    from matches as m
    join weights as w on w.q = m.q
    group by m.id
  ),
  window_terms as (
    -- Passage context: each match also counts toward the verses up to 2 before and after it
    -- (ids are consecutive within a chapter). So a story whose key words are spread over
    -- several verses, like the parable of the sower, outranks a lone verse with one word.
    select distinct m.id + o.offset_by as id, m.q
    from matches as m
    cross join generate_series(-2, 2) as o(offset_by)
  ),
  window_scores as (
    select wt.id, sum(w.weight) as score
    from window_terms as wt
    join weights as w on w.q = wt.q
    group by wt.id
  )
  -- Final rank = the verse's own score + its passage's score. Only verses that contain
  -- a term themselves are returned.
  select v.id, v.book_id, v.chapter, v.verse, v.text, (vs.score + ws.score)::real as rank
  from verse_scores as vs
  join window_scores as ws on ws.id = vs.id
  join public.verses as v on v.id = vs.id
  order by rank desc, v.id
  limit least(greatest(match_count, 1), 50);
$$;

-- Runs with the caller's permissions, so the verses table's read-only RLS still applies.
grant execute on function public.search_verses(text[], int) to anon, authenticated;
