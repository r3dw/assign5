import { parseTime } from "./time.ts";

// How current is the data? Decided from the worker's own run log, not from the
// station data: if few bikes move overnight the data is quiet, not stale.

export type WorkerRun = {
  id: number;
  started_at: string;
  finished_at: string | null;
  ok: boolean;
  rows_changed: number;
  error: string | null;
};

export type Freshness =
  | { state: "loading" }
  | { state: "fresh"; checkedMs: number }
  | { state: "stale"; checkedMs: number | null }
  | { state: "down"; failedMs: number; error: string | null };

/** The worker runs every 30 s, so 2 minutes is four missed runs in a row. */
export const STALE_AFTER_MS = 2 * 60 * 1000;

/**
 * @param run the worker's latest run; undefined while it is still loading, null if there are none
 */
export function freshness(run: WorkerRun | null | undefined, nowMs: number): Freshness {
  if (run === undefined) return { state: "loading" };
  if (run === null) return { state: "stale", checkedMs: null };

  const reported = parseTime(run.finished_at ?? run.started_at);
  // A failure is a failure whatever its timestamp looks like.
  if (!run.ok) {
    const failedAt = Number.isNaN(reported) ? nowMs : Math.min(reported, nowMs);
    return { state: "down", failedMs: nowMs - failedAt, error: run.error };
  }
  // A time we cannot read must never look fresh.
  if (Number.isNaN(reported)) return { state: "stale", checkedMs: null };

  // A viewer's clock can run a little behind the server's: never report a time in the future.
  const at = Math.min(reported, nowMs);
  const age = nowMs - at;

  if (age > STALE_AFTER_MS) return { state: "stale", checkedMs: at };
  return { state: "fresh", checkedMs: at };
}
