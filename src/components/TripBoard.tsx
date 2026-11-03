"use client";

import { useState } from "react";
import { freshness } from "@/lib/freshness";
import { useLatestRun } from "@/lib/latestRun";
import { useLiveStatus } from "@/lib/liveStatus";
import { orient } from "@/lib/tripView";
import { useNow } from "@/lib/useNow";
import { FreshnessBanner } from "./FreshnessBanner";
import { TripCard } from "./TripCard";

export type Trip = {
  id: string;
  originId: string;
  destinationId: string | null;
  origin: string;
  destination: string | null;
};

type Props = {
  heading: string;
  /** null while the list is still loading */
  trips: Trip[] | null;
  loadError: string | null;
  emptyText: string;
  removeLabel: string;
  onRemove: (id: string) => void;
};

/**
 * The live part of the page: the freshness banner and one card per trip, kept current
 * through Realtime. A trip with a destination can be flipped to show its return leg.
 */
export function TripBoard({ heading, trips, loadError, emptyText, removeLabel, onRemove }: Props) {
  const now = useNow(1000);
  // Trips currently shown as their return leg. Display only: nothing is saved, so a reload
  // shows every trip as saved. The two stations are the same, so no new subscription is needed.
  const [returning, setReturning] = useState<ReadonlySet<string>>(new Set());
  const toggleReturn = (id: string) =>
    setReturning((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  const watched = (trips ?? []).flatMap((t) => (t.destinationId ? [t.originId, t.destinationId] : [t.originId]));
  const { status, connection: statusConnection } = useLiveStatus(watched);
  const { run, connection: runConnection } = useLatestRun();
  const fresh = freshness(run, now);
  const connection = statusConnection === "offline" || runConnection === "offline" ? "offline" : statusConnection;
  const dim = fresh.state === "stale" || fresh.state === "down";

  return (
    <section aria-labelledby="board-heading">
      <h2 id="board-heading" className="text-lg font-bold">{heading}</h2>
      <div className="mt-3">
        <FreshnessBanner freshness={fresh} connection={connection} now={now} />
      </div>
      {loadError && <p role="alert" className="mt-3 text-sm text-red-700 dark:text-red-400">Could not load your trips: {loadError}</p>}
      {!loadError && trips === null && <p className="mt-3 text-sm text-muted">Loading your trips…</p>}
      {trips?.length === 0 && <p className="mt-3 text-sm text-muted">{emptyText}</p>}
      <ul className={`mt-3 space-y-3 transition-opacity ${dim ? "opacity-60" : ""}`} aria-label={heading}>
        {trips?.map((t) => {
          const v = orient(t, returning.has(t.id));
          return (
            <TripCard
              key={t.id}
              origin={v.pickup}
              destination={v.dropoff}
              originStatus={status.get(v.pickupId)}
              destinationStatus={v.dropoffId ? status.get(v.dropoffId) : undefined}
              now={now}
              removeLabel={removeLabel}
              onRemove={() => onRemove(t.id)}
              reversed={v.reversed}
              onReverse={t.destinationId ? () => toggleReturn(t.id) : undefined}
            />
          );
        })}
      </ul>
    </section>
  );
}
