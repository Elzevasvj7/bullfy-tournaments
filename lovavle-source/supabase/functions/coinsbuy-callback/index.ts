import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { fetchCoinsbuyDeposit, isCoinsbuyPaid } from "../_shared/coinsbuy-verify.js";
import { notifyPurchaseConfirmed } from "../_shared/notifications.js";
import { computeCommissions } from "../_shared/revenueSplits.js";
import { logFinancialEvent } from "../_shared/financial-log.js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Otorga el acceso de un producto pagado (curso / membresía / paquete).
// Mantener sincronizado con grantPurchaseAccess de portal-commerce.
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
 * Idempotently finalizes a portal order:
 * - sets payment_status=paid, paid_at, payment_reference
 * - creates revenue-split commissions
 * - inserts ledger entry
 * - auto-enrolls in courses
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

  // Lock idempotente: solo procede si la orden sigue 'pending'. Si dos
  // callbacks concurrentes intentan finalizar la misma orden, solo uno gana
  // y el resto retorna already_paid sin duplicar comisiones ni inscripciones.
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

  // Revenue splits → commissions
  const { data: splits } = await supabase
    .from("portal_revenue_splits")
    .select("role_label, percentage")
    .eq("portal_id", order.portal_id)
    .order("priority");

  if (splits && splits.length > 0) {
    // P4a: redondeo exacto (residuo a 'platform') + dedup por onConflict.
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

  // Ledger entry
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
    description: `Venta #${order.order_number} (confirmada vía Coinsbuy)`,
    balance_after: currentBalance + order.total_usd,
  });

  // Otorgar acceso (cursos, membresías, paquetes)
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

  // Inscripción a EVENTO pagado (si la orden corresponde a un evento). El trigger
  // enforce_event_capacity valida cupo; upsert idempotente por (event_id,user).
  if (order.event_id) {
    const { error: regErr } = await supabase.from("portal_event_registrations")
      .upsert(
        { event_id: order.event_id, partner_user_id: order.partner_user_id, granted_by: "paid" },
        { onConflict: "event_id,partner_user_id", ignoreDuplicates: true },
      );
    if (regErr) console.error("event registration (paid) failed", order.id, regErr);
  }

  // Trading-room subscription activation if this order belongs to one
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
        payment_provider: "coinsbuy",
        external_subscription_id: paymentReference ?? null,
        current_period_start: now.toISOString(),
        current_period_end: periodEnd.toISOString(),
      })
      .eq("id", sub.id);
  }

  // C7: notificar compra confirmada (usuario + IB) — best-effort.
  await notifyPurchaseConfirmed(supabase, {
    portalId: order.portal_id,
    partnerUserId: order.partner_user_id,
    orderNumber: order.order_number,
    total: order.total_usd,
  });

  // P6: trazar la confirmación de cobro (entrada de dinero).
  await logFinancialEvent(supabase, {
    function_name: "coinsbuy-callback",
    event_type: "order_paid",
    gateway: "coinsbuy",
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

    console.log("Coinsbuy callback received:", JSON.stringify(payload).substring(0, 1000));

    // Coinsbuy JSON:API shape: data.attributes.tracking_id / status
    const attrs = payload?.data?.attributes ?? payload?.attributes ?? payload ?? {};
    const trackingId: string | undefined = attrs.tracking_id || payload?.tracking_id;
    const status: unknown = attrs.status ?? payload?.status;
    const depositId: string | undefined =
      payload?.data?.id || payload?.id || attrs.deposit_id;

    // Extract orderId from tracking_id "bullfy-order-{uuid}"
    let orderId: string | null = null;
    if (trackingId && trackingId.startsWith("bullfy-order-")) {
      orderId = trackingId.replace("bullfy-order-", "");
    }

    // Persist raw callback log regardless
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
          gateway: "coinsbuy",
          gateway_action: "callback_received",
          amount: existingOrder.total_usd,
          currency: "usd",
          request_payload: payload,
          response_payload: { tracking_id: trackingId, status, deposit_id: depositId },
          http_status: 200,
          status: "success",
          gateway_reference_id: depositId ?? null,
        });
      }
    }

    // ── VERIFICACIÓN SERVER-TO-SERVER ──
    // No se confía en el cuerpo del webhook entrante. Para evitar falsificación,
    // pedimos a Coinsbuy directamente el estado real del depósito usando
    // nuestras credenciales (integration_settings + COINSBUY_PROXY).
    //
    // Reglas obligatorias antes de finalizar la orden:
    //   1) orderId + depositId presentes en el payload
    //   2) Coinsbuy confirma que el depósito existe y status == paid (3)
    //   3) tracking_id devuelto por la API == tracking_id del webhook
    //      (previene reusar deposit_id legítimo apuntando a otra orden)
    //   4) target_amount del depósito coincide ±1¢ con order.total_usd
    if (!orderId || !depositId) {
      console.warn("coinsbuy_callback: ids ausentes", { orderId, depositId });
      return new Response(JSON.stringify({ ok: true, ignored: true, reason: "missing_ids" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
      });
    }

    const deposit = await fetchCoinsbuyDeposit(supabase, depositId);
    if (!deposit) {
      console.error("coinsbuy_callback: depósito no verificable", { depositId });
      return new Response(JSON.stringify({ ok: false, error: "deposit_unverifiable" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 502,
      });
    }

    if (deposit.tracking_id !== trackingId) {
      console.error("coinsbuy_callback: tracking_id mismatch", {
        webhook: trackingId, api: deposit.tracking_id, depositId,
      });
      return new Response(JSON.stringify({ ok: false, error: "tracking_mismatch" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400,
      });
    }

    if (!isCoinsbuyPaid(deposit.status)) {
      console.warn("coinsbuy_callback: depósito no pagado", { depositId, status: deposit.status });
      return new Response(JSON.stringify({ ok: true, ignored: true, status: deposit.status }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
      });
    }

    // Validación de monto: Coinsbuy debe haber cobrado exactamente lo que
    // declaramos en la orden (±1 ¢). Si no, se rechaza y NO se finaliza.
    const { data: orderForAmount } = await supabase
      .from("portal_orders").select("total_usd").eq("id", orderId).maybeSingle();
    const expectedAmount = Number(orderForAmount?.total_usd ?? NaN);
    const actualAmount = Number(deposit.target_amount ?? NaN);
    if (!isFinite(expectedAmount) || !isFinite(actualAmount)
        || Math.abs(actualAmount - expectedAmount) > 0.01) {
      console.error("coinsbuy_callback: amount mismatch", {
        orderId, expected: expectedAmount, actual: actualAmount,
      });
      return new Response(JSON.stringify({ ok: false, error: "amount_mismatch" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 422,
      });
    }

    const result = await finalizeOrder(supabase, orderId, depositId);
    return new Response(JSON.stringify({ ok: true, finalized: result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err: any) {
    console.error("coinsbuy-callback error:", err);
    return new Response(JSON.stringify({ ok: false, error: err.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  }
});
