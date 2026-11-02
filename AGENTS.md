# Divvy Live: project context

Course assignment (MPCS 51238, Assignment 5, due Tue 2026-11-03 17:30): a live data system. The brief is `DBS Assign5 Brief.pdf`. A one-shot agent submission is marked incomplete, so work in small steps with real commit history, and make sure the user understands each piece.

## What this is

Divvy bike stations, live. A Supabase Edge Function polls the Divvy GBFS feed every 30 seconds, saves only changed rows, and logs each run. A Next.js page on Vercel updates through Supabase Realtime. Users sign in with Clerk and follow trips: an origin station (bikes) and an optional destination station (open docks).

The data-flow chart is `docs/data-flow.md`. Read it before changing the pipeline, and update it if the design changes.

## Stack

- Next.js (App Router), React, TypeScript, Tailwind CSS. Page on Vercel Hobby (free).
- Clerk for sign-in, linked to Supabase as third-party auth, so RLS can read the Clerk user id.
- Supabase: Postgres, Realtime, Cron, and the worker as an Edge Function in `supabase/functions/` (Deno, TypeScript).
- `tsconfig.json` excludes `supabase`, because the Edge Function code is Deno, not Node, and the Next.js build would fail on it.

## Source facts (checked 2026-11-02)

- Status: `https://gbfs.lyft.com/gbfs/1.1/chi/en/station_status.json`, no key, 2,079 stations, ~760 KB, TTL 60 s.
- Names and coordinates: `.../station_information.json`. Changes rarely.
- The root `gbfs.json` returns Access Denied. Use the two URLs above directly.
- Per poll, about 6% of stations really change. `last_reported` changes on about half of them with no real change, so never compare on it.

## Rules

- Free tiers only. No payment methods. The worker runs every 30 s (about 86,000 calls a month, limit 500,000). Do not go faster without telling the user.
- The worker upserts only changed rows. Rewriting every row burns the Realtime quota.
- Realtime needs the table in the publication, a read grant, and an RLS policy. If one is missing the page gets nothing and no error. Check all three.
- Freshness comes from the `worker_runs` table, not the station data. A quiet feed is not stale.
- Page states to design: loading, fresh, stale, down.
- Secrets: never read, print or commit `.env*` files. The Supabase secret key lives only on Supabase's servers. `.env.example` lists the names.
- Commit in small steps with clear messages. Do not push or deploy without the user asking.
- Move anything useful from a `CLAUDE.md` into this file and delete it. Check with `/context` that `AGENTS.md` loaded.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
