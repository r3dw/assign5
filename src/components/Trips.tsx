"use client";

import { useEffect, useState } from "react";
import { stationNames, type Station } from "@/lib/stations";
import { useSupabase } from "@/lib/supabase";
import { StationPicker } from "./StationPicker";

type Trip = { id: string; originId: string; destinationId: string | null; origin: string; destination: string | null };

export function Trips() {
  const supabase = useSupabase();
  const [trips, setTrips] = useState<Trip[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

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
        {loadError && <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">Could not load your trips: {loadError}</p>}
        {!loadError && trips === null && <p className="mt-3 text-sm text-zinc-500">Loading your trips…</p>}
        {trips?.length === 0 && (
          <p className="mt-3 text-sm text-zinc-500">You are not following any trips yet. Add one above.</p>
        )}
        <ul className="mt-3 space-y-3">
          {trips?.map((t) => (
            <li key={t.id} className="flex items-start justify-between gap-4 rounded-md border border-zinc-200 p-4 text-sm dark:border-zinc-800">
              <div>
                <p><span className="text-zinc-500">From</span> <strong>{t.origin}</strong></p>
                <p><span className="text-zinc-500">To</span> {t.destination ? <strong>{t.destination}</strong> : <em className="text-zinc-500">no destination</em>}</p>
              </div>
              <button
                type="button"
                onClick={() => remove(t.id)}
                aria-label={`Stop following the trip from ${t.origin}`}
                className="text-zinc-500 underline hover:text-zinc-800 dark:hover:text-zinc-200"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
