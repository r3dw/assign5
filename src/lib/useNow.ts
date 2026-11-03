"use client";

import { useEffect, useState } from "react";

/** The current time in milliseconds, refreshed on an interval, so "3 min ago" labels stay accurate. */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

/** "just now", "42 s ago", "5 min ago", "2 h ago". */
export function ago(fromMs: number, nowMs: number): string {
  if (!Number.isFinite(fromMs)) return "a while ago";
  const s = Math.max(0, Math.round((nowMs - fromMs) / 1000));
  if (s < 5) return "just now";
  if (s < 60) return `${s} s ago`;
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  return `${Math.floor(s / 3600)} h ago`;
}
