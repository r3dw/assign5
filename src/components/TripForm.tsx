"use client";

import { useState } from "react";
import type { Station } from "@/lib/stations";
import { StationPicker } from "./StationPicker";

type Props = {
  heading: string;
  submitLabel: string;
  busyLabel: string;
  /** Returns an error message to show, or null on success (which clears the form). */
  onSubmit: (origin: Station, destination: Station | null) => Promise<string | null>;
};

export function TripForm({ heading, submitLabel, busyLabel, onSubmit }: Props) {
  const [origin, setOrigin] = useState<Station | null>(null);
  const [destination, setDestination] = useState<Station | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!origin) return;
    setBusy(true);
    setError(null);
    const problem = await onSubmit(origin, destination);
    setBusy(false);
    if (problem) {
      setError(problem);
      return;
    }
    setOrigin(null);
    setDestination(null);
  }

  return (
    <section aria-labelledby="trip-form-heading">
      <h2 id="trip-form-heading" className="text-lg font-semibold">{heading}</h2>
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
          onClick={submit}
          disabled={!origin || busy}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {busy ? busyLabel : submitLabel}
        </button>
        {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      </div>
    </section>
  );
}
