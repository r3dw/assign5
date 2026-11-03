import assert from "node:assert/strict";
import { test } from "node:test";
import { orient } from "./tripView.ts";

const trip = { originId: "A", destinationId: "B", origin: "Blackstone", destination: "Ellis" };

test("as saved: pick up at the origin, drop off at the destination", () => {
  assert.deepEqual(orient(trip, false), {
    pickupId: "A", pickup: "Blackstone", dropoffId: "B", dropoff: "Ellis", reversed: false,
  });
});

test("reversed: the two stations swap roles", () => {
  assert.deepEqual(orient(trip, true), {
    pickupId: "B", pickup: "Ellis", dropoffId: "A", dropoff: "Blackstone", reversed: true,
  });
});

test("a trip with no destination has no return leg, even if reversal is asked for", () => {
  const oneWay = { originId: "A", destinationId: null, origin: "Blackstone", destination: null };
  const v = orient(oneWay, true);
  assert.equal(v.reversed, false);
  assert.equal(v.pickupId, "A");
  assert.equal(v.dropoffId, null);
});

test("reversing never changes which two stations are involved", () => {
  const fwd = orient(trip, false);
  const back = orient(trip, true);
  assert.deepEqual([fwd.pickupId, fwd.dropoffId].sort(), [back.pickupId, back.dropoffId].sort());
});

test("it does not change the saved trip", () => {
  const before = JSON.stringify(trip);
  orient(trip, true);
  assert.equal(JSON.stringify(trip), before);
});
