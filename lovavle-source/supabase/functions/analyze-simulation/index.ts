import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ok = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { snapshot_id } = await req.json();
    if (!snapshot_id) return ok({ ok: false, error: "snapshot_id required" });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableKey) return ok({ ok: false, error: "LOVABLE_API_KEY missing" });

    const admin = createClient(supabaseUrl, serviceKey);

    const { data: snap, error: fetchErr } = await admin
      .from("simulation_snapshots")
      .select("*")
      .eq("id", snapshot_id)
      .maybeSingle();

    if (fetchErr || !snap) return ok({ ok: false, error: "Snapshot not found" });

    // If already analyzed, return existing
    if (snap.ai_analysis) return ok({ ok: true, analysis: snap.ai_analysis, cached: true });

    const systemPrompt = `Eres un experto en estructura de brokers de FX/CFDs y modelos de prop trading apalancado.
Analizas si un producto de "cuenta apalancada artificial x12" es rentable para el broker basado en su configuración.
Responde SIEMPRE en español, con tono analítico y directo.`;

    const userPrompt = `Analiza esta simulación de "Cuentas x12 Apalancadas":

PARÁMETROS:
${JSON.stringify(snap.inputs, null, 2)}

RESULTADOS:
${JSON.stringify(snap.results, null, 2)}

Evalúa rentabilidad para el broker, riesgo máximo asumido vs revenue esperado, ajustes concretos numéricos si no es rentable, y 3 puntos críticos del modelo.`;

    const toolDef = {
      type: "function",
      function: {
        name: "submit_analysis",
        description: "Submit broker profitability analysis",
        parameters: {
          type: "object",
          properties: {
            is_profitable: { type: "boolean" },
            verdict: { type: "string" },
            expected_revenue_per_lot_usd: { type: "number" },
            max_broker_risk_usd: { type: "number" },
            risk_reward_ratio: { type: "number" },
            executive_summary: { type: "string" },
            critical_points: { type: "array", items: { type: "string" } },
            recommended_adjustments: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  parameter: { type: "string" },
                  current: { type: "string" },
                  suggested: { type: "string" },
                  reason: { type: "string" },
                },
                required: ["parameter", "current", "suggested", "reason"],
              },
            },
            scenario_analysis: {
              type: "object",
              properties: {
                client_wins: { type: "string" },
                client_loses: { type: "string" },
                breakeven: { type: "string" },
              },
              required: ["client_wins", "client_loses", "breakeven"],
            },
          },
          required: [
            "is_profitable",
            "verdict",
            "expected_revenue_per_lot_usd",
            "max_broker_risk_usd",
            "risk_reward_ratio",
            "executive_summary",
            "critical_points",
            "recommended_adjustments",
            "scenario_analysis",
          ],
        },
      },
    };

    const callModel = async (model: string) => {
      const ctrl = new AbortController();
      const timeout = setTimeout(() => ctrl.abort(), 50000);
      try {
        return await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          signal: ctrl.signal,
          headers: {
            Authorization: `Bearer ${lovableKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
            tools: [toolDef],
            tool_choice: { type: "function", function: { name: "submit_analysis" } },
          }),
        });
      } finally {
        clearTimeout(timeout);
      }
    };

    // Resilience: Flash first (fast), fallback chain
    const models = ["google/gemini-2.5-flash", "google/gemini-2.5-flash-lite", "openai/gpt-5-mini"];
    let aiResp: Response | null = null;
    let lastErr = "no response";

    for (const m of models) {
      try {
        console.log("Trying model:", m);
        const r = await callModel(m);
        if (r.ok) { aiResp = r; console.log("OK with", m); break; }
        const t = await r.text();
        console.error(`Model ${m} failed:`, r.status, t.slice(0, 200));
        lastErr = `HTTP ${r.status}`;
        if (r.status === 402) return ok({ ok: false, error: "Sin créditos AI. Recarga en Settings → Workspace → Usage" });
      } catch (e) {
        console.error(`Model ${m} threw:`, e);
        lastErr = e instanceof Error ? e.message : "timeout";
      }
    }

    if (!aiResp) return ok({ ok: false, error: `Todos los modelos AI fallaron (${lastErr})` });

    const aiData = await aiResp.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      console.error("No tool_call:", JSON.stringify(aiData).slice(0, 500));
      return ok({ ok: false, error: "Respuesta AI sin tool_call" });
    }

    let analysis: any;
    try {
      analysis = JSON.parse(toolCall.function.arguments);
    } catch {
      const match = toolCall.function.arguments.match(/\{[\s\S]*\}/);
      if (!match) return ok({ ok: false, error: "JSON inválido del modelo" });
      analysis = JSON.parse(match[0]);
    }

    const { error: updErr } = await admin
      .from("simulation_snapshots")
      .update({ ai_analysis: analysis })
      .eq("id", snapshot_id);

    if (updErr) {
      console.error("Update error:", updErr);
      return ok({ ok: false, error: "No se pudo guardar el análisis" });
    }

    return ok({ ok: true, analysis });
  } catch (e) {
    console.error("analyze-simulation error:", e);
    return ok({ ok: false, error: e instanceof Error ? e.message : "Error desconocido" });
  }
});
