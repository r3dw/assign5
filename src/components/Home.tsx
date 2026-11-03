"use client";

import { Show } from "@clerk/nextjs";
import { GuestTrips } from "./GuestTrips";
import { Trips } from "./Trips";

export function Home() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
      <h1 className="text-3xl font-semibold tracking-tight">Chicago bikes, live</h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">
        Follow a Divvy trip: where you pick up a bike, and optionally where you
        plan to drop it off. You&apos;ll see bikes and open docks update as they change. No account needed to watch; sign in to save your trips.
      </p>

      <Show when="signed-out">
        <GuestTrips />
      </Show>

      <Show when="signed-in">
        <Trips />
      </Show>
    </main>
  );
}
