"use client";

import { useSession } from "@clerk/nextjs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { useMemo } from "react";

/**
 * A Supabase client that sends the signed-in user's Clerk token with every request.
 * Row-level security reads the user id from that token, so a user only sees their
 * own follows. Supabase's Realtime connection uses the same token.
 *
 * Clerk is linked to Supabase as a third-party auth provider, so no custom JWT
 * template is needed: Clerk's own session token is accepted as is.
 */
export function useSupabase(): SupabaseClient {
  const { session } = useSession();

  return useMemo(
    () =>
      createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { accessToken: async () => (await session?.getToken()) ?? null },
      ),
    [session],
  );
}
