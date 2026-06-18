import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { notifyPurchaseConfirmed } from "../_shared/notifications.js";
import { computeCommissions } from "../_shared/revenueSplits.js";
import { logFinancialEvent } from "../_shared/financial-log.js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-nowpayments-sig",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// NOWPayments: "finished" = pago completado y acreditado.
function isNowpaymentsPaid(status: unknown): boolean {
  return String(status ?? "").trim().toLowerCase() === "finished";
}

async function getNowpaymentsConfig(supabase: any) {
  const { data } = await supabase
    .from("integration_settings")
    .select("config, enabled")
    .eq("service_name", "nowpayments")
    .maybeSingle();
  if (!data?.enabled) return null;
  return data.config || null;
}

function nowpaymentsBase(config: any): string {
  return config.environment === "production"
    ? "https://api.nowpayments.io/v1"
    : "https://api-sandbox.nowpayments.io/v1";
}

// HMAC-SHA512 (hex) de un mensaje con una clave.
async function hmacSha512Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// NOWPayments firma el JSON con las claves ordenadas alfabéticamente (recursivo).
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

// Otorga el acceso de un producto pagado (curso / membresía / paquete).
// Mantener sincronizado con grantPurchaseAccess de portal-commerce / coinsbuy-callback.
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
        upgrade_method: "crypto",
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
 * Finaliza una orden de forma idempotente (espejo de coinsbuy-callback):
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
    description: `Venta #${order.order_number} (confirmada vía NOWPayments)`,
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
        payment_provider: "nowpayments",
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
    function_name: "nowpayments-callback",
    event_type: "order_paid",
    gateway: "nowpayments",
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
    let payload: any = {};
    try { payload = JSON.parse(rawBody); } catch { payload = { raw: rawBody }; }

    console.log("NOWPayments IPN received:", JSON.stringify(payload).substring(0, 1000));

    const config = await getNowpaymentsConfig(supabase);
    if (!config?.ipn_secret || !config?.api_key) {
      console.error("nowpayments_callback: gateway no configurado");
      return new Response(JSON.stringify({ ok: false, error: "gateway_not_configured" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
      });
    }

    // Firma HMAC (señal de integridad, best-effort): NOWPayments firma el payload
    // ordenado con el IPN secret. El gate de seguridad real es la verificación
    // server-to-server más abajo (igual que coinsbuy-callback), así que un
    // desajuste de serialización no debe perder un pago legítimo: solo se loguea.
    const sigHeader = (req.headers.get("x-nowpayments-sig") || "").toLowerCase();
    let signatureValid = false;
    try {
      const expectedSig = await hmacSha512Hex(config.ipn_secret, JSON.stringify(sortObject(payload)));
      signatureValid = !!sigHeader && sigHeader === expectedSig;
    } catch (_e) { signatureValid = false; }
    if (!signatureValid) {
      console.warn("nowpayments_callback: firma HMAC no coincide (se continúa con verificación server-to-server)");
    }

    const orderField: string | undefined = payload?.order_id;
    const paymentId: string | undefined = payload?.payment_id != null ? String(payload.payment_id) : undefined;
    let orderId: string | null = null;
    if (orderField && orderField.startsWith("bullfy-order-")) {
      orderId = orderField.replace("bullfy-order-", "");
    }

    // Log del callback (best-effort).
    if (orderId) {
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
          gateway: "nowpayments",
          gateway_action: "callback_received",
          amount: existingOrder.total_usd,
          currency: "usd",
          request_payload: payload,
          response_payload: { payment_status: payload?.payment_status, payment_id: paymentId, signature_valid: signatureValid },
          http_status: 200,
          status: "success",
          gateway_reference_id: paymentId ?? null,
        });
      }
    }

    if (!orderId || !paymentId) {
      console.warn("nowpayments_callback: ids ausentes", { orderId, paymentId });
      return new Response(JSON.stringify({ ok: true, ignored: true, reason: "missing_ids" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
      });
    }

    // ── VERIFICACIÓN SERVER-TO-SERVER (gate de seguridad) ──
    // No se confía en el cuerpo del IPN: se pide a NOWPayments el estado REAL del
    // pago con nuestra API Key, y solo se finaliza si coincide order_id, status y monto.
    const verifyRes = await fetch(`${nowpaymentsBase(config)}/payment/${paymentId}`, {
      headers: { "x-api-key": config.api_key },
    });
    const verifyText = await verifyRes.text();
    let verifyData: any;
    try { verifyData = JSON.parse(verifyText); } catch { verifyData = {}; }

    if (!verifyRes.ok) {
      console.error("nowpayments_callback: pago no verificable", { paymentId, status: verifyRes.status });
      return new Response(JSON.stringify({ ok: false, error: "payment_unverifiable" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 502,
      });
    }

    // order_id devuelto por la API debe coincidir con el del webhook (anti-reuso).
    if (verifyData?.order_id && verifyData.order_id !== orderField) {
      console.error("nowpayments_callback: order_id mismatch", { webhook: orderField, api: verifyData.order_id });
      return new Response(JSON.stringify({ ok: false, error: "order_mismatch" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400,
      });
    }

    // Acepta 'finished' o 'partially_paid' con déficit MÍNIMO (≤ max(2% del precio, $0.50)).
    // En cripto el wallet/exchange del comprador puede descontar su fee de red al enviar,
    // dejando un faltante de centavos; lo toleramos para no atascar la venta. Déficits
    // grandes NO se aceptan (la orden queda pendiente y el comprador debe completar).
    const _npStatus = String(verifyData?.payment_status ?? "").trim().toLowerCase();
    const _price  = Number(verifyData?.price_amount ?? NaN);
    const _payAmt = Number(verifyData?.pay_amount ?? NaN);
    const _paid   = Number(verifyData?.actually_paid ?? NaN);
    let _effectivelyPaid = isNowpaymentsPaid(verifyData?.payment_status);
    if (!_effectivelyPaid && _npStatus === "partially_paid"
        && isFinite(_payAmt) && _payAmt > 0 && isFinite(_paid) && isFinite(_price) && _price > 0) {
      const shortfallUsd = (1 - _paid / _payAmt) * _price;
      const toleranceUsd = Math.max(_price * 0.02, 0.50);
      if (shortfallUsd >= 0 && shortfallUsd <= toleranceUsd) {
        _effectivelyPaid = true;
        console.warn("nowpayments_callback: partially_paid aceptado por tolerancia", { paymentId, shortfallUsd, toleranceUsd });
      }
    }
    if (!_effectivelyPaid) {
      console.warn("nowpayments_callback: pago no finalizado", { paymentId, status: verifyData?.payment_status });
      return new Response(JSON.stringify({ ok: true, ignored: true, status: verifyData?.payment_status }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
      });
    }

    // Monto: price_amount (USD) debe coincidir ±1¢ con el total declarado en la orden.
    const { data: orderForAmount } = await supabase
      .from("portal_orders").select("total_usd").eq("id", orderId).maybeSingle();
    const expectedAmount = Number(orderForAmount?.total_usd ?? NaN);
    const actualAmount = Number(verifyData?.price_amount ?? NaN);
    if (!isFinite(expectedAmount) || !isFinite(actualAmount)
        || Math.abs(actualAmount - expectedAmount) > 0.01) {
      console.error("nowpayments_callback: amount mismatch", { orderId, expected: expectedAmount, actual: actualAmount });
      return new Response(JSON.stringify({ ok: false, error: "amount_mismatch" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 422,
      });
    }

    const result = await finalizeOrder(supabase, orderId, paymentId);
    return new Response(JSON.stringify({ ok: true, finalized: result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
    });
  } catch (err: any) {
    console.error("nowpayments-callback error:", err);
    return new Response(JSON.stringify({ ok: false, error: err.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
    });
  }
});
