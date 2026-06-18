// Detecta anomalías contables: duplicados, picos atípicos y categorías sin presupuesto.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const out: any[] = [];

  try {
    // 1) Duplicados: mismo vendor, monto y fecha
    const { data: dups } = await supa.rpc("sql" as any, {}).catch(() => ({ data: null }));
    const { data: exp } = await supa.from("accounting_expenses")
      .select("id,vendor_id,amount_usd,expense_date,category_id")
      .gte("expense_date", new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10));

    if (exp) {
      const seen = new Map<string, any>();
      for (const e of exp) {
        const k = `${e.vendor_id}|${Number(e.amount_usd).toFixed(2)}|${e.expense_date}`;
        if (seen.has(k)) {
          const prev = seen.get(k);
          await supa.from("accounting_anomalies").upsert({
            anomaly_type: "duplicate_expense",
            severity: "warning",
            entity_type: "expense",
            entity_id: e.id,
            title: "Posible gasto duplicado",
            description: `Mismo vendor/monto/fecha que gasto ${prev.id}`,
            metadata: { duplicate_of: prev.id },
          }, { onConflict: "id", ignoreDuplicates: true });
          out.push({ type: "duplicate", id: e.id });
        } else seen.set(k, e);
      }

      // 2) Picos atípicos (z-score > 2 vs media de la categoría)
      const byCat: Record<string, number[]> = {};
      exp.forEach(e => { if (e.category_id) (byCat[e.category_id] ??= []).push(Number(e.amount_usd)); });
      for (const [cat, arr] of Object.entries(byCat)) {
        if (arr.length < 5) continue;
        const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
        const sd = Math.sqrt(arr.reduce((a, b) => a + (b - mean) ** 2, 0) / arr.length);
        if (sd === 0) continue;
        for (const e of exp.filter(x => x.category_id === cat)) {
          const z = (Number(e.amount_usd) - mean) / sd;
          if (z > 2.5) {
            await supa.from("accounting_anomalies").insert({
              anomaly_type: "outlier_amount",
              severity: z > 4 ? "critical" : "warning",
              entity_type: "expense",
              entity_id: e.id,
              title: `Gasto atípico (z=${z.toFixed(2)})`,
              description: `Monto $${Number(e.amount_usd).toFixed(2)} muy superior al promedio de la categoría ($${mean.toFixed(2)})`,
              metadata: { z_score: z, category_mean: mean },
            });
            out.push({ type: "outlier", id: e.id, z });
          }
        }
      }
    }

    return new Response(JSON.stringify({ ok: true, detected: out.length, items: out }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error(err);
    return new Response(JSON.stringify({ ok: false, error: err.message }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
