"use client";

import { useSession } from "@clerk/nextjs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { useEffect } from "react";

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

// Created on first use, not when this file is imported, so building or prerendering the
// page never needs the Supabase keys. Only signed-in components in the browser call it.
function getClient(): SupabaseClient {
  client ??= createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    accessToken: async () => (await currentSession?.getToken()) ?? null,
  });
  return client;
}

export function useSupabase(): SupabaseClient {
  const { session } = useSession();
  useEffect(() => {
    currentSession = session ?? null;
  }, [session]);
  return getClient();
}
