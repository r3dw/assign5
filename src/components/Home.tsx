"use client";

import { Show, SignInButton, SignUpButton } from "@clerk/nextjs";
import { Trips } from "./Trips";

export function Home() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
      <h1 className="text-4xl font-bold tracking-tight">Chicago bikes, live</h1>
      <span aria-hidden="true" className="mt-3 block h-1 w-16 rounded-full bg-flag-red" />
      <p className="mt-4 max-w-prose text-muted">
        Follow a Divvy trip: where you pick up a bike, and optionally where you
        plan to drop it off. You&apos;ll see bikes and open docks update as they change.
      </p>

      <Show when="signed-out">
        <section className="card mt-8 p-6">
          <h2 className="text-lg font-semibold">Sign in to follow your trips</h2>
          <p className="mt-1 text-sm text-muted">
            Use just your email address: we send you a code, so there is no password to remember.
          </p>
          <div className="mt-4 flex gap-3 text-sm">
            <SignInButton>
              <button className="btn-secondary">
                Sign in
              </button>
            </SignInButton>
            <SignUpButton>
              <button className="btn-primary">
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
