-- Migration 2: tighten grants.
-- Supabase gives new tables broad default privileges to anon and authenticated.
-- Migration 1 only added to them. Row-level security does not cover TRUNCATE, so
-- revoke everything from signed-in users and grant back only what the app needs.

revoke all on public.stations, public.station_status, public.worker_runs, public.follows
  from anon, authenticated;

grant select on public.stations, public.station_status, public.worker_runs to authenticated;
grant select, insert, delete on public.follows to authenticated;
