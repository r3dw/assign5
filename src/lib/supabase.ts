"use client";

import { useSession } from "@clerk/nextjs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { useEffect } from "react";
import { jwtExpiry, needsRefresh, REFRESH_MARGIN_SECONDS } from "./token";

type ClerkSession = ReturnType<typeof useSession>["session"];

// The signed-in user's Clerk session. useSupabase() keeps it current, and the client
// below asks it for a fresh token whenever one is needed (Clerk tokens are short-lived).
let currentSession: ClerkSession = null;

/**
 * One Supabase client for the whole page. It sends the signed-in user's Clerk token
 * with every request, so row-level security can read the user id from it, and
 * Supabase's Realtime connection uses the same token.
 *
 * It is created once, not per render or per Clerk session update: rebuilding it
 * would close and reopen the Realtime websocket each time Clerk refreshes a token.
 *
 * Clerk is linked to Supabase as a third-party auth provider, so no custom JWT
 * template is needed: Clerk's own session token is accepted as is.
 */
let client: SupabaseClient | undefined;
let lastToken: string | null = null;
let inFlight: Promise<string | null> | undefined;

/**
 * Clerk's token for Supabase, always with at least REFRESH_MARGIN_SECONDS left.
 *
 * Clerk hands back its cached token until it is nearly expired, and the Realtime server
 * closes the channel the moment the token it holds expires. Realtime only forwards a new
 * token at its 25 s heartbeat, so a nearly-expired token often ran out before the next one
 * arrived (the logs showed every drop landing on a token's expiry second). So a token with
 * little time left is replaced with a fresh one, forced past Clerk's cache.
 *
 * Only whether the token changed or went missing is logged, never the token itself.
 */
function clerkToken(): Promise<string | null> {
  const exp = lastToken ? jwtExpiry(lastToken) : null;
  if (lastToken && !needsRefresh(exp, Date.now() / 1000, REFRESH_MARGIN_SECONDS)) {
    return Promise.resolve(lastToken);
  }
  // Several callers (Realtime heartbeat, data requests) can ask at once: fetch only once.
  inFlight ??= fetchFreshToken().finally(() => {
    inFlight = undefined;
  });
  return inFlight;
}

async function fetchFreshToken(): Promise<string | null> {
  const at = new Date().toLocaleTimeString();
  let token: string | null = null;
  try {
    token = (await currentSession?.getToken({ skipCache: true })) ?? null;
  } catch (e) {
    console.warn(`[auth] Clerk getToken threw at ${at}`, e);
  }
  if (!token) {
    console.warn(`[auth] no token from Clerk at ${at}`);
    // The previous token may still have a few seconds to run: better than none.
    const left = lastToken ? jwtExpiry(lastToken) : null;
    return lastToken && left !== null && left > Date.now() / 1000 ? lastToken : null;
  }
  const exp = jwtExpiry(token);
  console.info(`[auth] new token at ${at}${exp ? `, valid for ${Math.round(exp - Date.now() / 1000)} s` : ""}`);
  lastToken = token;
  return token;
}

function getClient(): SupabaseClient {
  client ??= createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    accessToken: clerkToken,
    // Browsers throttle timers in background tabs, which can delay the websocket's
    // keep-alive pings until the server closes the connection. A Web Worker's timers
    // are not throttled.
    realtime: { worker: true },
  });
  return client;
}

export function useSupabase(): SupabaseClient {
  const { session } = useSession();
  useEffect(() => {
    // A different sign-in must never reuse the previous person's cached token.
    if (currentSession?.id !== session?.id) lastToken = null;
    currentSession = session ?? null;
  }, [session]);
  return getClient();
}
