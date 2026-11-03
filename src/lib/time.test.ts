import assert from "node:assert/strict";
import { test } from "node:test";
import { parseTime } from "./time.ts";

const T = Date.parse("2026-11-03T03:36:00.000Z");

test("reads the ISO form that fetched rows use", () => {
  assert.equal(parseTime("2026-11-03T03:36:00+00:00"), T);
  assert.equal(parseTime("2026-11-03T03:36:00Z"), T);
});

test("reads the Postgres text form that Realtime passes through", () => {
  assert.equal(parseTime("2026-11-03 03:36:00+00"), T);
  assert.equal(parseTime("2026-11-03 03:36:00.250000+00"), T + 250);
});

test("keeps the offset when it is not UTC", () => {
  assert.equal(parseTime("2026-11-02 21:36:00-06"), T);
  assert.equal(parseTime("2026-11-02T21:36:00-06:00"), T);
});

test("returns NaN, not a wrong time, for missing or unreadable values", () => {
  assert.ok(Number.isNaN(parseTime(null)));
  assert.ok(Number.isNaN(parseTime(undefined)));
  assert.ok(Number.isNaN(parseTime("")));
  assert.ok(Number.isNaN(parseTime("not a time")));
});
