import assert from "node:assert/strict";
import { test } from "node:test";
import { jwtExpiry, needsRefresh, REFRESH_MARGIN_SECONDS } from "./token.ts";

// header.payload.signature, base64url, with only the claims we read
const jwt = (claims: object) => `e30.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.sig`;

test("reads the expiry from a token", () => {
  assert.equal(jwtExpiry(jwt({ exp: 1793677000, sub: "u" })), 1793677000);
});

test("returns null for tokens it cannot read", () => {
  assert.equal(jwtExpiry("nonsense"), null);
  assert.equal(jwtExpiry(jwt({ sub: "u" })), null);
  assert.equal(jwtExpiry(jwt({ exp: "soon" })), null);
  assert.equal(jwtExpiry(""), null);
});

test("keeps a token that still has more than the margin left", () => {
  assert.equal(needsRefresh(1000 + 55, 1000, REFRESH_MARGIN_SECONDS), false);
  assert.equal(needsRefresh(1000 + REFRESH_MARGIN_SECONDS, 1000, REFRESH_MARGIN_SECONDS), false);
});

test("refreshes a token with less than the margin left, or already expired", () => {
  assert.equal(needsRefresh(1000 + 39, 1000, REFRESH_MARGIN_SECONDS), true);
  assert.equal(needsRefresh(1000 - 5, 1000, REFRESH_MARGIN_SECONDS), true);
});

test("refreshes when the expiry is unknown, rather than trusting the token", () => {
  assert.equal(needsRefresh(null, 1000, REFRESH_MARGIN_SECONDS), true);
});

test("the margin leaves room for the 25 s heartbeat", () => {
  // A token is replaced at the first heartbeat that sees under 40 s left. Heartbeats are
  // 25 s apart, so the token being replaced still has at least 40 - 25 = 15 s to run.
  assert.ok(REFRESH_MARGIN_SECONDS - 25 >= 10);
});
