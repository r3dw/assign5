// Supabase Edge Function (Deno). Supabase Cron calls it every 30 seconds.
// The run itself lives in poll.ts so it can be tested without Deno.

import { createClient } from "npm:@supabase/supabase-js@2";
import type { Db } from "./poll.ts";
import { runPoll } from "./poll.ts";

// Supabase provides these to every Edge Function on its own servers. The service
// role key bypasses row-level security, so it must never leave this function.
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

function fail(error: { message: string }, what: string): never {
  throw new Error(`${what}: ${error.message}`);
}

const db: Db = {
  async applyStationStatus(rows) {
    const { data, error } = await supabase.rpc("apply_station_status", { rows });
    if (error) fail(error, "apply_station_status");
    return data as number;
  },
  async countStations() {
    const { count, error } = await supabase.from("stations").select("*", { count: "exact", head: true });
    if (error) fail(error, "count stations");
    return count ?? 0;
  },
  async upsertStations(rows) {
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await supabase.from("stations").upsert(rows.slice(i, i + 500), { onConflict: "station_id" });
      if (error) fail(error, "upsert stations");
    }
  },
  async recordRun(run) {
    const { error } = await supabase.from("worker_runs").insert(run);
    if (error) fail(error, "record run");
  },
};

Deno.serve(async (req) => {
  // Only Supabase Cron may trigger a run. It sends a secret stored in Vault; the
  // database checks it, so the secret is never copied into this function.
  const given = req.headers.get("x-cron-secret") ?? "";
  const { data: allowed } = await supabase.rpc("cron_secret_ok", { candidate: given });
  if (allowed !== true) {
    return new Response("Forbidden", { status: 403 });
  }

  try {
    const result = await runPoll(db);
    return Response.json(result, { status: result.ok ? 200 : 502 });
  } catch (e) {
    // The run could not even be recorded (for example, the database is unreachable).
    return Response.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
});
