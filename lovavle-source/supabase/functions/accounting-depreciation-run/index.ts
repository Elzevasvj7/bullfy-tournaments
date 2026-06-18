// Genera asientos de depreciación lineal mensual para todos los activos activos.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const now = new Date();
    const py = now.getUTCFullYear();
    const pm = now.getUTCMonth() + 1;

    const { data: assets } = await supa.from("accounting_assets")
      .select("id,acquisition_date,acquisition_cost_usd,salvage_value_usd,useful_life_months,status")
      .eq("status", "active");

    let created = 0;
    for (const a of assets ?? []) {
      const acq = new Date(a.acquisition_date);
      const monthsSince = (py - acq.getUTCFullYear()) * 12 + (pm - (acq.getUTCMonth() + 1)) + 1;
      if (monthsSince <= 0 || monthsSince > a.useful_life_months) continue;

      const depreciable = Number(a.acquisition_cost_usd) - Number(a.salvage_value_usd);
      const monthly = depreciable / a.useful_life_months;
      const accumulated = Math.min(monthly * monthsSince, depreciable);
      const bookValue = Number(a.acquisition_cost_usd) - accumulated;

      const { error } = await supa.from("accounting_depreciation_entries").upsert({
        asset_id: a.id,
        period_year: py,
        period_month: pm,
        amount_usd: monthly.toFixed(2),
        accumulated_usd: accumulated.toFixed(2),
        book_value_usd: bookValue.toFixed(2),
      }, { onConflict: "asset_id,period_year,period_month" });
      if (!error) created++;
    }

    return new Response(JSON.stringify({ ok: true, period: `${py}-${pm}`, processed: created }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ ok: false, error: err.message }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
