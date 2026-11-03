"use client";

import { useEffect, useState } from "react";
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

  useEffect(() => {
    if (!key) return;
    const ids = key.split(",");
    let cancelled = false;

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
          setStatus((prev) => new Map(prev).set(row.station_id, row));
        },
      )
      .subscribe((state) => {
        if (cancelled) return;
        if (state === "SUBSCRIBED") {
          setConnection("live");
          snapshot();
        } else if (state === "CHANNEL_ERROR" || state === "TIMED_OUT" || state === "CLOSED") {
          setConnection("offline");
        }
      });

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [supabase, key]);

  return { status, connection };
}
