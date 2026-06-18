// Lead System 2.0 F4 — Alertas + refresh métricas
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const supa = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: alerts, error: e1 } = await supa.rpc("lead_system_alerts_tick");
    if (e1) throw e1;
    const { error: e2 } = await supa.rpc("refresh_closer_metrics_daily");
    if (e2) console.warn("refresh metrics:", e2.message);
    return new Response(JSON.stringify({ ok: true, alerts }), {
      status: 200, headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("lead-system-alerts error", e);
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message }), {
      status: 200, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
