"use client";

import { useEffect, useState } from "react";
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

  useEffect(() => {
    let cancelled = false;

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
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "worker_runs" }, (payload) => {
        setRun(payload.new as WorkerRun);
      })
      .subscribe((state) => {
        if (cancelled) return;
        if (state === "SUBSCRIBED") {
          setConnection("live");
          latest(); // catch up on anything missed while disconnected
        } else if (state === "CHANNEL_ERROR" || state === "TIMED_OUT" || state === "CLOSED") {
          setConnection("offline");
        }
      });

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  return { run, connection };
}
