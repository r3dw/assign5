// Parsing for Divvy's GBFS feeds. Pure functions: no network, no database.
// Plain TypeScript so both Deno (the Edge Function) and Node (the tests) can run it.

export const STATUS_URL = "https://gbfs.lyft.com/gbfs/1.1/chi/en/station_status.json";
export const INFO_URL = "https://gbfs.lyft.com/gbfs/1.1/chi/en/station_information.json";

export type StatusRow = {
  station_id: string;
  bikes_available: number;
  ebikes_available: number;
  docks_available: number;
  bikes_disabled: number;
  docks_disabled: number;
  is_renting: boolean;
  is_returning: boolean;
};

export type StationRow = {
  station_id: string;
  name: string;
  short_name: string | null;
  lat: number | null;
  lon: number | null;
  capacity: number | null;
};

type Raw = Record<string, unknown>;

function stationsOf(json: unknown, what: string): Raw[] {
  const list = (json as { data?: { stations?: unknown } } | null | undefined)?.data?.stations;
  if (!Array.isArray(list) || list.length === 0) {
    throw new Error(`${what}: no stations in response`);
  }
  return list as Raw[];
}

function count(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.trunc(n) : 0;
}

/**
 * Turns the status feed into rows for station_status.
 *
 * `last_reported` is deliberately left out: it changes on about half of all stations
 * every minute even when nothing real changed, so saving it would make every poll
 * look like a change and burn the Realtime quota.
 */
export function parseStatus(json: unknown): StatusRow[] {
  return stationsOf(json, "station_status")
    .filter((s) => typeof s?.station_id === "string" && s.station_id !== "")
    .map((s) => ({
      station_id: s.station_id as string,
      bikes_available: count(s.num_bikes_available),
      ebikes_available: count(s.num_ebikes_available),
      docks_available: count(s.num_docks_available),
      bikes_disabled: count(s.num_bikes_disabled),
      docks_disabled: count(s.num_docks_disabled),
      is_renting: s.is_renting === 1 || s.is_renting === true,
      is_returning: s.is_returning === 1 || s.is_returning === true,
    }));
}

/** Turns the information feed into rows for stations. */
export function parseStations(json: unknown): StationRow[] {
  return stationsOf(json, "station_information")
    .filter((s) => typeof s?.station_id === "string" && typeof s?.name === "string")
    .map((s) => ({
      station_id: s.station_id as string,
      name: s.name as string,
      short_name: typeof s.short_name === "string" ? s.short_name : null,
      lat: typeof s.lat === "number" ? s.lat : null,
      lon: typeof s.lon === "number" ? s.lon : null,
      capacity: typeof s.capacity === "number" ? s.capacity : null,
    }));
}
