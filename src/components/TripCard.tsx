"use client";

import type { StationStatus } from "@/lib/liveStatus";
import { parseTime } from "@/lib/time";
import { ago } from "@/lib/useNow";
import { BikeMark } from "./BikeSketch";

type Props = {
  origin: string;
  destination: string | null;
  originStatus: StationStatus | undefined;
  destinationStatus: StationStatus | undefined;
  now: number;
  removeLabel: string;
  onRemove: () => void;
};

/** A docking post, for the "Drop off" label. */
function DockMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" className={className}>
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <path d="M9 8h6M9 12h6" />
    </svg>
  );
}

/** A number that briefly highlights when its station has just changed. */
function Figure({ value, changedAt, now }: { value: number; changedAt: string; now: number }) {
  const justChanged = now - parseTime(changedAt) < 5000;
  return (
    <span
      className={`inline-block rounded-md px-2 text-4xl font-bold tabular-nums leading-tight transition-colors duration-1000 ${
        justChanged ? "bg-sky/30" : "bg-transparent"
      }`}
    >
      {value}
    </span>
  );
}

function Side({
  heading,
  name,
  status,
  now,
  kind,
}: {
  heading: string;
  name: string;
  status: StationStatus | undefined;
  now: number;
  kind: "bikes" | "docks";
}) {
  let body: React.ReactNode;
  if (!status) {
    body = <p className="text-muted">Loading…</p>;
  } else {
    const count = kind === "bikes" ? status.bikes_available : status.docks_available;
    const closed = kind === "bikes" ? !status.is_renting : !status.is_returning;
    let warning: string | null = null;
    if (closed) warning = kind === "bikes" ? "This station is not renting bikes right now." : "This station is not accepting returns right now.";
    else if (count === 0) warning = kind === "bikes" ? "No bikes available." : "No open docks. The station is full.";
    else if (count <= 2) warning = kind === "bikes" ? "Only a few bikes left." : "Only a few docks left.";

    body = (
      <>
        <p>
          <Figure value={count} changedAt={status.updated_at} now={now} />{" "}
          <span className="text-muted">{kind === "bikes" ? "bikes" : "open docks"}</span>
          {kind === "bikes" && status.ebikes_available > 0 && (
            <span className="text-muted"> ({status.ebikes_available} electric)</span>
          )}
        </p>
        {warning && (
          <p role="status" className={count === 0 || closed ? "font-semibold text-red-700 dark:text-red-400" : "font-medium text-amber-700 dark:text-amber-400"}>
            {warning}
          </p>
        )}
        <p className="text-xs text-muted">Changed {ago(parseTime(status.updated_at), now)}</p>
      </>
    );
  }

  return (
    <div className="space-y-1">
      <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-brand">
        {kind === "bikes" ? <BikeMark className="h-4 w-6" /> : <DockMark className="h-4 w-4" />}
        {heading}
      </p>
      <p className="font-semibold">{name}</p>
      {body}
    </div>
  );
}

export function TripCard({ origin, destination, originStatus, destinationStatus, now, removeLabel, onRemove }: Props) {
  return (
    <li className="card border-l-4 border-l-sky p-5 text-sm">
      <div className="grid gap-5 sm:grid-cols-2">
        <Side heading="Pick up" name={origin} status={originStatus} now={now} kind="bikes" />
        {destination ? (
          <Side heading="Drop off" name={destination} status={destinationStatus} now={now} kind="docks" />
        ) : (
          <p className="self-center text-muted">No destination chosen.</p>
        )}
      </div>
      <div className="mt-4 text-right">
        <button
          type="button"
          onClick={onRemove}
          aria-label={`${removeLabel} the trip from ${origin}`}
          className="link-quiet"
        >
          Remove
        </button>
      </div>
    </li>
  );
}
