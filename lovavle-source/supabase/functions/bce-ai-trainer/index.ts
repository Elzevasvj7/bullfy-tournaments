import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Eres el Entrenador IA del Bullfy Closing Engine (BCE), un motor de cierre de ventas para Business Developers que venden servicios de brokerage, prop firms y copy trading.

Tu objetivo es ayudar al Master Admin a entrenar el sistema de la manera más eficiente posible. Para eso:

1. **Haz preguntas específicas** para extraer objeciones, respuestas y scripts de ventas del entrenador.
2. **Guía la conversación** paso a paso: primero identifica qué área quiere entrenar (objeciones, scripts de apertura, diagnóstico, presentación, cierre).
3. **Cuando tengas suficiente información**, genera el contenido estructurado usando la herramienta disponible.

### Categorías de objeciones válidas:
dinero, confianza, competencia, riesgo, conocimiento, tiempo, otro

### Fases de scripts válidas:
apertura, diagnostico, presentacion, objeciones, cierre

### Tipos de lead:
IB (Introducing Broker), Trader, Inversionista

### Flujo de entrenamiento sugerido:
- Pregunta: "¿Qué tipo de objeción o situación quieres entrenar hoy?"
- Si el entrenador describe una objeción → pide los detalles: respuesta lógica, emocional, reframe, contra-pregunta, cierre sugerido
- Si el entrenador describe un script → pide la fase y el tipo de lead
- Cuando tengas TODA la información necesaria, usa la herramienta para guardar el contenido
- Después de guardar, pregunta si quiere seguir entrenando otra área

### Reglas:
- Responde SIEMPRE en español
- Sé conciso y directo
- Haz UNA pregunta a la vez para no abrumar
- Si el entrenador da información parcial, pide lo que falta
- Confirma antes de guardar
- Puedes sugerir mejoras a las respuestas del entrenador basándote en mejores prácticas de ventas`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, serviceKey);

    // Get existing data context
    const [objRes, flowRes] = await Promise.all([
      sb.from("bce_objections").select("texto_objecion, categoria").limit(20),
      sb.from("bce_call_flows").select("id, nombre, tipo_lead, objetivo"),
    ]);

    const existingContext = `\n\n--- CONTEXTO ACTUAL DEL SISTEMA ---
Objeciones existentes (${objRes.data?.length ?? 0}): ${objRes.data?.map(o => `"${o.texto_objecion}" [${o.categoria}]`).join(", ") || "ninguna"}
Flujos existentes: ${flowRes.data?.map(f => `${f.nombre} (${f.tipo_lead} → ${f.objetivo}) [ID: ${f.id}]`).join(", ") || "ninguno"}
---`;

    const tools = [
      {
        type: "function" as const,
        function: {
          name: "save_objection",
          description: "Guarda una nueva objeción con todas sus respuestas en el sistema BCE",
          parameters: {
            type: "object",
            properties: {
              texto_objecion: { type: "string" },
              respuesta_logica: { type: "string" },
              respuesta_emocional: { type: "string" },
              reframe: { type: "string" },
              contra_pregunta: { type: "string" },
              cierre_sugerido: { type: "string" },
              categoria: { type: "string", enum: ["dinero", "confianza", "competencia", "riesgo", "conocimiento", "tiempo", "otro"] },
            },
            required: ["texto_objecion", "respuesta_logica", "respuesta_emocional", "reframe", "contra_pregunta", "cierre_sugerido", "categoria"],
          },
        },
      },
      {
        type: "function" as const,
        function: {
          name: "save_script",
          description: "Guarda un nuevo script de ventas en el sistema BCE",
          parameters: {
            type: "object",
            properties: {
              flow_id: { type: "string" },
              fase: { type: "string", enum: ["apertura", "diagnostico", "presentacion", "objeciones", "cierre"] },
              texto_corto: { type: "string" },
              orden: { type: "number" },
            },
            required: ["flow_id", "fase", "texto_corto", "orden"],
          },
        },
      },
    ];

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT + existingContext },
          ...messages,
        ],
        tools,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Demasiadas solicitudes. Intenta en unos minutos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de AI agotados." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Error del servicio de IA" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await response.json();
    const choice = result.choices?.[0]?.message;
    const savedItems: string[] = [];

    // Process tool calls if any
    if (choice?.tool_calls?.length > 0) {
      for (const tc of choice.tool_calls) {
        const args = JSON.parse(tc.function.arguments);

        if (tc.function.name === "save_objection") {
          const { error } = await sb.from("bce_objections").insert({
            ...args,
            source: "ai_trainer",
          });
          savedItems.push(error
            ? `❌ Error guardando objeción: ${error.message}`
            : `✅ Objeción guardada: "${args.texto_objecion}"`
          );
        }

        if (tc.function.name === "save_script") {
          const { error } = await sb.from("bce_scripts").insert(args);
          savedItems.push(error
            ? `❌ Error guardando script: ${error.message}`
            : `✅ Script guardado: "${args.texto_corto}" (${args.fase})`
          );
        }
      }
    }

    const responseContent = choice?.content || "";
    const fullResponse = savedItems.length > 0
      ? `${savedItems.join("\n")}\n\n${responseContent}`
      : responseContent;

    return new Response(JSON.stringify({
      content: fullResponse,
      saved: savedItems,
      tool_calls: (choice?.tool_calls?.length ?? 0) > 0,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("bce-ai-trainer error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
