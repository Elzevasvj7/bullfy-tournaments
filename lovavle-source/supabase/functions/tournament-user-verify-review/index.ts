// Admin revisa solicitud de usuario verificado: approve | reject (refund opcional).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { cors, ok, err } from "../_shared/tournament-helpers.js";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Admin auth: usa el JWT de auth.users (sistema admin principal) — patrón ya usado en tournament-admin-action.
    const auth = req.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token) return err("Sin token");
    const { data: { user: adminUser } } = await supa.auth.getUser(token);
    if (!adminUser) return err("Admin no autenticado");
    const { data: role } = await supa.from("user_roles").select("role").eq("user_id", adminUser.id).in("role", ["admin","global_admin"]).maybeSingle();
    if (!role) return err("No autorizado");

    const { verification_id, decision, notes, refund } = await req.json();
    if (!verification_id || !["approve","reject"].includes(decision)) return err("Datos inválidos");

    const { data: v } = await supa.from("tournament_user_verifications").select("*").eq("id", verification_id).maybeSingle();
    if (!v) return err("Solicitud no encontrada");
    if (v.status !== "pending") return err("Ya revisada");

    if (decision === "approve") {
      await supa.from("tournament_user_verifications").update({
        status: "approved", review_notes: notes || null,
        reviewed_by: adminUser.id, reviewed_at: new Date().toISOString(),
      }).eq("id", verification_id);
      await supa.from("tournament_users").update({
        is_verified_user: true, verified_user_at: new Date().toISOString(),
      }).eq("id", v.user_id);
      await supa.rpc("tournament_award_points", {
        _user_id: v.user_id, _amount: 50, _reason: "user_verified",
        _ref_type: "verification", _ref_id: verification_id,
      });
      await supa.rpc("tournament_notify", {
        _user_id: v.user_id, _type: "verification_result",
        _title: "¡Cuenta verificada!",
        _message: "Tu solicitud fue aprobada. Insignia activada y +50 BP.",
        _link: "/tournament/dashboard", _ref_type: "verification", _ref_id: verification_id,
      });
    } else {
      let finalStatus = "rejected";
      if (refund) {
        // PR #7 A4: leer monto real del payment record en vez de hardcodear $25.
        // Si el precio del badge cambia en el futuro, el refund se mantiene
        // correcto. Para solicitudes históricas con payment_id null (por el
        // bug del enum previo) se usa $25 como fallback.
        const FALLBACK_REFUND = 25;
        let refundAmount = FALLBACK_REFUND;
        if (v.payment_id) {
          const { data: pay } = await supa.from("tournament_payments")
            .select("amount_usd").eq("id", v.payment_id).maybeSingle();
          if (pay && Number(pay.amount_usd) > 0) {
            refundAmount = Number(pay.amount_usd);
          }
        }
        await supa.rpc("tournament_wallet_credit", {
          p_user_id: v.user_id, p_usd: refundAmount, p_bmoney: 0,
        });
        // Marcar el payment como refunded para audit trail.
        if (v.payment_id) {
          await supa.from("tournament_payments").update({
            status: "refunded",
          }).eq("id", v.payment_id);
        }
        finalStatus = "refunded";
      }
      await supa.from("tournament_user_verifications").update({
        status: finalStatus, review_notes: notes || null,
        reviewed_by: adminUser.id, reviewed_at: new Date().toISOString(),
      }).eq("id", verification_id);
      await supa.rpc("tournament_notify", {
        _user_id: v.user_id, _type: "verification_result",
        _title: refund ? "Verificación rechazada (reembolsada)" : "Verificación rechazada",
        _message: notes || "Tu solicitud no fue aprobada. Puedes intentarlo de nuevo.",
        _link: "/tournament/verify", _ref_type: "verification", _ref_id: verification_id,
      });
    }

    return ok({});
  } catch (e) { return err((e as Error).message); }
});
