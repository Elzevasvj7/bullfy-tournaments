import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { cors, ok, err } from "../_shared/tournament-helpers.js";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const url = new URL(req.url);
    const username = (url.searchParams.get("username") || "").trim().toLowerCase();
    if (!username) return err("username requerido");

    const supa = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: user } = await supa
      .from("tournament_users")
      .select("id, username, full_name, avatar_url, avatar_config, avatar_3d_url, country, bio, bullfy_points, lifetime_winnings_usd, public_profile, is_elite, is_verified_user, clan_id, created_at, preferred_pose")
      .ilike("username", username)
      .maybeSingle();

    // Mensaje genérico para no permitir enumerar usernames existentes vs
    // ausentes. Antes distinguir entre "no encontrado" y "privado" expone
    // qué usernames están registrados.
    if (!user || !user.public_profile) return err("Perfil no disponible");

    let clan: any = null;
    if (user.clan_id) {
      const { data: c } = await supa.from("tournament_clans")
        .select("id, name, tag, logo_url, is_verified").eq("id", user.clan_id).maybeSingle();
      clan = c || null;
    }


    // Stats agregados
    const { data: parts } = await supa
      .from("tournament_participants")
      .select("final_rank, prize_won_usd, profit_pct, status, tournament_id, joined_at")
      .eq("user_id", user.id)
      .order("joined_at", { ascending: false });

    const totalTournaments = parts?.length || 0;
    const wins = parts?.filter((p: any) => p.final_rank === 1).length || 0;
    const podiums = parts?.filter((p: any) => p.final_rank && p.final_rank <= 3).length || 0;
    const winRate = totalTournaments > 0 ? Math.round((wins / totalTournaments) * 1000) / 10 : 0;
    const avgProfit = totalTournaments > 0
      ? Math.round((parts!.reduce((s: number, p: any) => s + Number(p.profit_pct || 0), 0) / totalTournaments) * 100) / 100
      : 0;

    // Logros desbloqueados
    const { data: achievements } = await supa
      .from("tournament_user_achievements")
      .select("unlocked_at, tournament_achievements(code, name, icon, description, reward_points)")
      .eq("user_id", user.id)
      .order("unlocked_at", { ascending: false });

    // Ranking aproximado por BP
    const { count: betterCount } = await supa
      .from("tournament_users")
      .select("id", { count: "exact", head: true })
      .eq("public_profile", true)
      .gt("bullfy_points", user.bullfy_points || 0);
    const rank = (betterCount || 0) + 1;

    return ok({
      user: {
        username: user.username,
        full_name: user.full_name,
        avatar_url: user.avatar_url,
        avatar_config: user.avatar_config,
        avatar_3d_url: user.avatar_3d_url,
        country: user.country,
        bio: user.bio,
        is_elite: user.is_elite,
        is_verified_user: user.is_verified_user,
        bullfy_points: user.bullfy_points,
        lifetime_winnings_usd: user.lifetime_winnings_usd,
        member_since: user.created_at,
        clan,
      },

      stats: {
        total_tournaments: totalTournaments,
        wins,
        podiums,
        win_rate_pct: winRate,
        avg_profit_pct: avgProfit,
        global_rank: rank,
      },
      achievements: (achievements || []).map((a: any) => ({
        unlocked_at: a.unlocked_at,
        ...a.tournament_achievements,
      })),
      recent_tournaments: (parts || []).slice(0, 10),
    });
  } catch (e) {
    return err((e as Error).message || "Error");
  }
});
