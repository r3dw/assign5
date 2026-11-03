"use client";

import type { StationStatus } from "@/lib/liveStatus";
import { parseTime } from "@/lib/time";
import { ago } from "@/lib/useNow";

type Props = {
  origin: string;
  destination: string | null;
  originStatus: StationStatus | undefined;
  destinationStatus: StationStatus | undefined;
  now: number;
  removeLabel: string;
  onRemove: () => void;
};

/** A number that briefly highlights when its station has just changed. */
function Figure({ value, changedAt, now }: { value: number; changedAt: string; now: number }) {
  const justChanged = now - parseTime(changedAt) < 5000;
  return (
    <span
      className={`inline-block rounded px-1.5 text-2xl font-semibold tabular-nums transition-colors duration-1000 ${
        justChanged ? "bg-amber-300/30" : "bg-transparent"
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
    body = <p className="text-zinc-500">Loading…</p>;
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
          <span className="text-zinc-500">{kind === "bikes" ? "bikes" : "open docks"}</span>
          {kind === "bikes" && status.ebikes_available > 0 && (
            <span className="text-zinc-500"> ({status.ebikes_available} electric)</span>
          )}
        </p>
        {warning && (
          <p role="status" className={count === 0 || closed ? "font-medium text-red-600 dark:text-red-400" : "text-amber-700 dark:text-amber-400"}>
            {warning}
          </p>
        )}
        <p className="text-xs text-zinc-500">Changed {ago(parseTime(status.updated_at), now)}</p>
      </>
    );
  }

  return (
    <div className="space-y-1">
      <p className="text-xs uppercase tracking-wide text-zinc-500">{heading}</p>
      <p className="font-medium">{name}</p>
      {body}
    </div>
  );
}

export function TripCard({ origin, destination, originStatus, destinationStatus, now, removeLabel, onRemove }: Props) {
  return (
    <li className="rounded-md border border-zinc-200 p-4 text-sm dark:border-zinc-800">
      <div className="grid gap-4 sm:grid-cols-2">
        <Side heading="Pick up" name={origin} status={originStatus} now={now} kind="bikes" />
        {destination ? (
          <Side heading="Drop off" name={destination} status={destinationStatus} now={now} kind="docks" />
        ) : (
          <p className="self-center text-zinc-500">No destination chosen.</p>
        )}
      </div>
      <div className="mt-3 text-right">
        <button
          type="button"
          onClick={onRemove}
          aria-label={`${removeLabel} the trip from ${origin}`}
          className="text-zinc-500 underline hover:text-zinc-800 dark:hover:text-zinc-200"
        >
          Remove
        </button>
      </div>
    </li>
  );
}
