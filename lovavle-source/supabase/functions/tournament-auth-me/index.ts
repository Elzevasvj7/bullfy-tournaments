import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { cors, ok, err } from "../_shared/tournament-helpers.js";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const auth = req.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token) return err("Sin token");
    const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: session } = await supa.from("tournament_user_sessions")
      .select("id, user_id, expires_at").eq("token", token).maybeSingle();
    if (!session) return err("Sesión no encontrada");
    if (new Date(session.expires_at) < new Date()) return err("Sesión expirada");

    await supa.from("tournament_user_sessions").update({ last_used_at: new Date().toISOString() }).eq("id", session.id);

    // Daily streak check (idempotent per UTC day)
    let streakInfo: any = null;
    try {
      const { data: sd } = await supa.rpc("tournament_check_daily_streak", { _user_id: session.user_id });
      streakInfo = sd;
    } catch { /* non-fatal */ }

    const { data: user } = await supa.from("tournament_users")
      .select("id, email, phone, full_name, country, avatar_url, avatar_config, avatar_3d_url, is_elite, kyc_status, bullfy_points, lifetime_winnings_usd, referral_code, daily_streak, username, bio, public_profile, preferred_pose, clan_id, is_verified_user, verified_user_at")
      .eq("id", session.user_id).maybeSingle();
    if (!user) return err("Usuario no encontrado");

    const { data: wallet } = await supa.from("tournament_wallets")
      .select("balance_usd, locked_usd, bmoney_balance, bmoney_locked, last_bmoney_topup_at").eq("user_id", user.id).maybeSingle();

    const { data: poseRows } = await supa.from("tournament_user_poses")
      .select("pose_key").eq("user_id", user.id);
    const unlocked_poses = (poseRows || []).map((r: any) => r.pose_key);

    return ok({ user, wallet: wallet || { balance_usd: 0, locked_usd: 0, bmoney_balance: 0, bmoney_locked: 0, last_bmoney_topup_at: null }, streak: streakInfo, unlocked_poses });
  } catch (e) {
    return err((e as Error).message);
  }
});
