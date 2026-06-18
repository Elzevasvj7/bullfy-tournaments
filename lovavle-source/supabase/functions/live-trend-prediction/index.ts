import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { z } from "https://esm.sh/zod@3.24.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BodySchema = z.object({
  portal_id: z.string().uuid().optional(),
  partner_user_id: z.string().uuid().optional(),
  symbol: z.string().trim().min(1).max(20),
  host_broadcast: z.boolean().optional(),
  requester_id: z.string().uuid().nullable().optional(),
});

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const TWELVEDATA_API_KEY = Deno.env.get("TWELVEDATA_API_KEY") ?? "";
const FF_XML_URL = "https://nfs.faireconomy.media/ff_calendar_thisweek.xml";

type EconomicEvent = {
  title: string;
  country: string;
  date: string;
  time: string;
  impact: "high" | "medium" | "low";
  forecast: string | null;
  previous: string | null;
  actual: string | null;
  url: string | null;
};

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function decodeXml(value: string) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

function extractTag(block: string, tag: string) {
  const match = block.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? decodeXml(match[1]) : "";
}

function normalizeImpact(raw: string): EconomicEvent["impact"] {
  const value = raw.toLowerCase();
  if (value.includes("high")) return "high";
  if (value.includes("medium")) return "medium";
  return "low";
}

function parseEconomicCalendar(xml: string): EconomicEvent[] {
  const blocks = xml.match(/<event>[\s\S]*?<\/event>/gi) ?? [];
  return blocks.map((block) => ({
    title: extractTag(block, "title"),
    country: extractTag(block, "country"),
    date: extractTag(block, "date"),
    time: extractTag(block, "time"),
    impact: normalizeImpact(extractTag(block, "impact")),
    forecast: extractTag(block, "forecast") || null,
    previous: extractTag(block, "previous") || null,
    actual: extractTag(block, "actual") || null,
    url: extractTag(block, "url") || null,
  })).filter((event) => event.title && event.country);
}

function normalizeSymbol(symbol: string) {
  return symbol.trim().toUpperCase();
}

function inferRelevantCountries(symbol: string) {
  const normalized = normalizeSymbol(symbol);
  const matches = normalized.match(/[A-Z]{3}/g) ?? [];
  const unique = Array.from(new Set(matches));

  if (normalized.includes("XAU") || normalized.includes("GOLD")) unique.push("USD");
  if (normalized.includes("US30") || normalized.includes("NAS") || normalized.includes("SPX")) unique.push("USD");
  if (normalized.includes("BTC") || normalized.includes("ETH")) unique.push("USD");

  return Array.from(new Set(unique)).slice(0, 4);
}

async function fetchQuote(symbol: string) {
  if (!TWELVEDATA_API_KEY) return null;
  const res = await fetch(
    `https://api.twelvedata.com/price?symbol=${encodeURIComponent(symbol)}&apikey=${TWELVEDATA_API_KEY}`,
    { headers: { Accept: "application/json" } },
  );
  if (!res.ok) return null;
  const data = await res.json();
  return typeof data?.price === "string" || typeof data?.price === "number"
    ? { price: String(data.price) }
    : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (!LOVABLE_API_KEY) {
      return jsonResponse({ ok: false, error: "AI Gateway no configurado" }, 500);
    }

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return jsonResponse({ ok: false, error: "Solicitud inválida", details: parsed.error.flatten() }, 400);
    }

    const { portal_id, partner_user_id, symbol, host_broadcast } = parsed.data;
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    if (!host_broadcast) {
      if (!portal_id || !partner_user_id) {
        return jsonResponse({ ok: false, error: "Faltan portal_id o partner_user_id" }, 400);
      }
      const { data: partnerUser, error: partnerUserError } = await supabase
        .from("partner_users")
        .select("id")
        .eq("id", partner_user_id)
        .eq("portal_id", portal_id)
        .maybeSingle();

      if (partnerUserError || !partnerUser) {
        return jsonResponse({ ok: false, error: "Viewer no válido para este portal" }, 403);
      }
    }

    const recentAnalysisQuery = partner_user_id
      ? supabase
          .from("trading_room_analysis_runs")
          .select("summary, created_at, status")
          .eq("partner_user_id", partner_user_id)
          .order("created_at", { ascending: false })
          .limit(3)
      : Promise.resolve({ data: [] as Array<{ summary: string | null }> });

    const [calendarResponse, quote, recentAnalysisResponse] = await Promise.all([
      fetch(FF_XML_URL, { headers: { "User-Agent": "Mozilla/5.0 BullfyLive/1.0" } }),
      fetchQuote(symbol),
      recentAnalysisQuery,
    ]);

    const calendarXml = calendarResponse.ok ? await calendarResponse.text() : "";
    const events = calendarXml ? parseEconomicCalendar(calendarXml) : [];
    const relevantCountries = inferRelevantCountries(symbol);
    const redFolderEvents = events
      .filter((event) => event.impact === "high" && relevantCountries.includes(event.country))
      .slice(0, 5)
      .map((event) => ({
        title: event.title,
        country: event.country,
        time_label: `${event.date} ${event.time}`.trim(),
        forecast: event.forecast,
        previous: event.previous,
        actual: event.actual,
      }));

    const analysisSummaries = (recentAnalysisResponse.data ?? [])
      .map((row) => row.summary)
      .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
      .slice(0, 2);

    const prompt = {
      symbol: normalizeSymbol(symbol),
      quote,
      relevant_countries: relevantCountries,
      red_folder_events: redFolderEvents,
      prior_bullfy_context: analysisSummaries,
    };

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content:
              "Eres un analista de trading para Bullfy Live. Debes responder con una función estructurada. Evalúa tendencia probable del activo, impacto de noticias rojas y entrega una explicación breve, prudente y accionable. Nunca prometas resultados ni des asesoría garantizada.",
          },
          {
            role: "user",
            content: `Analiza este activo y devuelve tendencia esperada, confianza, resumen breve y alerta por noticia roja si aplica. Contexto: ${JSON.stringify(prompt)}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "deliver_trend_prediction",
              description: "Entrega una predicción prudente de tendencia para un activo de trading.",
              parameters: {
                type: "object",
                properties: {
                  trend: { type: "string", enum: ["alcista", "bajista", "neutral"] },
                  confidence: { type: "string", enum: ["baja", "media", "alta"] },
                  summary: { type: "string" },
                  news_alert: { type: ["string", "null"] },
                },
                required: ["trend", "confidence", "summary", "news_alert"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "deliver_trend_prediction" } },
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) return jsonResponse({ ok: false, error: "Demasiadas solicitudes de AI. Intenta nuevamente en unos segundos." }, 429);
      if (aiResponse.status === 402) return jsonResponse({ ok: false, error: "Créditos de AI agotados en el workspace." }, 402);
      const text = await aiResponse.text();
      console.error("live-trend-prediction AI error", aiResponse.status, text);
      return jsonResponse({ ok: false, error: "No se pudo generar la predicción IA" }, 500);
    }

    const aiJson = await aiResponse.json();
    const toolCall = aiJson?.choices?.[0]?.message?.tool_calls?.[0];
    const args = toolCall?.function?.arguments ? JSON.parse(toolCall.function.arguments) : null;

    if (!args) {
      return jsonResponse({ ok: false, error: "La AI no devolvió una predicción válida" }, 500);
    }

    return jsonResponse({
      ok: true,
      prediction: {
        trend: args.trend,
        confidence: args.confidence,
        summary: args.summary,
        news_alert: args.news_alert,
        red_folder_events: redFolderEvents,
      },
    });
  } catch (error) {
    console.error("live-trend-prediction error", error);
    return jsonResponse({ ok: false, error: error instanceof Error ? error.message : "Error interno" }, 500);
  }
});