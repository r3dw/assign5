"use client";

import { useEffect, useState } from "react";
import { useSupabase } from "@/lib/supabase";

type Check = { label: string; state: "pending" | "ok" | "error"; detail: string };

/**
 * Temporary: proves the Clerk token reaches Supabase and that the row-level security
 * policies behave. It is replaced by the real trip cards in the next steps.
 */
export function ConnectionCheck() {
  const supabase = useSupabase();
  const [checks, setChecks] = useState<Check[]>([
    { label: "Live station data", state: "pending", detail: "" },
    { label: "Worker's latest run", state: "pending", detail: "" },
    { label: "Your followed trips (private)", state: "pending", detail: "" },
  ]);

  useEffect(() => {
    let cancelled = false;
    const set = (i: number, c: Omit<Check, "label">) =>
      !cancelled && setChecks((prev) => prev.map((p, j) => (j === i ? { ...p, ...c } : p)));

    (async () => {
      const stations = await supabase.from("station_status").select("*", { count: "exact", head: true });
      set(0, stations.error
        ? { state: "error", detail: stations.error.message }
        : { state: "ok", detail: `${stations.count} stations readable` });

      const run = await supabase.from("worker_runs").select("started_at, ok, rows_changed").order("started_at", { ascending: false }).limit(1);
      const r = run.data?.[0];
      set(1, run.error
        ? { state: "error", detail: run.error.message }
        : r
          ? { state: "ok", detail: `${r.ok ? "succeeded" : "failed"} at ${new Date(r.started_at).toLocaleTimeString()}, ${r.rows_changed} rows changed` }
          : { state: "error", detail: "no runs found" });

      const follows = await supabase.from("follows").select("*", { count: "exact", head: true });
      set(2, follows.error
        ? { state: "error", detail: follows.error.message }
        : { state: "ok", detail: `${follows.count} trips followed` });
    })();

    return () => {
      cancelled = true;
    };
  }, [supabase]);

  return (
    <ul className="mt-6 space-y-2 text-sm">
      {checks.map((c) => (
        <li key={c.label} className="flex gap-2">
          <span aria-hidden>{c.state === "pending" ? "…" : c.state === "ok" ? "✓" : "✗"}</span>
          <span>
            <strong>{c.label}:</strong> {c.state === "pending" ? "checking" : c.detail}
          </span>
        </li>
      ))}
    </ul>
  );
}
