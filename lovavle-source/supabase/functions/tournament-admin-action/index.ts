// Acciones administrativas globales: aprobar/rechazar KYC, retiros, torneos, ban usuarios.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { cors, ok, err } from "../_shared/tournament-helpers.js";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SVC = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

const ADMIN_ROLES = new Set(["global_admin", "admin"]);
const AVATURN_API = "https://api.avaturn.me/api/v1";

async function purgeAvaturn(supa: any, userId: string): Promise<{ purged: boolean; reason?: string }> {
  const apiKey = Deno.env.get("AVATURN_API_KEY");
  if (!apiKey) return { purged: false, reason: "AVATURN_API_KEY missing" };
  const { data: u } = await supa.from("tournament_users")
    .select("avatar_config, avatar_3d_url").eq("id", userId).maybeSingle();
  const avaturnUserId = u?.avatar_config?.avaturn_user_id;
  if (!avaturnUserId) return { purged: false, reason: "no avaturn user" };
  try {
    const r = await fetch(`${AVATURN_API}/users/${avaturnUserId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!r.ok && r.status !== 404) {
      const t = await r.text();
      console.error("avaturn delete failed", r.status, t);
      return { purged: false, reason: `avaturn ${r.status}` };
    }
    // Wipe local refs to the avatar
    const newCfg = { ...(u?.avatar_config || {}) };
    delete newCfg.avaturn_user_id;
    delete newCfg.avaturn_avatar_id;
    await supa.from("tournament_users").update({
      avatar_config: Object.keys(newCfg).length ? newCfg : null,
      avatar_3d_url: null,
    }).eq("id", userId);
    return { purged: true };
  } catch (e: any) {
    console.error("purgeAvaturn error", e);
    return { purged: false, reason: e?.message || "error" };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const auth = req.headers.get("Authorization") || "";
    if (!auth.startsWith("Bearer ")) return err("No autorizado");
    const userClient = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: auth } } });
    const { data: ud, error: ue } = await userClient.auth.getUser();
    if (ue || !ud?.user) return err("Sesión inválida");
    const { data: roles } = await userClient.from("user_roles").select("role").eq("user_id", ud.user.id);
    const isAdmin = (roles ?? []).some((r: any) => ADMIN_ROLES.has(r.role));
    if (!isAdmin) return err("Permisos insuficientes");

    const supa = createClient(SUPABASE_URL, SVC);
    const { action, target_id, payload } = await req.json();
    const log = (a: string, t: string, id: string, p: any = {}) =>
      supa.from("tournament_admin_audit").insert({ admin_user_id: ud.user!.id, action: a, target_type: t, target_id: id, payload: p });

    switch (action) {
      case "approve_kyc": {
        await supa.from("tournament_kyc_documents").update({
          status: "approved", reviewed_by: ud.user.id, reviewed_at: new Date().toISOString(),
        }).eq("user_id", target_id).eq("status", "pending");
        await supa.from("tournament_users").update({ kyc_status: "approved", is_elite: true }).eq("id", target_id);
        await log("approve_kyc", "tournament_user", target_id);
        return ok({});
      }
      case "reject_kyc": {
        await supa.from("tournament_kyc_documents").update({
          status: "rejected", reviewed_by: ud.user.id, reviewed_at: new Date().toISOString(),
          review_notes: payload?.notes || "",
        }).eq("user_id", target_id).eq("status", "pending");
        await supa.from("tournament_users").update({ kyc_status: "rejected", is_elite: false }).eq("id", target_id);
        await log("reject_kyc", "tournament_user", target_id, payload);
        return ok({});
      }
      case "approve_tournament": {
        await supa.from("tournaments").update({ approval_status: "approved" }).eq("id", target_id);
        await log("approve_tournament", "tournament", target_id);
        return ok({});
      }
      case "reject_tournament": {
        await supa.from("tournaments").update({
          approval_status: "rejected", status: "cancelled",
          rejection_reason: payload?.reason || null,
        }).eq("id", target_id);
        await log("reject_tournament", "tournament", target_id, payload);
        return ok({});
      }
      case "approve_withdrawal": {
        await supa.from("tournament_withdrawals").update({
          status: "approved", processed_by: ud.user.id, processed_at: new Date().toISOString(),
        }).eq("id", target_id);
        await log("approve_withdrawal", "tournament_withdrawal", target_id);
        return ok({});
      }
      case "mark_paid_withdrawal": {
        const { data: wd } = await supa.from("tournament_withdrawals").select("user_id, amount_usd").eq("id", target_id).maybeSingle();
        if (!wd) return err("Retiro no encontrado");
        await supa.from("tournament_withdrawals").update({
          status: "paid", processed_by: ud.user.id, processed_at: new Date().toISOString(),
          tx_hash: payload?.tx_hash || null,
        }).eq("id", target_id);
        // unlock funds
        const { data: w } = await supa.from("tournament_wallets").select("locked_usd").eq("user_id", wd.user_id).maybeSingle();
        await supa.from("tournament_wallets").update({
          locked_usd: Math.max(0, Number(w?.locked_usd ?? 0) - Number(wd.amount_usd)),
        }).eq("user_id", wd.user_id);
        await log("mark_paid_withdrawal", "tournament_withdrawal", target_id, payload);
        return ok({});
      }
      case "reject_withdrawal": {
        const { data: wd } = await supa.from("tournament_withdrawals").select("user_id, amount_usd").eq("id", target_id).maybeSingle();
        if (!wd) return err("Retiro no encontrado");
        await supa.from("tournament_withdrawals").update({
          status: "rejected", processed_by: ud.user.id, processed_at: new Date().toISOString(),
          notes: payload?.reason || null,
        }).eq("id", target_id);
        // refund to balance
        const { data: w } = await supa.from("tournament_wallets").select("balance_usd, locked_usd").eq("user_id", wd.user_id).maybeSingle();
        await supa.from("tournament_wallets").update({
          balance_usd: Number(w?.balance_usd ?? 0) + Number(wd.amount_usd),
          locked_usd: Math.max(0, Number(w?.locked_usd ?? 0) - Number(wd.amount_usd)),
        }).eq("user_id", wd.user_id);
        await log("reject_withdrawal", "tournament_withdrawal", target_id, payload);
        return ok({});
      }
      case "ban_user": {
        await supa.from("tournament_users").update({
          banned_at: new Date().toISOString(), ban_reason: payload?.reason || "policy",
        }).eq("id", target_id);
        // Also wipe Avaturn avatar (GDPR / no recursos huérfanos al banear)
        const avRes = await purgeAvaturn(supa, target_id);
        await log("ban_user", "tournament_user", target_id, { ...payload, avaturn: avRes });
        return ok({ avaturn: avRes });
      }
      case "unban_user": {
        await supa.from("tournament_users").update({ banned_at: null, ban_reason: null }).eq("id", target_id);
        await log("unban_user", "tournament_user", target_id);
        return ok({});
      }
      case "signed_kyc_url": {
        const { data: doc } = await supa.from("tournament_kyc_documents").select("file_url").eq("id", target_id).maybeSingle();
        if (!doc) return err("doc no encontrado");
        const { data: signed } = await supa.storage.from("tournament-kyc").createSignedUrl(doc.file_url, 300);
        return ok({ url: signed?.signedUrl });
      }
      case "dismiss_flag": {
        await supa.from("tournament_fraud_flags").update({
          status: "dismissed", reviewed_by: ud.user.id, reviewed_at: new Date().toISOString(),
          resolution_notes: payload?.notes || null,
        }).eq("id", target_id);
        await log("dismiss_flag", "tournament_fraud_flag", target_id, payload);
        return ok({});
      }
      case "confirm_flag": {
        const { data: flag } = await supa.from("tournament_fraud_flags")
          .select("participant_ids, user_ids, tournament_id").eq("id", target_id).maybeSingle();
        if (!flag) return err("Flag no encontrado");
        await supa.from("tournament_fraud_flags").update({
          status: "confirmed", reviewed_by: ud.user.id, reviewed_at: new Date().toISOString(),
          resolution_notes: payload?.notes || null,
        }).eq("id", target_id);
        // Auto-disqualify participants
        if (flag.participant_ids?.length) {
          await supa.from("tournament_participants").update({
            status: "disqualified", eliminated_at: new Date().toISOString(),
          }).in("id", flag.participant_ids);
        }
        await log("confirm_flag", "tournament_fraud_flag", target_id, payload);
        return ok({});
      }
      case "disqualify_participant": {
        await supa.from("tournament_participants").update({
          status: "disqualified", eliminated_at: new Date().toISOString(),
        }).eq("id", target_id);
        await log("disqualify_participant", "tournament_participant", target_id, payload);
        return ok({});
      }
      case "adjust_rank": {
        const newRank = Number(payload?.final_rank);
        if (!newRank || newRank < 1) return err("final_rank inválido");
        await supa.from("tournament_participants").update({ final_rank: newRank }).eq("id", target_id);
        await log("adjust_rank", "tournament_participant", target_id, payload);
        return ok({});
      }
      case "resolve_dispute": {
        await supa.from("tournament_disputes").update({
          status: payload?.status || "resolved",
          admin_response: payload?.response || null,
          resolved_by: ud.user.id, resolved_at: new Date().toISOString(),
        }).eq("id", target_id);
        await log("resolve_dispute", "tournament_dispute", target_id, payload);
        return ok({});
      }
      case "update_tournament": {
        const allowed = ["name","description","status","approval_status","max_participants","min_participants","prize_pool_usd","entry_fee_usd","starts_at","ends_at","registration_closes_at","modality","type","is_public","rejection_reason"];
        const updates: any = {};
        for (const k of allowed) if (payload?.[k] !== undefined) updates[k] = payload[k];
        if (Object.keys(updates).length === 0) return err("Sin cambios");
        const { error: ue } = await supa.from("tournaments").update(updates).eq("id", target_id);
        if (ue) return err(ue.message);
        await log("update_tournament", "tournament", target_id, updates);
        return ok({});
      }
      case "delete_tournament": {
        // Cascade-clean dependent rows then delete the tournament
        const tables = [
          "tournament_chat_messages","tournament_highlights","tournament_fraud_flags",
          "tournament_disputes","tournament_payments","tournament_participants",
        ];
        for (const tb of tables) {
          await supa.from(tb).delete().eq("tournament_id", target_id);
        }
        const { error: de } = await supa.from("tournaments").delete().eq("id", target_id);
        if (de) return err(de.message);
        await log("delete_tournament", "tournament", target_id, payload);
        return ok({});
      }
      case "refund_entry": {
        const { data: pay } = await supa.from("tournament_payments")
          .select("user_id, amount_usd, status").eq("id", target_id).maybeSingle();
        if (!pay) return err("Pago no encontrado");
        if (pay.status !== "completed") return err("Pago no está completado");
        const { data: w } = await supa.from("tournament_wallets")
          .select("balance_usd").eq("user_id", pay.user_id).maybeSingle();
        await supa.from("tournament_wallets").update({
          balance_usd: Number(w?.balance_usd ?? 0) + Number(pay.amount_usd),
        }).eq("user_id", pay.user_id);
        await supa.from("tournament_payments").update({
          status: "refunded", metadata: { refunded_by: ud.user.id, refunded_at: new Date().toISOString() },
        }).eq("id", target_id);
        await log("refund_entry", "tournament_payment", target_id, payload);
        return ok({});
      }
      case "list_tournament_users": {
        const q = (payload?.q || "").trim();
        let query = supa.from("tournament_users")
          .select("id, email, phone, full_name, username, country, kyc_status, is_elite, banned_at, created_at, bullfy_points")
          .order("created_at", { ascending: false }).limit(50);
        if (q) query = query.or(`email.ilike.%${q}%,phone.ilike.%${q}%,full_name.ilike.%${q}%,username.ilike.%${q}%`);
        const { data, error: le } = await query;
        if (le) return err(le.message);
        return ok({ users: data || [] });
      }
      case "force_login": {
        // Crea una sesión nueva válida 30 días para impersonar/dar acceso sin OTP
        const token = crypto.randomUUID() + "-" + crypto.randomUUID();
        const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        const { error: se } = await supa.from("tournament_user_sessions").insert({
          user_id: target_id, token, expires_at: expires,
        });
        if (se) return err(se.message);
        await log("force_login", "tournament_user", target_id, { admin: ud.user.id });
        return ok({ token, expires_at: expires });
      }
      case "update_user_contact": {
        const upd: any = {};
        if (typeof payload?.email === "string") upd.email = payload.email.trim().toLowerCase();
        if (typeof payload?.phone === "string") upd.phone = payload.phone.trim();
        if (typeof payload?.full_name === "string") upd.full_name = payload.full_name.trim();
        if (typeof payload?.username === "string") upd.username = payload.username.trim();
        if (Object.keys(upd).length === 0) return err("Sin cambios");
        const { error: ue2 } = await supa.from("tournament_users").update(upd).eq("id", target_id);
        if (ue2) return err(ue2.message);
        await log("update_user_contact", "tournament_user", target_id, upd);
        return ok({});
      }
      case "get_bp_config": {
        const { data } = await supa.from("tournament_bp_config").select("*").eq("id", 1).maybeSingle();
        return ok({ config: data });
      }
      case "update_bp_config": {
        const allowed = [
          "join_base_points","paid_multiplier","elite_multiplier","elite_entry_fee_threshold",
          "win_first_place_points","daily_streak_base_points","referral_first_deposit_points",
        ];
        const upd: any = { updated_at: new Date().toISOString(), updated_by: ud.user.id };
        for (const k of allowed) if (payload?.[k] !== undefined) upd[k] = Number(payload[k]);
        const { error: ue2 } = await supa.from("tournament_bp_config").update(upd).eq("id", 1);
        if (ue2) return err(ue2.message);
        await log("update_bp_config", "config", "1", payload);
        return ok({});
      }
      case "get_economy_config": {
        const { data } = await supa.from("tournament_global_config").select("*").eq("id", 1).maybeSingle();
        return ok({ config: data });
      }
      case "update_economy_config": {
        const allowed = [
          "bmoney_starting_balance","bmoney_topup_threshold","bmoney_topup_amount","bmoney_topup_cooldown_hours",
          "max_tournaments_per_user_per_day","house_fee_pct_default","bp_multiplier_bmoney","bp_multiplier_elite",
          "elite_min_deposit_usd","elite_kyc_required",
        ];
        const upd: any = { updated_at: new Date().toISOString() };
        for (const k of allowed) if (payload?.[k] !== undefined) {
          upd[k] = typeof payload[k] === "boolean" ? payload[k] : Number(payload[k]);
        }
        const { error: ue3 } = await supa.from("tournament_global_config").update(upd).eq("id", 1);
        if (ue3) return err(ue3.message);
        await log("update_economy_config", "config", "1", payload);
        return ok({});
      }
      case "delete_user": {
        // Borrado total de cuenta de torneo. Solo admin (los usuarios NO pueden darse de baja a sí mismos).
        const avRes = await purgeAvaturn(supa, target_id);
        // Cascade clean user-scoped rows
        const userTables = [
          "tournament_user_sessions","tournament_kyc_documents","tournament_chat_messages",
          "tournament_fraud_flags","tournament_disputes","tournament_payments",
          "tournament_withdrawals","tournament_participants","tournament_equity_snapshots",
          "tournament_bp_ledger","tournament_achievements_unlocked","tournament_referrals",
          "tournament_wallets","tournament_mt5_accounts",
        ];
        for (const tb of userTables) {
          await supa.from(tb).delete().eq("user_id", target_id);
        }
        const { error: de } = await supa.from("tournament_users").delete().eq("id", target_id);
        if (de) return err(de.message);
        await log("delete_user", "tournament_user", target_id, { ...payload, avaturn: avRes });
        return ok({ avaturn: avRes });
      }
      case "list_user_verifications": {
        const { data } = await supa.from("tournament_user_verifications")
          .select("id, user_id, id_front_url, id_back_url, selfie_url, status, review_notes, created_at, reviewed_at, tournament_users(full_name, email, username)")
          .eq("status", "pending").order("created_at", { ascending: true }).limit(100);
        return ok({ verifications: data || [] });
      }
      case "signed_verif_url": {
        // payload.path = storage path inside tournament-verifications bucket
        const path = payload?.path as string;
        if (!path) return err("path requerido");
        const { data: signed } = await supa.storage.from("tournament-verifications").createSignedUrl(path, 300);
        return ok({ url: signed?.signedUrl });
      }
      case "review_user_verification": {
        const verification_id = target_id;
        const decision = payload?.decision;
        const notes = payload?.notes || null;
        const refund = !!payload?.refund;
        if (!verification_id || !["approve","reject"].includes(decision)) return err("Datos inválidos");
        const { data: v } = await supa.from("tournament_user_verifications").select("*").eq("id", verification_id).maybeSingle();
        if (!v) return err("Solicitud no encontrada");
        if (v.status !== "pending") return err("Ya revisada");
        if (decision === "approve") {
          await supa.from("tournament_user_verifications").update({
            status: "approved", review_notes: notes,
            reviewed_by: ud.user.id, reviewed_at: new Date().toISOString(),
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
            await supa.rpc("tournament_wallet_credit", { p_user_id: v.user_id, p_usd: 25, p_bmoney: 0 });
            finalStatus = "refunded";
          }
          await supa.from("tournament_user_verifications").update({
            status: finalStatus, review_notes: notes,
            reviewed_by: ud.user.id, reviewed_at: new Date().toISOString(),
          }).eq("id", verification_id);
          await supa.rpc("tournament_notify", {
            _user_id: v.user_id, _type: "verification_result",
            _title: refund ? "Verificación rechazada (reembolsada)" : "Verificación rechazada",
            _message: notes || "Tu solicitud no fue aprobada. Puedes intentarlo de nuevo.",
            _link: "/tournament/verify", _ref_type: "verification", _ref_id: verification_id,
          });
        }
        await log("review_user_verification", "tournament_user_verification", verification_id, { decision, refund });
        return ok({});
      }
      default: return err(`acción desconocida: ${action}`);
    }
  } catch (e) {
    return err((e as Error).message);
  }
});
