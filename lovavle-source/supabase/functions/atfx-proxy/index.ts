import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ATFX_BASE_DEFAULT = "https://bullfy-live.brokertools.io/api/v1";

function ok(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify({ ok: true, ...payload }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
function fail(error: string, extra: Record<string, unknown> = {}) {
  return new Response(JSON.stringify({ ok: false, error, ...extra }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return fail("No autorizado");
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return fail("Sesión inválida");

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "global_admin")
      .maybeSingle();
    if (!roleRow) return fail("Solo Master Admin puede usar esta integración");

    const body = await req.json().catch(() => ({}));
    const { action, payload } = body as { action: string; payload?: any };

    // ===== Acciones de configuración (no requieren credenciales ATFX) =====
    if (action === "get_config") {
      const { data } = await admin
        .from("integration_settings")
        .select("config, enabled, updated_at")
        .eq("service_name", "atfx")
        .maybeSingle();
      const cfg = (data?.config ?? {}) as Record<string, any>;
      return ok({
        configured: !!(cfg.token_id && cfg.api_token),
        enabled: data?.enabled ?? false,
        endpoint: cfg.endpoint || ATFX_BASE_DEFAULT,
        token_id: cfg.token_id || "",
        token_id_masked: cfg.token_id ? `${String(cfg.token_id).slice(0, 4)}••••` : "",
        api_token_set: !!cfg.api_token,
        updated_at: data?.updated_at || null,
      });
    }

    if (action === "save_config") {
      // Normalizar: trim + quitar slashes finales. Si no termina en /api/v1, lo añadimos.
      let endpoint = (payload?.endpoint || "").toString().trim().replace(/\/+$/, "");
      if (!endpoint) endpoint = ATFX_BASE_DEFAULT;
      else if (!/\/api\/v\d+$/i.test(endpoint)) endpoint = `${endpoint}/api/v1`;
      const token_id = (payload?.token_id || "").toString().trim();
      const api_token = (payload?.api_token || "").toString().trim();
      if (!token_id) return fail("token_id es requerido");

      // Si no envían api_token nuevo, conservar el existente
      let finalApiToken = api_token;
      if (!finalApiToken) {
        const { data: existing } = await admin
          .from("integration_settings")
          .select("config")
          .eq("service_name", "atfx")
          .maybeSingle();
        finalApiToken = (existing?.config as any)?.api_token || "";
        if (!finalApiToken) return fail("api_token es requerido la primera vez");
      }

      const { error } = await admin
        .from("integration_settings")
        .upsert({
          service_name: "atfx",
          enabled: true,
          config: { endpoint, token_id, api_token: finalApiToken },
          updated_by: user.id,
        }, { onConflict: "service_name" });
      if (error) return fail(error.message);
      return ok({ saved: true });
    }

    // ===== Cargar credenciales para acciones que llaman a ATFX =====
    const { data: settings } = await admin
      .from("integration_settings")
      .select("config")
      .eq("service_name", "atfx")
      .maybeSingle();
    const cfg = (settings?.config ?? {}) as Record<string, any>;
    const tokenId = cfg.token_id || Deno.env.get("ATFX_API_TOKEN_ID");
    const apiToken = cfg.api_token || Deno.env.get("ATFX_API_TOKEN");
    const ATFX_BASE = (cfg.endpoint as string) || ATFX_BASE_DEFAULT;

    if (!tokenId || !apiToken) {
      return fail("Configura primero el endpoint y las credenciales ATFX en Configuración → Integraciones");
    }

    // ATFX usa header "Auth" con formato "apiId:apiKey" (sin "Bearer", sin guion bajo)
    // NO enviamos "Accept: application/json" porque ATFX devuelve content-type text/html
    // aunque el body sea JSON válido (verificado en pruebas reales con Talend).
    const authValue = `${tokenId}:${apiToken}`;
    const baseHeaders: Record<string, string> = {
      "Auth": authValue,
    };

    const normalizeBase = (b: string) => {
      let v = (b || "").trim().replace(/\/+$/, "");
      if (v && !/\/api\/v\d+$/i.test(v)) v = `${v}/api/v1`;
      return v;
    };

    const callATFX = async (
      path: string,
      method: "GET" | "POST" | "PUT" | "DELETE",
      reqBody?: unknown,
      baseOverride?: string,
    ) => {
      const base = baseOverride ? normalizeBase(baseOverride) : ATFX_BASE;
      const url = `${base}${path}`;
      const headers: Record<string, string> = { ...baseHeaders };
      const init: RequestInit = { method, headers };
      if (reqBody !== undefined) {
        headers["Content-Type"] = "application/json";
        init.body = JSON.stringify(reqBody);
      }
      const res = await fetch(url, init);
      const text = await res.text();
      let parsed: unknown = text;
      try { parsed = JSON.parse(text); } catch { /* keep raw text */ }
      return { status: res.status, ok: res.ok, data: parsed, url };
    };

    const qs = (obj?: Record<string, any>) => {
      if (!obj) return "";
      const params = new URLSearchParams();
      Object.entries(obj).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== "") params.append(k, String(v));
      });
      const s = params.toString();
      return s ? `?${s}` : "";
    };

    const get = async (path: string) => {
      const r = await callATFX(path, "GET");
      if (!r.ok) return fail(`HTTP ${r.status}`, { raw: r.data, url: r.url, status: r.status });
      return ok({ data: r.data, status: r.status, url: r.url });
    };

    switch (action) {
      case "test_connection": {
        // Llamamos a /trades?limit=1 — endpoint real, barato y validador del Auth header
        const result = await callATFX("/trades?limit=1", "GET");
        const isJson = typeof result.data === "object" && result.data !== null;
        const looksHtml = typeof result.data === "string" && /<!doctype html|<html/i.test(result.data);
        const tokenInvalid =
          (result.status === 401 || result.status === 403) ||
          (isJson && JSON.stringify(result.data).toLowerCase().includes("unauthor"));
        const wrongEndpoint = looksHtml || (!isJson && result.status === 200);
        return ok({
          connected: result.ok && isJson,
          endpoint_reachable: !wrongEndpoint && (result.ok || tokenInvalid),
          token_valid: result.ok && isJson,
          status: result.status,
          url: result.url,
          sample: isJson ? result.data : (looksHtml ? "<html response — endpoint incorrecto>" : result.data),
          hint: wrongEndpoint
            ? "El endpoint devuelve HTML. Verifica que la URL base sea https://client.bullfy.com/api/v1 (sin slash final)."
            : tokenInvalid
            ? "Endpoint OK pero el token ATFX es inválido. Formato del header Auth: tokenId:apiToken. Verifica credenciales."
            : undefined,
        });
      }

      // ===== Sistema =====
      case "list_products":         return get(`/products${qs(payload)}`);
      case "list_adapters":         return get(`/adapters${qs(payload)}`);
      case "list_trading_groups":   return get(`/groups${qs(payload)}`);
      case "list_webhooks":         return get(`/webhooks${qs(payload)}`);
      case "audit_log":             return get(`/auditlog${qs(payload)}`);

      // ===== Customers =====
      case "list_customers":        return get(`/customers${qs(payload)}`);
      case "customer_detail": {
        if (!payload?.id) return fail("Falta payload.id");
        return get(`/customer/${encodeURIComponent(payload.id)}`);
      }
      case "customer_accounts": {
        if (!payload?.id) return fail("Falta payload.id");
        return get(`/accounts${qs({ customer_id: payload.id })}`);
      }
      case "customer_transactions": {
        if (!payload?.id) return fail("Falta payload.id");
        const { id, ...rest } = payload;
        return get(`/transactions${qs({ customer_id: id, ...rest })}`);
      }
      case "customer_kyc_documents": {
        if (!payload?.id) return fail("Falta payload.id");
        return get(`/customerfiles${qs({ customer_id: payload.id })}`);
      }
      case "customer_login_history": {
        if (!payload?.id) return fail("Falta payload.id");
        return get(`/userlogin${qs({ customer_id: payload.id })}`);
      }
      case "customer_notes": {
        if (!payload?.id) return fail("Falta payload.id");
        return get(`/customerchanged${qs({ customer_id: payload.id })}`);
      }

      // ===== Transacciones =====
      case "list_transactions":         return get(`/transactions${qs(payload)}`);
      case "list_internal_transfers":   return get(`/transactions${qs({ ...payload, type: "transfer" })}`);
      case "list_manual_adjustments":   return get(`/transactions${qs({ ...payload, type: "adjustment" })}`);
      case "list_commissions":          return get(`/transactions${qs({ ...payload, type: "commission" })}`);

      // ===== Trades =====
      case "list_open_trades":      return get(`/positionsclosed${qs({ ...payload, status: "open" })}`);
      case "list_closed_trades":    return get(`/trades${qs(payload)}`);
      case "list_pending_orders":   return get(`/orders${qs(payload)}`);
      case "list_symbols":          return get(`/symbols${qs(payload)}`);

      // ===== Cuentas =====
      case "list_accounts":         return get(`/accounts${qs(payload)}`);
      case "account_detail": {
        if (!payload?.id) return fail("Falta payload.id");
        return get(`/serveraccount/${encodeURIComponent(payload.id)}`);
      }

      // ===== Agentes =====
      case "report_agents":         return get(`/agents${qs(payload)}`);
      case "agent_detail": {
        if (!payload?.id) return fail("Falta payload.id");
        return get(`/agent/${encodeURIComponent(payload.id)}`);
      }
      case "agent_referrals": {
        if (!payload?.id) return fail("Falta payload.id");
        return get(`/customers${qs({ agent_id: payload.id })}`);
      }
      case "agent_commissions": {
        if (!payload?.id) return fail("Falta payload.id");
        const { id, ...rest } = payload;
        return get(`/agentcommission${qs({ agent_id: id, ...rest })}`);
      }
      case "agent_hierarchy":       return get(`/agenttree${qs(payload)}`);
      case "agent_payouts":         return get(`/agentstatistics${qs(payload)}`);

      // ===== Promos =====
      case "list_bonuses":          return get(`/bonuses${qs(payload)}`);
      case "list_promotions":       return get(`/customerbonuses${qs(payload)}`);
      case "list_coupons":          return get(`/customerbonus${qs(payload)}`);

      // ===== Reportes financieros =====
      case "report_volume":         return get(`/reports${qs({ ...payload, type: "volume" })}`);
      case "report_profit":         return get(`/reports${qs({ ...payload, type: "profit" })}`);
      case "report_pamm":           return get(`/pamm${qs(payload)}`);
      case "report_store_revenue":  return get(`/store${qs({ ...payload, type: "revenue" })}`);

      // ===== Store =====
      case "list_store_orders":     return get(`/store${qs({ ...payload, type: "orders" })}`);
      case "list_subscriptions":    return get(`/store${qs({ ...payload, type: "subscriptions" })}`);

      // ===== Prop Trading =====
      case "prop_overview":         return get(`/proptrading${qs(payload)}`);
      case "list_challenges":       return get(`/proptrading${qs({ ...payload, section: "challenges" })}`);
      case "challenge_types":       return get(`/proptrading${qs({ ...payload, section: "challenge_types" })}`);
      case "challenge_detail": {
        if (!payload?.id) return fail("Falta payload.id");
        return get(`/proptrading${qs({ section: "challenges", id: payload.id })}`);
      }

      case "list_participants":     return get(`/proptrading${qs({ ...payload, section: "participants" })}`);
      case "participant_detail": {
        if (!payload?.id) return fail("Falta payload.id");
        return get(`/proptrading${qs({ section: "participants", id: payload.id })}`);
      }
      case "participant_goals": {
        if (!payload?.id) return fail("Falta payload.id");
        return get(`/proptrading${qs({ section: "goals", participant_id: payload.id })}`);
      }
      case "participant_phases": {
        if (!payload?.id) return fail("Falta payload.id");
        return get(`/proptrading${qs({ section: "phases", participant_id: payload.id })}`);
      }
      case "participant_trades": {
        if (!payload?.id) return fail("Falta payload.id");
        const { id, ...rest } = payload;
        return get(`/proptrading${qs({ section: "trades", participant_id: id, ...rest })}`);
      }
      case "participant_resets": {
        if (!payload?.id) return fail("Falta payload.id");
        return get(`/proptrading${qs({ section: "resets", participant_id: payload.id })}`);
      }

      case "prop_sales_summary":      return get(`/proptrading${qs({ ...payload, section: "sales_summary" })}`);
      case "prop_sales_by_type":      return get(`/proptrading${qs({ ...payload, section: "sales_by_type" })}`);
      case "prop_revenue_total":      return get(`/proptrading${qs({ ...payload, section: "revenue" })}`);
      case "prop_conversion_rate":    return get(`/proptrading${qs({ ...payload, section: "conversion" })}`);
      case "prop_arpu_ltv":           return get(`/proptrading${qs({ ...payload, section: "arpu" })}`);
      case "prop_coupons":            return get(`/proptrading${qs({ ...payload, section: "coupons" })}`);
      case "prop_payouts":            return get(`/proptrading${qs({ ...payload, section: "payouts" })}`);

      case "prop_open_trades":        return get(`/proptrading${qs({ ...payload, section: "trades", status: "open" })}`);
      case "prop_closed_trades":      return get(`/proptrading${qs({ ...payload, section: "trades", status: "closed" })}`);
      case "prop_drawdown_alerts":    return get(`/proptrading${qs({ ...payload, section: "drawdown" })}`);
      case "prop_equity_curve": {
        if (!payload?.id) return fail("Falta payload.id");
        return get(`/proptrading${qs({ section: "equity_curve", participant_id: payload.id })}`);
      }

      case "funded_accounts":         return get(`/proptrading${qs({ ...payload, section: "funded" })}`);
      case "funded_performance":      return get(`/proptrading${qs({ ...payload, section: "funded_performance" })}`);
      case "funded_breaches":         return get(`/proptrading${qs({ ...payload, section: "funded_breaches" })}`);

      case "enroll_prop": {
        if (!payload || typeof payload !== "object") return fail("Payload requerido");
        const result = await callATFX("/proptrading", "POST", payload);
        return ok({
          status: result.status,
          success: result.ok,
          response: result.data,
          request: payload,
        });
      }

      case "raw": {
        if (!payload?.path) return fail("Falta payload.path");
        const t0 = Date.now();
        const r = await callATFX(payload.path, payload.method || "GET", payload.body, payload.base_override);
        const elapsed_ms = Date.now() - t0;
        // Devolvemos también los headers que enviamos (token enmascarado) para debug estilo Talend
        const sentHeaders: Record<string, string> = {
          Auth: `${String(tokenId).slice(0, 4)}••••:${String(apiToken).slice(0, 4)}••••${String(apiToken).slice(-4)}`,
        };
        if (payload.body !== undefined) sentHeaders["Content-Type"] = "application/json";
        return ok({
          status: r.status,
          success: r.ok,
          data: r.data,
          url: r.url,
          elapsed_ms,
          sent_headers: sentHeaders,
          method: payload.method || "GET",
        });
      }

      default:
        return fail(`Acción no soportada: ${action}`);
    }
  } catch (e: any) {
    console.error("[atfx-proxy] error:", e);
    return fail(e?.message ?? "Error interno");
  }
});
