// NowPayments configuration manager v2
// Saves/reads credentials in integration_settings (service_name='nowpayments_gateway')
// Tests connection against NowPayments API.
// Force redeploy

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const NP_LIVE_BASE = "https://api.nowpayments.io/v1";
const NP_SANDBOX_BASE = "https://api-sandbox.nowpayments.io/v1";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    const { action, credentials, environment, enabled } = body ?? {};

    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ ok: false, error: "No autorizado" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .in("role", ["admin", "global_admin"]);

    if (!roles || roles.length === 0) {
      return new Response(JSON.stringify({ ok: false, error: "Permisos insuficientes" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "save_credentials") {
      const { data: existing } = await supabase
        .from("integration_settings")
        .select("id, config")
        .eq("service_name", "nowpayments_gateway")
        .maybeSingle();

      const oldConfig = (existing?.config as Record<string, any>) ?? {};
      const newConfig: Record<string, any> = {
        ...oldConfig,
        environment: environment || oldConfig.environment || "sandbox",
      };

      // Only overwrite secrets if provided
      if (credentials?.api_key_live) newConfig.api_key_live = credentials.api_key_live;
      if (credentials?.ipn_secret_live) newConfig.ipn_secret_live = credentials.ipn_secret_live;
      if (credentials?.api_key_sandbox) newConfig.api_key_sandbox = credentials.api_key_sandbox;
      if (credentials?.ipn_secret_sandbox) newConfig.ipn_secret_sandbox = credentials.ipn_secret_sandbox;

      let resultId: string;
      if (existing) {
        const { error } = await supabase
          .from("integration_settings")
          .update({ enabled: enabled ?? false, config: newConfig, updated_by: user.id })
          .eq("id", existing.id);
        if (error) throw error;
        resultId = existing.id;
      } else {
        const { data: row, error } = await supabase
          .from("integration_settings")
          .insert({
            service_name: "nowpayments_gateway",
            enabled: enabled ?? false,
            config: newConfig,
            updated_by: user.id,
          })
          .select("id")
          .single();
        if (error) throw error;
        resultId = row.id;
      }

      return new Response(JSON.stringify({ ok: true, id: resultId }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "get_credentials") {
      const { data } = await supabase
        .from("integration_settings")
        .select("*")
        .eq("service_name", "nowpayments_gateway")
        .maybeSingle();

      if (data?.config) {
        const cfg = data.config as Record<string, any>;
        const safe = {
          environment: cfg.environment ?? "sandbox",
          api_key_live_set: !!cfg.api_key_live,
          ipn_secret_live_set: !!cfg.ipn_secret_live,
          api_key_sandbox_set: !!cfg.api_key_sandbox,
          ipn_secret_sandbox_set: !!cfg.ipn_secret_sandbox,
        };
        return new Response(
          JSON.stringify({ ok: true, data: { ...data, config: safe } }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      return new Response(JSON.stringify({ ok: true, data: null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "test_connection") {
      const { data } = await supabase
        .from("integration_settings")
        .select("config")
        .eq("service_name", "nowpayments_gateway")
        .maybeSingle();

      const cfg = (data?.config as Record<string, any>) ?? {};
      const env = environment || cfg.environment || "sandbox";
      const base = env === "live" ? NP_LIVE_BASE : NP_SANDBOX_BASE;
      const apiKey = env === "live" ? cfg.api_key_live : cfg.api_key_sandbox;

      if (!apiKey) {
        return new Response(
          JSON.stringify({ ok: false, error: `No hay API Key configurada para ${env}` }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // Status endpoint is public; use /status as connectivity check then /currencies with key
      const statusRes = await fetch(`${base}/status`);
      const statusJson = await statusRes.json().catch(() => ({}));

      const currRes = await fetch(`${base}/currencies`, {
        headers: { "x-api-key": apiKey },
      });
      const currJson = await currRes.json().catch(() => ({}));

      if (!currRes.ok) {
        return new Response(
          JSON.stringify({
            ok: false,
            error: `NowPayments rechazó la API Key (${currRes.status}): ${JSON.stringify(currJson)}`,
            environment: env,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      return new Response(
        JSON.stringify({
          ok: true,
          environment: env,
          api_status: statusJson?.message ?? "unknown",
          currencies_count: Array.isArray(currJson?.currencies) ? currJson.currencies.length : 0,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({ ok: false, error: "Acción no reconocida" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
