"use client";

import { Show } from "@clerk/nextjs";
import { Trips } from "./Trips";

export function Home() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
      <h1 className="text-3xl font-semibold tracking-tight">Chicago bikes, live</h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">
        Follow a Divvy trip: where you pick up a bike, and optionally where you
        plan to drop it off. You&apos;ll see bikes and open docks update as they change.
      </p>

      <Show when="signed-out">
        <p className="mt-6 rounded-md border border-zinc-200 p-4 text-sm dark:border-zinc-800">
          Sign in to choose the stations you follow.
        </p>
      </Show>

      <Show when="signed-in">
        <Trips />
      </Show>
    </main>
  );
}
