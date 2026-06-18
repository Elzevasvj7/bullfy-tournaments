// Forecast contable IA — proyecta ingresos/gastos/neto de los próximos 3 meses
// usando los últimos 6 meses de histórico + Gemini 2.5 Flash (gratis vía Lovable AI).
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_AI_KEY = Deno.env.get("LOVABLE_API_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    // 6 meses de histórico mensual
    const since = new Date(); since.setMonth(since.getMonth() - 6); since.setDate(1);
    const sinceISO = since.toISOString().slice(0, 10);

    const [{ data: exp }, { data: rev }] = await Promise.all([
      supabase.from("accounting_expenses").select("amount_usd, expense_date").gte("expense_date", sinceISO),
      supabase.from("accounting_revenues").select("amount_usd, revenue_date").gte("revenue_date", sinceISO),
    ]);

    const monthly: Record<string, { rev: number; exp: number }> = {};
    for (const r of rev ?? []) {
      const k = String(r.revenue_date).slice(0, 7);
      (monthly[k] ??= { rev: 0, exp: 0 }).rev += Number(r.amount_usd ?? 0);
    }
    for (const e of exp ?? []) {
      const k = String(e.expense_date).slice(0, 7);
      (monthly[k] ??= { rev: 0, exp: 0 }).exp += Number(e.amount_usd ?? 0);
    }
    const history = Object.entries(monthly).sort(([a],[b]) => a.localeCompare(b))
      .map(([month, v]) => ({ month, revenues: Math.round(v.rev), expenses: Math.round(v.exp), net: Math.round(v.rev - v.exp) }));

    if (history.length < 2) {
      return new Response(JSON.stringify({ ok: true, history, forecast: [], note: "Histórico insuficiente" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const prompt = `Eres un analista financiero. Con base en este histórico mensual (USD), proyecta los próximos 3 meses (revenues, expenses, net). Considera tendencia y estacionalidad. Devuelve SOLO JSON:
{"forecast":[{"month":"YYYY-MM","revenues":number,"expenses":number,"net":number,"confidence":"low|medium|high"}],"narrative":"..."}
HISTORICO: ${JSON.stringify(history)}`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_AI_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!aiRes.ok) {
      const errTxt = await aiRes.text();
      return new Response(JSON.stringify({ ok: false, error: `AI error ${aiRes.status}: ${errTxt}` }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const aiJson = await aiRes.json();
    const raw: string = aiJson.choices?.[0]?.message?.content ?? "";
    const m = raw.match(/\{[\s\S]*\}/);
    let parsed: any = { forecast: [], narrative: "" };
    if (m) { try { parsed = JSON.parse(m[0]); } catch { /* keep default */ } }

    return new Response(JSON.stringify({ ok: true, history, ...parsed }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("accounting-forecast", err);
    return new Response(JSON.stringify({ ok: false, error: String(err) }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
