-- Migration 1: core tables, row-level security, Realtime, and the changed-rows-only upsert.
-- See docs/data-flow.md.

-- ---------------------------------------------------------------------------
-- stations: names and locations. Changes rarely. Written by the worker.
-- ---------------------------------------------------------------------------
create table public.stations (
  station_id text primary key,
  name       text not null,
  short_name text,
  lat        double precision,
  lon        double precision,
  capacity   integer,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- station_status: current counts for each station. Written by the worker, and only
-- when something changed (see apply_station_status below). Pushed through Realtime.
-- No foreign key to stations: the status feed can list a station before the
-- information feed does, and a failed insert would fail the whole run.
-- ---------------------------------------------------------------------------
create table public.station_status (
  station_id      text primary key,
  bikes_available integer not null,
  ebikes_available integer not null,
  docks_available integer not null,
  bikes_disabled  integer not null,
  docks_disabled  integer not null,
  is_renting      boolean not null,
  is_returning    boolean not null,
  updated_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- worker_runs: one row per worker run. The page's freshness states come from here.
-- ---------------------------------------------------------------------------
create table public.worker_runs (
  id            bigint generated always as identity primary key,
  started_at    timestamptz not null default now(),
  finished_at   timestamptz,
  ok            boolean not null,
  stations_seen integer not null default 0,
  rows_changed  integer not null default 0,
  duration_ms   integer,
  error         text
);
create index worker_runs_started_at_idx on public.worker_runs (started_at desc);

-- ---------------------------------------------------------------------------
-- follows: a user's followed trip. Origin is where they want a bike, destination
-- (optional) is where they want an open dock. Private per Clerk user id.
-- ---------------------------------------------------------------------------
create table public.follows (
  id                     uuid primary key default gen_random_uuid(),
  user_id                text not null default (auth.jwt() ->> 'sub'),
  origin_station_id      text not null,
  destination_station_id text,
  created_at             timestamptz not null default now(),
  constraint follows_different_stations
    check (destination_station_id is null or destination_station_id <> origin_station_id),
  constraint follows_unique_trip
    unique nulls not distinct (user_id, origin_station_id, destination_station_id)
);

-- At most 20 follows per user: keeps the Realtime filter well under its 100-value
-- limit (2 stations per follow) and protects the free-tier message quota.
create function public.enforce_follow_cap()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select count(*) from public.follows where user_id = new.user_id) >= 20 then
    raise exception 'You can follow at most 20 trips';
  end if;
  return new;
end;
$$;

create trigger follows_cap
  before insert on public.follows
  for each row execute function public.enforce_follow_cap();

-- ---------------------------------------------------------------------------
-- Row-level security. Everything is on; nothing is readable without a policy.
-- ---------------------------------------------------------------------------
alter table public.stations       enable row level security;
alter table public.station_status enable row level security;
alter table public.worker_runs    enable row level security;
alter table public.follows        enable row level security;

-- Shared live data: any signed-in user can read, nobody but the worker can write.
create policy "signed-in users read stations"
  on public.stations for select to authenticated using (true);
create policy "signed-in users read station_status"
  on public.station_status for select to authenticated using (true);
create policy "signed-in users read worker_runs"
  on public.worker_runs for select to authenticated using (true);

-- Follows: a user sees and changes only their own rows.
create policy "users read own follows"
  on public.follows for select to authenticated
  using (user_id = (select auth.jwt() ->> 'sub'));
create policy "users add own follows"
  on public.follows for insert to authenticated
  with check (user_id = (select auth.jwt() ->> 'sub'));
create policy "users delete own follows"
  on public.follows for delete to authenticated
  using (user_id = (select auth.jwt() ->> 'sub'));

-- ---------------------------------------------------------------------------
-- Grants. Row-level security is not enough on its own: without a grant the
-- role cannot touch the table at all. Signed-out visitors (anon) get nothing.
-- ---------------------------------------------------------------------------
revoke all on public.stations, public.station_status, public.worker_runs, public.follows from anon;

grant select on public.stations, public.station_status, public.worker_runs to authenticated;
grant select, insert, delete on public.follows to authenticated;

-- The worker uses the service role, which bypasses row-level security but still needs grants.
grant all on public.stations, public.station_status, public.worker_runs, public.follows to service_role;
grant usage, select on all sequences in schema public to service_role;

-- ---------------------------------------------------------------------------
-- Realtime. A table must be in the publication to be pushed to pages.
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table public.station_status, public.worker_runs;

-- ---------------------------------------------------------------------------
-- apply_station_status: the "save only what changed" step.
-- The worker sends every station in one call. The WHERE clause skips rows whose
-- values are identical, so unchanged stations are not written, produce no change
-- record, and send no Realtime message. Returns the number of rows changed.
-- ---------------------------------------------------------------------------
create function public.apply_station_status(rows jsonb)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  changed integer;
begin
  with incoming as (
    select * from jsonb_to_recordset(rows) as r(
      station_id text,
      bikes_available integer,
      ebikes_available integer,
      docks_available integer,
      bikes_disabled integer,
      docks_disabled integer,
      is_renting boolean,
      is_returning boolean
    )
  ), upserted as (
    insert into public.station_status as s (
      station_id, bikes_available, ebikes_available, docks_available,
      bikes_disabled, docks_disabled, is_renting, is_returning
    )
    select station_id, bikes_available, ebikes_available, docks_available,
           bikes_disabled, docks_disabled, is_renting, is_returning
    from incoming
    on conflict (station_id) do update set
      bikes_available  = excluded.bikes_available,
      ebikes_available = excluded.ebikes_available,
      docks_available  = excluded.docks_available,
      bikes_disabled   = excluded.bikes_disabled,
      docks_disabled   = excluded.docks_disabled,
      is_renting       = excluded.is_renting,
      is_returning     = excluded.is_returning,
      updated_at       = now()
    where (s.bikes_available, s.ebikes_available, s.docks_available, s.bikes_disabled,
           s.docks_disabled, s.is_renting, s.is_returning)
      is distinct from
          (excluded.bikes_available, excluded.ebikes_available, excluded.docks_available,
           excluded.bikes_disabled, excluded.docks_disabled, excluded.is_renting,
           excluded.is_returning)
    returning 1
  )
  select count(*) into changed from upserted;
  return changed;
end;
$$;

-- Only the worker (service role) may call it.
revoke execute on function public.apply_station_status(jsonb) from public, anon, authenticated;
grant execute on function public.apply_station_status(jsonb) to service_role;
