import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { notifyPurchaseConfirmed } from "../_shared/notifications.js";
import { computeCommissions } from "../_shared/revenueSplits.js";
import { logFinancialEvent } from "../_shared/financial-log.js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const STRIPE_API_BASE = "https://api.stripe.com/v1";

// La cuenta/modo (live vs test) la define la propia secret_key (sk_live_ / sk_test_),
// así que el endpoint de la API es siempre el mismo.
async function getStripeConfig(supabase: any) {
  const { data } = await supabase
    .from("integration_settings")
    .select("config, enabled")
    .eq("service_name", "stripe_gateway")
    .maybeSingle();
  if (!data?.enabled) return null;
  return data.config || null;
}

// HMAC-SHA256 (hex) — Stripe firma con SHA-256.
async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Comparación en tiempo (casi) constante para evitar timing-attacks.
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

// Verifica la cabecera `Stripe-Signature: t=...,v1=...` contra el webhook secret.
// El payload firmado es `${t}.${rawBody}`. Tolerancia de 5 min contra replays.
async function verifyStripeSignature(rawBody: string, sigHeader: string, secret: string): Promise<boolean> {
  if (!sigHeader) return false;
  const parts = Object.fromEntries(
    sigHeader.split(",").map((kv) => {
      const idx = kv.indexOf("=");
      return [kv.slice(0, idx).trim(), kv.slice(idx + 1).trim()];
    }),
  );
  const t = parts["t"];
  const v1 = parts["v1"];
  if (!t || !v1) return false;
  const expected = await hmacSha256Hex(secret, `${t}.${rawBody}`);
  if (!timingSafeEqual(v1, expected)) return false;
  // Anti-replay: rechaza si el timestamp tiene más de 5 minutos.
  const ts = Number(t);
  if (Number.isFinite(ts)) {
    const ageSec = Math.abs(Date.now() / 1000 - ts);
    if (ageSec > 300) return false;
  }
  return true;
}

// Otorga el acceso de un producto pagado (curso / membresía / paquete).
// Mantener sincronizado con grantPurchaseAccess de portal-commerce / *-callback.
async function grantPurchaseAccess(
  supabase: any,
  prod: { product_type?: string; reference_id?: string | null; membership_tier?: string | null } | null | undefined,
  partnerUserId: string,
  portalId: string,
) {
  if (!prod) return;
  if (prod.product_type === "course" && prod.reference_id) {
    await supabase.from("academy_enrollments").upsert(
      { course_id: prod.reference_id, partner_user_id: partnerUserId },
      { onConflict: "course_id,partner_user_id" },
    );
  } else if (prod.product_type === "membership" && prod.membership_tier) {
    const { data: pu } = await supabase
      .from("partner_users").select("tier").eq("id", partnerUserId).maybeSingle();
    const oldTier = pu?.tier || "general";
    if (oldTier !== prod.membership_tier) {
      await supabase.from("partner_users").update({ tier: prod.membership_tier }).eq("id", partnerUserId);
      await supabase.from("partner_tier_upgrades").insert({
        partner_user_id: partnerUserId,
        portal_id: portalId,
        old_tier: oldTier,
        new_tier: prod.membership_tier,
        upgrade_method: "card",
      });
    }
  } else if (prod.product_type === "bundle" && prod.reference_id) {
    const { data: bc } = await supabase
      .from("academy_bundle_courses").select("course_id").eq("bundle_id", prod.reference_id);
    for (const row of (bc || [])) {
      await supabase.from("academy_enrollments").upsert(
        { course_id: row.course_id, partner_user_id: partnerUserId },
        { onConflict: "course_id,partner_user_id" },
      );
    }
  }
}

/**
 * Finaliza una orden de forma idempotente (espejo de nowpayments-callback):
 * - payment_status=paid + paid_at + payment_reference (lock atómico sobre 'pending')
 * - comisiones por revenue-split
 * - entrada en el ledger
 * - acceso a cursos / membresía / paquete
 * - inscripción a evento pagado
 * - activación de suscripción de trading-room
 */
async function finalizeOrder(supabase: any, orderId: string, paymentReference?: string | null) {
  const { data: order } = await supabase
    .from("portal_orders")
    .select("id, order_number, portal_id, partner_user_id, total_usd, payment_status, event_id")
    .eq("id", orderId)
    .maybeSingle();

  if (!order) return { ok: false, error: "Order not found" };
  if (order.payment_status === "paid") {
    return { ok: true, already_paid: true };
  }

  // Lock idempotente: solo procede si la orden sigue 'pending'.
  const { data: marked } = await supabase
    .from("portal_orders")
    .update({
      payment_status: "paid",
      paid_at: new Date().toISOString(),
      payment_reference: paymentReference ?? null,
    })
    .eq("id", orderId)
    .eq("payment_status", "pending")
    .select("id");
  if (!marked || marked.length === 0) {
    return { ok: true, already_paid: true };
  }

  // Revenue splits → comisiones
  const { data: splits } = await supabase
    .from("portal_revenue_splits")
    .select("role_label, percentage")
    .eq("portal_id", order.portal_id)
    .order("priority");

  if (splits && splits.length > 0) {
    const commissions = computeCommissions(order.total_usd, splits as any).map((c) => ({
      order_id: order.id,
      portal_id: order.portal_id,
      beneficiary_type: c.role_label,
      amount: c.amount,
      status: "pending",
    }));
    await supabase.from("portal_commissions")
      .upsert(commissions, { onConflict: "order_id,beneficiary_type", ignoreDuplicates: true });
  }

  // Ledger
  const { data: lastEntry } = await supabase
    .from("portal_ledger")
    .select("balance_after")
    .eq("portal_id", order.portal_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const currentBalance = lastEntry?.balance_after || 0;
  await supabase.from("portal_ledger").insert({
    portal_id: order.portal_id,
    order_id: order.id,
    entry_type: "sale",
    amount: order.total_usd,
    description: `Venta #${order.order_number} (confirmada vía Stripe)`,
    balance_after: currentBalance + order.total_usd,
  });

  // Acceso (cursos, membresías, paquetes)
  const { data: items } = await supabase
    .from("portal_order_items")
    .select("product_id, quantity, portal_products:product_id(product_type, reference_id, membership_tier)")
    .eq("order_id", order.id);

  if (items) {
    for (const it of items) {
      const prod = (it as any).portal_products;
      await grantPurchaseAccess(supabase, prod, order.partner_user_id, order.portal_id);
    }
  }

  // Inscripción a EVENTO pagado (si la orden corresponde a un evento).
  if (order.event_id) {
    const { error: regErr } = await supabase.from("portal_event_registrations")
      .upsert(
        { event_id: order.event_id, partner_user_id: order.partner_user_id, granted_by: "paid" },
        { onConflict: "event_id,partner_user_id", ignoreDuplicates: true },
      );
    if (regErr) console.error("event registration (paid) failed", order.id, regErr);
  }

  // Activación de suscripción de trading-room si aplica.
  const { data: sub } = await supabase
    .from("trading_room_subscriptions")
    .select("id")
    .eq("partner_user_id", order.partner_user_id)
    .eq("portal_id", order.portal_id)
    .maybeSingle();

  if (sub?.id) {
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);
    await supabase
      .from("trading_room_subscriptions")
      .update({
        access_status: "active",
        billing_status: "paid",
        payment_provider: "stripe",
        external_subscription_id: paymentReference ?? null,
        current_period_start: now.toISOString(),
        current_period_end: periodEnd.toISOString(),
      })
      .eq("id", sub.id);
  }

  // Notificar compra confirmada (usuario + IB) — best-effort.
  await notifyPurchaseConfirmed(supabase, {
    portalId: order.portal_id,
    partnerUserId: order.partner_user_id,
    orderNumber: order.order_number,
    total: order.total_usd,
  });

  // Trazar la confirmación de cobro (entrada de dinero).
  await logFinancialEvent(supabase, {
    function_name: "stripe-webhook",
    event_type: "order_paid",
    gateway: "stripe",
    portal_id: order.portal_id,
    order_id: order.id,
    partner_user_id: order.partner_user_id,
    amount: order.total_usd,
    currency: "usd",
    result: "success",
    payload: { order_number: order.order_number, payment_reference: paymentReference ?? null },
  });

  return { ok: true, finalized: true };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  try {
    const rawBody = await req.text();

    const config = await getStripeConfig(supabase);
    if (!config?.secret_key || !config?.webhook_secret) {
      console.error("stripe_webhook: gateway no configurado (falta secret_key o webhook_secret)");
      return new Response(JSON.stringify({ ok: false, error: "gateway_not_configured" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
      });
    }

    const sigHeader = req.headers.get("stripe-signature") || "";

    let sessionId: string | undefined;
    let orderId: string | undefined;
    let sessionFromEvent: any = {};

    if (sigHeader) {
      // ── PATH 1: webhook real de Stripe ──
      // ── GATE DE SEGURIDAD 1: firma del webhook ──
      // La firma de Stripe es determinista y bien documentada → gate DURO: sin firma
      // válida, 400. (El gate 2, server-to-server, va más abajo y aplica a ambos paths.)
      const signatureValid = await verifyStripeSignature(rawBody, sigHeader, config.webhook_secret);
      if (!signatureValid) {
        console.error("stripe_webhook: firma inválida");
        return new Response(JSON.stringify({ ok: false, error: "invalid_signature" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400,
        });
      }

      let event: any = {};
      try { event = JSON.parse(rawBody); } catch { event = {}; }
      console.log("Stripe webhook received:", String(event?.type).substring(0, 80));

      const type: string = event?.type || "";
      // Solo nos interesan los eventos que confirman un cobro completado.
      const PAID_EVENTS = ["checkout.session.completed", "checkout.session.async_payment_succeeded"];
      if (!PAID_EVENTS.includes(type)) {
        return new Response(JSON.stringify({ ok: true, ignored: true, type }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
        });
      }

      sessionFromEvent = event?.data?.object || {};
      sessionId = sessionFromEvent?.id;
      orderId = sessionFromEvent?.metadata?.order_id;
    } else {
      // ── PATH 2: poll interno desde verify_payment (sin firma) ──
      // No hay firma, pero el gate 2 (verificación server-to-server contra Stripe con
      // nuestra secret_key) es el control real: solo finaliza si existe una sesión
      // REALMENTE pagada cuyo metadata.order_id coincide. Un atacante no puede fabricar
      // eso, así que este path es tan seguro como el de NOWPayments (verify_payment).
      let body: any = {};
      try { body = JSON.parse(rawBody); } catch { body = {}; }
      if (body?.internal === true && body?.order_id && body?.session_id) {
        orderId = String(body.order_id);
        sessionId = String(body.session_id);
      } else {
        console.error("stripe_webhook: sin firma y sin payload interno válido");
        return new Response(JSON.stringify({ ok: false, error: "invalid_request" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400,
        });
      }
    }

    if (!sessionId || !orderId) {
      console.warn("stripe_webhook: ids ausentes", { sessionId, orderId });
      return new Response(JSON.stringify({ ok: true, ignored: true, reason: "missing_ids" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
      });
    }

    // Log del callback (best-effort).
    const { data: existingOrder } = await supabase
      .from("portal_orders")
      .select("id, portal_id, partner_user_id, total_usd")
      .eq("id", orderId)
      .maybeSingle();
    if (existingOrder) {
      await supabase.from("portal_payment_transactions").insert({
        order_id: existingOrder.id,
        portal_id: existingOrder.portal_id,
        partner_user_id: existingOrder.partner_user_id,
        gateway: "stripe",
        gateway_action: "webhook_received",
        amount: existingOrder.total_usd,
        currency: "usd",
        request_payload: { type, session_id: sessionId },
        response_payload: { payment_status: sessionFromEvent?.payment_status, signature_valid: true },
        http_status: 200,
        status: "success",
        gateway_reference_id: sessionId,
      });
    } else {
      console.warn("stripe_webhook: orden no encontrada", { orderId });
      return new Response(JSON.stringify({ ok: true, ignored: true, reason: "order_not_found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
      });
    }

    // ── GATE DE SEGURIDAD 2: verificación server-to-server ──
    // No se confía en el cuerpo del webhook: se consulta a Stripe el estado REAL de la
    // sesión con nuestra secret_key y solo se finaliza si payment_status='paid' y el
    // monto coincide (igual que coinsbuy/nowpayments).
    const verifyRes = await fetch(`${STRIPE_API_BASE}/checkout/sessions/${sessionId}`, {
      headers: { "Authorization": `Bearer ${config.secret_key}` },
    });
    const verifyData = await verifyRes.json().catch(() => ({} as any));

    if (!verifyRes.ok) {
      console.error("stripe_webhook: sesión no verificable", { sessionId, status: verifyRes.status });
      return new Response(JSON.stringify({ ok: false, error: "session_unverifiable" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 502,
      });
    }

    // metadata.order_id de la API debe coincidir con el del webhook (anti-reuso).
    if (verifyData?.metadata?.order_id && verifyData.metadata.order_id !== orderId) {
      console.error("stripe_webhook: order_id mismatch", { webhook: orderId, api: verifyData.metadata.order_id });
      return new Response(JSON.stringify({ ok: false, error: "order_mismatch" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400,
      });
    }

    if (String(verifyData?.payment_status) !== "paid") {
      console.warn("stripe_webhook: pago no completado", { sessionId, status: verifyData?.payment_status });
      return new Response(JSON.stringify({ ok: true, ignored: true, status: verifyData?.payment_status }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
      });
    }

    // Monto: amount_total (centavos) debe coincidir ±1¢ con el total de la orden.
    const expectedCents = Math.round(Number(existingOrder.total_usd ?? NaN) * 100);
    const actualCents = Number(verifyData?.amount_total ?? NaN);
    if (!Number.isFinite(expectedCents) || !Number.isFinite(actualCents)
        || Math.abs(actualCents - expectedCents) > 1) {
      console.error("stripe_webhook: amount mismatch", { orderId, expectedCents, actualCents });
      return new Response(JSON.stringify({ ok: false, error: "amount_mismatch" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 422,
      });
    }

    const paymentReference = verifyData?.payment_intent || sessionId;
    const result = await finalizeOrder(supabase, orderId, paymentReference);
    return new Response(JSON.stringify({ ok: true, finalized: result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
    });
  } catch (err: any) {
    console.error("stripe-webhook error:", err);
    return new Response(JSON.stringify({ ok: false, error: err.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
    });
  }
});
