// NowPayments IPN webhook
// Public endpoint (verify_jwt = false). Validates HMAC-SHA512 signature with IPN Secret
// using the active environment, then upserts the payment in nowpayments_payments.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logFinancialEvent } from "../_shared/financial-log.js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-nowpayments-sig",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Sort object keys recursively (NowPayments requirement before HMAC)
function sortObject(obj: any): any {
  if (Array.isArray(obj)) return obj.map(sortObject);
  if (obj && typeof obj === "object") {
    return Object.keys(obj).sort().reduce((acc: any, k) => {
      acc[k] = sortObject(obj[k]);
      return acc;
    }, {});
  }
  return obj;
}

async function hmacSha512Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const rawBody = await req.text();
    const sigHeader = req.headers.get("x-nowpayments-sig") || "";

    let payload: any;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return new Response(JSON.stringify({ ok: false, error: "Invalid JSON" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get config to know environment + IPN secret
    const { data: cfgRow } = await supabase
      .from("integration_settings")
      .select("config")
      .eq("service_name", "nowpayments_gateway")
      .maybeSingle();

    const cfg = (cfgRow?.config as Record<string, any>) ?? {};
    const env = cfg.environment || "sandbox";
    const ipnSecret = env === "live" ? cfg.ipn_secret_live : cfg.ipn_secret_sandbox;

    if (!ipnSecret) {
      console.error("[nowpayments-webhook] IPN secret not configured for env:", env);
      return new Response(JSON.stringify({ ok: false, error: "IPN secret not configured" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify HMAC signature
    const sortedJson = JSON.stringify(sortObject(payload));
    const expectedSig = await hmacSha512Hex(ipnSecret, sortedJson);

    if (!sigHeader || sigHeader.toLowerCase() !== expectedSig.toLowerCase()) {
      console.error("[nowpayments-webhook] Signature mismatch");
      return new Response(JSON.stringify({ ok: false, error: "Invalid signature" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Upsert payment by payment_id
    const paymentId = String(payload.payment_id ?? "");
    if (!paymentId) {
      return new Response(JSON.stringify({ ok: false, error: "Missing payment_id" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const updates = {
      payment_id: paymentId,
      invoice_id: payload.invoice_id ? String(payload.invoice_id) : null,
      order_id: payload.order_id ?? null,
      order_description: payload.order_description ?? null,
      status: payload.payment_status ?? "waiting",
      price_amount: payload.price_amount ?? null,
      price_currency: payload.price_currency ?? null,
      pay_amount: payload.pay_amount ?? null,
      pay_currency: payload.pay_currency ?? null,
      pay_address: payload.pay_address ?? null,
      actually_paid: payload.actually_paid ?? null,
      environment: env,
      raw_payload: payload,
      updated_at: new Date().toISOString(),
    };

    const { error: upsertErr } = await supabase
      .from("nowpayments_payments")
      .upsert(updates, { onConflict: "payment_id" });

    if (upsertErr) {
      console.error("[nowpayments-webhook] DB upsert error:", upsertErr);
      return new Response(JSON.stringify({ ok: false, error: upsertErr.message }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === Trading Room subscription activation ===
    // order_id format: "tr_sub:<subscription_id>" or "tr_sub:<subscription_id>:renewal"
    const orderId: string = String(payload.order_id ?? "");
    const status: string = String(payload.payment_status ?? "");
    const isPaid = ["finished", "confirmed", "sending"].includes(status.toLowerCase());

    if (orderId.startsWith("tr_sub:") && isPaid) {
      const parts = orderId.split(":");
      const subId = parts[1];
      const isRenewal = parts[2] === "renewal";

      try {
        const { data: sub } = await supabase
          .from("trading_room_subscriptions")
          .select("id, current_period_end, access_status")
          .eq("id", subId)
          .maybeSingle();

        if (sub) {
          const now = new Date();
          let periodStart: Date;
          // Renewal chaining: if there's a still-active period in the future, start when it ends
          if (isRenewal && sub.current_period_end && new Date(sub.current_period_end) > now) {
            periodStart = new Date(sub.current_period_end);
          } else {
            periodStart = now;
          }
          const periodEnd = new Date(periodStart.getTime() + 30 * 24 * 60 * 60 * 1000);
          const renewalDue = new Date(periodStart.getTime() + 25 * 24 * 60 * 60 * 1000);

          await supabase
            .from("trading_room_subscriptions")
            .update({
              access_status: "active",
              billing_status: "active",
              current_period_start: periodStart.toISOString(),
              current_period_end: periodEnd.toISOString(),
              renewal_due_at: renewalDue.toISOString(),
              last_payment_id: paymentId,
              pending_invoice_id: null,
              pending_invoice_url: null,
              expired_at: null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", subId);

          console.log(`[nowpayments-webhook] Activated trading_room_subscription ${subId} until ${periodEnd.toISOString()}`);
        }
      } catch (e) {
        console.error("[nowpayments-webhook] Trading Room activation failed:", e);
      }
    }

    // P6: trazar el IPN de NowPayments cuando representa un pago confirmado.
    if (isPaid) {
      await logFinancialEvent(supabase, {
        function_name: "nowpayments-webhook", event_type: "payment_received",
        gateway: "nowpayments",
        amount: payload.price_amount ?? null, currency: payload.price_currency ?? null,
        result: "success",
        payload: { payment_id: paymentId, order_id: orderId, status, environment: env },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[nowpayments-webhook] error:", msg);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
