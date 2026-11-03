import type { SupabaseClient } from "@supabase/supabase-js";

export type Station = { station_id: string; name: string };

/**
 * Searches station names as the user types. Done on the server side (ilike) because
 * there are about 2,000 stations and Supabase returns at most 1,000 rows per request.
 */
export async function searchStations(supabase: SupabaseClient, query: string, limit = 8): Promise<Station[]> {
  const q = query.trim().replace(/[%_\\]/g, "\\$&"); // typed % and _ are literal characters
  if (q.length < 2) return [];
  const { data, error } = await supabase
    .from("stations")
    .select("station_id, name")
    .ilike("name", `%${q}%`)
    .order("name")
    .limit(limit);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function stationNames(supabase: SupabaseClient, ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const { data, error } = await supabase.from("stations").select("station_id, name").in("station_id", ids);
  if (error) throw new Error(error.message);
  return new Map((data ?? []).map((s) => [s.station_id as string, s.name as string]));
}
