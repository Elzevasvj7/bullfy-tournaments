// Creates a NowPayments invoice for a Trading Room subscription plan.
// Public (verify_jwt = false) — auth is handled by validating partner_user ownership in the partner portal session.
// On success, returns { ok: true, invoice_url, invoice_id } and creates/updates the subscription row in pending_payment.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function ok(data: Record<string, unknown>) {
  return new Response(JSON.stringify({ ok: true, ...data }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
function fail(error: string, extra: Record<string, unknown> = {}) {
  return new Response(JSON.stringify({ ok: false, error, ...extra }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const body = await req.json().catch(() => ({}));
    const { partner_user_id, portal_id, plan_id, success_url, cancel_url } = body;

    if (!partner_user_id || !portal_id || !plan_id) {
      return fail("partner_user_id, portal_id and plan_id are required");
    }

    // Validate partner user belongs to portal
    const { data: pu } = await supabase
      .from("partner_users")
      .select("id, portal_id, email, nombre")
      .eq("id", partner_user_id)
      .maybeSingle();
    if (!pu || pu.portal_id !== portal_id) return fail("Usuario no válido para este portal");

    // Resolve ib_id from portal
    const { data: portal } = await supabase
      .from("partner_portals")
      .select("id, ib_id, display_name")
      .eq("id", portal_id)
      .maybeSingle();
    if (!portal?.ib_id) return fail("Portal sin IB asociado");

    // Get plan
    const { data: plan } = await supabase
      .from("trading_room_plan_catalog")
      .select("id, plan_code, display_name, target_price_monthly, is_active")
      .eq("id", plan_id)
      .maybeSingle();
    if (!plan || !plan.is_active) return fail("Plan no disponible");
    if (Number(plan.target_price_monthly) <= 0) return fail("Plan sin precio configurado");

    // Get NowPayments config
    const { data: cfgRow } = await supabase
      .from("integration_settings")
      .select("config")
      .eq("service_name", "nowpayments_gateway")
      .maybeSingle();
    const cfg = (cfgRow?.config as Record<string, any>) ?? {};
    const env = cfg.environment || "sandbox";
    const apiKey = env === "live" ? cfg.api_key_live : cfg.api_key_sandbox;
    if (!apiKey) return fail(`NowPayments API key no configurada para ${env}`);

    const baseUrl = env === "live" ? "https://api.nowpayments.io/v1" : "https://api-sandbox.nowpayments.io/v1";

    // Upsert subscription as pending_payment (do not touch active rows of OTHER plans)
    const { data: existing } = await supabase
      .from("trading_room_subscriptions")
      .select("id, access_status, current_period_end")
      .eq("partner_user_id", partner_user_id)
      .eq("plan_id", plan_id)
      .in("access_status", ["active", "pending_payment", "past_due"])
      .maybeSingle();

    let subId = existing?.id as string | undefined;
    const isRenewalChained =
      existing?.access_status === "active" && existing.current_period_end && new Date(existing.current_period_end) > new Date();

    if (!subId) {
      const { data: inserted, error: insErr } = await supabase
        .from("trading_room_subscriptions")
        .insert({
          partner_user_id,
          portal_id,
          ib_id: portal.ib_id,
          plan_id,
          price_monthly: plan.target_price_monthly,
          access_status: "pending_payment",
          billing_status: "pending_payment",
          payment_provider: "nowpayments",
        })
        .select("id")
        .single();
      if (insErr) return fail("No se pudo crear la suscripción: " + insErr.message);
      subId = inserted.id;
    }

    // Build URLs
    const origin = req.headers.get("origin") || "https://bullfytech.online";
    const successUrl = success_url || `${origin}/portal?trading_room_paid=1`;
    const cancelUrl = cancel_url || `${origin}/portal?trading_room_cancelled=1`;
    const ipnUrl = `${SUPABASE_URL}/functions/v1/nowpayments-webhook`;

    const orderId = `tr_sub:${subId}${isRenewalChained ? ":renewal" : ""}`;
    const orderDesc = `Bullfy Trading Room — ${plan.display_name} (${pu.email})`;

    // Create NowPayments invoice
    const npRes = await fetch(`${baseUrl}/invoice`, {
      method: "POST",
      headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        price_amount: Number(plan.target_price_monthly),
        price_currency: "usd",
        order_id: orderId,
        order_description: orderDesc,
        ipn_callback_url: ipnUrl,
        success_url: successUrl,
        cancel_url: cancelUrl,
      }),
    });
    const npData = await npRes.json().catch(() => ({}));
    if (!npRes.ok) {
      return fail("NowPayments rechazó la solicitud: " + (npData?.message || npRes.statusText), { details: npData });
    }

    const invoiceUrl = npData.invoice_url;
    const invoiceId = String(npData.id ?? "");

    // Save invoice ref + insert pending payment row
    await supabase
      .from("trading_room_subscriptions")
      .update({
        pending_invoice_id: invoiceId,
        pending_invoice_url: invoiceUrl,
        access_status: isRenewalChained ? "active" : "pending_payment",
        billing_status: "pending_payment",
        updated_at: new Date().toISOString(),
      })
      .eq("id", subId);

    await supabase.from("nowpayments_payments").upsert(
      {
        invoice_id: invoiceId,
        payment_id: `inv_${invoiceId}`, // placeholder until IPN delivers real payment_id
        order_id: orderId,
        order_description: orderDesc,
        status: "waiting",
        price_amount: Number(plan.target_price_monthly),
        price_currency: "usd",
        environment: env,
        raw_payload: npData,
      },
      { onConflict: "payment_id" },
    );

    return ok({ invoice_url: invoiceUrl, invoice_id: invoiceId, subscription_id: subId, environment: env });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[trading-room-create-invoice]", msg);
    return fail(msg);
  }
});
