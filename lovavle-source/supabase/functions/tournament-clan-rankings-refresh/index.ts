// Recalcula ranking global de clanes. Recomendado cron cada 5 min.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { cors, ok, err, requireServiceRole } from "../_shared/tournament-helpers.js";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  // Solo cron jobs o callers con service-role
  if (!requireServiceRole(req)) return err("No autorizado", {}, 403);
  try {
    const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: clans } = await supa.from("tournament_clans")
      .select("id, rating, wars_won, members_count, total_score")
      .order("rating", { ascending: false }).limit(500);

    const rows = (clans || []).map((c, i) => ({
      clan_id: c.id, rank: i + 1,
      avg_member_score: c.members_count > 0 ? Number(c.total_score) / c.members_count : 0,
      wars_won: c.wars_won, rating: c.rating,
      members_count: c.members_count, computed_at: new Date().toISOString(),
    }));

    // Antes: delete-then-insert dejaba la tabla vacía si el INSERT fallaba
    // (ventana de caché caído de hasta 5 min). Ahora hacemos upsert sobre
    // clan_id — la tabla nunca queda vacía. Las filas de clanes que cayeron
    // fuera del top 500 quedan stale; aceptable porque la lectura suele
    // filtrar por rank <= N, y la siguiente ejecución las reescribe si
    // reentran al top.
    if (rows.length) {
      await supa.from("tournament_clan_rankings_cache").upsert(rows, { onConflict: "clan_id" });
    }

    return ok({ refreshed: rows.length });
  } catch (e) { return err((e as Error).message); }
});
