// Motor cron Lead System 2.0 — Fase 2
// Auto-libera leads sin contacto (30 min) y reasigna leads inactivos (5 días)
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

    const { data, error } = await supa.rpc("lead_system_tick");
    if (error) throw error;

    return new Response(JSON.stringify({ ok: true, result: data }), {
      status: 200,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("lead-system-tick error", e);
    return new Response(
      JSON.stringify({ ok: false, error: (e as Error).message }),
      { status: 200, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }
});
