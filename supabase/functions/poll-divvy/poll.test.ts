// Runs the worker on saved copies of Divvy's responses (fixtures/) with a fake database.
// Run with: npm test

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { INFO_URL, parseStations, parseStatus, STATUS_URL } from "./divvy.ts";
import { type Db, type RunRecord, runPoll } from "./poll.ts";

const load = (name: string) => JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8"));
const status = load("station_status.json");
const info = load("station_information.json");

/** A fake database that remembers what the worker asked it to save. */
function fakeDb(opts: { existingStations?: number; changed?: number; failApply?: boolean } = {}) {
  const calls = { applied: [] as unknown[][], upserted: [] as unknown[][], runs: [] as RunRecord[] };
  const db: Db = {
    applyStationStatus(rows) {
      if (opts.failApply) return Promise.reject(new Error("apply_station_status: connection refused"));
      calls.applied.push(rows);
      return Promise.resolve(opts.changed ?? rows.length);
    },
    countStations: () => Promise.resolve(opts.existingStations ?? 0),
    upsertStations(rows) {
      calls.upserted.push(rows);
      return Promise.resolve();
    },
    recordRun(run) {
      calls.runs.push(run);
      return Promise.resolve();
    },
  };
  return { db, calls };
}

/** Serves the saved responses and records which URLs were requested. */
function fakeFetch(overrides: Record<string, unknown> = {}) {
  const requested: string[] = [];
  const getJson = (url: string) => {
    requested.push(url);
    if (url in overrides) {
      const v = overrides[url];
      return v instanceof Error ? Promise.reject(v) : Promise.resolve(v);
    }
    return Promise.resolve(url === STATUS_URL ? status : url === INFO_URL ? info : undefined);
  };
  return { getJson, requested };
}

test("parseStatus maps every station and keeps only the fields the app needs", () => {
  const rows = parseStatus(status);
  assert.equal(rows.length, 40);

  const raw = status.data.stations[0];
  assert.deepEqual(rows[0], {
    station_id: raw.station_id,
    bikes_available: raw.num_bikes_available,
    ebikes_available: raw.num_ebikes_available,
    docks_available: raw.num_docks_available,
    bikes_disabled: raw.num_bikes_disabled,
    docks_disabled: raw.num_docks_disabled,
    is_renting: raw.is_renting === 1,
    is_returning: raw.is_returning === 1,
  });
  assert.equal(typeof rows[0].is_renting, "boolean");
  assert.ok(!("last_reported" in rows[0]));
});

test("a feed that only differs in last_reported produces identical rows", () => {
  // last_reported changes on about half of all stations every minute with no real change.
  // If it leaked into the saved rows, every poll would look like a change.
  const later = structuredClone(status);
  for (const s of later.data.stations) s.last_reported += 60;
  later.last_updated += 60;
  assert.deepEqual(parseStatus(later), parseStatus(status));
});

test("a real change shows up in exactly one row", () => {
  const changed = structuredClone(status);
  changed.data.stations[3].num_bikes_available += 1;
  const before = parseStatus(status);
  const after = parseStatus(changed);
  const differing = after.filter((row, i) => JSON.stringify(row) !== JSON.stringify(before[i]));
  assert.equal(differing.length, 1);
  assert.equal(differing[0].station_id, status.data.stations[3].station_id);
});

test("parseStatus rejects an empty or malformed response", () => {
  assert.throws(() => parseStatus({ data: { stations: [] } }), /no stations/);
  assert.throws(() => parseStatus({}), /no stations/);
  assert.throws(() => parseStatus(null), /no stations/);
});

test("parseStations keeps names and coordinates", () => {
  const rows = parseStations(info);
  assert.equal(rows.length, 40);
  assert.equal(rows[0].station_id, info.data.stations[0].station_id);
  assert.equal(rows[0].name, info.data.stations[0].name);
  assert.equal(typeof rows[0].lat, "number");
});

test("first run: loads the stations, saves the status, and records a successful run", async () => {
  const { db, calls } = fakeDb({ existingStations: 0, changed: 40 });
  const { getJson, requested } = fakeFetch();

  const result = await runPoll(db, getJson);

  assert.deepEqual(requested, [STATUS_URL, INFO_URL]);
  assert.equal(calls.upserted[0].length, 40);
  assert.equal(calls.applied.length, 1);
  assert.equal(calls.applied[0].length, 40);
  assert.equal(calls.runs.length, 1);
  assert.equal(calls.runs[0].ok, true);
  assert.equal(calls.runs[0].stations_seen, 40);
  assert.equal(calls.runs[0].rows_changed, 40);
  assert.equal(calls.runs[0].error, null);
  assert.equal(result.stations_synced, 40);
});

test("later runs: skips the station list and reports how many rows really changed", async () => {
  const { db, calls } = fakeDb({ existingStations: 40, changed: 3 });
  const { getJson, requested } = fakeFetch();

  const result = await runPoll(db, getJson);

  assert.deepEqual(requested, [STATUS_URL]);
  assert.equal(calls.upserted.length, 0);
  assert.equal(calls.runs[0].rows_changed, 3);
  assert.equal(calls.runs[0].stations_seen, 40);
  assert.equal(result.stations_synced, 0);
});

test("a station the database has not seen triggers a station reload", async () => {
  const { db, calls } = fakeDb({ existingStations: 39 });
  const { getJson, requested } = fakeFetch();
  await runPoll(db, getJson);
  assert.deepEqual(requested, [STATUS_URL, INFO_URL]);
  assert.equal(calls.upserted.length, 1);
});

test("when Divvy is unreachable, nothing is saved and the failed run is recorded", async () => {
  const { db, calls } = fakeDb({ existingStations: 40 });
  const { getJson } = fakeFetch({ [STATUS_URL]: new Error(`${STATUS_URL} returned HTTP 503`) });

  const result = await runPoll(db, getJson);

  assert.equal(calls.applied.length, 0);
  assert.equal(calls.runs.length, 1);
  assert.equal(calls.runs[0].ok, false);
  assert.match(calls.runs[0].error ?? "", /503/);
  assert.equal(calls.runs[0].rows_changed, 0);
  assert.equal(result.ok, false);
});

test("when Divvy returns an empty feed, the run fails instead of saving nothing quietly", async () => {
  const { db, calls } = fakeDb();
  const { getJson } = fakeFetch({ [STATUS_URL]: { data: { stations: [] } } });
  await runPoll(db, getJson);
  assert.equal(calls.runs[0].ok, false);
  assert.match(calls.runs[0].error ?? "", /no stations/);
});

test("when the save fails, the failed run is recorded with the reason", async () => {
  const { db, calls } = fakeDb({ existingStations: 40, failApply: true });
  const { getJson } = fakeFetch();
  await runPoll(db, getJson);
  assert.equal(calls.runs[0].ok, false);
  assert.match(calls.runs[0].error ?? "", /connection refused/);
});

test("duration comes from the clock", async () => {
  const { db, calls } = fakeDb({ existingStations: 40 });
  const { getJson } = fakeFetch();
  const times = [1_000, 3_500];
  await runPoll(db, getJson, () => times.shift()!);
  assert.equal(calls.runs[0].duration_ms, 2_500);
});
