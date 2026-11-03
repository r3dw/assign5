// One worker run: fetch Divvy, save what changed, record the run.
// The network and the database are passed in, so tests can run this on a saved
// copy of the response with a fake database.

import { INFO_URL, parseStations, parseStatus, STATUS_URL, type StationRow, type StatusRow } from "./divvy.ts";

export interface Db {
  /** Upserts the rows, skipping unchanged ones. Returns how many actually changed. */
  applyStationStatus(rows: StatusRow[]): Promise<number>;
  /** How many stations are already in the stations table. */
  countStations(): Promise<number>;
  upsertStations(rows: StationRow[]): Promise<void>;
  /** Writes one row to worker_runs. */
  recordRun(run: RunRecord): Promise<void>;
}

export type RunRecord = {
  started_at: string;
  finished_at: string;
  ok: boolean;
  stations_seen: number;
  rows_changed: number;
  duration_ms: number;
  error: string | null;
};

export type Fetcher = (url: string) => Promise<unknown>;

export type RunResult = RunRecord & { stations_synced: number };

/** Fetches JSON, failing on a bad HTTP status or a slow answer. */
export const fetchJson: Fetcher = async (url) => {
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`${url} returned HTTP ${res.status}`);
  return await res.json();
};

export async function runPoll(db: Db, getJson: Fetcher = fetchJson, now: () => number = Date.now): Promise<RunResult> {
  const started = now();
  let seen = 0;
  let changed = 0;
  let synced = 0;
  let error: string | null = null;

  try {
    const rows = parseStatus(await getJson(STATUS_URL));
    seen = rows.length;

    // Station names and locations change rarely. Load them on the first run, and
    // again whenever the status feed lists more stations than we have.
    if ((await db.countStations()) < seen) {
      const stations = parseStations(await getJson(INFO_URL));
      await db.upsertStations(stations);
      synced = stations.length;
    }

    changed = await db.applyStationStatus(rows);
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  const finished = now();
  const record: RunRecord = {
    started_at: new Date(started).toISOString(),
    finished_at: new Date(finished).toISOString(),
    ok: error === null,
    stations_seen: seen,
    rows_changed: changed,
    duration_ms: finished - started,
    error,
  };
  await db.recordRun(record);
  return { ...record, stations_synced: synced };
}
