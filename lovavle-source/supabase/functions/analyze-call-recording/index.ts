import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const TWILIO_API_KEY = Deno.env.get("TWILIO_API_KEY");

  if (!LOVABLE_API_KEY) {
    return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const { call_id } = await req.json();
    if (!call_id) {
      return new Response(JSON.stringify({ error: "call_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get call details
    const { data: call, error: callError } = await supabaseAdmin
      .from("lead_calls")
      .select("*")
      .eq("id", call_id)
      .single();

    if (callError || !call) {
      return new Response(JSON.stringify({ error: "Call not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if analysis already exists
    const { data: existing } = await supabaseAdmin
      .from("lead_call_analysis")
      .select("id, processing_status")
      .eq("call_id", call_id)
      .maybeSingle();

    if (existing?.processing_status === "completed") {
      return new Response(JSON.stringify({ message: "Analysis already exists", id: existing.id }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create or update analysis record as "processing"
    let analysisId = existing?.id;
    if (!analysisId) {
      const { data: newAnalysis, error: insertErr } = await supabaseAdmin
        .from("lead_call_analysis")
        .insert({
          call_id,
          lead_id: call.lead_id,
          agent_id: call.agent_id,
          processing_status: "processing",
        })
        .select("id")
        .single();
      if (insertErr) throw insertErr;
      analysisId = newAnalysis.id;
    } else {
      await supabaseAdmin
        .from("lead_call_analysis")
        .update({ processing_status: "processing", error_message: null })
        .eq("id", analysisId);
    }

    // Get lead info for context
    const { data: lead } = await supabaseAdmin
      .from("stream_leads")
      .select("nombre, correo, telefono, fuente, opportunity_score")
      .eq("id", call.lead_id)
      .maybeSingle();

    // Get agent name
    const { data: agentProfile } = await supabaseAdmin
      .from("profiles")
      .select("nombre")
      .eq("id", call.agent_id)
      .maybeSingle();

    // Get existing objections from BCE for matching
    const { data: bceObjections } = await supabaseAdmin
      .from("bce_objections")
      .select("texto_objecion, categoria")
      .limit(50);

    const objectionsList = (bceObjections || []).map((o: any) => o.texto_objecion).join("; ");

    // Build analysis context
    let audioContext = "";
    let hasRecording = false;

    if (call.recording_sid && TWILIO_API_KEY) {
      hasRecording = true;
      audioContext = `La llamada tiene una grabación (Recording SID: ${call.recording_sid}). Duración: ${call.duration_seconds || 0} segundos.`;
    } else {
      audioContext = `No hay grabación disponible. Duración: ${call.duration_seconds || 0} segundos.`;
    }

    // Build prompt
    const systemPrompt = `Eres un experto analista de ventas del equipo Bullfy. Tu trabajo es analizar llamadas de venta y proporcionar feedback accionable para mejorar el rendimiento del agente.

Metodología Bullfy de ventas:
1. **Apertura** (primeros 30 seg): Saludo profesional, presentación, establecer rapport
2. **Sondeo** (1-3 min): Preguntar sobre experiencia en trading, objetivos, capital disponible, problemas actuales
3. **Presentación de valor** (2-4 min): Explicar beneficios del programa IB, diferenciadores
4. **Manejo de objeciones**: Responder dudas con empatía y datos
5. **Cierre**: Proponer siguiente paso concreto (registro, depósito, reunión)

Objeciones comunes del catálogo: ${objectionsList || "N/A"}

IMPORTANTE: Responde siempre en español. Sé constructivo en el feedback.`;

    const userPrompt = `Analiza esta llamada de venta:

**Contexto:**
- Agente: ${agentProfile?.nombre || "Desconocido"}
- Lead: ${lead?.nombre || "Desconocido"} (Score: ${lead?.opportunity_score || "N/A"})
- Disposición del agente: ${call.disposition || "No registrada"}
- Notas del agente: ${call.notes || "Sin notas"}
- ${audioContext}
- Estado final: ${call.status}

${!hasRecording ? "NOTA: No hay grabación de audio disponible. Genera el análisis basándote en la disposición, notas y contexto disponible. Infiere lo que pudo haber ocurrido y da recomendaciones generales." : "Genera el análisis basándote en los datos de la llamada."}

Proporciona el análisis usando la función de herramienta.`;

    // Call AI with tool calling for structured output
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "save_call_analysis",
              description: "Guardar el análisis estructurado de la llamada de venta.",
              parameters: {
                type: "object",
                properties: {
                  summary: {
                    type: "string",
                    description: "Resumen ejecutivo de la llamada en 2-3 oraciones.",
                  },
                  success_score: {
                    type: "integer",
                    description: "Puntuación de éxito de 0 a 100. 0-30 = deficiente, 31-50 = necesita mejora, 51-70 = aceptable, 71-85 = bueno, 86-100 = excelente.",
                  },
                  sentiment: {
                    type: "string",
                    enum: ["muy_negativo", "negativo", "neutral", "positivo", "muy_positivo"],
                    description: "Sentimiento general percibido del lead durante la llamada.",
                  },
                  keywords: {
                    type: "array",
                    items: { type: "string" },
                    description: "3-6 palabras clave relevantes extraídas (ej: 'capital alto', 'trading experiencia', 'objeción precio').",
                  },
                  sales_phase_reached: {
                    type: "string",
                    enum: ["apertura", "sondeo", "presentacion", "objeciones", "cierre"],
                    description: "La fase más avanzada de la metodología Bullfy que se alcanzó.",
                  },
                  objections_detected: {
                    type: "array",
                    items: { type: "string" },
                    description: "Lista de objeciones detectadas o probables del lead.",
                  },
                  objections_handled: {
                    type: "array",
                    items: { type: "string" },
                    description: "Lista de objeciones que el agente manejó correctamente.",
                  },
                  improvement_suggestions: {
                    type: "array",
                    items: { type: "string" },
                    description: "3-5 sugerencias específicas y accionables para que el agente mejore.",
                  },
                  coaching_notes: {
                    type: "string",
                    description: "Notas de coaching detalladas. Incluir qué hizo bien el agente, qué pudo mejorar y cómo hubiera sido más efectivo. Escribe como un mentor experimentado.",
                  },
                },
                required: [
                  "summary",
                  "success_score",
                  "sentiment",
                  "keywords",
                  "sales_phase_reached",
                  "objections_detected",
                  "objections_handled",
                  "improvement_suggestions",
                  "coaching_notes",
                ],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "save_call_analysis" } },
      }),
    });

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      const body = await aiResponse.text();
      console.error("AI gateway error:", status, body);

      const errorMsg = status === 429
        ? "Rate limit exceeded, retrying later"
        : status === 402
          ? "AI credits exhausted"
          : `AI error: ${status}`;

      await supabaseAdmin
        .from("lead_call_analysis")
        .update({ processing_status: "error", error_message: errorMsg })
        .eq("id", analysisId);

      return new Response(JSON.stringify({ error: errorMsg }), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      await supabaseAdmin
        .from("lead_call_analysis")
        .update({ processing_status: "error", error_message: "No structured response from AI" })
        .eq("id", analysisId);

      return new Response(JSON.stringify({ error: "AI did not return structured data" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const analysis = JSON.parse(toolCall.function.arguments);

    // Save analysis
    const { error: updateErr } = await supabaseAdmin
      .from("lead_call_analysis")
      .update({
        summary: analysis.summary,
        success_score: Math.max(0, Math.min(100, analysis.success_score)),
        sentiment: analysis.sentiment,
        keywords: analysis.keywords || [],
        sales_phase_reached: analysis.sales_phase_reached,
        objections_detected: analysis.objections_detected || [],
        objections_handled: analysis.objections_handled || [],
        improvement_suggestions: analysis.improvement_suggestions || [],
        coaching_notes: analysis.coaching_notes,
        processing_status: "completed",
        error_message: null,
        analysis_model: "gemini-3-flash",
      })
      .eq("id", analysisId);

    if (updateErr) throw updateErr;

    console.log(`Analysis completed for call ${call_id}, score: ${analysis.success_score}`);

    return new Response(
      JSON.stringify({ success: true, id: analysisId, score: analysis.success_score }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Analysis error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
