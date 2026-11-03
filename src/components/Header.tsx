"use client";

import { Show, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
import { BikeMark, FlagStar } from "./BikeSketch";

/** The Chicago flag's pattern in miniature: two sky-blue stripes with the flag's four red stars between them. */
function FlagBand() {
  return (
    <div aria-hidden="true">
      <div className="h-1.5 bg-sky" />
      <div className="flex h-8 items-center justify-center gap-10 bg-surface sm:gap-16">
        {[0, 1, 2, 3].map((i) => (
          <FlagStar key={i} className="h-6 w-6 text-flag-red" />
        ))}
      </div>
      <div className="h-1.5 bg-sky" />
    </div>
  );
}

export function Header() {
  return (
    <header className="border-b border-line bg-surface">
      <FlagBand />
      <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4">
        <span className="flex items-center gap-2.5">
          <BikeMark className="h-8 w-12 text-brand" />
          <span className="text-xl font-bold tracking-tight">
            Divvy <span className="text-brand">Live</span>
          </span>
        </span>
        <nav className="flex items-center gap-3">
          <Show when="signed-out">
            <SignInButton>
              <button className="btn-secondary">Sign in</button>
            </SignInButton>
            <SignUpButton>
              <button className="btn-primary">Sign up</button>
            </SignUpButton>
          </Show>
          <Show when="signed-in">
            <UserButton />
          </Show>
        </nav>
      </div>
    </header>
  );
}
