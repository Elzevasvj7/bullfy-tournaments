// Usuario sube 3 documentos (base64) y paga $25 USDT del wallet. Queda en pending para revisión admin.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { cors, ok, err, requireTournamentUser } from "../_shared/tournament-helpers.js";

const VERIFY_USER_COST = 25;

interface DocIn { kind: "id_front"|"id_back"|"selfie"; filename: string; mime: string; content_base64: string; }

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { user, error: authErr } = await requireTournamentUser(req, supa);
    if (!user) return err(authErr || "No autenticado");

    if (user.is_verified_user) return err("Ya eres usuario verificado");

    const { data: pending } = await supa.from("tournament_user_verifications")
      .select("id").eq("user_id", user.id).eq("status", "pending").maybeSingle();
    if (pending) return err("Ya tienes una solicitud pendiente");

    const { documents } = await req.json() as { documents: DocIn[] };
    if (!Array.isArray(documents) || documents.length < 3) return err("Se requieren 3 documentos (frente, reverso, selfie)");

    const needed = new Set(["id_front", "id_back", "selfie"]);
    for (const d of documents) needed.delete(d.kind);
    if (needed.size > 0) return err("Faltan: " + Array.from(needed).join(", "));

    const { data: w } = await supa.from("tournament_wallets")
      .select("balance_usd").eq("user_id", user.id).maybeSingle();
    if (Number(w?.balance_usd ?? 0) < VERIFY_USER_COST) {
      return err(`Saldo USDT insuficiente. Necesitas $${VERIFY_USER_COST}.`);
    }

    const urls: Record<string, string> = {};
    for (const d of documents) {
      if (!d.content_base64) return err(`${d.kind} sin contenido`);
      const bytes = Uint8Array.from(atob(d.content_base64), (c) => c.charCodeAt(0));
      if (bytes.length > 8 * 1024 * 1024) return err(`${d.kind} excede 8MB`);
      const ext = (d.filename.split(".").pop() || "bin").toLowerCase();
      const path = `${user.id}/${d.kind}-${Date.now()}.${ext}`;
      const up = await supa.storage.from("tournament-user-verifications").upload(path, bytes, {
        contentType: d.mime || "application/octet-stream", upsert: true,
      });
      if (up.error) return err(up.error.message);
      urls[d.kind] = path;
    }

    // Cobrar USDT
    const debited = await supa.rpc("tournament_wallet_debit", {
      p_user_id: user.id, p_usd: VERIFY_USER_COST, p_bmoney: 0,
      p_lock_usd: false, p_lock_bmoney: false,
    });
    if (debited.error || debited.data === false) return err("No se pudo cobrar USDT");

    // PR #7 A4: chequear error del INSERT. Antes destructuraba solo `data`
    // y el INSERT fallaba en silencio cuando `user_verify` no existía en
    // el enum tournament_payment_type, dejando el debit sin audit trail y
    // la solicitud con payment_id = null (lo que rompía además el refund
    // del review). La migración agrega el valor; aquí cerramos el flanco.
    const { data: pay, error: payErr } = await supa.from("tournament_payments").insert({
      user_id: user.id, type: "user_verify",
      amount_usd: VERIFY_USER_COST, currency: "usd", gateway: "wallet", status: "completed",
      metadata: { kind: "verified_user_badge" },
    }).select("id").single();

    if (payErr || !pay) {
      await supa.rpc("tournament_wallet_credit", {
        p_user_id: user.id, p_usd: VERIFY_USER_COST, p_bmoney: 0,
      });
      console.error("user-verify-request: INSERT payment falló, debit revertido", {
        user_id: user.id, error: payErr?.message,
      });
      return err("No se pudo registrar el pago: " + (payErr?.message || "error desconocido"));
    }

    const { data: row, error: vErr } = await supa.from("tournament_user_verifications").insert({
      user_id: user.id,
      id_front_url: urls.id_front, id_back_url: urls.id_back, selfie_url: urls.selfie,
      payment_id: pay.id, status: "pending",
    }).select().single();

    if (vErr || !row) {
      // Rollback total: refund + marcar payment fallido para que no quede
      // un payment "completed" sin verification asociada.
      await supa.rpc("tournament_wallet_credit", {
        p_user_id: user.id, p_usd: VERIFY_USER_COST, p_bmoney: 0,
      });
      await supa.from("tournament_payments").update({
        status: "failed",
        metadata: { kind: "verified_user_badge", rollback_reason: "verification_insert_failed" },
      }).eq("id", pay.id);
      console.error("user-verify-request: INSERT verification falló, debit revertido", {
        user_id: user.id, payment_id: pay.id, error: vErr?.message,
      });
      return err("No se pudo registrar la solicitud: " + (vErr?.message || "error desconocido"));
    }

    return ok({ verification: row });
  } catch (e) { return err((e as Error).message); }
});
