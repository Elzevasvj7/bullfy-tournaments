// Devuelve participantes ordenados por score, con nombres y puntos.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { cors, ok, err } from "../_shared/tournament-helpers.js";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const url = new URL(req.url);
    const slug = url.searchParams.get("slug");
    const tournament_id = url.searchParams.get("tournament_id");
    const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    let tq = supa.from("tournaments").select("id, slug, name, status, modality, current_round, ends_at, current_round_ends_at");
    tq = tournament_id ? tq.eq("id", tournament_id) : tq.eq("slug", slug || "");
    const { data: t } = await tq.maybeSingle();
    if (!t) return err("Torneo no encontrado");

    const { data: parts } = await supa.from("tournament_participants")
      .select("id, user_id, current_score, current_equity, profit_pct, winrate, trades_count, status, final_rank, prize_won_usd, points_won, group_id, current_round")
      .eq("tournament_id", t.id)
      .order("current_score", { ascending: false });

    const ids = (parts || []).map((p) => p.user_id);
    const { data: users } = ids.length
      ? await supa.from("tournament_users").select("id, full_name, country, avatar_url").in("id", ids)
      : { data: [] as any[] };
    const uMap = new Map((users || []).map((u: any) => [u.id, u]));

    const ranked = (parts || []).map((p, i) => ({ rank: i + 1, ...p, user: uMap.get(p.user_id) }));

    return ok({ tournament: t, participants: ranked });
  } catch (e) {
    return err((e as Error).message);
  }
});
