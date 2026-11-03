import assert from "node:assert/strict";
import { test } from "node:test";
import { backoffMs } from "./backoff.ts";

test("doubles from one second and stops at thirty", () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6, 20].map(backoffMs), [1000, 2000, 4000, 8000, 16000, 30000, 30000, 30000]);
});

test("never returns a negative or fractional wait", () => {
  assert.equal(backoffMs(-3), 1000);
  assert.equal(backoffMs(1.9), 2000);
});
