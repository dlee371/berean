-- Row Level Security check: "can user B see user A's conversations?"
--
-- 1. Sign in to Berean with two different email addresses (A and B) and save a chat with A.
-- 2. In Supabase: Authentication → Users, copy user B's id ("UID").
-- 3. Paste it below in place of USER_B_ID, then run this whole file in the SQL Editor.
--
-- It pretends to be user B for one transaction (exactly how the app's requests run),
-- then rolls back so nothing changes.
-- Expected: others_conversations = 0 and others_messages = 0.

begin;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "USER_B_ID", "role": "authenticated"}', true);

select
  (select count(*) from public.conversations)                                as my_conversations,
  (select count(*) from public.conversations where user_id <> auth.uid())    as others_conversations,
  (select count(*) from public.messages where user_id <> auth.uid())         as others_messages;

rollback;
