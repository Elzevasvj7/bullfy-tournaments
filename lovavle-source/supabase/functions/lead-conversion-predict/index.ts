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
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${LOVABLE_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: "Eres un analista de ventas. Responde SOLO con JSON válido." },
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
    const today = new Date().toISOString().slice(0, 10);

    const { data: leads, error } = await sb
      .from("stream_leads")
      .select("id, full_name, status, opportunity_score, contact_attempts, last_contact_at, created_at, assigned_to, source, partner_portal_id")
      .not("status", "in", "(cerrado,perdido)")
      .order("opportunity_score", { ascending: false, nullsFirst: false })
      .limit(150);

    if (error) return new Response(JSON.stringify({ ok: false, error: error.message }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    let processed = 0, skipped = 0, errors = 0;
    const models = ["google/gemini-3-flash-preview", "google/gemini-3.1-flash-lite-preview"];

    for (const lead of leads ?? []) {
      try {
        const { data: exists } = await sb
          .from("lead_conversion_predictions")
          .select("id")
          .eq("lead_id", lead.id)
          .eq("snapshot_date", today)
          .maybeSingle();
        if (exists) { skipped++; continue; }

        const features = {
          status: lead.status,
          score: lead.opportunity_score,
          contact_attempts: lead.contact_attempts,
          days_in_pipeline: Math.round((Date.now() - new Date(lead.created_at).getTime()) / 86400000),
          days_since_last_contact: lead.last_contact_at ? Math.round((Date.now() - new Date(lead.last_contact_at).getTime()) / 86400000) : null,
          source: lead.source,
        };

        const prompt = `Analiza este lead y predice su conversión. Datos: ${JSON.stringify(features)}
Responde JSON: { "probability_close": 0-100, "predicted_close_date": "YYYY-MM-DD" o null, "risk_factors": ["..."], "recommended_action": "..." }`;

        let raw = "", usedModel = "";
        for (const m of models) {
          try { raw = await callAI(m, prompt); usedModel = m; break; } catch (_) { continue; }
        }
        const parsed = extractJson(raw);
        if (!parsed) { errors++; continue; }

        await sb.from("lead_conversion_predictions").insert({
          lead_id: lead.id,
          snapshot_date: today,
          probability_close: Math.max(0, Math.min(100, Number(parsed.probability_close ?? 0))),
          predicted_close_date: parsed.predicted_close_date || null,
          risk_factors: Array.isArray(parsed.risk_factors) ? parsed.risk_factors : [],
          recommended_action: parsed.recommended_action ?? null,
          model: usedModel,
          raw_response: parsed,
        });
        processed++;
      } catch (e) {
        errors++;
      }
    }

    return new Response(JSON.stringify({ ok: true, processed, skipped, errors, total: leads?.length ?? 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: e?.message ?? String(e) }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
