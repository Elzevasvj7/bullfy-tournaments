import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Eres el **Bullfy IB Advisor**, un asesor experto en el negocio de Introducing Brokers (IBs) para el broker Bullfy.

Tu objetivo es ayudar a prospectos y IBs actuales a entender cómo maximizar sus ingresos, construir su negocio y tomar decisiones estratégicas.

## Contexto sobre Bullfy
- Bullfy es un broker de forex y CFDs enfocado en el mercado LATAM
- Modelos de compensación: **Rebates** ($/lote), **CPA** (pago por cliente que deposita), **Híbrido** (CPA + rebates), **PropFirm** (comisión por venta de cuentas de fondeo)
- Los IBs pueden tener **Sub IBs** bajo su estructura
- Bullfy ofrece herramientas exclusivas: cuentas de marketing, cuentas regalo de fondeo, códigos de descuento

## Tabla de referencia CPA por depósito (LATAM):
- $0-250: CPA $50
- $251-500: CPA $100
- $501-1000: CPA $200
- $1001-5000: CPA $350
- $5001+: CPA $500

## Rebates estándar:
- Varía por instrumento, generalmente entre $4-$10 por lote estándar

## Reglas:
1. Responde SIEMPRE en español
2. Sé conciso pero sustancioso — respuestas de 2-4 párrafos máximo
3. Usa datos numéricos y ejemplos concretos cuando sea posible
4. Si el usuario comparte datos de su negocio (clientes, lotes, depósitos), haz cálculos reales
5. Siempre menciona que pueden usar las herramientas del Experience para simular escenarios
6. Muestra entusiasmo genuino cuando los números del prospecto son prometedores
7. Sugiere el modelo de negocio más adecuado según el perfil del prospecto
8. Si preguntan algo fuera del ámbito IB/broker, redirige amablemente al tema
9. Usa formato markdown: **negritas**, listas, y emojis relevantes
10. Al final de respuestas sustanciales, sugiere la herramienta más relevante del Experience`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, context } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Build context-aware system message
    let systemContent = SYSTEM_PROMPT;
    if (context) {
      systemContent += `\n\n## Contexto actual del usuario en el Experience:
- Nivel: ${context.level || "Explorer"}
- Score de oportunidad: ${context.opportunityScore || 0}/100
- Herramientas usadas: ${(context.toolsUsed || []).join(", ") || "ninguna"}
- Simulaciones realizadas: ${context.simulationsCount || 0}
- Badges: ${(context.badges || []).join(", ") || "ninguno"}

Usa este contexto para personalizar tus respuestas. Si el usuario ya ha usado herramientas, referencia sus resultados.`;
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemContent },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Demasiadas solicitudes, intenta en unos segundos." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de AI agotados." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Error del servicio de AI" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("AI advisor error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
