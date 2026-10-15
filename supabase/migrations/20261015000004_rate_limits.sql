-- Phase 7: rate limiting for /api/chat, so a public deployment can't run up the Claude bill.
--
-- Counts requests per key (a hashed IP address, or "global") per time window.
-- Lives in Postgres because on Vercel each request may run on a different server,
-- so counters kept in memory wouldn't add up.

create schema if not exists private; -- not exposed through the Supabase API

create table private.rate_limits (
  key          text not null,
  window_start timestamptz not null,
  count        integer not null default 0,
  primary key (key, window_start)
);

-- Records one request and returns true if it's within the limit.
--   select check_rate_limit('ip:abc123', 20, 3600);  -- 20 per hour
create or replace function public.check_rate_limit(p_key text, p_limit int, p_window_seconds int)
returns boolean
language plpgsql
security definer          -- runs with the owner's rights, so it can write to private.rate_limits
set search_path = ''
as $$
declare
  v_window timestamptz := to_timestamp(
    floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds
  );
  v_count integer;
begin
  insert into private.rate_limits as r (key, window_start, count)
  values (p_key, v_window, 1)
  on conflict (key, window_start) do update set count = r.count + 1
  returning r.count into v_count;

  -- Now and then, clear out windows older than two days.
  if random() < 0.01 then
    delete from private.rate_limits where window_start < now() - interval '2 days';
  end if;

  return v_count <= p_limit;
end;
$$;

-- Only the server (secret key) may call it. Otherwise anyone could burn through
-- someone else's allowance by calling it directly.
revoke all on function public.check_rate_limit(text, int, int) from public, anon, authenticated;
grant execute on function public.check_rate_limit(text, int, int) to service_role;
