// Estado de ventana de trading de un torneo. Público.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { cors, ok, err } from "../_shared/tournament-helpers.js";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { tournament_id, slug } = await req.json();
    const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    let q = supa.from("tournaments").select("id, slug, status, starts_at, ends_at, cleanup_at, trading_enabled_at, trading_disabled_at, cleanup_done");
    q = tournament_id ? q.eq("id", tournament_id) : q.eq("slug", slug);
    const { data: t } = await q.maybeSingle();
    if (!t) return err("Torneo no encontrado");

    const now = Date.now();
    const startMs = new Date(t.starts_at).getTime();
    const endMs = new Date(t.ends_at).getTime();
    const cleanupMs = t.cleanup_at ? new Date(t.cleanup_at).getTime() : endMs + 30 * 60 * 1000;

    const window_open = t.status === "running" && now >= startMs && now < endMs;
    let phase: "pending" | "open" | "closed" | "cleaned" = "pending";
    if (t.cleanup_done) phase = "cleaned";
    else if (now >= endMs) phase = "closed";
    else if (now >= startMs) phase = "open";

    return ok({
      tournament: t,
      window_open,
      phase,
      time_to_open_seconds: Math.max(0, Math.floor((startMs - now) / 1000)),
      time_to_close_seconds: Math.max(0, Math.floor((endMs - now) / 1000)),
      time_to_cleanup_seconds: Math.max(0, Math.floor((cleanupMs - now) / 1000)),
    });
  } catch (e) {
    return err((e as Error).message);
  }
});
