-- Migration 6: reverse migration 5. The live data is readable by signed-in users only.
-- Decision: a public link would let anyone open Realtime connections against the free
-- project, so the site requires an account to use. Migration 5 stays in the history.

revoke select on public.stations, public.station_status, public.worker_runs from anon;

drop policy "anyone reads stations" on public.stations;
drop policy "anyone reads station_status" on public.station_status;
drop policy "anyone reads worker_runs" on public.worker_runs;

create policy "signed-in users read stations"
  on public.stations for select to authenticated using (true);
create policy "signed-in users read station_status"
  on public.station_status for select to authenticated using (true);
create policy "signed-in users read worker_runs"
  on public.worker_runs for select to authenticated using (true);
