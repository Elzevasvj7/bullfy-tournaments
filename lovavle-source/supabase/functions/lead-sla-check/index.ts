// F7 — Ejecuta lead_sla_check_run() para detectar violaciones de SLA.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const supa = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data, error } = await supa.rpc("lead_sla_check_run");
    if (error) throw error;

    // Notify closers of new violations (best effort, last 15 min)
    const { data: fresh } = await supa
      .from("lead_sla_violations")
      .select("id, lead_id, violation_type, closer_id")
      .gte("detected_at", new Date(Date.now() - 15 * 60 * 1000).toISOString())
      .is("resolved_at", null)
      .limit(200);

    const notifs = (fresh ?? [])
      .filter((v: any) => v.closer_id)
      .map((v: any) => ({
        user_id: v.closer_id,
        type: "lead_sla_violation",
        title: "Violación de SLA",
        message: `Lead requiere atención: ${v.violation_type}`,
        reference_id: v.lead_id,
        reference_type: "lead",
      }));
    if (notifs.length) await supa.from("notifications").insert(notifs);

    return new Response(JSON.stringify({ ok: true, result: data, notified: notifs.length }), {
      status: 200, headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[lead-sla-check]", e);
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message }), {
      status: 200, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
