# Divvy Live

Live Chicago Divvy bike stations. Sign in, follow a trip (where you pick up a bike, and optionally where you plan to drop it off), and watch bikes and open docks change on the page without refreshing.

- **Live site:** https://assign5-iota.vercel.app (sign in with just your email and a code, no password)
- **Course:** MPCS 51238 Design, Build, Ship, Assignment 5: Live Data System
- **Data flow chart:** [docs/data-flow.md](docs/data-flow.md), drawn before any code was written

## How it works

```
 Divvy feed ──▶ Worker ──▶ Database ──▶ Realtime ──▶ Page
 (changes)     (every 30 s)  (changed rows   (pushes each    (updates on
                              only)           change)         its own)
```

| Part | What it is | What it does |
| --- | --- | --- |
| Data source | Divvy's public GBFS feed, `station_status.json` | About 2,079 stations, refreshed by Divvy about once a minute. No API key. |
| Worker | A Supabase Edge Function (`supabase/functions/poll-divvy`) run by Supabase Cron every 30 seconds | Fetches the feed, sends every station to the database, and logs the run |
| Database | Supabase Postgres | `apply_station_status()` writes only the stations whose numbers changed. `worker_runs` records every run. |
| Realtime | Supabase Realtime | Pushes each change to the pages that follow that station |
| Page | Next.js and Tailwind on Vercel | Shows a card per followed trip and a banner saying how current the data is |
| Sign-in | Clerk | Email and a one-time code. Clerk is linked to Supabase, so the database knows who is asking. |

### Tracing one change, from the bike dock to the screen

1. Someone takes a bike at a Divvy station. Divvy's feed changes within about a minute.
2. Supabase Cron calls the worker (every 30 s, with a secret from Vault that the database checks, so only Cron can trigger it).
3. The worker fetches the feed and sends all stations to `apply_station_status()` in one call. About 6% have really changed per refresh, and only those are written. Unchanged stations produce no write and so no Realtime message. A typical run takes about 200 ms.
4. The write puts a row change on `station_status`. The worker also adds a `worker_runs` row recording the time, success or failure, and how many rows changed.
5. Realtime sends the change to every open page that follows that station. The subscription is filtered on the server, so a page never receives the other ~2,000 stations.
6. The page updates the card, highlights the number that changed, and resets "Changed N s ago". It also sees the new `worker_runs` row and refreshes the freshness banner.

### How someone knows the data is current

The page does not judge freshness from the bike numbers, because a quiet night means few changes and that is not a problem. It reads the worker's own run log:

| State | When | What the user sees |
| --- | --- | --- |
| Loading | The run log has not loaded yet | "Checking that the data is current…" |
| Fresh | The latest run succeeded within the last 2 minutes (four missed runs) | Green "Live", "Checked 12 s ago" |
| Stale | The latest successful run is older than 2 minutes, or there are no runs | Amber "These numbers may be out of date", with the last check time. The cards dim. |
| Down | The latest run failed | Red "Divvy's data feed is not responding", with the error and the last known numbers. The cards dim. |

All four states, including stale and down, were produced and watched on the live site (see "What the testing and logs showed").

### What would break if one part changed

See the table at the end of [docs/data-flow.md](docs/data-flow.md). The most dangerous one is silent: if `station_status` is missing from the Realtime publication, has no read grant, or has no read policy, the page gets no updates and no error. All three were checked directly in the database.

## Tech stack

Next.js (App Router), React, TypeScript, Tailwind CSS · Clerk · Supabase (Postgres, Realtime, Cron, Edge Functions, Vault) · Vercel Hobby (free). Everything runs on free tiers with no payment method on file.

## Repository layout

```
src/app/                       Pages and the Clerk sign-in and sign-up routes
src/components/                Header, Home, TripForm, TripBoard, TripCard, FreshnessBanner, StationPicker
src/lib/                       Supabase client, live data hooks, freshness rules, token and time helpers (+ tests)
supabase/functions/poll-divvy/ The worker: index.ts (Deno entry), poll.ts and divvy.ts (logic), tests, saved Divvy responses
supabase/migrations/           Six SQL migrations, in order
docs/data-flow.md              The data-flow chart and tables
AGENTS.md                      Project context for the coding agent
```

### Database

| Table | Holds | Access |
| --- | --- | --- |
| `stations` | Names and locations | Signed-in users read; the worker writes |
| `station_status` | Current bikes, e-bikes, docks, flags | Signed-in users read; the worker writes (through `apply_station_status`) |
| `worker_runs` | One row per worker run | Signed-in users read; the worker writes |
| `follows` | A user's trips (origin, optional destination) | Each user reads, adds and deletes only their own rows (row-level security on the Clerk user id), at most 20 each |

Migrations: 1 core tables and policies, 2 tighter grants, 3 Cron prerequisites and secret, 4 the 30-second schedule, 5 public read access, 6 reverse of 5. Number 5 was an experiment that let signed-out visitors watch live data; it was reversed in 6 because a public link could use up the free Realtime quota. Both stay in the history on purpose.

## Running it yourself

Developed on Node 24.6. The tests run TypeScript files directly with Node's built-in type stripping, so use a recent release.

```bash
npm install
cp .env.example .env.local    # then fill in the four values below
npm run dev                    # http://localhost:3000
```

| Variable | Where from |
| --- | --- |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` | Clerk dashboard, API keys |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase dashboard, Project Settings, API |

The Supabase secret (service role) key is never in this repo or on Vercel. Supabase supplies it to the worker on its own servers. To rebuild the backend: create a Supabase project, run the migrations in order, link Clerk under Authentication, Third-Party Auth, and deploy `supabase/functions/poll-divvy` with JWT verification off (the function checks the Cron secret itself).

| Command | What it does |
| --- | --- |
| `npm test` | Runs the 36 tests with Node's built-in runner, no extra packages |
| `npm run lint` | ESLint |
| `npm run build` | Production build, including the TypeScript check |

## Design

- **Colours:** the Chicago flag's sky blue and red, with a deeper blue for buttons and links so white text on them stays readable. The header carries the flag's two blue stripes with its four red stars, drawn in the flag's own proportions (six long, narrow points), and faint line-drawn bicycles sit behind the page. Light and dark themes follow the system setting.
- **Live data needs clear states.** Fresh, stale and down each have their own wording and icon, and the cards dim when the numbers may be old, so a stale number never looks as trustworthy as a live one. A number that has just changed is highlighted for five seconds, so a change catches the eye.
- **Colour is never the only signal.** Every state and warning also has words or an icon ("▲ These numbers may be out of date", "No open docks. The station is full.").
- **Contrast:** every text and background pair in both themes was checked against the WCAG AA standard (4.5:1). The lowest in light mode is the amber warning, at 5.0:1.
- **Keyboard:** controls keep a visible focus outline, and the station search is a normal labelled field with buttons for its results.
- **Phones:** cards stack on narrow screens and the header fits at 390 px (checked by calculation and at 500 px; a real phone has not been tried).

## Tests: what they check, and what they do not

All 36 run offline in under a second.

| File | Checks |
| --- | --- |
| `supabase/functions/poll-divvy/poll.test.ts` (12) | The worker, run on a saved copy of real Divvy responses with a fake database. A feed that differs only in `last_reported` gives identical rows. One real change shows up in exactly one row. Divvy being down, an empty feed, and a failed save each record a failed run and save nothing. The first run loads stations; later runs do not. |
| `src/lib/freshness.test.ts` (12) | Every page state and edge: a quiet feed stays fresh, stale starts just after 2 minutes, a failed run is down however old, unreadable times are never fresh or NaN |
| `src/lib/token.test.ts` (6) | Reads token expiry; refreshes a token with under 40 s left |
| `src/lib/time.test.ts` (4) | Reads both the ISO and the Postgres text timestamp forms |
| `src/lib/backoff.test.ts` (2) | The reconnect wait doubles from 1 s to a 30 s cap |

**Not covered by automated tests:** the Deno entry point `index.ts`, the React components, Clerk sign-in, and Realtime itself. The SQL function `apply_station_status()` and the row-level security policies were tested by hand in the database (rolled-back transactions acting as each role), not by a repeatable test. The page was checked by hand on the deployed site, in Safari, Chrome and Firefox on a Mac.

## What the testing and logs showed

- **The worker runs unattended.** In the hour I checked, 120 runs with zero failures, averaging about 217 ms (the slowest was 469 ms). There were no real failures in the day I checked either. In the logs, changed rows alternate with zero because Divvy refreshes once a minute and we poll twice.
- **Only real changes are saved.** Sending the identical data again changed 0 rows; changing one station changed 1.
- **A mistake caught by checking:** the first migration left signed-in users with broad default privileges, including `TRUNCATE`, which row-level security does not cover. Found by listing the grants after applying; fixed in migration 2.
- **The first Vercel build failed** with `npm error Invalid Version:`. A bundled optional package had been written into `package-lock.json` without a version. Reproduced locally, fixed, and verified with a clean install.
- **A Realtime connection that kept dropping.** The browser console showed each drop landing on the exact second a token expired. Clerk hands out its cached token until it is nearly dead, and Supabase forwards a new one only every 25 s, so the old token often ran out first and the server closed the connection. The fix hands out tokens only while they have at least 40 s left. After it, a seven-minute watch showed no drops. Two supporting changes: the page rebuilds a closed channel itself (the library does not), and falls back to reading over HTTP while the websocket is down.
- **A banner that said "NaN h ago".** Realtime passes timestamps as raw Postgres text, which some browsers cannot parse. Times are now normalised, an unreadable time counts as stale, and a new run row is treated only as a signal to re-read the row over HTTP.
- **Stale and down on the live site.** Pausing the Cron job turned the banner amber after about 2 minutes (the page's own clock noticed). Inserting a failed run turned it red within a second or two. Resuming the job returned it to green, and the first run back changed 179 rows, as the data had piled up.
- **Privacy with two real users.** Two accounts each saw only their own trip. In the database, acting as one user: reading showed only their row, deleting the other's trips removed 0 rows, and inserting a trip under the other's id was refused.

## Free-tier limits

Every service is on its free plan, and no payment method is on file with any of them (checked in each dashboard).

**There is no spending limit to set.** On free plans, going over a limit gets the service restricted, not charged. Supabase's own usage page says so: "you may experience restrictions, as you are currently not billed for overages." Vercel Hobby and Clerk's free tier work the same way.

| Service | Plan | Limit that matters | Where this app stands (read from the dashboards on 2026-11-03) |
| --- | --- | --- | --- |
| Supabase Edge Functions | Free | 500,000 calls a month (per the course brief) | 1,637 calls so far. A 30 s schedule is about 86,000 a month, 17% of the limit. |
| Supabase Realtime | Free | Every message to every open page counts, and there are caps on connections and monthly messages | Peak concurrent connections: 3. Messages: 144. Subscriptions are filtered to followed stations, and the run log sends each open tab about 2 messages a minute. |
| Supabase database | Free | 500 MB (per Supabase's published free plan) | 0.032 GB. A daily job deletes `worker_runs` rows older than 3 days. |
| Supabase project | Free | Paused after a week without use | Open the app now and then until grades are back |
| Vercel | Hobby | Data transfer, requests and function use | 166.78 MB data transfer and 4.3K requests over the last 30 days, far below the limits |
| Clerk | Free ("Hobby") | Monthly active users | 2 active users; usage far below the limit |

Usage figures were read from each service's own usage page. Supabase's page can lag by up to an hour, so the call count differs a little from the count I took from its logs (1,691 over the first 14 hours).

Signed-out visitors are refused everywhere on purpose: a public link would let anyone open Realtime connections against the free project.

## Known limitations

- Clerk is on a **development instance**, so its console shows a development-keys warning, and Safari may log a one-time cross-site fetch error at page load. Production would need your own domain.
- Divvy updates its feed about once a minute, so changes cannot appear faster than that.
- Followed trips are stations only. A "near me" or neighborhood view is not built.
- Each user can follow at most 20 trips.
- Tested in Safari, Chrome and Firefox on a Mac, and with two signed-in users at once. Not tested: Windows, Linux, phones or tablets, screen readers, or more than two simultaneous users.

## How this was built

Built with Claude Code in small steps, with a commit after each: chart first, then database, worker, schedule, sign-in, trip search, live cards, freshness states, then the fixes above. Each step was checked against the real system (database queries, live-site checks, console logs) before moving on, and the commit history shows that order.
