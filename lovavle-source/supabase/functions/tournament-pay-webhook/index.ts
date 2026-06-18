// Webhook universal para Stripe y Coinsbuy. Acredita wallet solo en wallet_topup.
// Stripe: FAIL-CLOSED — sin STRIPE_WEBHOOK_SECRET no se procesa ningún evento.
// Coinsbuy: verificación server-to-server contra la API antes de acreditar
// (no se confía en el cuerpo del webhook entrante).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { cors, verifyStripeSignature } from "../_shared/tournament-helpers.js";
import { fetchCoinsbuyDeposit, isCoinsbuyPaid } from "../_shared/coinsbuy-verify.js";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SVC = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const j = (data: any, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...cors, "Content-Type": "application/json" } });

async function settlePayment(
  supa: any,
  paymentId: string,
  gatewayRef: string,
  verifiedAmountUsd: number | null,
  rawPayload: any,
) {
  const { data: p } = await supa.from("tournament_payments")
    .select("*").eq("id", paymentId).maybeSingle();
  if (!p) return { ok: false, error: "payment_not_found", status: 404 };
  if (p.status === "completed") return { ok: true, dup: true };

  // Validación de monto: lo que la pasarela cobró realmente debe coincidir con
  // lo que registramos como amount_usd (±1 ¢). Si no coincide, no se acredita y
  // se marca 'failed' con el detalle en metadata.
  if (verifiedAmountUsd !== null && Math.abs(verifiedAmountUsd - Number(p.amount_usd)) > 0.01) {
    console.error("amount_mismatch", { declared: p.amount_usd, actual: verifiedAmountUsd, payment: paymentId });
    await supa.from("tournament_payments").update({
      status: "failed",
      metadata: {
        ...(p.metadata || {}),
        amount_mismatch: { declared: Number(p.amount_usd), actual: verifiedAmountUsd },
        webhook: rawPayload,
      },
    }).eq("id", paymentId).eq("status", "pending");
    return { ok: false, error: "amount_mismatch", status: 422 };
  }

  // Idempotencia: solo actualizamos si sigue en 'pending'. Si dos webhooks
  // llegan a la vez, solo uno gana y el otro retorna dup:true.
  const { data: marked } = await supa.from("tournament_payments")
    .update({
      status: "completed",
      gateway_ref: gatewayRef,
      metadata: { ...(p.metadata || {}), webhook: rawPayload },
    })
    .eq("id", paymentId)
    .eq("status", "pending")
    .select("id");
  if (!marked || marked.length === 0) return { ok: true, dup: true };

  // Acreditar SOLO wallet_topup. entry_fee / elite_entry ya no acreditan saldo
  // aquí — esa lógica generaba doble-cobro porque tournament-join también
  // debita el wallet al inscribir. Los topups son la única vía de entrada de
  // saldo desde pasarela.
  if (p.type === "wallet_topup") {
    const { data: w } = await supa.from("tournament_wallets")
      .select("balance_usd").eq("user_id", p.user_id).maybeSingle();
    const newBal = Number(w?.balance_usd || 0) + Number(p.amount_usd);
    await supa.from("tournament_wallets").update({ balance_usd: newBal }).eq("user_id", p.user_id);
  } else {
    // entry_fee / elite_entry no deberían poder llegar aquí porque
    // tournament-pay-create ya los rechaza, pero si aparece un pago viejo
    // pendiente, lo dejamos completed sin crédito y registramos el caso.
    console.warn("settlePayment: tipo no acreditable, no se aplica saldo", { paymentId, type: p.type });
  }
  return { ok: true };
}

function settleResponse(gateway: string, r: { ok: true; dup?: boolean } | { ok: false; error: string; status: number }) {
  if (r.ok) return j({ received: true, processed: true, dup: !!r.dup });
  console.error(`${gateway}_settle_error`, r.error);
  return j({ received: true, processed: false, error: r.error }, r.status);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const url = new URL(req.url);
    const gw = url.searchParams.get("gw") || "stripe";
    const supa = createClient(SUPABASE_URL, SVC);
    const raw = await req.text();

    // ── STRIPE ────────────────────────────────────────────────────────────────
    if (gw === "stripe") {
      const stripeSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

      // FAIL-CLOSED: sin secreto no se puede verificar autenticidad → rechazar
      if (!stripeSecret) {
        console.error("stripe_webhook_secret_missing: pago rechazado (configura STRIPE_WEBHOOK_SECRET)");
        return j({ received: false, error: "webhook_not_configured" }, 400);
      }

      const valid = await verifyStripeSignature(raw, req.headers.get("stripe-signature"), stripeSecret);
      if (!valid) {
        console.error("stripe_signature_invalid");
        return j({ received: false, error: "invalid_signature" }, 400);
      }

      const evt = JSON.parse(raw);
      if (evt.type === "checkout.session.completed") {
        const session = evt.data.object;
        const pid = session.metadata?.payment_id;
        // amount_total viene en centavos
        const verifiedAmountUsd = typeof session.amount_total === "number" ? session.amount_total / 100 : null;
        if (!pid) {
          console.error("stripe_session_without_payment_id", { session: session.id });
          return j({ received: true, processed: false, error: "missing_payment_id" }, 400);
        }
        const r = await settlePayment(supa, pid, session.id, verifiedAmountUsd, session);
        return settleResponse("stripe", r);
      }
      // Otros eventos de Stripe: acuse de recibo sin liquidar
      return j({ received: true, processed: false, reason: "event_ignored" });
    }

    // ── COINSBUY ──────────────────────────────────────────────────────────────
    // No se confía en el cuerpo del webhook entrante. Para validar la
    // autenticidad sin depender del esquema de firma de Coinsbuy (no
    // confirmado oficialmente), se consulta server-to-server a la API de
    // Coinsbuy con nuestras propias credenciales y se exige:
    //   1) status real == paid (3)
    //   2) tracking_id devuelto por la API == tracking_id del webhook
    //      (previene "deposit id squatting")
    //   3) target_amount devuelto se pasa a settlePayment para validar contra
    //      tournament_payments.amount_usd
    if (gw === "coinsbuy") {
      const evt = JSON.parse(raw);
      const trackingId = evt?.data?.attributes?.tracking_id || evt?.tracking_id;
      const depositId = evt?.data?.id || null;

      console.log("coinsbuy_webhook_received", {
        trackingId, depositId,
        rawStatus: evt?.data?.attributes?.status ?? evt?.status,
      });

      if (!trackingId || !depositId) {
        console.error("coinsbuy_webhook_missing_ids", { trackingId, depositId });
        return j({ received: true, processed: false, error: "missing_ids" }, 400);
      }

      // Server-to-server: pregúntale a Coinsbuy cuál es el estado real
      const deposit = await fetchCoinsbuyDeposit(supa, depositId);
      if (!deposit) {
        console.error("coinsbuy_deposit_unverifiable", { depositId });
        return j({ received: true, processed: false, error: "deposit_unverifiable" }, 502);
      }

      // El tracking_id que nos devuelve Coinsbuy debe coincidir con el del
      // webhook. Si no coincide, alguien está intentando reusar un deposit_id
      // legítimo apuntándolo a otro tracking_id.
      if (deposit.tracking_id !== trackingId) {
        console.error("coinsbuy_tracking_mismatch", {
          webhook: trackingId, api: deposit.tracking_id, depositId,
        });
        return j({ received: false, error: "tracking_mismatch" }, 400);
      }

      if (!isCoinsbuyPaid(deposit.status)) {
        console.warn("coinsbuy_deposit_not_paid", { depositId, status: deposit.status });
        return j({ received: true, processed: false, reason: "not_paid", status: deposit.status });
      }

      const verifiedAmount = deposit.target_amount != null ? Number(deposit.target_amount) : null;
      const r = await settlePayment(supa, trackingId, depositId, verifiedAmount, evt);
      return settleResponse("coinsbuy", r);
    }

    return j({ ok: false, error: "unknown gateway" }, 400);
  } catch (e) {
    console.error("pay_webhook_error", (e as Error).message);
    return j({ ok: false, error: (e as Error).message }, 500);
  }
});
