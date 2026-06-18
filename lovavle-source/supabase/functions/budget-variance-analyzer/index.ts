// Cron horario: recalcula varianzas de presupuestos activos y genera alertas
// en accounting_budget_alerts. Idempotente por (budget_line_id + period_label + severity)
// — no duplica alertas en el mismo periodo.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const periodLabel = () => new Date().toISOString().slice(0, 7); // YYYY-MM

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { data: budgets, error: bErr } = await supabase
      .from("accounting_budgets")
      .select("id, name, period_start, period_end")
      .eq("status", "active");
    if (bErr) throw bErr;

    const period = periodLabel();
    const alertsCreated: any[] = [];

    for (const b of budgets ?? []) {
      const { data: variances, error: vErr } = await supabase
        .rpc("get_budget_variances", { _budget_id: b.id });
      if (vErr) { console.error("variance rpc", b.id, vErr); continue; }

      for (const v of variances ?? []) {
        if (!["over", "critical"].includes(v.status)) continue;
        const severity = v.status === "critical" ? "critical" : "warning";
        const message = `${b.name} · ${v.category_name ?? "Línea"} — ${
          Number(v.variance_pct).toFixed(1)
        }% sobre lo planeado (${Number(v.actual_usd).toFixed(0)} / ${
          Number(v.planned_usd).toFixed(0)} USD)`;

        // Dedupe: same line + period + severity in last 24h
        const since = new Date(Date.now() - 86_400_000).toISOString();
        const { data: existing } = await supabase
          .from("accounting_budget_alerts")
          .select("id")
          .eq("budget_line_id", v.budget_line_id)
          .eq("period_label", period)
          .eq("severity", severity)
          .gte("created_at", since)
          .limit(1);
        if (existing && existing.length) continue;

        const { data: ins, error: iErr } = await supabase
          .from("accounting_budget_alerts")
          .insert({
            budget_line_id: v.budget_line_id,
            period_label: period,
            severity,
            message,
            planned_usd: v.planned_usd,
            actual_usd: v.actual_usd,
            variance_pct: v.variance_pct,
          }).select("id").single();
        if (!iErr && ins) alertsCreated.push(ins.id);
      }
    }

    return new Response(
      JSON.stringify({ ok: true, budgets: budgets?.length ?? 0, alerts_created: alertsCreated.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("budget-variance-analyzer", e);
    return new Response(
      JSON.stringify({ ok: false, error: String((e as any)?.message ?? e) }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
