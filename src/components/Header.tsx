"use client";

import { Show, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";

export function Header() {
  return (
    <header className="border-b border-zinc-200 dark:border-zinc-800">
      <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
        <span className="text-lg font-semibold tracking-tight">Divvy Live</span>
        <nav className="flex items-center gap-3 text-sm">
          <Show when="signed-out">
            <SignInButton>
              <button className="rounded-md px-3 py-1.5 font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800">
                Sign in
              </button>
            </SignInButton>
            <SignUpButton>
              <button className="rounded-md bg-zinc-900 px-3 py-1.5 font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300">
                Sign up
              </button>
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
