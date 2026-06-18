import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");

    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ ok: false, error: "LOVABLE_API_KEY not set" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    let editionId = body.edition_id;

    // If no specific edition, find editions sent > 24h ago that need verification
    if (!editionId) {
      const { data: editions } = await sb.from("newsletter_editions")
        .select("id, prediction_question, prediction_options, sent_at")
        .eq("status", "sent")
        .not("prediction_question", "is", null)
        .lt("sent_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .limit(5);

      if (!editions?.length) {
        return new Response(JSON.stringify({ ok: true, message: "No editions to verify" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const results = [];
      for (const ed of editions) {
        const result = await verifyEdition(sb, LOVABLE_API_KEY, FIRECRAWL_API_KEY, ed);
        results.push(result);
      }

      return new Response(JSON.stringify({ ok: true, verified: results.length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: edition } = await sb.from("newsletter_editions")
      .select("*").eq("id", editionId).single();

    if (!edition) {
      return new Response(JSON.stringify({ ok: false, error: "Edition not found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await verifyEdition(sb, LOVABLE_API_KEY, FIRECRAWL_API_KEY, edition);

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("newsletter-verify error:", err);
    return new Response(JSON.stringify({ ok: false, error: err.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function verifyEdition(sb: any, apiKey: string, firecrawlKey: string | undefined, edition: any) {
  const question = edition.prediction_question;
  const options = edition.prediction_options || [];

  // Try to get verification data from web
  let webContext = "";
  if (firecrawlKey) {
    try {
      const searchRes = await fetch("https://api.firecrawl.dev/v1/search", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${firecrawlKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: question,
          limit: 5,
          lang: "es",
          tbs: "qdr:d",
        }),
      });
      if (searchRes.ok) {
        const searchData = await searchRes.json();
        const articles = (searchData.data || []).map((r: any) =>
          `- ${r.title}: ${r.description || ""} (${r.url})`
        ).join("\n");
        webContext = articles || "No se encontraron resultados recientes.";
      }
    } catch {}
  }

  const verifyPrompt = `Eres la Dra. Amara Okafor, verificadora financiera de élite. PhD en Economía, 20 años de experiencia en Goldman Sachs.

Pregunta de predicción: "${question}"
Opciones: ${options.map((o: any) => `${o.key}: ${o.label}`).join(", ")}

Información reciente de la web:
${webContext || "No disponible"}

Tu tarea:
1. Determina cuál es la respuesta correcta basándote en datos verificables
2. Proporciona evidencia con fuentes citadas
3. Explica tu razonamiento

Responde en JSON:
{
  "correct_answer": "A o B",
  "evidence_summary": "Explicación detallada con datos...",
  "evidence_urls": ["url1", "url2"],
  "confidence": "high/medium/low"
}`;

  const res = await fetch(AI_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-pro",
      messages: [
        { role: "system", content: "Eres una verificadora financiera imparcial. Solo reportas hechos." },
        { role: "user", content: verifyPrompt },
      ],
    }),
  });

  const aiData = await res.json();
  const resultText = aiData.choices?.[0]?.message?.content || "";

  let parsed;
  try { parsed = JSON.parse(resultText); } catch {
    const m = resultText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (m) try { parsed = JSON.parse(m[1].trim()); } catch {}
  }
  if (!parsed) {
    const s = resultText.indexOf("{");
    if (s >= 0) {
      let d = 0;
      for (let i = s; i < resultText.length; i++) {
        if (resultText[i] === "{") d++;
        if (resultText[i] === "}") d--;
        if (d === 0) { try { parsed = JSON.parse(resultText.substring(s, i + 1)); } catch {} break; }
      }
    }
  }

  if (!parsed) parsed = { correct_answer: "A", evidence_summary: "Verificación automática no concluyente", evidence_urls: [], confidence: "low" };

  const correctAnswer = parsed.correct_answer;

  // Get predictions
  const { data: predictions } = await sb.from("newsletter_predictions")
    .select("id, selected_option, user_email")
    .eq("edition_id", edition.id);

  const totalResponses = predictions?.length || 0;

  // Calculate distribution
  const distribution: Record<string, number> = {};
  for (const opt of options) {
    distribution[opt.key] = (predictions || []).filter((p: any) => p.selected_option === opt.key).length;
  }

  // Determine majority
  const majorityOption = Object.entries(distribution).sort((a, b) => b[1] - a[1])[0]?.[0];

  // Update predictions with results
  for (const pred of (predictions || [])) {
    const isCorrect = pred.selected_option === correctAnswer;
    let points = 0;
    if (isCorrect) {
      points = 100;
      // Bonus if beat majority
      if (pred.selected_option !== majorityOption) {
        points += 100;
      }
    }
    await sb.from("newsletter_predictions").update({
      is_correct: isCorrect,
      points_earned: points,
    }).eq("id", pred.id);
  }

  // Insert results
  await sb.from("newsletter_prediction_results").upsert({
    edition_id: edition.id,
    correct_answer: correctAnswer,
    evidence_summary: parsed.evidence_summary,
    evidence_urls: parsed.evidence_urls || [],
    total_responses: totalResponses,
    option_distribution: distribution,
  }, { onConflict: "edition_id" });

  // Update edition
  await sb.from("newsletter_editions").update({
    status: "verified",
    prediction_correct_answer: correctAnswer,
    verification_evidence: parsed,
    verified_at: new Date().toISOString(),
  }).eq("id", edition.id);

  // Log agent
  await sb.from("newsletter_agent_logs").insert({
    edition_id: edition.id,
    agent_name: "Dr. Amara Okafor",
    agent_role: "Verificadora",
    agent_emoji: "⚖️",
    action: "verify_prediction",
    input_summary: question,
    output_summary: JSON.stringify(parsed).substring(0, 2000),
  });
}
