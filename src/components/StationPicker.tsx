"use client";

import { useEffect, useId, useState } from "react";
import { searchStations, type Station } from "@/lib/stations";
import { useSupabase } from "@/lib/supabase";

type Props = {
  label: string;
  hint: string;
  value: Station | null;
  onChange: (station: Station | null) => void;
  /** A station that cannot be picked here, such as the origin when choosing a destination. */
  excludeId?: string;
};

export function StationPicker({ label, hint, value, onChange, excludeId }: Props) {
  const supabase = useSupabase();
  const inputId = useId();
  const listId = useId();
  const [text, setText] = useState("");
  const [found, setFound] = useState<{ query: string; stations: Station[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Search 250 ms after the user stops typing.
  useEffect(() => {
    const query = text.trim();
    if (query.length < 2) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const stations = await searchStations(supabase, query);
        if (!cancelled) {
          setFound({ query, stations });
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Search failed");
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [text, supabase]);

  const query = text.trim();
  const results = (found?.query === query ? found.stations : []).filter((s) => s.station_id !== excludeId);
  const searching = query.length >= 2 && found?.query !== query && !error;

  if (value) {
    return (
      <div>
        <span className="block text-sm font-medium">{label}</span>
        <div className="mt-1 flex items-center justify-between rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700">
          <span>{value.name}</span>
          <button
            type="button"
            onClick={() => {
              onChange(null);
              setText("");
            }}
            className="text-zinc-500 underline hover:text-zinc-800 dark:hover:text-zinc-200"
          >
            Change
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <label htmlFor={inputId} className="block text-sm font-medium">
        {label}
      </label>
      <input
        id={inputId}
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={hint}
        autoComplete="off"
        aria-controls={listId}
        className="mt-1 w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700"
      />
      <ul id={listId} className="mt-1 text-sm" aria-live="polite">
        {error && <li className="px-3 py-2 text-red-600 dark:text-red-400">Could not search: {error}</li>}
        {searching && <li className="px-3 py-2 text-zinc-500">Searching…</li>}
        {!searching && !error && query.length >= 2 && results.length === 0 && (
          <li className="px-3 py-2 text-zinc-500">No stations match “{query}”.</li>
        )}
        {results.map((s) => (
          <li key={s.station_id}>
            <button
              type="button"
              onClick={() => {
                onChange(s);
                setText("");
              }}
              className="w-full rounded-md px-3 py-2 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              {s.name}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
