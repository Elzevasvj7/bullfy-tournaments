import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logFinancialEvent } from "../_shared/financial-log.js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// VPS Proxy config
const PROXY_URL = Deno.env.get("COINSBUY_PROXY_URL"); // e.g. https://1.2.3.4:8443
const PROXY_TOKEN = Deno.env.get("COINSBUY_PROXY_TOKEN");

async function getConfig(supabase: any) {
  const { data } = await supabase
    .from("integration_settings")
    .select("config, enabled")
    .eq("service_name", "coinsbuy")
    .maybeSingle();

  if (!data || !data.config) {
    throw new Error(
      "Coinsbuy no está configurado. Ve a Configuración > Pasarelas de Pago.",
    );
  }
  return data.config;
}

function getEnvPrefix(config: any): string {
  return config.environment === "production" ? "production" : "sandbox";
}

/** Route request through VPS proxy or fallback to direct */
async function proxyFetch(
  config: any,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const envPrefix = getEnvPrefix(config);

  if (PROXY_URL && PROXY_TOKEN) {
    // Route through VPS proxy
    const url = `${PROXY_URL}/${envPrefix}/${path}`;
    const headers = new Headers(init.headers || {});
    headers.set("X-Proxy-Token", PROXY_TOKEN);
    return fetch(url, { ...init, headers });
  }

  // Fallback: direct call (will fail if IP not whitelisted)
  const directBase =
    config.environment === "production"
      ? "https://v3.api.coinsbuy.com"
      : "https://v3.api-sandbox.coinsbuy.com";
  return fetch(`${directBase}/${path}`, init);
}

async function authenticate(config: any) {
  if (!config.client_id || !config.client_secret) {
    throw new Error("Client ID o Client Secret no configurados");
  }
  const res = await proxyFetch(config, "token/", {
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
  if (!res.ok) throw new Error(`Auth failed (${res.status}): ${text}`);
  const json = JSON.parse(text);
  return json.data?.attributes?.access;
}

async function authedFetch(
  config: any,
  path: string,
  method = "GET",
  body?: string,
): Promise<{ ok: boolean; json: any }> {
  const accessToken = await authenticate(config);
  const res = await proxyFetch(config, path, {
    method,
    headers: {
      "Content-Type": "application/vnd.api+json",
      Authorization: `Bearer ${accessToken}`,
    },
    ...(body ? { body } : {}),
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  return { ok: res.ok, json };
}

function jsonRes(data: any) {
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action } = body;

    // Validate user auth
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return jsonRes({ ok: false, error: "No autorizado" });
    }

    // ─── CHECK EGRESS IP ───
    if (action === "check_ip") {
      const [ipify, icanhazip] = await Promise.all([
        fetch("https://api.ipify.org?format=json").then((r) => r.text()),
        fetch("https://icanhazip.com").then((r) => r.text()),
      ]);
      return jsonRes({
        ok: true,
        data: {
          ipify,
          icanhazip: icanhazip.trim(),
          proxy_configured: !!(PROXY_URL && PROXY_TOKEN),
        },
      });
    }

    const config = await getConfig(supabase);

    // ─── PING ───
    if (action === "ping") {
      const res = await proxyFetch(config, "ping");
      const text = await res.text();
      return jsonRes({
        ok: res.ok,
        data: {
          status: res.status,
          body: text,
          environment: config.environment,
          proxy: !!(PROXY_URL && PROXY_TOKEN),
        },
      });
    }

    // ─── AUTHENTICATE ───
    if (action === "authenticate") {
      const accessToken = await authenticate(config);
      return jsonRes({
        ok: true,
        data: {
          token_preview: accessToken?.substring(0, 30) + "...",
          environment: config.environment,
          message: "Token OAuth2 generado exitosamente",
        },
      });
    }

    // ─── LIST WALLETS ───
    if (action === "list_wallets") {
      const { ok, json } = await authedFetch(config, "wallet/?page[size]=50");
      return jsonRes({ ok, data: json });
    }

    // ─── LIST CURRENCIES ───
    if (action === "list_currencies") {
      const { ok, json } = await authedFetch(
        config,
        "currency/?page[size]=50",
      );
      return jsonRes({ ok, data: json });
    }

    // ─── CREATE DEPOSIT ───
    if (action === "create_deposit") {
      const attributes: Record<string, any> = {
        label: body.label || "Bullfy Deposit",
        tracking_id: `bullfy-${Date.now()}`,
        callback_url: `${SUPABASE_URL}/functions/v1/coinsbuy-callback`,
      };
      if (body.amount) attributes.target_amount_requested = body.amount;

      const payload = {
        data: {
          type: "deposit",
          attributes,
          relationships: {
            wallet: { data: { type: "wallet", id: body.wallet_id } },
          },
        },
      };

      console.log("Creating deposit with payload:", JSON.stringify(payload));

      const { ok, json } = await authedFetch(
        config,
        "deposit/",
        "POST",
        JSON.stringify(payload),
      );
      // P6: trazar la creación del depósito (antes no dejaba ningún rastro).
      await logFinancialEvent(supabase, {
        function_name: "coinsbuy-proxy",
        event_type: "deposit_created",
        gateway: "coinsbuy",
        partner_user_id: user.id,
        amount: body.amount ?? null,
        currency: "usd",
        result: ok ? "success" : "failed",
        error_message: ok ? null : (json?.errors?.[0]?.detail ?? "deposit create failed"),
        payload: { tracking_id: attributes.tracking_id, deposit_id: json?.data?.id ?? null, wallet_id: body.wallet_id },
      });
      return jsonRes({
        ok,
        data: json,
        error: !ok ? `HTTP error` : undefined,
      });
    }

    // ─── LIST DEPOSITS ───
    if (action === "list_deposits") {
      const { ok, json } = await authedFetch(
        config,
        "deposit/?page[size]=10&sort=-created_at",
      );
      return jsonRes({ ok, data: json });
    }

    return jsonRes({ ok: false, error: "Acción no reconocida" });
  } catch (err) {
    return jsonRes({ ok: false, error: err.message });
  }
});
