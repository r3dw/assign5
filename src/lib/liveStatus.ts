"use client";

import { useEffect, useRef, useState } from "react";
import { backoffMs } from "./backoff";
import { useSupabase } from "./supabase";

export type StationStatus = {
  station_id: string;
  bikes_available: number;
  ebikes_available: number;
  docks_available: number;
  bikes_disabled: number;
  docks_disabled: number;
  is_renting: boolean;
  is_returning: boolean;
  updated_at: string;
};

export type Connection = "connecting" | "live" | "offline";

const COLUMNS =
  "station_id, bikes_available, ebikes_available, docks_available, bikes_disabled, docks_disabled, is_renting, is_returning, updated_at";

/**
 * Current status of the given stations, kept up to date through Supabase Realtime.
 *
 * - The subscription is filtered on the server to just these stations. Realtime counts
 *   every message sent to every open page, so a page must not receive changes for
 *   the other ~2,000 stations. (Realtime allows at most 100 values in one filter.)
 * - Whenever the connection (re)opens, the current values are read again, so changes
 *   missed while disconnected never leave stale numbers on screen.
 * - Realtime applies row-level security with the user's Clerk token, so this only
 *   works if station_status is in the Realtime publication, readable by signed-in
 *   users, and has a read policy.
 */
export function useLiveStatus(stationIds: string[]) {
  const supabase = useSupabase();
  const key = [...new Set(stationIds)].sort().join(",");
  const [status, setStatus] = useState<Map<string, StationStatus>>(new Map());
  const [connection, setConnection] = useState<Connection>("connecting");
  // Bumped to throw the channel away and build a new one after the connection is lost.
  const [attempt, setAttempt] = useState(0);
  const failures = useRef(0);

  useEffect(() => {
    if (!key) return;
    const ids = key.split(",");
    let cancelled = false;
    let live = false;
    let retry: ReturnType<typeof setTimeout> | undefined;

    async function snapshot() {
      const { data } = await supabase.from("station_status").select(COLUMNS).in("station_id", ids);
      if (cancelled || !data) return;
      setStatus((prev) => {
        const next = new Map(prev);
        for (const row of data as StationStatus[]) next.set(row.station_id, row);
        return next;
      });
    }

    const channel = supabase
      .channel(`station-status-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "station_status", filter: `station_id=in.(${ids.join(",")})` },
        (payload) => {
          if (payload.eventType === "DELETE") return;
          const row = payload.new as StationStatus;
          // If the message is missing columns, trust the database instead.
          if (typeof row?.station_id !== "string" || typeof row.bikes_available !== "number" || typeof row.docks_available !== "number") {
            snapshot();
            return;
          }
          setStatus((prev) => new Map(prev).set(row.station_id, row));
        },
      )
      .subscribe((state) => {
        if (cancelled) return;
        console.info(`[realtime] station_status ${state} at ${new Date().toLocaleTimeString()}`);
        if (state === "SUBSCRIBED") {
          live = true;
          failures.current = 0;
          setConnection("live");
          snapshot();
        } else if (state === "CHANNEL_ERROR" || state === "TIMED_OUT" || state === "CLOSED") {
          live = false;
          setConnection("offline");
          // The library does not rejoin a channel the server has closed, so build a new
          // one after a short, growing pause, with a freshly fetched token.
          if (!retry) {
            retry = setTimeout(async () => {
              failures.current += 1;
              await supabase.realtime.setAuth().catch(() => {});
              if (!cancelled) setAttempt((n) => n + 1);
            }, backoffMs(failures.current));
          }
        }
      });

    // Fallback: while the websocket is down, read the numbers over plain HTTP so they
    // never freeze. This costs no Realtime messages.
    const poll = setInterval(() => {
      if (!live) snapshot();
    }, 20_000);

    return () => {
      cancelled = true;
      clearInterval(poll);
      clearTimeout(retry);
      supabase.removeChannel(channel);
    };
  }, [supabase, key, attempt]);

  return { status, connection };
}
