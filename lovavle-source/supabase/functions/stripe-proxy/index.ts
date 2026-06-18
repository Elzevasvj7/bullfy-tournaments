import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const STRIPE_API_BASE = "https://api.stripe.com/v1";

async function getConfig(supabase: any) {
  const { data } = await supabase
    .from("integration_settings")
    .select("config, enabled")
    .eq("service_name", "stripe_gateway")
    .maybeSingle();

  if (!data || !data.config) throw new Error("Stripe no está configurado. Ve a Configuración > Pasarelas de Pago.");
  if (!data.config.secret_key) throw new Error("Secret Key de Stripe no configurada.");
  return data.config;
}

async function stripeRequest(secretKey: string, path: string, method = "GET", bodyParams?: Record<string, any>) {
  const options: RequestInit = {
    method,
    headers: {
      "Authorization": `Bearer ${secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
  };

  if (bodyParams && method === "POST") {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(bodyParams)) {
      if (value !== undefined && value !== null) {
        params.append(key, String(value));
      }
    }
    options.body = params.toString();
  }

  const res = await fetch(`${STRIPE_API_BASE}${path}`, options);
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  return { ok: res.ok, status: res.status, data: json };
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
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ ok: false, error: "No autorizado" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // ─── CHECK CONNECTION ───
    if (action === "check_connection") {
      const config = await getConfig(supabase);
      const result = await stripeRequest(config.secret_key, "/balance");
      return new Response(JSON.stringify({
        ok: result.ok,
        data: result.ok ? {
          environment: config.environment,
          livemode: result.data?.livemode,
          available: result.data?.available,
          pending: result.data?.pending,
          message: result.data?.livemode ? "⚠️ Conectado en modo LIVE" : "✅ Conectado en modo TEST"
        } : result.data
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ─── CREATE PAYMENT INTENT ───
    if (action === "create_payment_intent") {
      const config = await getConfig(supabase);
      const amount = parseInt(body.amount);
      if (!amount || amount < 50) {
        return new Response(JSON.stringify({ ok: false, error: "Monto mínimo: 50 centavos" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      const result = await stripeRequest(config.secret_key, "/payment_intents", "POST", {
        amount,
        currency: body.currency || "usd",
        description: body.description || "Bullfy test payment",
        "metadata[source]": "bullfy_sandbox",
        "metadata[created_by]": user.id,
      });

      return new Response(JSON.stringify({
        ok: result.ok,
        data: result.ok ? {
          id: result.data.id,
          amount: result.data.amount,
          currency: result.data.currency,
          status: result.data.status,
          client_secret: result.data.client_secret,
          livemode: result.data.livemode,
          created: new Date(result.data.created * 1000).toISOString(),
        } : result.data,
        error: !result.ok ? result.data?.error?.message : undefined
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ─── LIST PAYMENT INTENTS ───
    if (action === "list_payment_intents") {
      const config = await getConfig(supabase);
      const result = await stripeRequest(config.secret_key, "/payment_intents?limit=10");

      const items = result.data?.data?.map((pi: any) => ({
        id: pi.id,
        amount: pi.amount,
        currency: pi.currency,
        status: pi.status,
        description: pi.description,
        livemode: pi.livemode,
        created: new Date(pi.created * 1000).toISOString(),
      })) || [];

      return new Response(JSON.stringify({
        ok: result.ok,
        data: { items, total: result.data?.data?.length || 0 }
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ ok: false, error: "Acción no reconocida" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: err.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
