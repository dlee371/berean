-- Phase 2: Bible text tables.
-- Public, read-only data. Only the import script (using the secret key) writes here.

create table public.books (
  id            smallint primary key,               -- 1..66 in canonical order
  code          text not null unique,               -- 3-letter code used in the source file, e.g. 'JOH'
  name          text not null,                      -- 'John'
  slug          text not null unique,               -- 'john' (used in URLs)
  testament     text not null check (testament in ('OT', 'NT')),
  chapter_count smallint not null
);

create table public.verses (
  -- id encodes the reference: book * 1,000,000 + chapter * 1,000 + verse.
  -- John 3:16 → 43003016. Sorting by id gives canonical order.
  id       integer primary key,
  book_id  smallint not null references public.books (id),
  chapter  smallint not null,
  verse    smallint not null,
  text     text not null,                           -- exact WEB text, never edited
  -- Postgres keeps this search index column up to date automatically.
  search   tsvector generated always as (to_tsvector('english', text)) stored,
  unique (book_id, chapter, verse)
);

-- GIN index makes full-text search fast (used in Phase 3).
create index verses_search_idx on public.verses using gin (search);

-- Row Level Security: everyone may read, nobody may write through the API.
-- (There are no insert/update/delete policies, so those are denied.
--  The secret key used by the import script bypasses RLS.)
alter table public.books  enable row level security;
alter table public.verses enable row level security;

create policy "Books are readable by everyone"
  on public.books for select to anon, authenticated using (true);

create policy "Verses are readable by everyone"
  on public.verses for select to anon, authenticated using (true);

-- Make sure the API roles can see the tables (RLS still decides which rows).
grant select on public.books, public.verses to anon, authenticated;
grant all on public.books, public.verses to service_role;
