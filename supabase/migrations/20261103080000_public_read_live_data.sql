-- Migration 5: let signed-out visitors read the shared live data.
-- Stations, their current status, and the worker's run log are public Divvy data, so
-- anyone may watch them. Saving a trip still needs an account: `follows` is untouched,
-- stays private to its owner, and signed-out visitors (anon) have no access to it.

-- Grants first (row-level security is not enough on its own: without a grant the role
-- cannot touch the table at all).
grant select on public.stations, public.station_status, public.worker_runs to anon;

-- Replace the "signed-in users only" read policies with ones covering visitors too.
drop policy "signed-in users read stations" on public.stations;
drop policy "signed-in users read station_status" on public.station_status;
drop policy "signed-in users read worker_runs" on public.worker_runs;

create policy "anyone reads stations"
  on public.stations for select to anon, authenticated using (true);
create policy "anyone reads station_status"
  on public.station_status for select to anon, authenticated using (true);
create policy "anyone reads worker_runs"
  on public.worker_runs for select to anon, authenticated using (true);
