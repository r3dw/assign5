"use client";

import { SignInButton, SignUpButton } from "@clerk/nextjs";
import { useState } from "react";
import type { Station } from "@/lib/stations";
import { TripBoard, type Trip } from "./TripBoard";
import { TripForm } from "./TripForm";

/** Fewest things to remember: guests can watch a few trips, kept only in this browser tab. */
const GUEST_LIMIT = 3;

/**
 * Signed-out visitors: they can pick stations and watch them live (the live data is public),
 * but nothing is saved. Saving a trip needs an account, so it is offered right where it matters.
 */
export function GuestTrips() {
  const [trips, setTrips] = useState<Trip[]>([]);

  async function watch(origin: Station, destination: Station | null) {
    if (trips.length >= GUEST_LIMIT) return `Guests can watch up to ${GUEST_LIMIT} trips. Remove one, or sign in to save more.`;
    if (trips.some((t) => t.originId === origin.station_id && t.destinationId === (destination?.station_id ?? null))) {
      return "You are already watching that trip.";
    }
    setTrips((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        originId: origin.station_id,
        destinationId: destination?.station_id ?? null,
        origin: origin.name,
        destination: destination?.name ?? null,
      },
    ]);
    return null;
  }

  return (
    <div className="mt-8 space-y-8">
      <TripForm heading="Watch a trip" submitLabel="Watch trip" busyLabel="Adding…" onSubmit={watch} />
      <TripBoard
        heading="Trips you are watching"
        trips={trips}
        loadError={null}
        emptyText="Pick a station above to watch bikes and docks change live."
        removeLabel="Stop watching"
        onRemove={(id) => setTrips((prev) => prev.filter((t) => t.id !== id))}
      />
      <aside className="rounded-md border border-zinc-200 p-4 text-sm dark:border-zinc-800">
        <p className="font-medium">Want to keep your trips?</p>
        <p className="mt-1 text-zinc-600 dark:text-zinc-400">
          Trips you watch as a guest disappear when you leave. Sign in with just your email and a code to save them and
          see them every time you visit.
        </p>
        <div className="mt-3 flex gap-3">
          <SignInButton>
            <button className="rounded-md border border-zinc-300 px-3 py-1.5 font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800">
              Sign in
            </button>
          </SignInButton>
          <SignUpButton>
            <button className="rounded-md bg-zinc-900 px-3 py-1.5 font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300">
              Sign up
            </button>
          </SignUpButton>
        </div>
      </aside>
    </div>
  );
}
