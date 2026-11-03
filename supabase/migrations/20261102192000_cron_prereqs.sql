-- Migration 3: what Supabase Cron needs before the worker can be scheduled.
-- The schedule itself comes later, after the worker has been deployed and called once by hand.

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

-- A random secret that proves a request to the worker came from Supabase Cron.
-- It is generated here, stored encrypted in Vault, and never appears in the repo,
-- in a log, or in any other file. The cron job reads it from Vault to send it; the
-- worker asks the database (cron_secret_ok) whether the one it received matches.
select vault.create_secret(
  encode(extensions.gen_random_bytes(32), 'hex'),
  'cron_secret',
  'Shared secret: pg_cron sends it, poll-divvy checks it'
)
where not exists (select 1 from vault.secrets where name = 'cron_secret');

create function public.cron_secret_ok(candidate text)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select coalesce(
    (select decrypted_secret = candidate
       from vault.decrypted_secrets
      where name = 'cron_secret'),
    false
  );
$$;

-- Only the worker (service role) may ask.
revoke execute on function public.cron_secret_ok(text) from public, anon, authenticated;
grant execute on function public.cron_secret_ok(text) to service_role;
