# Data flow

High-level chart of how data moves through the system. Drawn before any code is written.

Source: Divvy station status (GBFS), polled by the worker every 30 seconds.

```mermaid
flowchart LR
    SRC["<b>Data source</b><br/>Divvy GBFS<br/>station_status.json<br/>2,079 stations, refreshed ~60 s"]
    CRON["<b>Supabase Cron</b><br/>every 30 s"]
    W["<b>Worker</b><br/>Edge Function (Deno)<br/>fetch, compare, upsert changed rows only"]
    DB[("<b>Supabase Postgres</b><br/>stations<br/>station_status<br/>worker_runs<br/>follows (RLS)")]
    RT["<b>Supabase Realtime</b><br/>row changes pushed<br/>to open pages"]
    PAGE["<b>Page</b><br/>Next.js + Tailwind on Vercel<br/>live station cards,<br/>freshness banner"]
    CLERK["<b>Clerk</b><br/>sign-in"]

    CRON -- "invokes" --> W
    SRC -- "JSON (~760 KB)" --> W
    W -- "only changed rows<br/>(service role key)" --> DB
    W -- "one row per run:<br/>time, ok/failed, rows changed" --> DB
    DB -- "changes on followed stations" --> RT
    RT -- "websocket" --> PAGE
    PAGE -- "initial load, add/remove follows<br/>(anon key + Clerk token, RLS)" --> DB
    CLERK -- "user id in token" --> PAGE
```

## What each part sends to the next

| From | To | What | Notes |
| --- | --- | --- | --- |
| Divvy | Worker | Full status for every station: bikes, e-bikes, docks, disabled counts, renting/returning flags | The worker ignores `last_reported`, which changes on about 1,100 stations per poll when only about 120 really changed |
| Cron | Worker | An authenticated HTTP call every 30 s | About 86,000 calls a month, under the 500,000 free limit |
| Worker | Database | Upserts of only the stations whose counts or flags changed, plus one `worker_runs` row per run | Uses the Supabase secret key, which never goes in code |
| Database | Realtime | Row changes on `station_status` | Needs the table in the Realtime publication, read access granted, and an RLS policy letting a signed-in user read it |
| Realtime | Page | Changes pushed over a websocket | The page filters to the stations the user follows |
| Page | Database | The user's follows (read, add, remove) | RLS: a user sees and changes only their own rows |

## Tables

| Table | Holds | Who writes | Who reads |
| --- | --- | --- | --- |
| `stations` | Name, lat/lon, capacity (changes rarely) | Worker, on first run and occasionally after | Signed-in users |
| `station_status` | Current bikes, e-bikes, docks, disabled, renting/returning, `updated_at` | Worker | Signed-in users, and Realtime |
| `worker_runs` | When each run happened, success or failure, rows changed, error message | Worker | Page, for the freshness states |
| `follows` | A user's followed trip: an origin station, and optionally a destination station | The user | Only that user (RLS on the Clerk user id) |

## Follows: origin and optional destination

A follow is a trip, not just one station.

- **Origin:** the user wants a bike, so the page watches bikes available (and e-bikes).
- **Destination (optional):** the user wants to return the bike, so the page watches open docks. This warns about a full destination before the user rides.
- Single-station following is just a follow with no destination. Near-me or neighborhood grouping can be added later as another way to pick stations, with no change to the pipeline.

## Page states

| State | When | What the user sees |
| --- | --- | --- |
| Loading | Before the first data arrives | Skeleton cards |
| Fresh | The last run succeeded and was recent | Live data with "updated N seconds ago" |
| Stale | The newest successful run is older than a few missed runs (for example more than 2 minutes) | Data stays visible but is dimmed, with a clear "last updated" notice |
| Down | The worker's most recent run failed | A banner saying the feed is down and the data is the last known good |

A quiet feed is not stale. If runs keep succeeding but no stations change, the page stays fresh because freshness comes from `worker_runs`, not from the station data.

## What would break if one part changed

| If this changes | What breaks |
| --- | --- |
| Divvy changes its feed format or URL | The worker fails, so `worker_runs` records a failure and the page shows Down. Nothing else breaks. |
| Cron stops or slows | No new runs, so the page goes Stale, then still shows old data. |
| The worker upserts unchanged rows | Realtime messages and free-tier usage jump, roughly tenfold at the observed rates. |
| A table is missing from the Realtime publication, or has no read grant or RLS policy | The page gets no updates and no error. This is the most likely silent failure. |
| Clerk and Supabase aren't linked | Follows can't be read or written, because RLS can't see the user id. |
| `follows` loses its RLS | Users can see each other's trips. |
