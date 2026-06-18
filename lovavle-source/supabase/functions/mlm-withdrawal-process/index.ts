// MLM Withdrawal Processor
// Procesa solicitudes en portal_withdrawal_requests:
//   - payout_method='usdt_trc20' → Coinsbuy payout
//   - payout_method='stripe'     → Stripe Transfer / Payout
// Idempotente: solo procesa filas en status='pending', y al iniciar las
// marca 'processing' con guard optimista para evitar dobles ejecuciones.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { notifyWithdrawal } from "../_shared/notifications.js";
import { logFinancialEvent } from "../_shared/financial-log.js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface WithdrawalRow {
  id: string;
  portal_id: string;
  user_id: string;
  wallet_id: string;
  request_number: string | null;
  amount_requested: number;
  fee_amount: number;
  amount_net: number;
  currency: string;
  network: string | null;
  destination_address: string | null;
  payout_method: "usdt_trc20" | "stripe";
  stripe_destination: string | null;
  status: string;
  account_kind?: string;
}

async function getStripeConfig(supabase: any) {
  const { data } = await supabase
    .from("integration_settings")
    .select("config, enabled")
    .eq("service_name", "stripe_gateway")
    .maybeSingle();
  if (!data?.config?.secret_key) {
    throw new Error("Stripe no está configurado en Configuración > Pasarelas de Pago");
  }
  return data.config as { secret_key: string; environment: string };
}

async function stripePost(secretKey: string, path: string, params: Record<string, any>) {
  const body = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) body.append(k, String(v));
  }
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });
  const text = await res.text();
  let json: any;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  return { ok: res.ok, status: res.status, data: json };
}

async function getCoinsbuyConfig(supabase: any) {
  const { data } = await supabase
    .from("integration_settings")
    .select("config, enabled")
    .eq("service_name", "coinsbuy_gateway")
    .maybeSingle();
  if (!data?.config) throw new Error("Coinsbuy no está configurado");
  return data.config as Record<string, string>;
}

async function processStripe(supabase: any, w: WithdrawalRow) {
  const cfg = await getStripeConfig(supabase);
  const isAccount = w.stripe_destination!.startsWith("acct_");

  if (isAccount) {
    // Stripe Connect Transfer (cuenta conectada)
    const result = await stripePost(cfg.secret_key, "/transfers", {
      amount: Math.round(w.amount_net * 100),
      currency: (w.currency || "usd").toLowerCase(),
      destination: w.stripe_destination,
      description: `MLM Withdrawal ${w.request_number ?? w.id}`,
      "metadata[withdrawal_id]": w.id,
      "metadata[portal_id]": w.portal_id,
      "metadata[user_id]": w.user_id,
    });
    if (!result.ok) {
      return { ok: false, error: result.data?.error?.message ?? "Stripe transfer failed", raw: result.data };
    }
    return { ok: true, transfer_id: result.data?.id, raw: result.data };
  }

  // Sin Stripe Connect → registramos pending con instrucciones manuales
  return {
    ok: false,
    error: `Destino Stripe '${w.stripe_destination}' no es una cuenta conectada (acct_...). Para procesar a un email se requiere configurar Stripe Connect Express en el portal.`,
    raw: { manual_required: true, destination: w.stripe_destination },
  };
}

async function processCoinsbuy(supabase: any, w: WithdrawalRow) {
  // Coinsbuy payout integration placeholder. Marcamos processing.
  // Cuando el portal tenga API keys de Coinsbuy payouts configuradas,
  // se reemplaza por la llamada real. Por ahora: registramos request_id
  // sintético y dejamos status='processing' para procesamiento manual.
  try {
    await getCoinsbuyConfig(supabase);
  } catch (_) {
    return { ok: false, error: "Coinsbuy no está configurado para payouts en este portal" };
  }
  return {
    ok: true,
    payout_id: `cb_pending_${Date.now()}`,
    raw: { note: "Coinsbuy payout queued; awaiting external confirmation" },
    keep_processing: true,
  };
}

// ─── NOWPayments payout ───
async function getNowpaymentsConfig(supabase: any) {
  const { data } = await supabase
    .from("integration_settings")
    .select("config, enabled")
    .eq("service_name", "nowpayments")
    .maybeSingle();
  if (!data?.enabled) return null;
  return data.config || null;
}

function npBase(config: any): string {
  return config.environment === "production"
    ? "https://api.nowpayments.io/v1"
    : "https://api-sandbox.nowpayments.io/v1";
}

async function npJwt(config: any): Promise<string> {
  if (!config.email || !config.password) {
    throw new Error("NOWPayments payouts: faltan email/password en la configuración");
  }
  const res = await fetch(`${npBase(config)}/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: config.email, password: config.password }),
  });
  const data = await res.json().catch(() => ({} as any));
  if (!res.ok || !data?.token) throw new Error(`NOWPayments auth failed (${res.status})`);
  return data.token as string;
}

// Crea un batch de payout en NOWPayments. Queda en WAITING hasta la aprobación manual
// en el dashboard de NP. Adopta el patrón del cliente: unique_external_id = withdrawal.id
// y payout_description "email · nombre · wd:xxxx". NO completa el retiro: espera el IPN.
async function processNowpaymentsPayout(supabase: any, w: WithdrawalRow) {
  const config = await getNowpaymentsConfig(supabase);
  if (!config?.api_key || !config?.email || !config?.password) {
    return { ok: false, error: "NOWPayments no está configurado para payouts (faltan API key / email / password)" };
  }
  if (!w.destination_address) {
    return { ok: false, error: "Falta la dirección de destino para el payout" };
  }

  // Descripción legible para el dashboard de NP.
  let payoutDescription = `wd:${w.id.slice(0, 8)}`;
  try {
    const { data: pu } = await supabase
      .from("partner_users").select("email, nombre").eq("id", w.user_id).maybeSingle();
    const sanitize = (s: string) => s.replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim();
    const parts = [
      pu?.email ? sanitize(pu.email) : null,
      pu?.nombre ? sanitize(pu.nombre) : null,
      `wd:${w.id.slice(0, 8)}`,
    ].filter(Boolean) as string[];
    payoutDescription = parts.join(" · ").slice(0, 100);
  } catch (_) { /* best-effort */ }

  const ipnUrl = `${SUPABASE_URL}/functions/v1/nowpayments-payout-callback`;
  const jwt = await npJwt(config);

  const res = await fetch(`${npBase(config)}/payout`, {
    method: "POST",
    headers: {
      "x-api-key": config.api_key,
      Authorization: `Bearer ${jwt}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ipn_callback_url: ipnUrl,
      withdrawals: [
        {
          address: w.destination_address,
          currency: "usdttrc20",
          amount: w.amount_net,
          unique_external_id: w.id,
          ipn_callback_url: ipnUrl,
          payout_description: payoutDescription,
        },
      ],
    }),
  });

  const data = await res.json().catch(() => ({} as any));
  if (!res.ok) {
    return { ok: false, error: `NOWPayments payout failed (${res.status}): ${JSON.stringify(data).slice(0, 300)}`, raw: data };
  }
  const batchId = String(data?.id ?? "");
  // keep_processing: queda 'processing' hasta que el IPN confirme (FINISHED/SENT) o
  // falle (FAILED/REJECTED). NO se completa aquí.
  return { ok: true, payout_id: batchId, raw: data, keep_processing: true };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const body = await req.json().catch(() => ({}));
    const withdrawal_id: string | undefined = body.withdrawal_id;

    // Gate de aprobación: los retiros REALES solo se procesan si un admin los aprobó
    // (approved_at IS NOT NULL). Los DEMO (simulados) no requieren aprobación.
    let query = supabase
      .from("portal_withdrawal_requests")
      .select("*")
      .eq("status", "pending")
      .or("account_kind.eq.demo,approved_at.not.is.null")
      .limit(20);

    if (withdrawal_id) query = supabase
      .from("portal_withdrawal_requests")
      .select("*")
      .eq("id", withdrawal_id)
      .eq("status", "pending")
      .or("account_kind.eq.demo,approved_at.not.is.null");

    const { data: rows, error: fetchErr } = await query;
    if (fetchErr) throw fetchErr;

    const results: any[] = [];
    for (const w of (rows as WithdrawalRow[]) ?? []) {
      // Optimistic guard: pending → processing
      const { data: lockData, error: lockErr } = await supabase
        .from("portal_withdrawal_requests")
        .update({ status: "processing", processed_at: new Date().toISOString() })
        .eq("id", w.id)
        .eq("status", "pending")
        .select("id")
        .maybeSingle();
      if (lockErr || !lockData) {
        results.push({ id: w.id, skipped: true });
        continue;
      }

      try {
        // P7.3: retiro DEMO simulado. No toca pasarela ni mueve dinero real; se
        // completa directamente (el saldo demo ya se descontó al crear el retiro).
        // complete_withdrawal deriva account_kind='demo' de la fila y actualiza el
        // wallet demo. Espejo de la UX de retiro real, sin payout.
        const proc =
          w.account_kind === "demo"
            ? { ok: true as const, payout_id: `demo_${Date.now()}`, raw: { simulated: true, demo: true } }
            : w.payout_method === "stripe"
              ? await processStripe(supabase, w)
              : await processNowpaymentsPayout(supabase, w);

        if (!proc.ok) {
          // Fase 3 / P3: reembolso ATÓMICO vía RPC (marca failed + reintegra
          // saldo + asiento de ledger correcto, todo en una transacción). Antes
          // el insert de ledger usaba la columna `type` (inexistente) y un
          // transaction_type fuera del CHECK → fallaba siempre y el saldo/ledger
          // divergían; además el read-modify-write del refund no era atómico.
          const { data: refundResult, error: refundErr } = await supabase.rpc("refund_withdrawal", {
            _withdrawal_id: w.id,
            _reason: proc.error,
          });
          if (refundErr) console.error("refund_withdrawal failed", w.id, refundErr);
          // Persistir la respuesta cruda de la pasarela (metadata, no crítico).
          await supabase
            .from("portal_withdrawal_requests")
            .update({ stripe_response: w.payout_method === "stripe" ? proc.raw : null })
            .eq("id", w.id);
          // Notificar solo si el reembolso realmente se aplicó (no afirmar falso).
          if (!refundErr && refundResult === "refunded") {
            await notifyWithdrawal(supabase, {
              portalId: w.portal_id, partnerUserId: w.user_id, status: "fallido", amount: w.amount_requested,
            });
          }
          // P6: trazar el retiro fallido (salida de dinero).
          await logFinancialEvent(supabase, {
            function_name: "mlm-withdrawal-process",
            event_type: "withdrawal_failed",
            gateway: w.payout_method === "stripe" ? "stripe" : "nowpayments",
            portal_id: w.portal_id, withdrawal_id: w.id, partner_user_id: w.user_id,
            amount: w.amount_requested, currency: w.currency,
            result: "failed", error_message: proc.error,
            payload: { payout_method: w.payout_method, refunded: refundResult === "refunded" },
          });
          results.push({ id: w.id, ok: false, error: proc.error });
          continue;
        }

        // Success or queued
        const updates: Record<string, any> = {
          stripe_response: w.payout_method === "stripe" ? proc.raw : null,
          nowpayments_response: w.payout_method === "usdt_trc20" ? proc.raw : null,
        };
        if (w.payout_method === "stripe") updates.stripe_transfer_id = (proc as any).transfer_id;
        if (w.payout_method === "usdt_trc20") updates.nowpayments_payout_id = (proc as any).payout_id;

        if (!(proc as any).keep_processing) {
          // Fase 3 / P3: completado ATÓMICO vía RPC (marca completed +
          // total_withdrawn += net + asiento de ledger correcto en una
          // transacción). El status/completed_at los fija el RPC, no `updates`.
          const { error: compErr } = await supabase.rpc("complete_withdrawal", {
            _withdrawal_id: w.id,
            _payout_id: w.payout_method === "usdt_trc20"
              ? (proc as any).payout_id ?? null
              : (proc as any).transfer_id ?? null,
            _tx_hash: null,
          });
          if (compErr) console.error("complete_withdrawal failed", w.id, compErr);
          // C7: notificar retiro procesado — best-effort. (No notificar en demo:
          // es un retiro simulado, no enviamos correos reales por pruebas.)
          if (w.account_kind !== "demo") {
            await notifyWithdrawal(supabase, {
              portalId: w.portal_id, partnerUserId: w.user_id, status: "procesado", amount: w.amount_net,
            });
          }
          // P6: trazar el retiro procesado (incluye demo, para trazabilidad).
          await logFinancialEvent(supabase, {
            function_name: "mlm-withdrawal-process",
            event_type: "withdrawal_completed",
            gateway: w.account_kind === "demo" ? "demo" : (w.payout_method === "stripe" ? "stripe" : "nowpayments"),
            portal_id: w.portal_id, withdrawal_id: w.id, partner_user_id: w.user_id,
            amount: w.amount_net, currency: w.currency,
            result: "success",
            payload: { payout_method: w.payout_method, account_kind: w.account_kind ?? "real" },
          });
        }

        await supabase.from("portal_withdrawal_requests").update(updates).eq("id", w.id);
        results.push({ id: w.id, ok: true, method: w.payout_method });
      } catch (innerErr) {
        const msg = innerErr instanceof Error ? innerErr.message : String(innerErr);
        await supabase
          .from("portal_withdrawal_requests")
          .update({ status: "failed", failure_reason: msg })
          .eq("id", w.id);
        results.push({ id: w.id, ok: false, error: msg });
      }
    }

    return new Response(JSON.stringify({ ok: true, processed: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
