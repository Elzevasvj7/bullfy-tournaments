import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const ok = (body: Record<string, unknown>) =>
  new Response(JSON.stringify({ ok: true, ...body }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const fail = (error: string, extra: Record<string, unknown> = {}) =>
  new Response(JSON.stringify({ ok: false, error, ...extra }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

interface Payload {
  action: string;
  login?: string | number;
  ticket?: string | number;
  body?: Record<string, unknown>;
  query?: Record<string, string | number>;
}

const WRITE_ACTIONS = new Set([
  "create_user",
  "update_user",
  "suspend",
  "enable",
  "change_password",
  "deposit",
  "withdrawal",
  "credit_in",
  "credit_out",
]);

// Trading actions: allowed for the account owner (no admin role required)
const TRADING_ACTIONS = new Set([
  "create_order",
  "list_orders",
  "cancel_order",
  "modify_order",
  "close_position",
  "close_all_positions",
  "modify_position",
]);

const ADMIN_ROLES = new Set(["global_admin", "admin", "admin_operaciones", "operaciones"]);

function buildRoute(p: Payload): { method: string; path: string; needsLogin: boolean } | null {
  switch (p.action) {
    case "health": return { method: "GET", path: "/health", needsLogin: false };
    case "health_ready": return { method: "GET", path: "/health/ready", needsLogin: false };
    case "create_user": return { method: "POST", path: "/users", needsLogin: false };
    case "get_user": return { method: "GET", path: `/users/${p.login}`, needsLogin: true };
    case "update_user": return { method: "PATCH", path: `/users/${p.login}`, needsLogin: true };
    case "suspend": return { method: "POST", path: `/users/${p.login}/suspend`, needsLogin: true };
    case "enable": return { method: "POST", path: `/users/${p.login}/enable`, needsLogin: true };
    case "change_password": return { method: "POST", path: `/users/${p.login}/password`, needsLogin: true };
    case "get_deals": return { method: "GET", path: `/users/${p.login}/deals`, needsLogin: true };
    case "get_positions": return { method: "GET", path: `/users/${p.login}/positions`, needsLogin: true };
    case "get_account": return { method: "GET", path: `/accounts/${p.login}`, needsLogin: true };
    case "deposit": return { method: "POST", path: `/accounts/${p.login}/deposit`, needsLogin: true };
    case "withdrawal": return { method: "POST", path: `/accounts/${p.login}/withdrawal`, needsLogin: true };
    case "credit_in": return { method: "POST", path: `/accounts/${p.login}/credit/in`, needsLogin: true };
    case "credit_out": return { method: "POST", path: `/accounts/${p.login}/credit/out`, needsLogin: true };
    // Trading
    case "create_order": return { method: "POST", path: `/users/${p.login}/orders`, needsLogin: true };
    case "list_orders": return { method: "GET", path: `/users/${p.login}/orders`, needsLogin: true };
    case "cancel_order": return { method: "DELETE", path: `/users/${p.login}/orders/${p.ticket}`, needsLogin: true };
    case "modify_order": return { method: "PATCH", path: `/users/${p.login}/orders/${p.ticket}`, needsLogin: true };
    case "close_position": return { method: "POST", path: `/users/${p.login}/positions/${p.ticket}/close`, needsLogin: true };
    case "close_all_positions": return { method: "POST", path: `/users/${p.login}/positions/close-all`, needsLogin: true };
    case "modify_position": return { method: "PATCH", path: `/users/${p.login}/positions/${p.ticket}`, needsLogin: true };
    default: return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const BRIDGE_URL = Deno.env.get("MT5_BRIDGE_URL");
    const BRIDGE_KEY = Deno.env.get("MT5_BRIDGE_API_KEY");
    if (!BRIDGE_URL || !BRIDGE_KEY) return fail("Bridge MT5 no configurado");

    const payload = (await req.json().catch(() => ({}))) as Payload;
    if (!payload?.action) return fail("action requerida");

    const route = buildRoute(payload);
    if (!route) return fail(`action desconocida: ${payload.action}`);
    if (route.needsLogin && !payload.login) return fail("login requerido");

    // Auth: require logged-in admin/ops user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return fail("No autorizado");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user) return fail("Sesión inválida");

    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id);
    const userRoles = new Set((roles ?? []).map((r: { role: string }) => r.role));
    const isAdmin = [...userRoles].some((r) => ADMIN_ROLES.has(r));
    if (!isAdmin) return fail("Permisos insuficientes");
    if (WRITE_ACTIONS.has(payload.action) && !userRoles.has("global_admin") && !userRoles.has("admin") && !userRoles.has("admin_operaciones")) {
      return fail("Solo administradores pueden ejecutar operaciones financieras");
    }
    // Trading actions in the proxy are reserved for admin/ops use (manual ops from Settings).
    // Portal users execute trading via the `trading-room-client` edge function (server-to-server).
    void TRADING_ACTIONS;

    // Build URL
    const url = new URL(BRIDGE_URL.replace(/\/+$/, "") + route.path);
    if (payload.query) {
      for (const [k, v] of Object.entries(payload.query)) url.searchParams.set(k, String(v));
    }

    const init: RequestInit = {
      method: route.method,
      headers: {
        Authorization: `Bearer ${BRIDGE_KEY}`,
        "Content-Type": "application/json",
      },
    };
    if (route.method !== "GET" && payload.body) init.body = JSON.stringify(payload.body);

    const t0 = Date.now();
    const res = await fetch(url.toString(), init);
    const latency = Date.now() - t0;
    const text = await res.text();
    let data: unknown;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }

    if (!res.ok) {
      return fail(`Bridge ${res.status}`, { status: res.status, data, latency_ms: latency });
    }
    return ok({ data, status: res.status, latency_ms: latency });
  } catch (e) {
    return fail((e as Error).message || "Error inesperado");
  }
});
