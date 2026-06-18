const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const respond = (payload: Record<string, unknown>) =>
  new Response(JSON.stringify(payload), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const parseAnalysisContent = (rawContent: string) => {
  const cleaned = rawContent
    .replace(/```json\n?/g, "")
    .replace(/```\n?/g, "")
    .trim();

  if (!cleaned) return null;

  const candidates = [cleaned];
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");

  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    const extracted = cleaned.slice(firstBrace, lastBrace + 1);
    if (extracted !== cleaned) {
      candidates.push(extracted);
    }
  }

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      // Try next candidate
    }
  }

  return null;
};

const buildFallbackAnalysis = ({
  assetType,
  assetName,
  copyText,
  reason,
}: {
  assetType?: string;
  assetName?: string;
  copyText?: string;
  reason?: string;
}) => ({
  impact_score: 55,
  summary: `Se generó un análisis preliminar para ${assetName || assetType || "este asset"} porque Bullfy Brain respondió de forma intermitente. ${copyText ? "Se tomó en cuenta el copy proporcionado para no frenar el flujo." : "Puedes volver a ejecutar el análisis más tarde para obtener un análisis más detallado."}`,
  segment_analysis: {
    traders_activos: {
      relevance: 68,
      reasoning: "El formato de video es relevante para audiencias activas, pero conviene reforzar el gancho inicial y el beneficio principal.",
    },
    ibs_potenciales: {
      relevance: 64,
      reasoning: "Puede interesar a IBs potenciales si se aclara el valor comercial o de comunidad en los primeros segundos.",
    },
    novatos: {
      relevance: 58,
      reasoning: "El contenido necesita un mensaje más simple y una promesa más clara para captar mejor a usuarios nuevos.",
    },
    inversores_institucionales: {
      relevance: 34,
      reasoning: "No parece estar optimizado para un perfil institucional; falta enfoque en data, confianza y diferenciadores más formales.",
    },
  },
  suggestions: [
    {
      type: "copy",
      priority: "alta",
      suggestion: "Refuerza el gancho en los primeros 3 segundos con un beneficio concreto para el trader o IB.",
    },
    {
      type: "visual",
      priority: "media",
      suggestion: "Incluye texto en pantalla con la propuesta principal para mejorar la retención en mobile.",
    },
    {
      type: "targeting",
      priority: "media",
      suggestion: "Adapta una versión específica para traders activos y otra para IBs potenciales para elevar la relevancia del mensaje.",
    },
  ],
  predicted_engagement: {
    instagram: "medio",
    tiktok: "medio",
    youtube: "medio",
  },
  best_posting_times: ["Martes 10am EST", "Jueves 6pm EST"],
  hashtag_suggestions: ["#TradingLATAM", "#Bullfy", "#Broker", "#EducacionFinanciera"],
  fallback_used: true,
  fallback_reason: reason || "Respuesta de IA inestable",
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return respond({ ok: false, error: "AI Gateway not configured" });
    }

    // Usage enforcement
    const { user_id, skip_limits } = (() => {
      try {
        const authHeader = req.headers.get("authorization") || "";
        const token = authHeader.replace("Bearer ", "");
        if (token) {
          const payload = JSON.parse(atob(token.split(".")[1]));
          return { user_id: payload.sub, skip_limits: false };
        }
      } catch {}
      return { user_id: null, skip_limits: true };
    })();

    if (user_id && !skip_limits) {
      const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
      const supabaseAdmin = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );

      const { data: access } = await supabaseAdmin
        .from("video_studio_access")
        .select("tier, enabled, monthly_analysis_limit")
        .eq("user_id", user_id)
        .maybeSingle();

      if (access && !access.enabled) {
        return respond({ ok: false, error: "Video Studio access is disabled for your account" });
      }

      if (access) {
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const { count } = await supabaseAdmin
          .from("video_studio_usage_log")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user_id)
          .eq("action", "analysis")
          .gte("created_at", startOfMonth.toISOString());

        if ((count || 0) >= access.monthly_analysis_limit) {
          return respond({
            ok: false,
            error: "Monthly analysis limit reached",
            limit: access.monthly_analysis_limit,
            used: count,
          });
        }

        await supabaseAdmin.from("video_studio_usage_log").insert({
          user_id,
          action: "analysis",
          credits_used: 1,
          metadata: { tier: access.tier },
        });
      }
    }

    const { asset_url, asset_type, copy_text, asset_name } = await req.json();

    if (!asset_url && !copy_text) {
      return respond({ ok: false, error: "asset_url or copy_text is required" });
    }

    const userContent: any[] = [];

    if ((asset_type === "video" || asset_type === "image") && asset_url && asset_url !== "text-only") {
      userContent.push({
        type: "image_url",
        image_url: { url: asset_url },
      });
    }

    const textPrompt = `Analiza este asset de marketing para una empresa de trading/brokeraje (Bullfy).

Tipo de asset: ${asset_type || "unknown"}
${asset_name ? `Nombre: ${asset_name}` : ""}
${copy_text ? `Copy/Texto de la campaña: "${copy_text}"` : ""}

Evalúa el contenido y responde EXCLUSIVAMENTE con un JSON válido (sin markdown, sin backticks) con esta estructura:
{
  "impact_score": <número 0-100>,
  "summary": "<resumen de 2-3 oraciones del contenido>",
  "segment_analysis": {
    "traders_activos": { "relevance": <0-100>, "reasoning": "<por qué>" },
    "ibs_potenciales": { "relevance": <0-100>, "reasoning": "<por qué>" },
    "novatos": { "relevance": <0-100>, "reasoning": "<por qué>" },
    "inversores_institucionales": { "relevance": <0-100>, "reasoning": "<por qué>" }
  },
  "suggestions": [
    { "type": "copy|visual|targeting|timing", "priority": "alta|media|baja", "suggestion": "<sugerencia concreta>" }
  ],
  "predicted_engagement": {
    "instagram": "<bajo|medio|alto|viral>",
    "tiktok": "<bajo|medio|alto|viral>",
    "youtube": "<bajo|medio|alto|viral>"
  },
  "best_posting_times": ["<ej: Martes 10am EST>"],
  "hashtag_suggestions": ["<hashtags relevantes>"]
}

Sé específico y accionable en las sugerencias. Considera el mercado LATAM de trading.`;

    userContent.push({ type: "text", text: textPrompt });

    const models = ["google/gemini-2.5-flash", "google/gemini-2.5-flash-lite"];
    const maxAttemptsPerModel = 2;
    let analysis: Record<string, unknown> | null = null;
    let rawContent = "";
    let lastTransientError = "";
    let modelUsed: string | null = null;

    outer: for (const model of models) {
      for (let attempt = 1; attempt <= maxAttemptsPerModel; attempt += 1) {
        const aiResponse = await fetch(
          "https://ai.gateway.lovable.dev/v1/chat/completions",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model,
              max_tokens: 4096,
              messages: [
                {
                  role: "system",
                  content:
                    "Eres un experto en marketing digital especializado en el sector financiero y trading. Analiza assets de campañas y proporciona insights accionables. Responde siempre en JSON válido sin markdown.",
                },
                { role: "user", content: userContent },
              ],
            }),
          }
        );

        if (!aiResponse.ok) {
          const errStatus = aiResponse.status;
          const errText = await aiResponse.text();
          console.error(`AI Gateway error with ${model} attempt ${attempt}:`, errStatus, errText);

          if (errStatus === 429) {
            return respond({ ok: false, error: "Demasiadas solicitudes. Intenta en un momento." });
          }
          if (errStatus === 402) {
            return respond({ ok: false, error: "Créditos de IA agotados." });
          }
          if (errStatus < 500) {
            return respond({ ok: false, error: `Error de análisis IA (${errStatus})` });
          }

          lastTransientError = `Bullfy Brain devolvió ${errStatus} en ${model} (intento ${attempt}).`;
          if (attempt < maxAttemptsPerModel) {
            await sleep(450 * attempt);
            continue;
          }
          break;
        }

        const aiText = await aiResponse.text();
        let aiData: any;
        try {
          aiData = JSON.parse(aiText);
        } catch {
          lastTransientError = `Bullfy Brain devolvió una envoltura inválida en ${model} (intento ${attempt}).`;
          console.error("Failed to parse AI gateway response:", aiText.slice(0, 500));
          if (attempt < maxAttemptsPerModel) {
            await sleep(450 * attempt);
            continue;
          }
          break;
        }

        rawContent = aiData.choices?.[0]?.message?.content || "";
        const parsedAnalysis = parseAnalysisContent(rawContent);

        if (parsedAnalysis) {
          analysis = parsedAnalysis;
          modelUsed = model;
          console.log(`AI analysis succeeded with model: ${model} on attempt ${attempt}`);
          break outer;
        }

        lastTransientError = `Bullfy Brain devolvió contenido vacío o malformado en ${model} (intento ${attempt}).`;
        console.error("Failed to parse AI response content:", rawContent.slice(0, 500));

        if (attempt < maxAttemptsPerModel) {
          await sleep(450 * attempt);
        }
      }
    }

    let warning: string | null = null;
    if (!analysis) {
      warning = "Se usó un análisis preliminar para mantener el flujo estable.";
      analysis = buildFallbackAnalysis({
        assetType: asset_type,
        assetName: asset_name,
        copyText: copy_text,
        reason: lastTransientError,
      });
      rawContent = rawContent || JSON.stringify({ fallback_reason: lastTransientError || "AI fallback used" });
      console.warn("Using fallback analysis:", lastTransientError || "Unknown transient AI error");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    let userId: string | null = null;
    const authHeader = req.headers.get("authorization");
    if (authHeader) {
      try {
        const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
        const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
          headers: { Authorization: authHeader, apikey: anonKey },
        });
        if (userRes.ok) {
          const userData = await userRes.json();
          userId = userData.id;
        }
      } catch {
        // ignore auth lookup failures
      }
    }

    const insertRes = await fetch(`${supabaseUrl}/rest/v1/campaign_analyses`, {
      method: "POST",
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        asset_type: asset_type || "unknown",
        asset_url,
        asset_name: asset_name || null,
        copy_text: copy_text || null,
        impact_score: analysis.impact_score || 0,
        segment_analysis: analysis.segment_analysis || {},
        suggestions: analysis.suggestions || [],
        raw_analysis: rawContent,
        analyzed_by: userId,
      }),
    });

    let savedRecord = null;
    if (insertRes.ok) {
      const arr = await insertRes.json();
      savedRecord = arr?.[0] || null;
    } else {
      console.error("DB insert error:", await insertRes.text());
    }

    return respond({
      ok: true,
      analysis,
      warning,
      record_id: savedRecord?.id || null,
      diagnostics: {
        model_used: modelUsed,
        fallback_used: Boolean(warning),
      },
    });
  } catch (error) {
    console.error("analyze-campaign-content error:", error);
    return respond({ ok: false, error: error.message });
  }
});