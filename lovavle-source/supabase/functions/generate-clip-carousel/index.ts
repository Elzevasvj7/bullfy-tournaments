// Generates an Instagram carousel (10 cards) from a clip's transcript using
// Lovable AI to split the content + Gemini image gen for each card.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const respond = (p: Record<string, unknown>, s = 200) =>
  new Response(JSON.stringify(p), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_KEY = Deno.env.get("LOVABLE_API_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { clip_id, num_cards = 8 } = await req.json();
    if (!clip_id) return respond({ ok: false, error: "clip_id required" });

    const authHeader = req.headers.get("authorization") || "";
    const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { Authorization: authHeader, apikey: Deno.env.get("SUPABASE_ANON_KEY")! },
    });
    if (!userRes.ok) return respond({ ok: false, error: "No autenticado" }, 401);
    const user = await userRes.json();

    const cRes = await fetch(`${supabaseUrl}/rest/v1/video_clips?id=eq.${clip_id}&select=*`, {
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
    });
    const clip = (await cRes.json())?.[0];
    if (!clip) return respond({ ok: false, error: "Clip no encontrado" });

    // 1. AI splits the transcript into N carousel cards
    const sys = `Eres diseñador de carruseles para Instagram en nicho trading/inversión.
Convierte el contenido en ${num_cards} tarjetas (slides) secuenciales.
Cada tarjeta: title (3-7 palabras), body (1-2 frases cortas), image_prompt (descripción concisa para generar imagen abstracta financiera, SIN personas reales, estilo gráfico minimalista, colores azul oscuro/cian).
Devuelve SOLO JSON: {"title":"...","caption":"caption final IG","cards":[{"title":"","body":"","image_prompt":""}]}`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: sys },
          { role: "user", content: `Contenido fuente: """${clip.transcript_segment || clip.title || ""}"""` },
        ],
      }),
    });

    if (!aiRes.ok) return respond({ ok: false, error: `AI ${aiRes.status}` });
    const aiData = await aiRes.json();
    const text = aiData?.choices?.[0]?.message?.content || "";
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return respond({ ok: false, error: "AI no devolvió JSON" });

    let parsed: any;
    try { parsed = JSON.parse(match[0]); } catch { return respond({ ok: false, error: "JSON inválido" }); }

    const cards = (parsed.cards || []).slice(0, num_cards);

    // 2. For each card, generate an image via Gemini image preview
    const enrichedCards: any[] = [];
    for (const c of cards) {
      try {
        const imgRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${LOVABLE_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-3-flash-image-preview",
            messages: [
              { role: "user", content: `${c.image_prompt}. Estilo: minimalista, financiero, abstracto, fondo azul oscuro #062B63, acentos #146EF5, sin texto, sin personas reales. Cuadrado 1080x1080.` },
            ],
            modalities: ["image", "text"],
          }),
        });
        const imgData = await imgRes.json();
        const url = imgData?.choices?.[0]?.message?.images?.[0]?.image_url?.url || null;
        enrichedCards.push({ ...c, image_url: url });
      } catch (e) {
        enrichedCards.push({ ...c, image_url: null, error: String(e) });
      }
    }

    // 3. Save carousel
    const insertRes = await fetch(`${supabaseUrl}/rest/v1/clip_carousels`, {
      method: "POST",
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify({
        clip_id,
        title: parsed.title || clip.title,
        caption: parsed.caption || "",
        cards: enrichedCards,
        status: "draft",
        created_by: user.id,
      }),
    });
    const saved = (await insertRes.json())?.[0];

    return respond({ ok: true, carousel_id: saved?.id, cards: enrichedCards, caption: parsed.caption });
  } catch (e) {
    console.error("generate-clip-carousel error:", e);
    return respond({ ok: false, error: e instanceof Error ? e.message : String(e) });
  }
});
