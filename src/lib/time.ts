/**
 * Parses a timestamp from Supabase. Fetched rows come back as ISO 8601
 * ("2026-11-03T03:36:00.12+00:00"), but Realtime passes Postgres's own text through
 * ("2026-11-03 03:36:00.12+00": a space instead of T, and an offset with no minutes).
 * Some browsers, Safari in particular, reject that form and return NaN, so it is
 * normalised first. Returns NaN if the value still cannot be read.
 */
export function parseTime(value: string | null | undefined): number {
  if (!value) return NaN;
  const iso = value.trim().replace(" ", "T").replace(/([+-]\d\d)$/, "$1:00");
  return new Date(iso).getTime();
}
