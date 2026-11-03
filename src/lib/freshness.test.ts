import assert from "node:assert/strict";
import { test } from "node:test";
import { freshness, STALE_AFTER_MS, type WorkerRun } from "./freshness.ts";

const NOW = Date.parse("2026-11-03T02:00:00Z");
const run = (secondsAgo: number, over: Partial<WorkerRun> = {}): WorkerRun => ({
  id: 1,
  started_at: new Date(NOW - secondsAgo * 1000).toISOString(),
  finished_at: new Date(NOW - secondsAgo * 1000 + 300).toISOString(),
  ok: true,
  rows_changed: 0,
  error: null,
  ...over,
});

test("loading until the first read of the run log comes back", () => {
  assert.deepEqual(freshness(undefined, NOW), { state: "loading" });
});

test("fresh when the last run succeeded recently, even if it changed nothing", () => {
  const f = freshness(run(20, { rows_changed: 0 }), NOW);
  assert.equal(f.state, "fresh");
});

test("a quiet feed is not stale: zero changed rows on a healthy worker stays fresh", () => {
  assert.equal(freshness(run(45, { rows_changed: 0 }), NOW).state, "fresh");
});

test("fresh right up to the threshold, stale just after it", () => {
  const limit = STALE_AFTER_MS / 1000;
  assert.equal(freshness(run(limit - 5), NOW).state, "fresh");
  assert.equal(freshness(run(limit + 5), NOW).state, "stale");
});

test("stale when the worker has stopped, for example after 10 minutes of silence", () => {
  const f = freshness(run(600), NOW);
  assert.equal(f.state, "stale");
});

test("stale, with no time to show, when there are no runs at all", () => {
  assert.deepEqual(freshness(null, NOW), { state: "stale", checkedMs: null });
});

test("down when the latest run failed, with its error", () => {
  const f = freshness(run(10, { ok: false, error: "returned HTTP 503" }), NOW);
  assert.equal(f.state, "down");
  if (f.state === "down") assert.equal(f.error, "returned HTTP 503");
});

test("down takes priority over stale: a failed run stays down however old it is", () => {
  assert.equal(freshness(run(900, { ok: false, error: "x" }), NOW).state, "down");
});

test("a viewer clock behind the server never reports a check time in the future", () => {
  const f = freshness(run(-5), NOW);
  assert.equal(f.state, "fresh");
  if (f.state === "fresh") assert.ok(f.checkedMs <= NOW);
});
