// Crea una sesión de pago de recarga de wallet (wallet_topup).
// gateway: 'stripe' | 'coinsbuy'. Devuelve URL de checkout.
// Las entradas pagadas (entry_fee/elite_entry) están deshabilitadas — el
// webhook solo acredita topups. Flujo: recargar wallet -> inscribirse al
// torneo (tournament-join debita el wallet de forma atómica).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { cors, ok, err, requireTournamentUser } from "../_shared/tournament-helpers.js";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SVC = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PUBLIC_BASE = "https://bullfytech.online";

async function getGatewayConfig(supa: any, service: "stripe_gateway" | "coinsbuy") {
  const { data } = await supa.from("integration_settings")
    .select("config, enabled").eq("service_name", service).maybeSingle();
  if (!data?.enabled || !data?.config) throw new Error(`${service} no configurado`);
  return data.config;
}

async function stripeForm(secretKey: string, path: string, params: Record<string, any>) {
  const body = new URLSearchParams();
  const flatten = (obj: any, prefix = "") => {
    for (const [k, v] of Object.entries(obj)) {
      if (v === undefined || v === null) continue;
      const key = prefix ? `${prefix}[${k}]` : k;
      if (typeof v === "object" && !Array.isArray(v)) flatten(v, key);
      else body.append(key, String(v));
    }
  };
  flatten(params);
  const r = await fetch(`https://api.stripe.com/v1${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${secretKey}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  return { ok: r.ok, status: r.status, data: await r.json() };
}

async function coinsbuyAuth(cfg: any) {
  const base = cfg.environment === "production" ? "https://v3.api.coinsbuy.com" : "https://v3.api-sandbox.coinsbuy.com";
  const r = await fetch(`${base}/token/`, {
    method: "POST", headers: { "Content-Type": "application/vnd.api+json" },
    body: JSON.stringify({ data: { type: "auth-token", attributes: { client_id: cfg.client_id, client_secret: cfg.client_secret } } }),
  });
  if (!r.ok) throw new Error(`Coinsbuy auth failed (${r.status})`);
  const j = await r.json();
  return { token: j.data?.attributes?.access, base };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const supa = createClient(SUPABASE_URL, SVC);
    const { user, error: authErr } = await requireTournamentUser(req, supa);
    if (!user) return err(authErr || "No autenticado");

    const { gateway, type, amount_usd } = await req.json();
    if (!["stripe", "coinsbuy"].includes(gateway)) return err("gateway inválido");

    // Solo se soporta wallet_topup. entry_fee/elite_entry están deshabilitadas:
    // el webhook solo acredita topups, y tournament-join debita el wallet al
    // inscribir. Un pago directo de entrada quedaría 'completed' sin efecto.
    if (type !== "wallet_topup") {
      return err("unsupported_payment_type; top up wallet then join");
    }

    const amount = Number(amount_usd) || 0;
    if (amount < 1) return err("Monto inválido");

    // Create pending payment row
    const { data: pay, error: payErr } = await supa.from("tournament_payments").insert({
      user_id: user.id, tournament_id: null,
      type, amount_usd: amount, gateway, status: "pending",
      expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    }).select("id").single();
    if (payErr) return err(payErr.message);

    const successUrl = `${PUBLIC_BASE}/tournament/wallet?payment=success&pid=${pay.id}`;
    const cancelUrl = `${PUBLIC_BASE}/tournament/wallet?payment=cancel&pid=${pay.id}`;

    if (gateway === "stripe") {
      const cfg = await getGatewayConfig(supa, "stripe_gateway");
      const r = await stripeForm(cfg.secret_key, "/checkout/sessions", {
        mode: "payment",
        success_url: successUrl,
        cancel_url: cancelUrl,
        customer_email: user.email,
        line_items: [{
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: Math.round(amount * 100),
            product_data: { name: "Recarga Bullfy Tournament" },
          },
        }],
        metadata: { payment_id: pay.id, tournament_user_id: user.id, type },
      });
      if (!r.ok) {
        await supa.from("tournament_payments").update({ status: "failed", metadata: r.data }).eq("id", pay.id);
        return err(r.data?.error?.message || "Stripe error");
      }
      await supa.from("tournament_payments").update({
        gateway_session_id: r.data.id, gateway_payment_url: r.data.url,
      }).eq("id", pay.id);
      return ok({ url: r.data.url, payment_id: pay.id });
    }

    // Coinsbuy
    const cfg = await getGatewayConfig(supa, "coinsbuy");
    const { token, base } = await coinsbuyAuth(cfg);
    const r = await fetch(`${base}/invoices/`, {
      method: "POST",
      headers: { "Content-Type": "application/vnd.api+json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        data: {
          type: "invoice",
          attributes: {
            target_amount: amount.toFixed(2),
            target_currency: "USD",
            label: "Wallet Topup",
            tracking_id: pay.id,
            callback_url: `${SUPABASE_URL}/functions/v1/tournament-pay-webhook?gw=coinsbuy`,
            success_url: successUrl,
            cancel_url: cancelUrl,
          },
          relationships: { wallet: { data: { type: "wallet", id: cfg.wallet_id || cfg.default_wallet_id } } },
        },
      }),
    });
    const j = await r.json();
    if (!r.ok) {
      await supa.from("tournament_payments").update({ status: "failed", metadata: j }).eq("id", pay.id);
      return err(j?.errors?.[0]?.detail || "Coinsbuy error");
    }
    const url = j.data?.attributes?.url || j.data?.attributes?.payment_page;
    await supa.from("tournament_payments").update({
      gateway_session_id: j.data?.id, gateway_payment_url: url,
    }).eq("id", pay.id);
    return ok({ url, payment_id: pay.id });
  } catch (e) {
    return err((e as Error).message);
  }
});
