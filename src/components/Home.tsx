"use client";

import { Show, SignInButton, SignUpButton } from "@clerk/nextjs";
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
        <section className="mt-8 rounded-md border border-zinc-200 p-6 dark:border-zinc-800">
          <h2 className="text-lg font-semibold">Sign in to follow your trips</h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Use just your email address: we send you a code, so there is no password to remember.
          </p>
          <div className="mt-4 flex gap-3 text-sm">
            <SignInButton>
              <button className="rounded-md border border-zinc-300 px-4 py-2 font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800">
                Sign in
              </button>
            </SignInButton>
            <SignUpButton>
              <button className="rounded-md bg-zinc-900 px-4 py-2 font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300">
                Sign up
              </button>
            </SignUpButton>
          </div>
        </section>
      </Show>

      <Show when="signed-in">
        <Trips />
      </Show>
    </main>
  );
}
