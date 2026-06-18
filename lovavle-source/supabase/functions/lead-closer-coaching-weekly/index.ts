import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

function extractJson(text: string): any {
  try { return JSON.parse(text); } catch {}
  const m = text.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch {} }
  return null;
}

async function callAI(model: string, prompt: string) {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${LOVABLE_API_KEY}` },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: "Eres coach de ventas senior. Responde SOLO JSON válido." },
        { role: "user", content: prompt },
      ],
    }),
  });
  if (!res.ok) throw new Error(`AI ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data?.choices?.[0]?.message?.content ?? "";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const sb = createClient(SUPABASE_URL, SERVICE_KEY);
    const now = new Date();
    const day = now.getUTCDay();
    const diffToMonday = (day === 0 ? -6 : 1 - day);
    const monday = new Date(now);
    monday.setUTCDate(now.getUTCDate() + diffToMonday - 7);
    monday.setUTCHours(0,0,0,0);
    const weekStart = monday.toISOString().slice(0,10);
    const weekEnd = new Date(monday.getTime() + 7*86400000).toISOString();

    // Get closers (role ventas)
    const { data: closerRoles } = await sb.from("user_roles").select("user_id").eq("role", "ventas");
    const closers = [...new Set((closerRoles ?? []).map(r => r.user_id))];

    let processed = 0, skipped = 0, errors = 0;
    const models = ["google/gemini-3-flash-preview", "google/gemini-3.1-flash-lite-preview"];

    for (const closerId of closers) {
      try {
        const { data: exists } = await sb
          .from("lead_closer_coaching")
          .select("id").eq("closer_user_id", closerId).eq("week_start", weekStart).maybeSingle();
        if (exists) { skipped++; continue; }

        const { data: leads } = await sb
          .from("stream_leads")
          .select("status, opportunity_score, contact_attempts, created_at")
          .eq("assigned_to", closerId)
          .gte("created_at", monday.toISOString())
          .lt("created_at", weekEnd);

        const { data: calls } = await sb
          .from("lead_calls")
          .select("id, duration_seconds, outcome")
          .eq("agent_id", closerId)
          .gte("created_at", monday.toISOString())
          .lt("created_at", weekEnd);

        const { data: analyses } = await sb
          .from("lead_call_analysis")
          .select("success_score, sentiment, objections_detected, objections_handled, improvement_suggestions")
          .eq("agent_id", closerId)
          .gte("created_at", monday.toISOString())
          .lt("created_at", weekEnd)
          .limit(50);

        const totalLeads = leads?.length ?? 0;
        const closed = (leads ?? []).filter(l => l.status === "cerrado").length;
        const lost = (leads ?? []).filter(l => l.status === "perdido").length;
        const callCount = calls?.length ?? 0;
        const avgScore = analyses && analyses.length ? Math.round(analyses.reduce((s,a)=>s+(a.success_score??0),0)/analyses.length) : null;

        if (totalLeads === 0 && callCount === 0) { skipped++; continue; }

        const metrics = {
          leads_assigned: totalLeads,
          closed, lost,
          close_rate: totalLeads > 0 ? Math.round((closed/totalLeads)*100) : 0,
          calls_made: callCount,
          avg_call_success_score: avgScore,
          analyses_count: analyses?.length ?? 0,
        };

        const sampleSuggestions = (analyses ?? []).flatMap(a => a.improvement_suggestions ?? []).slice(0, 15);

        const prompt = `Analiza el desempeño semanal de este closer y entrega coaching.
Métricas: ${JSON.stringify(metrics)}
Sugerencias detectadas en sus llamadas: ${JSON.stringify(sampleSuggestions)}
Responde JSON: { "strengths": ["..."], "weaknesses": ["..."], "recommendations": ["..."], "summary": "..." }`;

        let raw = "", usedModel = "";
        for (const m of models) {
          try { raw = await callAI(m, prompt); usedModel = m; break; } catch { continue; }
        }
        const parsed = extractJson(raw);
        if (!parsed) { errors++; continue; }

        await sb.from("lead_closer_coaching").insert({
          closer_user_id: closerId,
          week_start: weekStart,
          metrics,
          strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
          weaknesses: Array.isArray(parsed.weaknesses) ? parsed.weaknesses : [],
          recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
          summary: parsed.summary ?? null,
          model: usedModel,
        });
        processed++;
      } catch (e) {
        errors++;
      }
    }

    return new Response(JSON.stringify({ ok: true, processed, skipped, errors, week_start: weekStart, closers: closers.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: e?.message ?? String(e) }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
