// Returns the user's gamification snapshot: points history, unlocked achievements,
// all available achievements (with locked/unlocked flag), referrals and referral stats.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { cors, ok, err, requireTournamentUser } from "../_shared/tournament-helpers.js";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { user, error: authErr } = await requireTournamentUser(req, supa);
    if (!user) return err(authErr || "No autenticado");

    const [ledgerR, achAllR, achMineR, refR] = await Promise.all([
      supa.from("tournament_points_ledger")
        .select("id, delta, reason, metadata, created_at")
        .eq("user_id", user.id).order("created_at", { ascending: false }).limit(50),
      supa.from("tournament_achievements")
        .select("id, code, name, description, icon, reward_points, sort_order")
        .eq("is_active", true).order("sort_order", { ascending: true }),
      supa.from("tournament_user_achievements")
        .select("achievement_id, unlocked_at, metadata").eq("user_id", user.id),
      supa.from("tournament_referrals")
        .select("id, referred_user_id, status, qualified_at, rewarded_at, reward_points, created_at")
        .eq("referrer_user_id", user.id).order("created_at", { ascending: false }),
    ]);

    const unlocked = new Map<string, any>(
      (achMineR.data || []).map((r: any) => [r.achievement_id, r])
    );
    const achievements = (achAllR.data || []).map((a: any) => ({
      ...a, unlocked: unlocked.has(a.id), unlocked_at: unlocked.get(a.id)?.unlocked_at ?? null,
    }));

    // Resolve referred user names (best effort)
    const referredIds = (refR.data || []).map((r: any) => r.referred_user_id);
    let referredMap: Record<string, any> = {};
    if (referredIds.length) {
      const { data: ref } = await supa.from("tournament_users")
        .select("id, full_name, created_at").in("id", referredIds);
      referredMap = Object.fromEntries((ref || []).map((u: any) => [u.id, u]));
    }
    const referrals = (refR.data || []).map((r: any) => ({
      ...r,
      referred_name: referredMap[r.referred_user_id]?.full_name ?? null,
      referred_joined_at: referredMap[r.referred_user_id]?.created_at ?? null,
    }));

    const stats = {
      bullfy_points: user.bullfy_points,
      daily_streak: user.daily_streak ?? 0,
      referral_code: user.referral_code,
      referrals_total: referrals.length,
      referrals_qualified: referrals.filter((r: any) => r.status !== "pending").length,
      achievements_unlocked: achievements.filter((a: any) => a.unlocked).length,
      achievements_total: achievements.length,
    };

    return ok({
      stats,
      ledger: ledgerR.data || [],
      achievements,
      referrals,
    });
  } catch (e) {
    return err((e as Error).message);
  }
});
