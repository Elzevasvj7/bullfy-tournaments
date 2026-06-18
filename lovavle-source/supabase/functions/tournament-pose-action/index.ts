import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { cors, ok, err } from "../_shared/tournament-helpers.js";

// Pose catalog kept in sync with src/pages/tournament/components/avatarAnimations.ts
const POSE_COSTS: Record<string, number> = {
  idle: 0,
  wave: 0,
  weight_shift: 0,
  crossed_arms: 0,
  bow: 50,
  salute: 100,
  thinking: 100,
  clapping: 150,
  yelling: 200,
  cheer: 300,
  hip_hop_dance: 500,
  samba_dance: 800,
};

const FREE_POSES = Object.keys(POSE_COSTS).filter((k) => POSE_COSTS[k] === 0);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const auth = req.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token) return err("Sin token");

    const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: session } = await supa.from("tournament_user_sessions")
      .select("user_id, expires_at").eq("token", token).maybeSingle();
    if (!session) return err("Sesión no encontrada");
    if (new Date(session.expires_at) < new Date()) return err("Sesión expirada");

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "");
    const poseKey = String(body.pose_key || "");

    if (!(poseKey in POSE_COSTS)) return err("Pose desconocida");

    const userId = session.user_id;

    if (action === "equip") {
      // Verify ownership: free pose or unlocked
      if (!FREE_POSES.includes(poseKey)) {
        const { data: owned } = await supa.from("tournament_user_poses")
          .select("id").eq("user_id", userId).eq("pose_key", poseKey).maybeSingle();
        if (!owned) return err("Esta pose no está desbloqueada");
      }
      const { error: upErr } = await supa.from("tournament_users")
        .update({ preferred_pose: poseKey }).eq("id", userId);
      if (upErr) return err(upErr.message);
      return ok({ preferred_pose: poseKey });
    }

    if (action === "unlock") {
      const cost = POSE_COSTS[poseKey];
      if (cost === 0) return err("Esta pose ya es gratuita");

      // Already owned?
      const { data: existing } = await supa.from("tournament_user_poses")
        .select("id").eq("user_id", userId).eq("pose_key", poseKey).maybeSingle();
      if (existing) return err("Ya tienes esta pose");

      // Check balance
      const { data: user } = await supa.from("tournament_users")
        .select("bullfy_points").eq("id", userId).maybeSingle();
      if (!user) return err("Usuario no encontrado");
      if ((user.bullfy_points || 0) < cost) return err("Bullfy Points insuficientes");

      // Deduct via canonical RPC (delta negativo)
      const { error: payErr } = await supa.rpc("tournament_award_points", {
        _user_id: userId,
        _amount: -cost,
        _reason: "pose_unlock",
        _ref_type: "pose",
        _metadata: { pose_key: poseKey, cost },
      });
      if (payErr) return err(payErr.message);

      // Insert unlocked pose
      const { error: insErr } = await supa.from("tournament_user_poses")
        .insert({ user_id: userId, pose_key: poseKey });
      if (insErr) {
        // Rollback: refund
        await supa.rpc("tournament_award_points", {
          _user_id: userId,
          _amount: cost,
          _reason: "pose_unlock_refund",
          _ref_type: "pose",
          _metadata: { pose_key: poseKey, reason: insErr.message },
        });
        return err(insErr.message);
      }

      const { data: refreshed } = await supa.from("tournament_users")
        .select("bullfy_points").eq("id", userId).maybeSingle();

      return ok({ unlocked: poseKey, balance: refreshed?.bullfy_points ?? 0 });
    }

    return err("Acción inválida");
  } catch (e) {
    return err((e as Error).message);
  }
});
