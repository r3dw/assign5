"use client";

import { freshness } from "@/lib/freshness";
import { useLatestRun } from "@/lib/latestRun";
import { useLiveStatus } from "@/lib/liveStatus";
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
 * through Realtime. Shared by signed-in visitors (saved trips) and signed-out visitors
 * (trips that exist only in their browser), because the live data is public.
 */
export function TripBoard({ heading, trips, loadError, emptyText, removeLabel, onRemove }: Props) {
  const now = useNow(1000);
  const watched = (trips ?? []).flatMap((t) => (t.destinationId ? [t.originId, t.destinationId] : [t.originId]));
  const { status, connection: statusConnection } = useLiveStatus(watched);
  const { run, connection: runConnection } = useLatestRun();
  const fresh = freshness(run, now);
  const connection = statusConnection === "offline" || runConnection === "offline" ? "offline" : statusConnection;
  const dim = fresh.state === "stale" || fresh.state === "down";

  return (
    <section aria-labelledby="board-heading">
      <h2 id="board-heading" className="text-lg font-semibold">{heading}</h2>
      <div className="mt-3">
        <FreshnessBanner freshness={fresh} connection={connection} now={now} />
      </div>
      {loadError && <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">Could not load your trips: {loadError}</p>}
      {!loadError && trips === null && <p className="mt-3 text-sm text-zinc-500">Loading your trips…</p>}
      {trips?.length === 0 && <p className="mt-3 text-sm text-zinc-500">{emptyText}</p>}
      <ul className={`mt-3 space-y-3 transition-opacity ${dim ? "opacity-60" : ""}`} aria-label={heading}>
        {trips?.map((t) => (
          <TripCard
            key={t.id}
            origin={t.origin}
            destination={t.destination}
            originStatus={status.get(t.originId)}
            destinationStatus={t.destinationId ? status.get(t.destinationId) : undefined}
            now={now}
            removeLabel={removeLabel}
            onRemove={() => onRemove(t.id)}
          />
        ))}
      </ul>
    </section>
  );
}
