import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { computeCommissions } from "../_shared/revenueSplits.js";
import { logFinancialEvent } from "../_shared/financial-log.js";
import { isCoinsbuyPaid } from "../_shared/coinsbuy-verify.js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const STRIPE_API_BASE = "https://api.stripe.com/v1";
const PROXY_URL = Deno.env.get("COINSBUY_PROXY_URL");
const PROXY_TOKEN = Deno.env.get("COINSBUY_PROXY_TOKEN");

// QA C3: la simulación de pagos (marcar 'paid' sin cobro real) solo se permite
// si se habilita EXPLÍCITAMENTE por env var, nunca por defecto. En producción
// debe estar ausente/false → un pago sin pasarela configurada FALLA, no simula.
const ALLOW_SIMULATED_PAYMENTS = Deno.env.get("ALLOW_SIMULATED_PAYMENTS") === "true";

// ─── Gateway Helpers ───

async function getGatewayConfig(supabase: any, serviceName: string) {
  const { data } = await supabase
    .from("integration_settings")
    .select("config, enabled")
    .eq("service_name", serviceName)
    .maybeSingle();
  // QA C3: respetar el flag `enabled`. Antes se devolvía el config aunque la
  // pasarela estuviera deshabilitada, por lo que poner enabled=false no la
  // apagaba realmente. Ahora, deshabilitada → null → el caller falla explícito.
  if (!data?.enabled) return null;
  return data.config || null;
}

// ¿El portal tiene Bullfy eCommerce activo? (portal_commerce_access.enabled por ib_id)
// Si NO, el portal no puede cobrar: cursos/eventos se entregan gratis (los caminos
// gratis viven en el cliente/RLS). Este chequeo es el candado de seguridad para que
// una petición de cobro forzada/obsoleta NO cobre cuando el comercio está apagado.
async function isPortalCommerceEnabled(supabase: any, portalId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("portal_commerce_enabled", { _portal_id: portalId });
  if (error) {
    console.error("portal_commerce_enabled rpc error", error);
    return false; // ante la duda, no cobrar.
  }
  return data === true;
}

function getEnvPrefix(config: any): string {
  return config.environment === "production" ? "production" : "sandbox";
}

// QA #6: la lógica de "pago confirmado" se centralizó en _shared/coinsbuy-verify.ts
// (isCoinsbuyPaid). Ya no se duplica aquí.

async function coinsbuyProxyFetch(config: any, path: string, init: RequestInit = {}): Promise<Response> {
  const envPrefix = getEnvPrefix(config);
  if (PROXY_URL && PROXY_TOKEN) {
    const url = `${PROXY_URL}/${envPrefix}/${path}`;
    const headers = new Headers(init.headers || {});
    headers.set("X-Proxy-Token", PROXY_TOKEN);
    return fetch(url, { ...init, headers });
  }
  const directBase = config.environment === "production"
    ? "https://v3.api.coinsbuy.com"
    : "https://v3.api-sandbox.coinsbuy.com";
  return fetch(`${directBase}/${path}`, init);
}

async function coinsbuyAuthenticate(config: any): Promise<string> {
  const res = await coinsbuyProxyFetch(config, "token/", {
    method: "POST",
    headers: { "Content-Type": "application/vnd.api+json" },
    body: JSON.stringify({
      data: {
        type: "auth-token",
        attributes: {
          client_id: config.client_id,
          client_secret: config.client_secret,
        },
      },
    }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Coinsbuy auth failed (${res.status}): ${text}`);
  const json = JSON.parse(text);
  return json.data?.attributes?.access;
}

async function logTransaction(
  supabase: any,
  params: {
    order_id: string;
    portal_id: string;
    partner_user_id: string;
    gateway: string;
    gateway_action: string;
    amount: number;
    currency: string;
    request_payload: any;
    response_payload: any;
    http_status: number;
    status: string;
    gateway_reference_id?: string;
    error_message?: string;
  }
) {
  await supabase.from("portal_payment_transactions").insert(params);
}

// Otorga el acceso correspondiente a un producto pagado.
//   course     → inscribe en el curso (reference_id).
//   membership → sube el tier del usuario (membership_tier) + registra upgrade.
//   bundle     → inscribe en TODOS los cursos del bundle (reference_id = bundle.id).
async function grantPurchaseAccess(
  supabase: any,
  prod: { id?: string; product_type?: string; reference_id?: string | null; membership_tier?: string | null; validity_months?: number | null } | null | undefined,
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
    // Registrar la membresía del usuario con su vencimiento. La validez arranca
    // AL PAGAR: expires_at = ahora + validity_months (NULL = vitalicia). Esto
    // alimenta la auto-baja al vencer y las campañas de recordatorio.
    const now = new Date();
    let expiresAt: string | null = null;
    if (prod.validity_months && prod.validity_months > 0) {
      const d = new Date(now);
      d.setMonth(d.getMonth() + prod.validity_months);
      expiresAt = d.toISOString();
    }
    await supabase.from("portal_user_memberships").insert({
      portal_id: portalId,
      partner_user_id: partnerUserId,
      product_id: prod.id ?? null,
      tier_slug: prod.membership_tier,
      started_at: now.toISOString(),
      expires_at: expiresAt,
      status: "active",
    });
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

async function activateTradingRoomSubscription(
  supabase: any,
  partnerUserId: string,
  portalId: string,
  paymentGateway: string | null,
  externalReference?: string | null,
) {
  const { data: subscription } = await supabase
    .from("trading_room_subscriptions")
    .select("id")
    .eq("partner_user_id", partnerUserId)
    .eq("portal_id", portalId)
    .maybeSingle();

  if (!subscription?.id) return;

  const now = new Date();
  const periodEnd = new Date(now);
  periodEnd.setMonth(periodEnd.getMonth() + 1);

  await supabase
    .from("trading_room_subscriptions")
    .update({
      access_status: "active",
      billing_status: "paid",
      payment_provider: paymentGateway,
      external_subscription_id: externalReference ?? null,
      current_period_start: now.toISOString(),
      current_period_end: periodEnd.toISOString(),
    })
    .eq("id", subscription.id);
}

// ─── Stripe Checkout (Checkout Session hospedada) ───
// Crea una Checkout Session de Stripe y devuelve la URL hospedada (payment_page)
// para redirigir al cliente, igual que Coinsbuy/NOWPayments. La orden queda 'pending';
// la confirmación REAL llega por el webhook (stripe-webhook), nunca al crear la sesión.
// QA C3: ya NO se marca 'paid' aquí — eso causaba acceso sin cobro confirmado.
async function processStripeCheckout(
  supabase: any,
  config: any,
  orderId: string,
  orderNumber: string,
  total: number,
  portalId: string,
  partnerUserId: string,
  redirectUrl?: string,
) {
  const amountCents = Math.round(total * 100);
  // success_url/cancel_url: Stripe los exige. Reutilizamos el redirect del front
  // (que ya trae ?payment=success); al volver, el polling de verify_payment confirma.
  const successUrl = redirectUrl || `${SUPABASE_URL}`;
  const cancelUrl = redirectUrl || `${SUPABASE_URL}`;

  const requestPayload: Record<string, string> = {
    "mode": "payment",
    "success_url": successUrl,
    "cancel_url": cancelUrl,
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": "usd",
    "line_items[0][price_data][unit_amount]": String(amountCents),
    "line_items[0][price_data][product_data][name]": `Bullfy Order ${orderNumber}`,
    "metadata[source]": "bullfy_ecommerce",
    "metadata[order_id]": orderId,
    "metadata[portal_id]": portalId,
    // Propaga el order_id también al PaymentIntent (trazabilidad en el dashboard).
    "payment_intent_data[metadata][order_id]": orderId,
  };

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(requestPayload)) {
    params.append(key, value);
  }

  const res = await fetch(`${STRIPE_API_BASE}/checkout/sessions`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${config.secret_key}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  const responseData = await res.json().catch(() => ({} as any));
  const sessionId = responseData?.id || null;
  const sessionUrl = responseData?.url || null;

  await logTransaction(supabase, {
    order_id: orderId,
    portal_id: portalId,
    partner_user_id: partnerUserId,
    gateway: "stripe",
    gateway_action: "create_checkout_session",
    amount: total,
    currency: "usd",
    request_payload: requestPayload,
    response_payload: responseData,
    http_status: res.status,
    status: res.ok && sessionUrl ? "success" : "failed",
    gateway_reference_id: sessionId,
    error_message: !res.ok
      ? (responseData.error?.message || `HTTP ${res.status}`)
      : (!sessionUrl ? "Stripe: url ausente en la respuesta" : null),
  });

  if (!res.ok || !sessionUrl) {
    return { ok: false, error: responseData?.error?.message || `No se pudo crear la sesión de pago de Stripe (HTTP ${res.status}).` };
  }
  // payment_page para que el caller lo trate igual que cripto (paymentUrl).
  return { ok: true, payment_page: sessionUrl, deposit_id: sessionId };
}

// ¿La config de Stripe tiene credenciales utilizables para cobrar?
function stripeConfigReady(config: any): boolean {
  return !!config?.secret_key;
}

// ─── Coinsbuy Checkout ───

async function processCoinsbuyCheckout(
  supabase: any,
  config: any,
  orderId: string,
  orderNumber: string,
  total: number,
  portalId: string,
  partnerUserId: string,
  walletId?: string,
  redirectUrl?: string,
) {
  const accessToken = await coinsbuyAuthenticate(config);

  // If no wallet specified, try to get the first available wallet
  let targetWalletId = walletId;
  if (!targetWalletId) {
    const walletsRes = await coinsbuyProxyFetch(config, "wallet/?page[size]=5", {
      headers: {
        "Content-Type": "application/vnd.api+json",
        "Authorization": `Bearer ${accessToken}`,
      },
    });
    const walletsText = await walletsRes.text();
    let walletsData: any;
    try { walletsData = JSON.parse(walletsText); } catch { walletsData = { raw: walletsText }; }
    // QA: la consulta de wallets puede fallar (rate-limit, token, 5xx). En ese caso
    // `data` viene vacío y NO debe disfrazarse de "no hay wallets": hay que propagar
    // el error REAL y registrarlo, para no atascar al usuario en el polling.
    if (!walletsRes.ok) {
      await logTransaction(supabase, {
        order_id: orderId,
        portal_id: portalId,
        partner_user_id: partnerUserId,
        gateway: "coinsbuy",
        gateway_action: "create_deposit",
        amount: total,
        currency: "usd",
        request_payload: { note: "wallet lookup failed", path: "wallet/?page[size]=5" },
        response_payload: walletsData,
        http_status: walletsRes.status,
        status: "failed",
        error_message: `Coinsbuy wallet lookup failed (HTTP ${walletsRes.status})`,
      });
      return { ok: false, error: `No se pudo consultar las wallets de Coinsbuy (HTTP ${walletsRes.status}). Inténtalo de nuevo en unos segundos.` };
    }
    targetWalletId = walletsData.data?.[0]?.id;
  }

  if (!targetWalletId) {
    await logTransaction(supabase, {
      order_id: orderId,
      portal_id: portalId,
      partner_user_id: partnerUserId,
      gateway: "coinsbuy",
      gateway_action: "create_deposit",
      amount: total,
      currency: "usd",
      request_payload: { note: "No wallet available" },
      response_payload: { error: "No wallets configured in Coinsbuy" },
      http_status: 0,
      status: "failed",
      error_message: "No wallets configured in Coinsbuy",
    });
    return { ok: false, error: "No hay wallets configurados en Coinsbuy" };
  }

  const depositAttributes: Record<string, any> = {
    label: `Bullfy Order ${orderNumber}`.replace(/[^a-zA-Z0-9 ]/g, ''),
    tracking_id: `bullfy-order-${orderId}`,
    target_amount_requested: String(total),
    callback_url: `${SUPABASE_URL}/functions/v1/coinsbuy-callback`,
  };
  if (redirectUrl) {
    // Coinsbuy supports `redirect_url` to render a "Return to merchant" CTA on success
    depositAttributes.redirect_url = redirectUrl;
  }

  const requestPayload = {
    data: {
      type: "deposit",
      attributes: depositAttributes,
      relationships: {
        wallet: { data: { type: "wallet", id: targetWalletId } },
      },
    },
  };

  const res = await coinsbuyProxyFetch(config, "deposit/", {
    method: "POST",
    headers: {
      "Content-Type": "application/vnd.api+json",
      "Authorization": `Bearer ${accessToken}`,
    },
    body: JSON.stringify(requestPayload),
  });

  const responseText = await res.text();
  let responseData;
  try { responseData = JSON.parse(responseText); } catch { responseData = { raw: responseText }; }

  const depositId = responseData.data?.id || null;
  const depositAddress = responseData.data?.attributes?.address || null;
  const paymentPage = responseData.data?.attributes?.payment_page || null;

  await logTransaction(supabase, {
    order_id: orderId,
    portal_id: portalId,
    partner_user_id: partnerUserId,
    gateway: "coinsbuy",
    gateway_action: "create_deposit",
    amount: total,
    currency: "usd",
    request_payload: requestPayload,
    response_payload: responseData,
    http_status: res.status,
    status: res.ok ? "success" : "failed",
    gateway_reference_id: depositId,
    error_message: !res.ok ? `HTTP ${res.status}` : null,
  });

  return {
    ok: res.ok,
    deposit_id: depositId,
    deposit_address: depositAddress,
    payment_page: paymentPage,
    error: !res.ok ? `Coinsbuy error (${res.status})` : undefined,
  };
}

// ─── NOWPayments Checkout (invoice hospedado) ───
// Crea un invoice y devuelve la URL hospedada (payment_page) para redirigir al
// cliente, igual que Coinsbuy. La confirmación llega por IPN (nowpayments-callback).
async function processNowpaymentsCheckout(
  supabase: any,
  config: any,
  orderId: string,
  orderNumber: string,
  total: number,
  portalId: string,
  partnerUserId: string,
  redirectUrl?: string,
) {
  const base = config.environment === "production"
    ? "https://api.nowpayments.io/v1"
    : "https://api-sandbox.nowpayments.io/v1";

  // Pre-validar el mínimo de NOWPayments (USD→USDT TRC20 como referencia, con el fee
  // a cargo del cliente). Evita crear un invoice condenado a quedar 'partially_paid' y
  // da un mensaje claro. usdttrc20 es de los mínimos más bajos, así que no bloquea de más.
  try {
    const minRes = await fetch(
      `${base}/min-amount?currency_from=usd&currency_to=usdttrc20&fiat_equivalent=usd&is_fee_paid_by_user=true`,
      { headers: { "x-api-key": config.api_key } },
    );
    if (minRes.ok) {
      const minData = await minRes.json().catch(() => ({} as any));
      const minUsd = Number(minData?.fiat_equivalent ?? minData?.min_amount ?? 0);
      if (Number.isFinite(minUsd) && minUsd > 0 && total < minUsd) {
        return { ok: false, error: `El pago con cripto requiere un mínimo de ~$${Math.ceil(minUsd)} USD. Para montos menores, paga con tarjeta.` };
      }
    }
  } catch (_e) { /* si el chequeo de mínimo falla, continuamos y dejamos que NOWPayments decida */ }

  const requestPayload: Record<string, any> = {
    price_amount: total,
    price_currency: "usd",
    // order_id con el mismo prefijo que Coinsbuy para correlacionar el IPN con la orden.
    order_id: `bullfy-order-${orderId}`,
    order_description: `Bullfy Order ${orderNumber}`.replace(/[^a-zA-Z0-9 #-]/g, ""),
    ipn_callback_url: `${SUPABASE_URL}/functions/v1/nowpayments-callback`,
    // El cliente paga el fee de servicio → el merchant recibe el monto completo.
    is_fee_paid_by_user: true,
    // Tasa fija: bloquea el monto a pagar durante la ventana → evita 'partially_paid'
    // por fluctuación de tasa entre crear el invoice y pagar.
    is_fixed_rate: true,
  };
  if (redirectUrl) {
    requestPayload.success_url = redirectUrl;
    requestPayload.cancel_url = redirectUrl;
  }

  const res = await fetch(`${base}/invoice`, {
    method: "POST",
    headers: { "x-api-key": config.api_key, "Content-Type": "application/json" },
    body: JSON.stringify(requestPayload),
  });

  const responseText = await res.text();
  let responseData: any;
  try { responseData = JSON.parse(responseText); } catch { responseData = { raw: responseText }; }

  const invoiceId = responseData?.id != null ? String(responseData.id) : null;
  const invoiceUrl = responseData?.invoice_url || null;

  await logTransaction(supabase, {
    order_id: orderId,
    portal_id: portalId,
    partner_user_id: partnerUserId,
    gateway: "nowpayments",
    gateway_action: "create_invoice",
    amount: total,
    currency: "usd",
    request_payload: requestPayload,
    response_payload: responseData,
    http_status: res.status,
    status: res.ok && invoiceUrl ? "success" : "failed",
    gateway_reference_id: invoiceId,
    error_message: !res.ok
      ? `NOWPayments error (${res.status})`
      : (!invoiceUrl ? "NOWPayments: invoice_url ausente en la respuesta" : null),
  });

  if (!res.ok || !invoiceUrl) {
    return { ok: false, error: responseData?.message || `No se pudo crear el invoice de NOWPayments (HTTP ${res.status}).` };
  }
  return { ok: true, payment_page: invoiceUrl, deposit_id: invoiceId };
}

// Resuelve qué proveedor cripto usar. Si el front pide uno explícito
// (coinsbuy/nowpayments) se respeta; si pide "crypto" se lee el proveedor activo
// que eligió el admin (service_name='crypto_router', default coinsbuy).
async function resolveActiveCryptoGateway(supabase: any, requested?: string) {
  let provider: string;
  if (requested === "coinsbuy" || requested === "nowpayments") {
    provider = requested;
  } else {
    const router = await getGatewayConfig(supabase, "crypto_router");
    provider = router?.active_provider === "nowpayments" ? "nowpayments" : "coinsbuy";
  }
  const config = await getGatewayConfig(supabase, provider);
  return { provider, config };
}

// ¿La config de la pasarela cripto tiene credenciales utilizables?
function cryptoConfigReady(provider: string, config: any): boolean {
  if (!config) return false;
  return provider === "nowpayments" ? !!config.api_key : !!config.client_id;
}

// Dispara el checkout del proveedor cripto resuelto. Devuelve {ok, payment_page, ...}.
async function processCryptoCheckout(
  supabase: any, provider: string, config: any,
  orderId: string, orderNumber: string, total: number,
  portalId: string, partnerUserId: string, redirectUrl?: string,
) {
  if (provider === "nowpayments") {
    return await processNowpaymentsCheckout(supabase, config, orderId, orderNumber, total, portalId, partnerUserId, redirectUrl);
  }
  return await processCoinsbuyCheckout(supabase, config, orderId, orderNumber, total, portalId, partnerUserId, undefined, redirectUrl);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  try {
    const body = await req.json();
    const { action } = body;

    // ============ ADD TO CART ============
    if (action === "add_to_cart") {
      const { partner_user_id, product_id } = body;
      if (!partner_user_id || !product_id) {
        return new Response(JSON.stringify({ ok: false, error: "Datos incompletos" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error } = await supabase
        .from("portal_cart_items")
        .upsert({ partner_user_id, product_id, quantity: 1 }, { onConflict: "partner_user_id,product_id" });

      if (error) throw error;
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ============ REMOVE FROM CART ============
    if (action === "remove_from_cart") {
      const { cart_item_id } = body;
      if (!cart_item_id) {
        return new Response(JSON.stringify({ ok: false, error: "ID requerido" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error } = await supabase.from("portal_cart_items").delete().eq("id", cart_item_id);
      if (error) throw error;
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ============ CHECKOUT ============
    if (action === "checkout") {
      const { partner_user_id, portal_id, payment_gateway, redirect_url } = body;
      // P7.3: checkout DEMO. El cliente gasta su saldo demo (no toca pasarela).
      // La orden se crea con account_kind='demo'; al marcarse 'paid' dispara el
      // mismo trigger de BD → mlm-engine reparte comisiones demo. Espejo del real.
      const isDemo = body.account_kind === "demo";
      const orderKind = isDemo ? "demo" : "real";
      if (!partner_user_id || !portal_id) {
        return new Response(JSON.stringify({ ok: false, error: "Datos incompletos" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Candado eCommerce: sin comercio activo el portal NO cobra (cobros reales).
      // El contenido se entrega gratis por los caminos gratuitos del cliente. Demo
      // no se gatea (gasta saldo demo de prueba, no dinero real).
      if (!isDemo && !(await isPortalCommerceEnabled(supabase, portal_id))) {
        return new Response(JSON.stringify({ ok: false, error: "Este portal no tiene cobros activos; el contenido es gratuito." }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get cart items with product details
      const { data: cartItems, error: cartErr } = await supabase
        .from("portal_cart_items")
        .select("id, product_id, quantity")
        .eq("partner_user_id", partner_user_id);

      if (cartErr) throw cartErr;
      if (!cartItems || cartItems.length === 0) {
        return new Response(JSON.stringify({ ok: false, error: "Carrito vacío" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get product prices
      const productIds = cartItems.map(ci => ci.product_id);
      const { data: products } = await supabase
        .from("portal_products")
        .select("id, price_usd, title, product_type, reference_id, membership_tier, validity_months")
        .in("id", productIds);

      if (!products || products.length === 0) {
        return new Response(JSON.stringify({ ok: false, error: "Productos no encontrados" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const productMap = new Map(products.map(p => [p.id, p]));
      const total = cartItems.reduce((sum, ci) => {
        const prod = productMap.get(ci.product_id);
        return sum + (prod ? prod.price_usd * ci.quantity : 0);
      }, 0);

      // Create order with pending status
      const { data: order, error: orderErr } = await supabase
        .from("portal_orders")
        .insert({
          portal_id,
          partner_user_id,
          total_usd: total,
          payment_gateway: isDemo ? "demo" : (payment_gateway || null),
          payment_status: "pending",
          account_kind: orderKind,
        })
        .select("id, order_number")
        .single();

      if (orderErr) throw orderErr;

      // Create order items
      const orderItems = cartItems.map(ci => {
        const prod = productMap.get(ci.product_id);
        return {
          order_id: order.id,
          product_id: ci.product_id,
          unit_price: prod?.price_usd || 0,
          quantity: ci.quantity,
        };
      });

      const { error: itemsErr } = await supabase.from("portal_order_items").insert(orderItems);
      if (itemsErr) throw itemsErr;

      // QA C3 (UX): el carrito se vacía DESPUÉS de iniciar el pago con éxito
      // (ver más abajo, antes del return de éxito). Si la pasarela falla/no está
      // disponible y retornamos error temprano, el carrito se conserva.

      // ─── Call real gateway API ───
      let gatewayResult: any = null;
      let paymentUrl: string | null = null;

      if (isDemo) {
        // P7.3: compra DEMO. Debita el saldo demo del cliente de forma ATÓMICA
        // (chequeo de saldo + débito + transacción en una sola operación) y marca
        // la orden 'paid' → dispara el trigger de mlm-engine (comisiones demo).
        // (Solo se debita si total > 0; un producto gratuito no consume saldo.)
        if (total > 0) {
          const { data: debitRes, error: debitErr } = await supabase.rpc("debit_demo_wallet", {
            _portal_id: portal_id,
            _user_id: partner_user_id,
            _amount: total,
            _order_id: order.id,
            _description: `Compra demo #${order.order_number}`,
          });
          if (debitErr) throw debitErr;
          if (debitRes !== "ok") {
            // Saldo demo insuficiente → cancela la orden demo y conserva el carrito.
            await supabase.from("portal_orders")
              .update({ payment_status: "cancelled" }).eq("id", order.id);
            return new Response(JSON.stringify({ ok: false, error: "Saldo demo insuficiente para esta compra." }), {
              status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        }
        await supabase.from("portal_orders")
          .update({ payment_status: "paid", paid_at: new Date().toISOString(), payment_reference: `demo_${Date.now()}` })
          .eq("id", order.id);
        gatewayResult = { ok: true, demo: true };
      } else if (payment_gateway === "stripe_gateway") {
        // Pago con tarjeta vía Stripe Checkout Session hospedada. La orden queda
        // 'pending' y solo se finaliza por el webhook (stripe-webhook), nunca aquí.
        const stripeConfig = await getGatewayConfig(supabase, "stripe_gateway");
        if (stripeConfigReady(stripeConfig)) {
          gatewayResult = await processStripeCheckout(
            supabase, stripeConfig, order.id, order.order_number, total, portal_id, partner_user_id, redirect_url,
          );
          if (gatewayResult.ok && gatewayResult.payment_page) {
            paymentUrl = gatewayResult.payment_page;
          } else {
            return new Response(JSON.stringify({ ok: false, error: gatewayResult.error || "No se pudo iniciar el pago con tarjeta." }), {
              status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          // Stripe: la orden queda pending hasta que el webhook confirme.
        } else {
          return new Response(JSON.stringify({ ok: false, error: "El pago con tarjeta no está disponible en este momento. Usa el pago con cripto." }), {
            status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } else if (payment_gateway === "coinsbuy" || payment_gateway === "nowpayments" || payment_gateway === "crypto") {
        const { provider, config: cryptoConfig } = await resolveActiveCryptoGateway(supabase, payment_gateway);
        if (cryptoConfigReady(provider, cryptoConfig)) {
          // Guardar el proveedor REAL resuelto en la orden (verify_payment y el callback lo usan).
          await supabase.from("portal_orders").update({ payment_gateway: provider }).eq("id", order.id);
          gatewayResult = await processCryptoCheckout(
            supabase, provider, cryptoConfig, order.id, order.order_number, total, portal_id, partner_user_id, redirect_url
          );
          if (gatewayResult.ok && gatewayResult.payment_page) {
            paymentUrl = gatewayResult.payment_page;
          }
          // For crypto, order stays pending until callback confirms
        } else if (ALLOW_SIMULATED_PAYMENTS) {
          // Solo en entorno de pruebas con ALLOW_SIMULATED_PAYMENTS=true.
          await logTransaction(supabase, {
            order_id: order.id, portal_id, partner_user_id,
            gateway: "coinsbuy", gateway_action: "create_deposit",
            amount: total, currency: "usd",
            request_payload: { note: "Coinsbuy not configured — SIMULATED" },
            response_payload: { simulated: true },
            http_status: 0, status: "success",
            gateway_reference_id: `sim_${Date.now()}`,
          });
          await supabase.from("portal_orders")
            .update({ payment_status: "paid", paid_at: new Date().toISOString() })
            .eq("id", order.id);
          gatewayResult = { ok: true, simulated: true };
        } else {
          // QA C3: sin pasarela configurada NO se simula pago; se falla explícito.
          return new Response(JSON.stringify({ ok: false, error: "La pasarela de pago no está disponible en este momento. Inténtalo más tarde." }), {
            status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } else {
        // QA C3: pasarela no especificada → error explícito (antes simulaba pago).
        return new Response(JSON.stringify({ ok: false, error: "Debes elegir un método de pago." }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Process revenue splits and commissions (only if paid)
      const { data: currentOrder } = await supabase
        .from("portal_orders")
        .select("payment_status")
        .eq("id", order.id)
        .single();

      if (currentOrder?.payment_status === "paid") {
        const { data: splits } = await supabase
          .from("portal_revenue_splits")
          .select("role_label, percentage")
          .eq("portal_id", portal_id)
          .order("priority");

        if (splits && splits.length > 0) {
          // P4a: redondeo exacto (residuo a 'platform') + dedup por onConflict.
          const commissions = computeCommissions(total, splits as any).map(c => ({
            order_id: order.id,
            portal_id,
            beneficiary_type: c.role_label,
            amount: c.amount,
            status: "pending",
            account_kind: orderKind,
          }));
          await supabase.from("portal_commissions")
            .upsert(commissions, { onConflict: "order_id,beneficiary_type", ignoreDuplicates: true });
        }

        // Ledger entry
        const { data: lastEntry } = await supabase
          .from("portal_ledger")
          .select("balance_after")
          .eq("portal_id", portal_id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        const currentBalance = lastEntry?.balance_after || 0;
        await supabase.from("portal_ledger").insert({
          portal_id,
          order_id: order.id,
          entry_type: "sale",
          amount: total,
          description: `Venta #${order.order_number} — ${cartItems.length} producto(s)`,
          balance_after: currentBalance + total,
          account_kind: orderKind,
        });

        // Otorgar acceso (cursos, membresías, paquetes)
        for (const ci of cartItems) {
          const prod = productMap.get(ci.product_id);
          await grantPurchaseAccess(supabase, prod, partner_user_id, portal_id);
        }

        // P6: trazar la orden pagada en checkout.
        await logFinancialEvent(supabase, {
          function_name: "portal-commerce", event_type: "order_paid",
          gateway: isDemo ? "demo" : ((gatewayResult as any)?.simulated ? "simulated" : "coinsbuy"),
          portal_id, order_id: order.id, partner_user_id, amount: total, currency: "usd",
          result: "success",
          payload: { source: "checkout", order_number: order.order_number, simulated: !!(gatewayResult as any)?.simulated, account_kind: orderKind },
        });
      }

      // Vaciar el carrito solo ahora que el pago se inició/confirmó con éxito
      // (orden pagada o checkout cripto creado). Los paths de error ya retornaron
      // antes, por lo que el usuario no pierde el carrito si no pudo pagar.
      await supabase.from("portal_cart_items").delete().eq("partner_user_id", partner_user_id);

      return new Response(JSON.stringify({
        ok: true,
        order_id: order.id,
        order_number: order.order_number,
        total,
        gateway_result: gatewayResult,
        payment_url: paymentUrl,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "checkout_trading_plan") {
      const { partner_user_id, portal_id, payment_gateway, redirect_url } = body;
      if (!partner_user_id || !portal_id) {
        return new Response(JSON.stringify({ ok: false, error: "Datos incompletos" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: subscription, error: subscriptionError } = await supabase
        .from("trading_room_subscriptions")
        .select("id, plan_id, price_monthly, billing_status, trading_room_plan_catalog(display_name)")
        .eq("partner_user_id", partner_user_id)
        .eq("portal_id", portal_id)
        .maybeSingle();

      if (subscriptionError) throw subscriptionError;
      if (!subscription?.plan_id) {
        return new Response(JSON.stringify({ ok: false, error: "Primero debes seleccionar un plan" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const total = Number(subscription.price_monthly || 0);
      const planName = subscription.trading_room_plan_catalog?.display_name || "Trading Room";

      const { data: order, error: orderErr } = await supabase
        .from("portal_orders")
        .insert({
          portal_id,
          partner_user_id,
          total_usd: total,
          payment_gateway: payment_gateway || null,
          payment_status: "pending",
        })
        .select("id, order_number")
        .single();

      if (orderErr) throw orderErr;

      let gatewayResult: any = null;
      let paymentUrl: string | null = null;

      if (payment_gateway === "stripe_gateway") {
        // Pago con tarjeta vía Stripe Checkout Session. La suscripción se activa al
        // confirmar el pago (stripe-webhook → finalizeOrder), no aquí.
        const stripeConfig = await getGatewayConfig(supabase, "stripe_gateway");
        if (stripeConfigReady(stripeConfig)) {
          gatewayResult = await processStripeCheckout(
            supabase, stripeConfig, order.id, order.order_number, total, portal_id, partner_user_id, redirect_url,
          );
          if (gatewayResult.ok && gatewayResult.payment_page) {
            paymentUrl = gatewayResult.payment_page;
          } else {
            return new Response(JSON.stringify({ ok: false, error: gatewayResult.error || "No se pudo iniciar el pago con tarjeta." }), {
              status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          await supabase
            .from("trading_room_subscriptions")
            .update({ billing_status: "pending_payment", payment_provider: "stripe" })
            .eq("partner_user_id", partner_user_id)
            .eq("portal_id", portal_id);
        } else {
          return new Response(JSON.stringify({ ok: false, error: "El pago con tarjeta no está disponible en este momento. Usa el pago con cripto." }), {
            status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } else if (payment_gateway === "coinsbuy" || payment_gateway === "nowpayments" || payment_gateway === "crypto") {
        const { provider, config: cryptoConfig } = await resolveActiveCryptoGateway(supabase, payment_gateway);
        if (cryptoConfigReady(provider, cryptoConfig)) {
          await supabase.from("portal_orders").update({ payment_gateway: provider }).eq("id", order.id);
          gatewayResult = await processCryptoCheckout(
            supabase, provider, cryptoConfig, order.id, order.order_number, total, portal_id, partner_user_id, redirect_url,
          );
          if (gatewayResult.ok && gatewayResult.payment_page) {
            paymentUrl = gatewayResult.payment_page;
          }
          await supabase
            .from("trading_room_subscriptions")
            .update({ billing_status: gatewayResult.ok ? "pending_payment" : "payment_error", payment_provider: provider })
            .eq("partner_user_id", partner_user_id)
            .eq("portal_id", portal_id);
        } else if (ALLOW_SIMULATED_PAYMENTS) {
          // Solo en entorno de pruebas con ALLOW_SIMULATED_PAYMENTS=true.
          await logTransaction(supabase, {
            order_id: order.id,
            portal_id,
            partner_user_id,
            gateway: "coinsbuy",
            gateway_action: "create_deposit",
            amount: total,
            currency: "usd",
            request_payload: { note: "Coinsbuy not configured — SIMULATED", plan: planName },
            response_payload: { simulated: true },
            http_status: 0,
            status: "success",
            gateway_reference_id: `sim_${Date.now()}`,
          });
          await supabase.from("portal_orders")
            .update({ payment_status: "paid", paid_at: new Date().toISOString(), payment_reference: `sim_${Date.now()}` })
            .eq("id", order.id);
          await activateTradingRoomSubscription(supabase, partner_user_id, portal_id, "coinsbuy", null);
          gatewayResult = { ok: true, simulated: true };
        } else {
          // QA C3: sin pasarela configurada NO se simula pago; se falla explícito.
          return new Response(JSON.stringify({ ok: false, error: "La pasarela de pago no está disponible en este momento. Inténtalo más tarde." }), {
            status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } else {
        return new Response(JSON.stringify({ ok: false, error: "Pasarela no soportada" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({
        ok: true,
        order_id: order.id,
        order_number: order.order_number,
        total,
        gateway_result: gatewayResult,
        payment_url: paymentUrl,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ============ CHECKOUT EVENTO PAGADO ============
    if (action === "checkout_event") {
      const { partner_user_id, portal_id, event_id, payment_gateway, redirect_url } = body;
      if (!partner_user_id || !portal_id || !event_id) {
        return new Response(JSON.stringify({ ok: false, error: "Datos incompletos" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Candado eCommerce: sin comercio activo no se cobran entradas. La inscripción
      // gratis se hace por el camino directo del cliente (RLS lo permite cuando OFF).
      if (!(await isPortalCommerceEnabled(supabase, portal_id))) {
        return new Response(JSON.stringify({ ok: false, error: "Este portal no tiene cobros activos; la inscripción es gratuita." }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: ev, error: evErr } = await supabase
        .from("portal_events")
        .select("id, title, price_usd, is_free, status, capacity, portal_id")
        .eq("id", event_id)
        .maybeSingle();
      if (evErr) throw evErr;
      if (!ev || ev.portal_id !== portal_id) {
        return new Response(JSON.stringify({ ok: false, error: "Evento no encontrado" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (ev.is_free || Number(ev.price_usd) <= 0) {
        return new Response(JSON.stringify({ ok: false, error: "Este evento es gratuito; usa la inscripción directa." }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // ¿Ya inscrito?
      const { data: alreadyReg } = await supabase
        .from("portal_event_registrations")
        .select("id").eq("event_id", event_id).eq("partner_user_id", partner_user_id).maybeSingle();
      if (alreadyReg) {
        return new Response(JSON.stringify({ ok: false, error: "Ya estás inscrito en este evento." }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Cupo (chequeo suave; enforce_event_capacity es el guard final al inscribir).
      if (ev.capacity != null) {
        const { count } = await supabase
          .from("portal_event_registrations")
          .select("id", { count: "exact", head: true })
          .eq("event_id", event_id);
        if ((count ?? 0) >= ev.capacity) {
          return new Response(JSON.stringify({ ok: false, error: "Este evento ya no tiene cupos disponibles." }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      const total = Number(ev.price_usd) || 0;
      const { data: order, error: orderErr } = await supabase
        .from("portal_orders")
        .insert({
          portal_id,
          partner_user_id,
          total_usd: total,
          payment_gateway: payment_gateway || null,
          payment_status: "pending",
          event_id,
        })
        .select("id, order_number")
        .single();
      if (orderErr) throw orderErr;

      let gatewayResult: any = null;
      let paymentUrl: string | null = null;

      if (payment_gateway === "stripe_gateway") {
        // Pago con tarjeta vía Stripe Checkout Session. La inscripción al evento se
        // crea al CONFIRMAR el pago (stripe-webhook → finalizeOrder), no aquí.
        const stripeConfig = await getGatewayConfig(supabase, "stripe_gateway");
        if (stripeConfigReady(stripeConfig)) {
          gatewayResult = await processStripeCheckout(
            supabase, stripeConfig, order.id, order.order_number, total, portal_id, partner_user_id, redirect_url,
          );
          if (gatewayResult.ok && gatewayResult.payment_page) {
            paymentUrl = gatewayResult.payment_page;
          } else {
            return new Response(JSON.stringify({ ok: false, error: gatewayResult.error || "No se pudo iniciar el pago con tarjeta." }), {
              status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        } else {
          return new Response(JSON.stringify({ ok: false, error: "El pago con tarjeta no está disponible en este momento. Usa el pago con cripto." }), {
            status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } else if (payment_gateway === "coinsbuy" || payment_gateway === "nowpayments" || payment_gateway === "crypto") {
        const { provider, config: cryptoConfig } = await resolveActiveCryptoGateway(supabase, payment_gateway);
        if (cryptoConfigReady(provider, cryptoConfig)) {
          await supabase.from("portal_orders").update({ payment_gateway: provider }).eq("id", order.id);
          gatewayResult = await processCryptoCheckout(
            supabase, provider, cryptoConfig, order.id, order.order_number, total, portal_id, partner_user_id, redirect_url,
          );
          if (gatewayResult.ok && gatewayResult.payment_page) paymentUrl = gatewayResult.payment_page;
          // La inscripción al evento se crea al CONFIRMAR el pago (callback/verify_payment).
        } else if (ALLOW_SIMULATED_PAYMENTS) {
          await supabase.from("portal_orders")
            .update({ payment_status: "paid", paid_at: new Date().toISOString(), payment_reference: `sim_${Date.now()}` })
            .eq("id", order.id);
          await supabase.from("portal_event_registrations").upsert(
            { event_id, partner_user_id, granted_by: "paid" },
            { onConflict: "event_id,partner_user_id", ignoreDuplicates: true },
          );
          gatewayResult = { ok: true, simulated: true };
        } else {
          return new Response(JSON.stringify({ ok: false, error: "La pasarela de pago no está disponible en este momento. Inténtalo más tarde." }), {
            status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } else {
        return new Response(JSON.stringify({ ok: false, error: "Debes elegir un método de pago." }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({
        ok: true, order_id: order.id, order_number: order.order_number, total,
        gateway_result: gatewayResult, payment_url: paymentUrl,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ============ VERIFY PAYMENT (polling fallback for Coinsbuy) ============
    if (action === "verify_payment") {
      const { order_id } = body;
      if (!order_id) {
        return new Response(JSON.stringify({ ok: false, error: "order_id requerido" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: order } = await supabase
        .from("portal_orders")
        .select("id, payment_status, payment_gateway, portal_id, partner_user_id, total_usd, order_number, event_id")
        .eq("id", order_id)
        .maybeSingle();

      if (!order) {
        return new Response(JSON.stringify({ ok: false, error: "Orden no encontrada" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Already paid: short-circuit
      if (order.payment_status === "paid") {
        return new Response(JSON.stringify({ ok: true, status: "paid" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Stripe: consulta ACTIVA del estado de la Checkout Session (paridad con cripto).
      // Toma el session_id del log de creación y delega en stripe-webhook por la vía
      // interna (idempotente + re-verificación server-to-server con la secret_key).
      if (order.payment_gateway === "stripe_gateway") {
        const { data: stripeLog } = await supabase
          .from("portal_payment_transactions")
          .select("gateway_reference_id")
          .eq("order_id", order.id)
          .eq("gateway", "stripe")
          .eq("gateway_action", "create_checkout_session")
          .not("gateway_reference_id", "is", null)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        const sessionId = stripeLog?.gateway_reference_id;
        if (sessionId) {
          try {
            await supabase.functions.invoke("stripe-webhook", {
              body: { internal: true, order_id: order.id, session_id: sessionId },
            });
            const { data: fresh } = await supabase
              .from("portal_orders").select("payment_status").eq("id", order.id).maybeSingle();
            return new Response(JSON.stringify({ ok: true, status: fresh?.payment_status || order.payment_status }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          } catch (e: any) {
            console.error("verify_payment stripe poll error", e);
          }
        }
        return new Response(JSON.stringify({ ok: true, status: order.payment_status }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // NOWPayments: consulta ACTIVA del estado del pago (paridad con Coinsbuy). El
      // invoice no expone payment_id al crearse, así que lo tomamos del primer IPN ya
      // recibido (NOWPayments notifica cada cambio de estado y el log queda en
      // portal_payment_transactions). Si el pago ya está 'finished', finaliza por la vía
      // probada (nowpayments-callback: idempotente + re-verificación server-to-server).
      if (order.payment_gateway === "nowpayments") {
        const npConfig = await getGatewayConfig(supabase, "nowpayments");
        const { data: npLog } = await supabase
          .from("portal_payment_transactions")
          .select("gateway_reference_id")
          .eq("order_id", order.id)
          .eq("gateway", "nowpayments")
          .eq("gateway_action", "callback_received")
          .not("gateway_reference_id", "is", null)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        const npPaymentId = npLog?.gateway_reference_id;
        if (npConfig?.api_key && npPaymentId) {
          try {
            const base = npConfig.environment === "production"
              ? "https://api.nowpayments.io/v1"
              : "https://api-sandbox.nowpayments.io/v1";
            const res = await fetch(`${base}/payment/${npPaymentId}`, {
              headers: { "x-api-key": npConfig.api_key },
            });
            const data = await res.json().catch(() => ({}));
            const _st = String(data?.payment_status ?? "").toLowerCase();
            // 'finished' o 'partially_paid' → deja que el callback decida (aplica la
            // tolerancia de déficit mínimo). Otros estados siguen pendientes.
            if (res.ok && (_st === "finished" || _st === "partially_paid")) {
              // Finaliza por el callback probado (idempotente, vuelve a verificar contra NOWPayments).
              await supabase.functions.invoke("nowpayments-callback", {
                body: { order_id: `bullfy-order-${order.id}`, payment_id: npPaymentId },
              });
              const { data: fresh } = await supabase
                .from("portal_orders").select("payment_status").eq("id", order.id).maybeSingle();
              return new Response(JSON.stringify({ ok: true, status: fresh?.payment_status || "paid" }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              });
            }
          } catch (e: any) {
            console.error("verify_payment nowpayments poll error", e);
          }
        }
        return new Response(JSON.stringify({ ok: true, status: order.payment_status }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // For Coinsbuy: actively poll the gateway for the latest deposit status
      if (order.payment_gateway === "coinsbuy") {
        const coinsbuyConfig = await getGatewayConfig(supabase, "coinsbuy");
        if (!coinsbuyConfig?.client_id) {
          return new Response(JSON.stringify({ ok: true, status: order.payment_status }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Find deposit_id from prior log entry
        const { data: logRow } = await supabase
          .from("portal_payment_transactions")
          .select("gateway_reference_id")
          .eq("order_id", order.id)
          .eq("gateway", "coinsbuy")
          .eq("gateway_action", "create_deposit")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        const depositId = logRow?.gateway_reference_id;
        if (!depositId) {
          return new Response(JSON.stringify({ ok: true, status: order.payment_status }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        try {
          const accessToken = await coinsbuyAuthenticate(coinsbuyConfig);
          const res = await coinsbuyProxyFetch(coinsbuyConfig, `deposit/${depositId}/`, {
            headers: {
              "Content-Type": "application/vnd.api+json",
              "Authorization": `Bearer ${accessToken}`,
            },
          });
          const json = await res.json();
          const remoteStatus = json?.data?.attributes?.status;
          const isPaid = isCoinsbuyPaid(remoteStatus);

          await logTransaction(supabase, {
            order_id: order.id,
            portal_id: order.portal_id,
            partner_user_id: order.partner_user_id,
            gateway: "coinsbuy",
            gateway_action: "verify_payment",
            amount: order.total_usd,
            currency: "usd",
            request_payload: { deposit_id: depositId },
            response_payload: { status: remoteStatus, raw: json },
            http_status: res.status,
            status: res.ok ? "success" : "failed",
            gateway_reference_id: depositId,
          });

          if (isPaid) {
            // P4a: marcar pagado de forma CONDICIONAL (cierra la carrera). Solo
            // corremos los side-effects si ESTA llamada hizo la transición
            // pending→paid; otra llamada concurrente que pierda no los re-ejecuta.
            const { data: markedPaid } = await supabase.from("portal_orders")
              .update({ payment_status: "paid", paid_at: new Date().toISOString(), payment_reference: depositId })
              .eq("id", order.id)
              .eq("payment_status", "pending")
              .select("id");
            if (!markedPaid || markedPaid.length === 0) {
              return new Response(JSON.stringify({ ok: true, status: "paid" }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              });
            }

            // Revenue splits
            const { data: splits } = await supabase
              .from("portal_revenue_splits")
              .select("role_label, percentage")
              .eq("portal_id", order.portal_id)
              .order("priority");
            if (splits && splits.length > 0) {
              const { data: existingComm } = await supabase
                .from("portal_commissions")
                .select("id")
                .eq("order_id", order.id)
                .limit(1);
              if (!existingComm || existingComm.length === 0) {
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
            }

            // Ledger
            const { data: existingLedger } = await supabase
              .from("portal_ledger")
              .select("id")
              .eq("order_id", order.id)
              .limit(1);
            if (!existingLedger || existingLedger.length === 0) {
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
                description: `Venta #${order.order_number} (verificada vía Coinsbuy)`,
                balance_after: currentBalance + order.total_usd,
              });
            }

            // Otorgar acceso (cursos, membresías, paquetes)
            const { data: items } = await supabase
              .from("portal_order_items")
              .select("product_id, portal_products:product_id(id, product_type, reference_id, membership_tier, validity_months)")
              .eq("order_id", order.id);
            if (items) {
              for (const it of items) {
                const prod = (it as any).portal_products;
                await grantPurchaseAccess(supabase, prod, order.partner_user_id, order.portal_id);
              }
            }

            // Inscripción a EVENTO pagado (si la orden corresponde a un evento).
            if ((order as any).event_id) {
              const { error: regErr } = await supabase.from("portal_event_registrations")
                .upsert(
                  { event_id: (order as any).event_id, partner_user_id: order.partner_user_id, granted_by: "paid" },
                  { onConflict: "event_id,partner_user_id", ignoreDuplicates: true },
                );
              if (regErr) console.error("event registration (paid) failed", order.id, regErr);
            }

            // Activate trading-room subscription if applicable
            await activateTradingRoomSubscription(supabase, order.partner_user_id, order.portal_id, "coinsbuy", depositId);

            // P6: trazar la orden pagada (verificada vía Coinsbuy).
            await logFinancialEvent(supabase, {
              function_name: "portal-commerce", event_type: "order_paid",
              gateway: "coinsbuy", portal_id: order.portal_id, order_id: order.id,
              partner_user_id: order.partner_user_id, amount: order.total_usd, currency: "usd",
              result: "success", payload: { source: "verify_payment", deposit_id: depositId, order_number: order.order_number },
            });

            return new Response(JSON.stringify({ ok: true, status: "paid" }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }

          return new Response(JSON.stringify({ ok: true, status: remoteStatus || "pending" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        } catch (e: any) {
          console.error("verify_payment Coinsbuy error", e);
          return new Response(JSON.stringify({ ok: true, status: "pending", error: e.message }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      return new Response(JSON.stringify({ ok: true, status: order.payment_status }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: false, error: "Acción no reconocida" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ ok: false, error: err.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
