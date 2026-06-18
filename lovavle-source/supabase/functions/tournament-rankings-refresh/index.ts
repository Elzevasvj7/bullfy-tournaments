// Recomputes global tournament_rankings_cache (all-time, by lifetime winnings + points).
// PR #8 — D4b: reemplazado delete + insert por upsert sobre (user_id, scope, period).
//              Antes: si el INSERT fallaba después del DELETE, el ranking
//              global quedaba VACÍO hasta el próximo cron (5 min). Ahora la
//              tabla nunca queda sin datos. Las filas de usuarios que salen
//              del top 500 quedan stale; aceptable porque la lectura filtra
//              por rank y la siguiente ejecución reescribe si reentran.
//              Mismo fix ya aplicado en tournament-clan-rankings-refresh
//              (PR #6) sobre clan rankings.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { cors, ok, err, requireServiceRole } from "../_shared/tournament-helpers.js";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  // Solo cron jobs o callers con service-role
  if (!requireServiceRole(req)) return err("No autorizado", {}, 403);
  try {
    const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: users } = await supa.from("tournament_users")
      .select("id, lifetime_winnings_usd, bullfy_points")
      .order("lifetime_winnings_usd", { ascending: false }).limit(500);

    const rows = (users || []).map((u, i) => ({
      user_id: u.id, scope: "global", period: "all_time", rank: i + 1,
      total_winnings_usd: u.lifetime_winnings_usd, total_points: u.bullfy_points,
      computed_at: new Date().toISOString(),
    }));

    if (rows.length) {
      // La tabla tiene UNIQUE (user_id, scope, period) — el upsert reescribe
      // el rank/winnings/points para cada usuario del top 500 sin ventana de
      // tabla vacía.
      await supa.from("tournament_rankings_cache").upsert(rows, {
        onConflict: "user_id,scope,period",
      });
    }
    return ok({ refreshed: rows.length });
  } catch (e) {
    return err((e as Error).message);
  }
});
