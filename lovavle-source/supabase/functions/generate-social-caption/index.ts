// Generates platform-optimized caption + hashtags using Lovable AI.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const respond = (p: Record<string, unknown>, s = 200) =>
  new Response(JSON.stringify(p), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

const PLATFORM_RULES: Record<string, string> = {
  instagram:
    "Instagram Reels: caption ≤ 2200 chars, gancho en primera línea, 8-15 hashtags relevantes mezclando nicho y amplios. Tono visual y emocional. Máximo 2 emojis al inicio.",
  tiktok:
    "TikTok: caption ≤ 150 chars, MUY corto y punzante. 3-5 hashtags, incluir #fyp y/o #parati. Tono directo, conversacional, viral. 1 emoji opcional.",
  youtube:
    "YouTube Shorts: título ≤ 60 chars con keyword fuerte. Description ≤ 200 chars + 3-5 hashtags al final precedidos de #. SEO friendly, sin clickbait excesivo.",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { base_caption, platform, niche } = await req.json();
    if (!base_caption || !platform) return respond({ ok: false, error: "base_caption and platform required" });

    const rule = PLATFORM_RULES[platform] || PLATFORM_RULES.instagram;
    const sys = `Eres un copywriter experto en redes sociales para trading/inversión.
Reglas para ${platform.toUpperCase()}: ${rule}
Nicho: ${niche || "trading, inversión, finanzas"}.
Devuelve SOLO JSON válido: {"caption":"...","hashtags":["#tag1","#tag2"]}`;

    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: sys },
          { role: "user", content: `Caption original: """${base_caption}"""\n\nGenera la versión optimizada.` },
        ],
      }),
    });

    if (r.status === 429) return respond({ ok: false, error: "Rate limit. Intenta en un momento." });
    if (r.status === 402) return respond({ ok: false, error: "Créditos AI agotados. Recarga en Settings." });
    if (!r.ok) {
      const t = await r.text();
      return respond({ ok: false, error: `AI error: ${t.substring(0, 150)}` });
    }

    const data = await r.json();
    const text = data?.choices?.[0]?.message?.content || "";
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return respond({ ok: false, error: "AI no devolvió JSON parseable", raw: text });

    let parsed: any;
    try {
      parsed = JSON.parse(match[0]);
    } catch {
      return respond({ ok: false, error: "JSON inválido", raw: text });
    }

    return respond({
      ok: true,
      caption: parsed.caption || base_caption,
      hashtags: Array.isArray(parsed.hashtags) ? parsed.hashtags : [],
    });
  } catch (e) {
    console.error("generate-social-caption error:", e);
    return respond({ ok: false, error: e instanceof Error ? e.message : String(e) });
  }
});
