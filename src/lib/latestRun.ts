"use client";

import { useEffect, useRef, useState } from "react";
import { backoffMs } from "./backoff";
import type { WorkerRun } from "./freshness";
import type { Connection } from "./liveStatus";
import { useSupabase } from "./supabase";

const COLUMNS = "id, started_at, finished_at, ok, rows_changed, error";

/**
 * The worker's latest run, kept current through Realtime.
 * undefined = still loading, null = the worker has never run.
 *
 * Every run (one per 30 s) is pushed to each open page, which is about 2,900
 * Realtime messages a day per open tab. That is fine for a class, but it is why
 * this table is small and why the page should not be left open on many screens.
 */
export function useLatestRun() {
  const supabase = useSupabase();
  const [run, setRun] = useState<WorkerRun | null | undefined>(undefined);
  const [connection, setConnection] = useState<Connection>("connecting");
  // Bumped to throw the channel away and build a new one after the connection is lost.
  const [attempt, setAttempt] = useState(0);
  const failures = useRef(0);

  useEffect(() => {
    let cancelled = false;
    let live = false;
    let retry: ReturnType<typeof setTimeout> | undefined;

    async function latest() {
      const { data, error } = await supabase
        .from("worker_runs")
        .select(COLUMNS)
        .order("started_at", { ascending: false })
        .limit(1);
      if (cancelled || error) return;
      setRun((data?.[0] as WorkerRun | undefined) ?? null);
    }

    latest();

    const channel = supabase
      .channel(`worker-runs-${Math.random().toString(36).slice(2)}`)
      // The message only says "a new run exists". The row itself is read over normal
      // HTTP, because Realtime passes raw Postgres text (odd timestamp format) and can
      // omit columns, and a half-read run must never turn the banner red.
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "worker_runs" }, () => {
        latest();
      })
      .subscribe((state) => {
        if (cancelled) return;
        console.info(`[realtime] worker_runs ${state} at ${new Date().toLocaleTimeString()}`);
        if (state === "SUBSCRIBED") {
          live = true;
          failures.current = 0;
          setConnection("live");
          latest(); // catch up on anything missed while disconnected
        } else if (state === "CHANNEL_ERROR" || state === "TIMED_OUT" || state === "CLOSED") {
          live = false;
          setConnection("offline");
          // The library does not rejoin a channel the server has closed, so build a new
          // one after a short, growing pause, with a freshly fetched token.
          if (!retry) {
            retry = setTimeout(async () => {
              failures.current += 1;
              await supabase.realtime.setAuth().catch(() => {});
              if (!cancelled) setAttempt((n) => n + 1);
            }, backoffMs(failures.current));
          }
        }
      });

    // Fallback: while the websocket is down, read the run log over plain HTTP so the
    // freshness banner stays truthful. This costs no Realtime messages.
    const poll = setInterval(() => {
      if (!live) latest();
    }, 20_000);

    return () => {
      cancelled = true;
      clearInterval(poll);
      clearTimeout(retry);
      supabase.removeChannel(channel);
    };
  }, [supabase, attempt]);

  return { run, connection };
}
