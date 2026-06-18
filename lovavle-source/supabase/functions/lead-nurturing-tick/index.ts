// F7 — Procesa enrollments de nurturing pendientes y dispara notificaciones vía lead-notifications-send.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supa = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: due } = await supa
      .from("lead_nurturing_enrollments")
      .select("id, lead_id, sequence_id, current_step")
      .eq("status", "active")
      .lte("next_run_at", new Date().toISOString())
      .limit(100);

    let processed = 0, completed = 0, failed = 0;
    for (const en of (due ?? [])) {
      const nextOrder = (en.current_step ?? 0) + 1;
      const { data: step } = await supa
        .from("lead_nurturing_steps")
        .select("*")
        .eq("sequence_id", en.sequence_id)
        .eq("step_order", nextOrder)
        .eq("is_active", true)
        .maybeSingle();

      if (!step) {
        await supa.from("lead_nurturing_enrollments")
          .update({ status: "completed", completed_at: new Date().toISOString(), next_run_at: null })
          .eq("id", en.id);
        completed++;
        continue;
      }

      try {
        const resp = await fetch(`${SUPABASE_URL}/functions/v1/lead-notifications-send`, {
          method: "POST",
          headers: { Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            lead_id: en.lead_id,
            notification_type: "nurturing",
            channel: step.channel,
            subject: step.subject,
            content: step.content,
          }),
        });
        const json = await resp.json().catch(() => ({}));
        if (!json.ok) failed++;
      } catch { failed++; }

      // Schedule next
      const { data: nextStep } = await supa
        .from("lead_nurturing_steps")
        .select("day_offset")
        .eq("sequence_id", en.sequence_id)
        .eq("step_order", nextOrder + 1)
        .eq("is_active", true)
        .maybeSingle();

      const update: any = { current_step: nextOrder };
      if (nextStep) {
        update.next_run_at = new Date(Date.now() + nextStep.day_offset * 86400000).toISOString();
      } else {
        update.status = "completed";
        update.completed_at = new Date().toISOString();
        update.next_run_at = null;
        completed++;
      }
      await supa.from("lead_nurturing_enrollments").update(update).eq("id", en.id);
      processed++;
    }

    return new Response(JSON.stringify({ ok: true, processed, completed, failed }), {
      status: 200, headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[lead-nurturing-tick]", e);
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message }), {
      status: 200, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
