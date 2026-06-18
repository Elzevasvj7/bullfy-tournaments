// NOWPayments PAYOUT IPN handler.
// Recibe las notificaciones de estado de los payouts (retiros a IBs) y cierra la
// solicitud: FINISHED/SENT → complete_withdrawal (idempotente); FAILED/REJECTED →
// refund_withdrawal (reintegra el saldo). Adopta el matching de 3 pasos del cliente.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { notifyWithdrawal } from "../_shared/notifications.js";
import { logFinancialEvent } from "../_shared/financial-log.js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-nowpayments-sig",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function getNowpaymentsConfig(supabase: any) {
  const { data } = await supabase
    .from("integration_settings")
    .select("config, enabled")
    .eq("service_name", "nowpayments")
    .maybeSingle();
  if (!data?.enabled) return null;
  return data.config || null;
}

async function hmacSha512Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-512" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Orden alfabético recursivo de claves (idéntico a la integración del cliente:
// usa localeCompare para coincidir con la firma que genera NOWPayments).
function sortObj(obj: any): any {
  if (Array.isArray(obj)) return obj.map(sortObj);
  if (obj && typeof obj === "object") {
    const entries = Object.entries(obj as Record<string, unknown>).sort(
      ([a], [b]) => a.localeCompare(b),
    );
    return Object.fromEntries(entries.map(([k, v]) => [k, sortObj(v)]));
  }
  return obj;
}

function npCurrencyToNetwork(c: string | null | undefined): string | null {
  if (!c) return null;
  const v = c.toLowerCase();
  if (v.includes("trc20") || v.includes("trx")) return "TRC20";
  if (v.includes("bsc") || v.includes("bep20")) return "BSC";
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  try {
    const rawBody = await req.text();
    let payload: any = {};
    try { payload = JSON.parse(rawBody); } catch { payload = { raw: rawBody }; }

    console.log("NOWPayments PAYOUT IPN:", JSON.stringify(payload).substring(0, 1000));

    const config = await getNowpaymentsConfig(supabase);
    if (!config?.ipn_secret) {
      console.error("nowpayments_payout_callback: gateway no configurado");
      return new Response(JSON.stringify({ ok: false, error: "gateway_not_configured" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
      });
    }

    // Verificación de firma HMAC (gate, igual que la integración del cliente).
    const sigHeader = (req.headers.get("x-nowpayments-sig") || "").toLowerCase();
    const expectedSig = await hmacSha512Hex(config.ipn_secret, JSON.stringify(sortObj(payload)));
    if (!sigHeader || sigHeader !== expectedSig) {
      console.error("nowpayments_payout_callback: firma inválida");
      return new Response(JSON.stringify({ ok: false, error: "invalid_signature" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401,
      });
    }

    const npId = payload?.id != null ? String(payload.id) : "";
    const uniqueExternalId = payload?.unique_external_id ? String(payload.unique_external_id) : "";
    const npStatus = String(payload?.status ?? "").toUpperCase();
    const txHash = payload?.hash ? String(payload.hash) : null;

    // Matching 3 pasos: unique_external_id → nowpayments_payout_id → fallback.
    const cols = "id, portal_id, user_id, amount_requested, amount_net, network, destination_address, status, account_kind";
    let w: any = null;
    if (uniqueExternalId) {
      const { data } = await supabase
        .from("portal_withdrawal_requests").select(cols).eq("id", uniqueExternalId).maybeSingle();
      w = data;
    }
    if (!w && npId) {
      const { data } = await supabase
        .from("portal_withdrawal_requests").select(cols).eq("nowpayments_payout_id", npId).maybeSingle();
      w = data;
    }
    if (!w) {
      const npAddress = payload?.address ? String(payload.address) : null;
      const npAmount = payload?.amount != null ? Number(payload.amount) : null;
      const npNetwork = npCurrencyToNetwork(payload?.currency ? String(payload.currency) : null);
      if (npAddress && npAmount != null && npNetwork) {
        const { data } = await supabase
          .from("portal_withdrawal_requests")
          .select(cols)
          .eq("network", npNetwork)
          .eq("destination_address", npAddress)
          .in("status", ["pending", "processing"])
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        // Confirmar que el monto coincide (±1¢) para no cerrar el retiro equivocado.
        if (data && Math.abs(Number(data.amount_net) - npAmount) <= 0.01) w = data;
      }
    }

    if (!w) {
      console.warn("nowpayments_payout_callback: retiro no encontrado", { npId, uniqueExternalId });
      return new Response(JSON.stringify({ ok: true, ignored: true, reason: "withdrawal_not_found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
      });
    }

    // Guardar referencia/respuesta del payout (trazabilidad).
    await supabase
      .from("portal_withdrawal_requests")
      .update({ nowpayments_payout_id: npId || w.nowpayments_payout_id, nowpayments_response: payload })
      .eq("id", w.id);

    if (["FINISHED", "SENT"].includes(npStatus)) {
      const { data: res, error } = await supabase.rpc("complete_withdrawal", {
        _withdrawal_id: w.id,
        _payout_id: npId || null,
        _tx_hash: txHash,
      });
      if (error) console.error("complete_withdrawal failed", w.id, error);
      if (!error && res === "completed") {
        await notifyWithdrawal(supabase, {
          portalId: w.portal_id, partnerUserId: w.user_id, status: "procesado", amount: w.amount_net,
        });
        await logFinancialEvent(supabase, {
          function_name: "nowpayments-payout-callback", event_type: "withdrawal_completed",
          gateway: "nowpayments", portal_id: w.portal_id, withdrawal_id: w.id, partner_user_id: w.user_id,
          amount: w.amount_net, currency: "usd", result: "success",
          payload: { np_payout_id: npId, tx_hash: txHash, account_kind: w.account_kind ?? "real" },
        });
      }
      return new Response(JSON.stringify({ ok: true, status: "completed", rpc: res }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
      });
    }

    if (["FAILED", "REJECTED"].includes(npStatus)) {
      const reason = `NOWPayments payout ${npStatus}`;
      const { data: res, error } = await supabase.rpc("refund_withdrawal", {
        _withdrawal_id: w.id, _reason: reason,
      });
      if (error) console.error("refund_withdrawal failed", w.id, error);
      if (!error && res === "refunded") {
        await notifyWithdrawal(supabase, {
          portalId: w.portal_id, partnerUserId: w.user_id, status: "fallido", amount: w.amount_requested,
        });
        await logFinancialEvent(supabase, {
          function_name: "nowpayments-payout-callback", event_type: "withdrawal_failed",
          gateway: "nowpayments", portal_id: w.portal_id, withdrawal_id: w.id, partner_user_id: w.user_id,
          amount: w.amount_requested, currency: "usd", result: "failed", error_message: reason,
          payload: { np_payout_id: npId },
        });
      }
      return new Response(JSON.stringify({ ok: true, status: "failed", rpc: res }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
      });
    }

    // Estado intermedio (WAITING/CREATING/PROCESSING/SENDING) → solo se registra.
    return new Response(JSON.stringify({ ok: true, status: npStatus, note: "in_progress" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
    });
  } catch (err: any) {
    console.error("nowpayments-payout-callback error:", err);
    return new Response(JSON.stringify({ ok: false, error: err.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
    });
  }
});
