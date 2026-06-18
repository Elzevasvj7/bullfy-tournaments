import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action, gateway, credentials, environment, enabled } = body;

    // Validate auth
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ ok: false, error: "No autorizado" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Check admin role
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .in("role", ["admin", "global_admin"]);

    if (!roles || roles.length === 0) {
      return new Response(JSON.stringify({ ok: false, error: "Permisos insuficientes" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (action === "save_credentials") {
      if (!gateway) {
        return new Response(JSON.stringify({ ok: false, error: "Gateway requerido" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      let config: Record<string, any> = { environment: environment || "sandbox" };

      if (gateway === "coinsbuy") {
        if (credentials.client_id) config.client_id = credentials.client_id;
        // Store secrets securely - we save them in the config but masked for display
        if (credentials.client_secret) {
          config.client_secret = credentials.client_secret;
          config.client_secret_masked = true;
        }
        if (credentials.callback_secret) {
          config.callback_secret = credentials.callback_secret;
          config.callback_secret_masked = true;
        }
      } else if (gateway === "stripe_gateway") {
        if (credentials.publishable_key) config.publishable_key = credentials.publishable_key;
        if (credentials.secret_key) {
          config.secret_key = credentials.secret_key;
          config.secret_key_masked = true;
        }
        // Clave de firma del webhook (whsec_...) para verificar Stripe-Signature.
        if (credentials.webhook_secret) {
          config.webhook_secret = credentials.webhook_secret;
          config.webhook_secret_masked = true;
        }
      } else if (gateway === "nowpayments") {
        if (credentials.api_key) {
          config.api_key = credentials.api_key;
          config.api_key_masked = true;
        }
        if (credentials.ipn_secret) {
          config.ipn_secret = credentials.ipn_secret;
          config.ipn_secret_masked = true;
        }
        // Credenciales para PAYOUTS (JWT). El email no es secreto; el password sí.
        if (credentials.email !== undefined) config.email = credentials.email;
        if (credentials.password) {
          config.password = credentials.password;
          config.password_masked = true;
        }
      }

      // Check if record exists
      const { data: existing } = await supabase
        .from("integration_settings")
        .select("id, config")
        .eq("service_name", gateway)
        .maybeSingle();

      let resultId: string;

      if (existing) {
        // Merge config - preserve existing secrets if new ones not provided
        const mergedConfig = { ...existing.config, ...config };
        if (gateway === "coinsbuy") {
          if (!credentials.client_secret && existing.config?.client_secret) {
            mergedConfig.client_secret = existing.config.client_secret;
            mergedConfig.client_secret_masked = true;
          }
          if (!credentials.callback_secret && existing.config?.callback_secret) {
            mergedConfig.callback_secret = existing.config.callback_secret;
            mergedConfig.callback_secret_masked = true;
          }
        } else if (gateway === "stripe_gateway") {
          if (!credentials.secret_key && existing.config?.secret_key) {
            mergedConfig.secret_key = existing.config.secret_key;
            mergedConfig.secret_key_masked = true;
          }
          if (!credentials.webhook_secret && existing.config?.webhook_secret) {
            mergedConfig.webhook_secret = existing.config.webhook_secret;
            mergedConfig.webhook_secret_masked = true;
          }
        } else if (gateway === "nowpayments") {
          if (!credentials.api_key && existing.config?.api_key) {
            mergedConfig.api_key = existing.config.api_key;
            mergedConfig.api_key_masked = true;
          }
          if (!credentials.ipn_secret && existing.config?.ipn_secret) {
            mergedConfig.ipn_secret = existing.config.ipn_secret;
            mergedConfig.ipn_secret_masked = true;
          }
          if (!credentials.password && existing.config?.password) {
            mergedConfig.password = existing.config.password;
            mergedConfig.password_masked = true;
          }
        }

        const { error } = await supabase
          .from("integration_settings")
          .update({ enabled: enabled ?? false, config: mergedConfig, updated_by: user.id })
          .eq("id", existing.id);

        if (error) throw error;
        resultId = existing.id;
      } else {
        const { data: newRow, error } = await supabase
          .from("integration_settings")
          .insert({
            service_name: gateway,
            enabled: enabled ?? false,
            config,
            updated_by: user.id
          })
          .select("id")
          .single();

        if (error) throw error;
        resultId = newRow.id;
      }

      return new Response(JSON.stringify({ ok: true, id: resultId }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (action === "get_credentials") {
      const { data } = await supabase
        .from("integration_settings")
        .select("*")
        .eq("service_name", gateway)
        .maybeSingle();

      // Return config without raw secrets for display
      if (data?.config) {
        const safeConfig = { ...data.config };
        delete safeConfig.client_secret;
        delete safeConfig.callback_secret;
        delete safeConfig.secret_key;
        delete safeConfig.webhook_secret;
        delete safeConfig.api_key;
        delete safeConfig.ipn_secret;
        delete safeConfig.password;
        return new Response(JSON.stringify({ ok: true, data: { ...data, config: safeConfig } }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      return new Response(JSON.stringify({ ok: true, data: null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Selecciona qué pasarela cripto está ACTIVA para el checkout (Coinsbuy o
    // NOWPayments). El front del cliente final envía payment_gateway="crypto" y el
    // backend resuelve el proveedor leyendo esta fila (service_name='crypto_router').
    if (action === "set_active_crypto") {
      const provider = body.provider === "nowpayments" ? "nowpayments" : "coinsbuy";
      const { data: existing } = await supabase
        .from("integration_settings")
        .select("id, config")
        .eq("service_name", "crypto_router")
        .maybeSingle();

      if (existing) {
        await supabase
          .from("integration_settings")
          .update({ enabled: true, config: { ...existing.config, active_provider: provider }, updated_by: user.id })
          .eq("id", existing.id);
      } else {
        await supabase
          .from("integration_settings")
          .insert({ service_name: "crypto_router", enabled: true, config: { active_provider: provider }, updated_by: user.id });
      }

      return new Response(JSON.stringify({ ok: true, active_provider: provider }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
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
