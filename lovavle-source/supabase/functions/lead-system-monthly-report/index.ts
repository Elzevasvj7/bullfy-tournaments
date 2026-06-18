// Lead System 2.0 F4 — Reporte mensual (snapshot)
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
    let body: any = {};
    try { body = await req.json(); } catch (_) {}
    const { data, error } = await supa.rpc("generate_lead_monthly_report", {
      _period_start: body?.period_start ?? null,
    });
    if (error) throw error;
    return new Response(JSON.stringify({ ok: true, report_id: data }), {
      status: 200, headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("lead-system-monthly-report error", e);
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message }), {
      status: 200, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
