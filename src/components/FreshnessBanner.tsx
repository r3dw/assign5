"use client";

import type { Freshness } from "@/lib/freshness";
import type { Connection } from "@/lib/liveStatus";
import { ago } from "@/lib/useNow";

type Props = { freshness: Freshness; connection: Connection; now: number };

/**
 * Says how current the numbers are. Each state has its own wording, icon and colour
 * (never colour alone), and the page dims the cards when the data is stale or down.
 */
export function FreshnessBanner({ freshness: f, connection, now }: Props) {
  const reconnecting = connection === "offline";

  let tone: string;
  let icon: string;
  let title: string;
  let detail: string | null = null;

  switch (f.state) {
    case "loading":
      tone = "border-zinc-300 text-zinc-500 dark:border-zinc-700";
      icon = "…";
      title = "Checking that the data is current…";
      break;
    case "fresh":
      tone = "border-emerald-600/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300";
      icon = "●";
      title = "Live";
      detail = `Checked ${ago(f.checkedMs, now)}. Numbers update as soon as Divvy reports a change.`;
      break;
    case "stale":
      tone = "border-amber-600/50 bg-amber-500/10 text-amber-900 dark:text-amber-200";
      icon = "▲";
      title = "These numbers may be out of date";
      detail =
        f.checkedMs === null
          ? "The data feed has not reported yet. We will keep trying."
          : `The last successful check was ${ago(f.checkedMs, now)}. Updates should resume on their own.`;
      break;
    case "down":
      tone = "border-red-600/50 bg-red-500/10 text-red-900 dark:text-red-200";
      icon = "✕";
      title = "Divvy's data feed is not responding";
      detail = `Showing the last numbers we received. The latest check failed ${ago(now - f.failedMs, now)}.${f.error ? ` (${f.error})` : ""}`;
      break;
  }

  return (
    <div role="status" className={`rounded-md border px-4 py-3 text-sm ${tone}`}>
      <p className="font-medium">
        <span aria-hidden>{icon}</span> {title}
      </p>
      {detail && <p className="mt-0.5">{detail}</p>}
      {reconnecting && f.state !== "loading" && (
        <p className="mt-0.5 font-medium">
          Your live connection dropped. Reconnecting…
        </p>
      )}
    </div>
  );
}
