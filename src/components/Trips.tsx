"use client";

import { useEffect, useState } from "react";
import { stationNames } from "@/lib/stations";
import { useSupabase } from "@/lib/supabase";
import { TripBoard, type Trip } from "./TripBoard";
import { TripForm } from "./TripForm";

/** Signed-in visitors: trips are saved to the database, private to the account by row-level security. */
export function Trips() {
  const supabase = useSupabase();
  const [trips, setTrips] = useState<Trip[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Bumping this reloads the list after an add or a remove.
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("follows")
        .select("id, origin_station_id, destination_station_id")
        .order("created_at");
      if (cancelled) return;
      if (error) {
        setLoadError(error.message);
        return;
      }
      try {
        const ids = [...new Set((data ?? []).flatMap((f) => [f.origin_station_id, f.destination_station_id].filter(Boolean)))];
        const names = await stationNames(supabase, ids);
        if (cancelled) return;
        setTrips(
          (data ?? []).map((f) => ({
            id: f.id,
            originId: f.origin_station_id,
            destinationId: f.destination_station_id,
            origin: names.get(f.origin_station_id) ?? "Unknown station",
            destination: f.destination_station_id ? (names.get(f.destination_station_id) ?? "Unknown station") : null,
          })),
        );
        setLoadError(null);
      } catch (e) {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : "Could not load your trips");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, version]);

  async function add(origin: { station_id: string }, destination: { station_id: string } | null) {
    const { error } = await supabase.from("follows").insert({
      origin_station_id: origin.station_id,
      destination_station_id: destination?.station_id ?? null,
    });
    if (error) return error.code === "23505" ? "You already follow that trip." : error.message;
    setVersion((v) => v + 1);
    return null;
  }

  async function remove(id: string) {
    const { error } = await supabase.from("follows").delete().eq("id", id);
    if (error) {
      setLoadError(error.message);
      return;
    }
    setVersion((v) => v + 1);
  }

  return (
    <div className="mt-8 space-y-8">
      <TripForm heading="Follow a trip" submitLabel="Follow trip" busyLabel="Adding…" onSubmit={add} />
      <TripBoard
        heading="Your trips"
        trips={trips}
        loadError={loadError}
        emptyText="You are not following any trips yet. Add one above."
        removeLabel="Stop following"
        onRemove={remove}
      />
    </div>
  );
}
