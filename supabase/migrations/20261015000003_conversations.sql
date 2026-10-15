-- Phase 6: saved conversations for logged-in users.
-- Row Level Security (RLS) makes every row visible ONLY to the user who owns it,
-- enforced by Postgres itself, no matter what the app code does.

create table public.conversations (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title      text not null check (char_length(title) between 1 and 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index conversations_user_updated_idx on public.conversations (user_id, updated_at desc);

create table public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  role            text not null check (role in ('user', 'assistant')),
  content         text not null check (char_length(content) <= 20000),
  status          text check (status in ('answered', 'not_found', 'refused')), -- assistant only
  passages        jsonb, -- the verses the answer was allowed to use
  verification    jsonb, -- the server's citation check result
  created_at      timestamptz not null default now()
);

create index messages_conversation_idx on public.messages (conversation_id, created_at);

alter table public.conversations enable row level security;
alter table public.messages      enable row level security;

-- (select auth.uid()) is the logged-in user's id. Wrapping it in "select" lets Postgres
-- compute it once per query instead of once per row.

create policy "Users can read their own conversations"
  on public.conversations for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can create their own conversations"
  on public.conversations for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can rename their own conversations"
  on public.conversations for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own conversations"
  on public.conversations for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can read their own messages"
  on public.messages for select to authenticated
  using ((select auth.uid()) = user_id);

-- A message can only be added to a conversation the same user owns.
create policy "Users can add messages to their own conversations"
  on public.messages for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id and c.user_id = (select auth.uid())
    )
  );

-- No update policy on messages: saved answers can't be edited afterwards.
-- Deleting happens through the conversation (on delete cascade).

-- Logged-out visitors (anon) get no access at all.
grant select, insert, update, delete on public.conversations to authenticated;
grant select, insert on public.messages to authenticated;
revoke all on public.conversations, public.messages from anon;
