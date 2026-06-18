import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const end = new Date();
    const start = new Date(end.getTime() - 7 * 86400000);
    const startStr = start.toISOString().slice(0, 10);
    const endStr = end.toISOString().slice(0, 10);
    const prevStart = new Date(start.getTime() - 7 * 86400000).toISOString().slice(0, 10);

    const [{ data: rev }, { data: exp }, { data: revPrev }, { data: expPrev }, { data: budgets }] = await Promise.all([
      supabase.from("accounting_revenues").select("amount_usd,category_id,revenue_date").gte("revenue_date", startStr).lte("revenue_date", endStr),
      supabase.from("accounting_expenses").select("amount_usd,category_id,vendor_id,expense_date,description").gte("expense_date", startStr).lte("expense_date", endStr),
      supabase.from("accounting_revenues").select("amount_usd").gte("revenue_date", prevStart).lt("revenue_date", startStr),
      supabase.from("accounting_expenses").select("amount_usd").gte("expense_date", prevStart).lt("expense_date", startStr),
      supabase.from("accounting_budget_alerts").select("*").gte("created_at", startStr),
    ]);

    const totalIn = (rev || []).reduce((s, r: any) => s + Number(r.amount_usd || 0), 0);
    const totalOut = (exp || []).reduce((s, r: any) => s + Number(r.amount_usd || 0), 0);
    const totalInPrev = (revPrev || []).reduce((s, r: any) => s + Number(r.amount_usd || 0), 0);
    const totalOutPrev = (expPrev || []).reduce((s, r: any) => s + Number(r.amount_usd || 0), 0);

    const kpis = {
      ingresos_usd: Math.round(totalIn),
      gastos_usd: Math.round(totalOut),
      neto_usd: Math.round(totalIn - totalOut),
      delta_ingresos_pct: totalInPrev ? Math.round(((totalIn - totalInPrev) / totalInPrev) * 100) : 0,
      delta_gastos_pct: totalOutPrev ? Math.round(((totalOut - totalOutPrev) / totalOutPrev) * 100) : 0,
      alertas_presupuesto: (budgets || []).length,
    };

    const prompt = `Eres un analista financiero. Analiza estos KPIs semanales (USD) y la lista de gastos. Detecta anomalías y propón recomendaciones concretas y accionables.

PERIODO: ${startStr} → ${endStr}
KPIs: ${JSON.stringify(kpis)}
TOP GASTOS (hasta 30): ${JSON.stringify((exp || []).slice(0, 30).map((e: any) => ({ desc: e.description, amt: e.amount_usd })))}
ALERTAS PRESUPUESTO: ${(budgets || []).length}

Responde SOLO con JSON válido con este esquema exacto:
{
  "summary": "resumen en 3-5 frases en español",
  "anomalies": [{"severity":"high|med|low","message":"..."}],
  "recommendations": ["acción concreta 1", "acción concreta 2"]
}`;

    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableKey) {
      return new Response(JSON.stringify({ ok: false, error: "LOVABLE_API_KEY no configurada" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${lovableKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const aiJson = await aiRes.json();
    const text = aiJson?.choices?.[0]?.message?.content || "";
    const match = text.match(/\{[\s\S]*\}/);
    let parsed: any = { summary: text, anomalies: [], recommendations: [] };
    if (match) { try { parsed = JSON.parse(match[0]); } catch { /* keep fallback */ } }

    const { data: insight, error } = await supabase.from("accounting_ai_insights").insert({
      period_start: startStr, period_end: endStr,
      summary: parsed.summary || "Sin resumen",
      anomalies: parsed.anomalies || [],
      recommendations: parsed.recommendations || [],
      kpis, model: "google/gemini-2.5-flash",
    }).select().single();

    if (error) {
      return new Response(JSON.stringify({ ok: false, error: error.message }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ ok: true, insight }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
