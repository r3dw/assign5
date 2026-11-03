"use client";

import { useEffect, useState } from "react";
import { freshness } from "@/lib/freshness";
import { useLatestRun } from "@/lib/latestRun";
import { useLiveStatus } from "@/lib/liveStatus";
import { stationNames, type Station } from "@/lib/stations";
import { useSupabase } from "@/lib/supabase";
import { useNow } from "@/lib/useNow";
import { FreshnessBanner } from "./FreshnessBanner";
import { StationPicker } from "./StationPicker";
import { TripCard } from "./TripCard";

type Trip = { id: string; originId: string; destinationId: string | null; origin: string; destination: string | null };

export function Trips() {
  const supabase = useSupabase();
  const [trips, setTrips] = useState<Trip[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const now = useNow(1000);
  const watched = (trips ?? []).flatMap((t) => (t.destinationId ? [t.originId, t.destinationId] : [t.originId]));
  const { status, connection: statusConnection } = useLiveStatus(watched);
  const { run, connection: runConnection } = useLatestRun();
  const fresh = freshness(run, now);
  const connection = statusConnection === "offline" || runConnection === "offline" ? "offline" : statusConnection;
  const dim = fresh.state === "stale" || fresh.state === "down";

  const [origin, setOrigin] = useState<Station | null>(null);
  const [destination, setDestination] = useState<Station | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

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

  async function add() {
    if (!origin) return;
    setSaving(true);
    setFormError(null);
    const { error } = await supabase.from("follows").insert({
      origin_station_id: origin.station_id,
      destination_station_id: destination?.station_id ?? null,
    });
    setSaving(false);
    if (error) {
      setFormError(
        error.code === "23505" ? "You already follow that trip." : error.message,
      );
      return;
    }
    setOrigin(null);
    setDestination(null);
    setVersion((v) => v + 1);
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
      <section aria-labelledby="add-trip">
        <h2 id="add-trip" className="text-lg font-semibold">Follow a trip</h2>
        <div className="mt-3 space-y-4">
          <StationPicker
            label="Pick up a bike at"
            hint="Search stations, for example “Clark & Lake”"
            value={origin}
            onChange={setOrigin}
            excludeId={destination?.station_id}
          />
          <StationPicker
            label="Drop it off at (optional)"
            hint="Search stations to also watch open docks"
            value={destination}
            onChange={setDestination}
            excludeId={origin?.station_id}
          />
          <button
            type="button"
            onClick={add}
            disabled={!origin || saving}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {saving ? "Adding…" : "Follow trip"}
          </button>
          {formError && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{formError}</p>}
        </div>
      </section>

      <section aria-labelledby="my-trips">
        <h2 id="my-trips" className="text-lg font-semibold">Your trips</h2>
        <div className="mt-3">
          <FreshnessBanner freshness={fresh} connection={connection} now={now} />
        </div>
        {loadError && <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">Could not load your trips: {loadError}</p>}
        {!loadError && trips === null && <p className="mt-3 text-sm text-zinc-500">Loading your trips…</p>}
        {trips?.length === 0 && (
          <p className="mt-3 text-sm text-zinc-500">You are not following any trips yet. Add one above.</p>
        )}
        <ul className={`mt-3 space-y-3 transition-opacity ${dim ? "opacity-60" : ""}`} aria-label="Your followed trips">
          {trips?.map((t) => (
            <TripCard
              key={t.id}
              origin={t.origin}
              destination={t.destination}
              originStatus={status.get(t.originId)}
              destinationStatus={t.destinationId ? status.get(t.destinationId) : undefined}
              now={now}
              onRemove={() => remove(t.id)}
            />
          ))}
        </ul>
      </section>
    </div>
  );
}
