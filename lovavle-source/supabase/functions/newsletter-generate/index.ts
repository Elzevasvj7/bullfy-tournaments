import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

// ── Agent Profiles ──
const AGENTS: Record<string, any> = {
  recruiter: {
    name: "Diana Voss", emoji: "🎯", role: "Reclutadora",
    profile: "42 años, alemana. 18 años en headhunting para medios financieros (Bloomberg, Reuters).",
    model: "google/gemini-2.5-flash-lite",
  },
  researcher: {
    name: "Marcus Chen", emoji: "🔍", role: "Investigador",
    profile: "38 años, chino-americano. Ex-analista senior de Reuters, 15 años en periodismo financiero investigativo.",
    model: "google/gemini-2.5-flash",
  },
  gossip: {
    name: "Vanessa Drake", emoji: "🍷", role: "Gossip Editor de Wall Street",
    profile: "41 años, estadounidense. 16 años como editora de chismes corporativos en Page Six y Dealbreaker.",
    model: "google/gemini-2.5-flash-lite",
  },
  copywriter_technical: {
    name: "Sofía Hernández", emoji: "✍️", role: "Copywriter Técnica",
    profile: "35 años, colombo-española. 12 años en copys financieros, ex-editora de The Economist en español.",
    model: "google/gemini-2.5-flash",
  },
  copywriter_storyteller: {
    name: "Valentina Torres", emoji: "🌟", role: "Copywriter Storyteller",
    profile: "28 años, mexicana. 7 años transformando finanzas complejas en historias simples. Ex-creadora de contenido en Finimize y The Hustle.",
    model: "google/gemini-2.5-flash",
  },
  editor: {
    name: "James Whitmore", emoji: "📝", role: "Editor de Estilo",
    profile: "55 años, británico. 25 años como corrector de estilo en The Financial Times y The Guardian.",
    model: "google/gemini-2.5-flash-lite",
  },
  designer: {
    name: "Yuki Tanaka", emoji: "🎨", role: "Directora Creativa",
    profile: "29 años, japonesa. 8 años en startups fintech de Silicon Valley.",
    model: "google/gemini-2.5-flash-lite",
  },
  cta: {
    name: "Carlos Mendoza", emoji: "❓", role: "Estratega CTA",
    profile: "45 años, mexicano. 17 años en medios interactivos y gamificación.",
    model: "google/gemini-2.5-flash-lite",
  },
  director: {
    name: "Richard Blackwell", emoji: "🏆", role: "Director de Edición",
    profile: "58 años, estadounidense. 22 años dirigiendo newsletters premiados (Morning Brew, The Hustle).",
    model: "google/gemini-2.5-flash",
  },
  verifier: {
    name: "Dr. Amara Okafor", emoji: "⚖️", role: "Verificadora",
    profile: "48 años, nigeriana-británica. PhD en Economía, ex-analista cuantitativa Goldman Sachs.",
    model: "google/gemini-2.5-flash-lite",
  },
};

async function callAI(apiKey: string, model: string, systemPrompt: string, userPrompt: string): Promise<string> {
  const models = [model, "google/gemini-2.5-flash-lite", "openai/gpt-5-nano"];
  for (const m of models) {
    try {
      const res = await fetch(AI_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: m,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
        }),
      });
      if (res.status === 429 || res.status === 402) {
        const t = await res.text();
        throw new Error(`AI rate/payment error [${res.status}]: ${t}`);
      }
      if (!res.ok) { await res.text(); continue; }
      const data = await res.json();
      return data.choices?.[0]?.message?.content || "";
    } catch (e: any) {
      if (e.message?.includes("rate") || e.message?.includes("payment")) throw e;
      continue;
    }
  }
  throw new Error("All AI models failed");
}

function parseJSON(text: string): any {
  try { return JSON.parse(text); } catch {}
  const m = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (m) try { return JSON.parse(m[1].trim()); } catch {}
  const start = text.indexOf("{");
  if (start >= 0) {
    let depth = 0;
    for (let i = start; i < text.length; i++) {
      if (text[i] === "{") depth++;
      if (text[i] === "}") depth--;
      if (depth === 0) {
        try { return JSON.parse(text.substring(start, i + 1)); } catch { break; }
      }
    }
  }
  return null;
}

async function logAgent(sb: any, editionId: string, agent: any, action: string, input: string, output: string) {
  try {
    await sb.from("newsletter_agent_logs").insert({
      edition_id: editionId,
      agent_name: agent.name, agent_role: agent.role, agent_emoji: agent.emoji,
      action, input_summary: input?.substring(0, 500), output_summary: output?.substring(0, 2000),
      iteration_number: 1,
    });
  } catch (_) { /* ignore logging errors */ }
}

async function fetchFinancialNews(firecrawlKey: string | null, marketauxKey: string | null): Promise<string> {
  const results: string[] = [];
  if (marketauxKey) {
    try {
      const res = await fetch(`https://api.marketaux.com/v1/news/all?language=en&filter_entities=true&limit=10&api_token=${marketauxKey}`);
      if (res.ok) {
        const data = await res.json();
        if (data?.data?.length) {
          results.push(`## MarketAux\n${data.data.slice(0, 10).map((h: any) => `- **${h.title}** (${h.source}) — ${h.description || ""}`).join("\n")}`);
        }
      } else { await res.text(); }
    } catch {}
  }
  if (firecrawlKey && results.length === 0) {
    try {
      const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
        method: "POST",
        headers: { Authorization: `Bearer ${firecrawlKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://www.reuters.com/markets/", formats: ["markdown"], onlyMainContent: true, waitFor: 3000 }),
      });
      if (res.ok) {
        const data = await res.json();
        const md = data?.data?.markdown || "";
        if (md) results.push(`## Reuters\n${md.substring(0, 3000)}`);
      }
    } catch {}
  }
  if (results.length === 0) {
    try {
      const finnKey = Deno.env.get("FINNHUB_API_KEY");
      if (finnKey) {
        const fRes = await fetch(`https://finnhub.io/api/v1/news?category=general&token=${finnKey}`);
        const fData = await fRes.json();
        if (Array.isArray(fData)) {
          results.push(`## Finnhub\n${fData.slice(0, 15).map((h: any) => `- **${h.headline}** (${h.source})`).join("\n")}`);
        }
      }
    } catch {}
  }
  return results.join("\n\n") || "No se pudieron obtener noticias en tiempo real.";
}

async function fetchGossipNews(newsapiKey: string | null, firecrawlKey: string | null): Promise<string> {
  const results: string[] = [];
  if (newsapiKey) {
    try {
      const q = encodeURIComponent("CEO wall street luxury scandal billionaire");
      const res = await fetch(`https://newsapi.org/v2/everything?q=${q}&language=en&sortBy=publishedAt&pageSize=8&apiKey=${newsapiKey}`);
      if (res.ok) {
        const data = await res.json();
        if (data?.articles?.length) {
          results.push(data.articles.slice(0, 6).map((a: any) => `- **${a.title}** (${a.source?.name || ""})`).join("\n"));
        }
      }
    } catch {}
  }
  return results.join("\n") || "";
}

async function fetchAgentLearnings(sb: any, agentName: string): Promise<string> {
  const { data } = await sb.from("agent_learning_log")
    .select("lesson_learned, metric_type")
    .eq("agent_name", agentName)
    .order("created_at", { ascending: false })
    .limit(3);
  if (!data?.length) return "";
  const lessons = data.filter((d: any) => d.lesson_learned).map((d: any) => `- ${d.lesson_learned}`).join("\n");
  return lessons ? `\nLECCIONES ANTERIORES:\n${lessons}` : "";
}

async function generateAIImage(apiKey: string, sb: any, prompt: string, fileName: string): Promise<string | null> {
  try {
    const res = await fetch(AI_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3.1-flash-image-preview",
        messages: [{ role: "user", content: prompt }],
        modalities: ["image", "text"],
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const b64 = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    if (!b64) return null;
    const base64Data = b64.replace(/^data:image\/\w+;base64,/, "");
    const bytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
    const { error } = await sb.storage.from("newsletter-images").upload(fileName, bytes, { contentType: "image/png", upsert: true });
    if (error) return null;
    const { data: urlData } = sb.storage.from("newsletter-images").getPublicUrl(fileName);
    return urlData?.publicUrl || null;
  } catch { return null; }
}

const brandGuidelines = `Bullfy: marca fintech premium. Colores: Navy #062B63, Azul #146EF5, Claro #83CBFF, Fondo #F7F9FC, Texto #1A1A2E. Estilo editorial premium. Idioma: Español.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  let edition_id_ref: string | null = null;
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY") || null;
    const MARKETAUX_API_KEY = Deno.env.get("MARKETAUX_API_KEY") || null;
    const NEWSAPI_KEY = Deno.env.get("NEWSAPI_KEY") || null;

    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const userSb = createClient(supabaseUrl, supabaseAnon, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: authErr } = await userSb.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const sb = createClient(supabaseUrl, serviceKey);
    const body = await req.json();
    const { edition_id } = body;
    edition_id_ref = edition_id;

    if (!edition_id) {
      return new Response(JSON.stringify({ error: "edition_id is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: editionRow } = await sb.from("newsletter_editions").select("gossip_mode, copywriter_style").eq("id", edition_id).single();
    const gossipMode = editionRow?.gossip_mode === true;
    const copywriterStyle = editionRow?.copywriter_style === "storyteller" ? "storyteller" : "technical";
    const COPYWRITER = copywriterStyle === "storyteller" ? AGENTS.copywriter_storyteller : AGENTS.copywriter_technical;

    await sb.from("newsletter_editions").update({ status: "generating" }).eq("id", edition_id);

    // ═══════════════════════════════════════════════════════════
    // PHASE 1 (PARALLEL): News fetching + Designer + Learnings
    // ═══════════════════════════════════════════════════════════
    console.log("Phase 1: Parallel data gathering");

    const activeCopyKey = copywriterStyle === "storyteller" ? "copywriter_storyteller" : "copywriter_technical";
    const inactiveCopyKey = copywriterStyle === "storyteller" ? "copywriter_technical" : "copywriter_storyteller";
    const teamList = Object.entries(AGENTS)
      .filter(([k, a]) => a.role !== "Reclutadora" && k !== inactiveCopyKey && (k !== "gossip" || gossipMode))
      .map(([_, a]) => `${a.emoji} ${a.name} - ${a.role}`)
      .join(", ");

    const [rawNews, rawGossip, designerResult, copywriterLearnings, recruiterResult] = await Promise.all([
      fetchFinancialNews(FIRECRAWL_API_KEY, MARKETAUX_API_KEY),
      gossipMode ? fetchGossipNews(NEWSAPI_KEY, FIRECRAWL_API_KEY) : Promise.resolve(""),
      // Designer runs independently - doesn't need content
      callAI(LOVABLE_API_KEY, AGENTS.designer.model,
        `Eres directora creativa de diseño editorial premium. ${brandGuidelines}`,
        `Eres ${AGENTS.designer.name}. Diseña la estructura visual del newsletter Bullfy Markets Daily.
Fondo #F7F9FC, contenedor 640px, cards con sombras sutiles, botones border-radius 25px.
${gossipMode ? "Incluye sección gossip: fondo #F5F0E8, border-left #C9A96E." : ""}
Responde JSON: { "layout_description": "", "sections": [{ "name": "", "background": "", "text_color": "" }], "color_palette": {} }`),
      fetchAgentLearnings(sb, COPYWRITER.name),
      // Recruiter: lightweight validation
      callAI(LOVABLE_API_KEY, AGENTS.recruiter.model, brandGuidelines,
        `Valida equipo: ${teamList}. Responde JSON: { "team_validated": true, "notes": "ok" }`),
    ]);

    // Log phase 1 results (fire-and-forget)
    logAgent(sb, edition_id, AGENTS.recruiter, "validate_team", "Team", recruiterResult);
    logAgent(sb, edition_id, AGENTS.designer, "design_layout", "Structure", designerResult);
    const designData = parseJSON(designerResult) || {};

    // ═══════════════════════════════════════════════════════════
    // PHASE 2 (PARALLEL): Researcher + Gossip Agent analysis
    // ═══════════════════════════════════════════════════════════
    console.log("Phase 2: Research analysis");

    const researcherPrompt = `Eres ${AGENTS.researcher.name}. Noticias financieras recientes:
${rawNews}
Selecciona 5-7 noticias relevantes para traders. Identifica LA más polarizante para predicción.
Responde JSON: { "top_stories": [{ "headline": "", "summary": "", "market_impact": "", "source": "" }], "prediction_candidate": { "headline": "", "context": "", "possible_question": "" } }`;

    const [researcherResult, gossipResult] = await Promise.all([
      callAI(LOVABLE_API_KEY, AGENTS.researcher.model, `Investigador financiero de élite. ${brandGuidelines}`, researcherPrompt),
      gossipMode ? callAI(LOVABLE_API_KEY, AGENTS.gossip.model,
        `Gossip editor de Wall Street. Tono Page Six meets FT. ${brandGuidelines}
REGLAS ABSOLUTAS:
- NUNCA inventes, fabriques ni alucines noticias, rumores o chismes. TODO debe estar basado en hechos reales y verificables.
- Cada chisme DEBE provenir de fuentes reales (Reuters, Bloomberg, WSJ, FT, SEC filings, comunicados oficiales, redes sociales verificadas de ejecutivos, etc.).
- Si no encuentras suficiente material real en los datos proporcionados, reduce la cantidad de chismes pero NUNCA inventes contenido.
- NUNCA menciones a "Bullfy" como empresa, marca o producto. Bullfy es solo el medio que publica, no un sujeto de noticias.
- Incluye siempre la fuente o referencia verificable de cada chisme.`,
        `Eres ${AGENTS.gossip.name}. Gossip corporativo REAL basado EXCLUSIVAMENTE en los siguientes datos verificados:\n${rawGossip || "No hay datos de gossip disponibles. Responde con un array vacío de gossip_stories."}\nSelecciona 2-3 chismes REALES con fuente verificable. Si no hay suficientes datos reales, devuelve menos historias. NUNCA inventes contenido.\nResponde JSON: { "gossip_stories": [{ "headline": "", "body": "", "source": "", "spice_level": "" }], "section_title": "Los Susurros de Wall Street" }`)
        : Promise.resolve(""),
    ]);

    logAgent(sb, edition_id, AGENTS.researcher, "research_news", "Sources", researcherResult);
    const researchData = parseJSON(researcherResult) || { top_stories: [], prediction_candidate: {} };
    let gossipData: any = null;
    if (gossipMode && gossipResult) {
      logAgent(sb, edition_id, AGENTS.gossip, "research_gossip", "Gossip", gossipResult);
      gossipData = parseJSON(gossipResult) || { gossip_stories: [], section_title: "Los Susurros de Wall Street" };
    }

    // ═══════════════════════════════════════════════════════════
    // PHASE 3: Copywriter (needs research data)
    // ═══════════════════════════════════════════════════════════
    console.log("Phase 3: Copywriter");

    const gossipSection = gossipMode && gossipData?.gossip_stories?.length
      ? `\nSECCIÓN GOSSIP:\n${JSON.stringify(gossipData.gossip_stories)}`
      : "";
    const storytellerInstructions = copywriterStyle === "storyteller"
      ? `\nESTILO STORYTELLER: Explica como a un amigo de 25 años. Analogías cotidianas (Netflix, fútbol, videojuegos). Evita jerga. Tono cercano, humor sutil. Cada noticia con gancho emocional.`
      : "";

    const copyResult = await callAI(LOVABLE_API_KEY, COPYWRITER.model,
      copywriterStyle === "storyteller"
        ? `Storyteller financiera para audiencias jóvenes. ${brandGuidelines}`
        : `Mejor copywriter financiera del mundo hispano. ${brandGuidelines}`,
      `Eres ${COPYWRITER.name}. Noticias:\n${JSON.stringify(researchData.top_stories)}${gossipSection}${copywriterLearnings}${storytellerInstructions}
Crea newsletter Bullfy Markets Daily: titular (10 palabras), subtítulo, resumen ejecutivo, desarrollo noticias, ${gossipMode ? '"Susurros de Wall Street",' : ""} dato del día, cierre.
Responde JSON: { "main_headline": "", "subtitle": "", "executive_summary": "", "stories": [{ "headline": "", "body": "", "market_impact": "" }], ${gossipMode ? '"gossip_section": { "title": "Los Susurros de Wall Street", "stories": [{ "headline": "", "body": "", "spice_level": "" }] },' : ""} "fun_fact": "", "closing": "" }`);

    logAgent(sb, edition_id, COPYWRITER, "write_copy", "Research", copyResult);
    const copyData = parseJSON(copyResult) || {};

    // ═══════════════════════════════════════════════════════════
    // PHASE 4 (PARALLEL): Editor + CTA + Images (all independent)
    // ═══════════════════════════════════════════════════════════
    console.log("Phase 4: Editor + CTA + Images (parallel)");

    const stories = copyData?.stories || [];
    const headerTopic = copyData?.main_headline || researchData?.top_stories?.[0]?.headline || "financial markets";

    const imagePromises = [
      // Header image
      generateAIImage(LOVABLE_API_KEY, sb,
        `Premium editorial header image (1200x400). Abstract financial visualization: "${headerTopic}". Navy #062B63 and white with blue accents #146EF5. Minimalist. NO TEXT. Geometric shapes, data lines.`,
        `ai-header-${edition_id}.png`),
      // Gossip image
      gossipMode
        ? generateAIImage(LOVABLE_API_KEY, sb,
            `Elegant editorial illustration: abstract Manhattan skyline watercolor, champagne glass, luxury watch, art deco. NO PEOPLE. Warm cream #F5F0E8 with gold. NO TEXT.`,
            `ai-gossip-${edition_id}.png`)
        : Promise.resolve(null),
      // Story images (max 3 to save time)
      ...stories.slice(0, 3).map((story: any, idx: number) =>
        generateAIImage(LOVABLE_API_KEY, sb,
          `Editorial illustration: "${story?.headline || "financial news"}". Abstract, geometric. Navy #062B63, blue #146EF5. NO PEOPLE. NO TEXT. Clean style.`,
          `ai-story-${edition_id}-${idx}.png`)),
    ];

    const [editorResult, ctaResult, ...imageResults] = await Promise.all([
      // Editor
      callAI(LOVABLE_API_KEY, AGENTS.editor.model,
        `Corrector de estilo exigente. ${brandGuidelines}`,
        `Eres ${AGENTS.editor.name}. Corrige ortografía, gramática, estilo:\n${JSON.stringify(copyData)}\nResponde JSON con contenido corregido (misma estructura) + "corrections_made": []`),
      // CTA
      callAI(LOVABLE_API_KEY, AGENTS.cta.model,
        `Experto en engagement financiero. ${brandGuidelines}`,
        `Eres ${AGENTS.cta.name}. Noticia para predicción:\n${JSON.stringify(researchData.prediction_candidate)}\nCrea pregunta verificable en 24h, 2 opciones (A/B), polarizante.\nJSON: { "question": "", "option_a": "", "option_b": "", "context": "", "engagement_hook": "" }`),
      // All images
      ...imagePromises,
    ]);

    logAgent(sb, edition_id, AGENTS.editor, "review_grammar", "Copy", editorResult);
    logAgent(sb, edition_id, AGENTS.cta, "create_prediction", "Candidate", ctaResult);
    const editedData = parseJSON(editorResult) || copyData;
    const ctaData = parseJSON(ctaResult) || {};

    const [headerUrl, gossipUrl, ...storyUrls] = imageResults;
    const totalImages = imageResults.filter(Boolean).length;
    logAgent(sb, edition_id, AGENTS.designer, "images_ready", "AI Engine", `${totalImages} imágenes generadas`);

    // ═══════════════════════════════════════════════════════════
    // PHASE 5 (PARALLEL): Director review + HTML build
    // ═══════════════════════════════════════════════════════════
    console.log("Phase 5: Director + HTML (parallel)");

    const fullContent: any = { copy: editedData, prediction: ctaData, design: designData, research: researchData };
    if (gossipData) fullContent.gossip = gossipData;

    // Build image instructions for HTML
    const imgInstructions = (storyUrls as (string | null)[])
      .map((url, i) => url ? `- IMAGEN NOTICIA ${i + 1}: <img src="${url}" alt="Noticia ${i + 1}" style="width:100%;display:block;border-radius:8px;" />` : "")
      .filter(Boolean).join("\n");

    const headerImgTag = headerUrl
      ? `<img src="${headerUrl}" alt="Header" style="width:100%;display:block;border-radius:0 0 12px 12px;" />`
      : "";
    const gossipImgTag = gossipUrl
      ? `<img src="${gossipUrl}" alt="Wall Street" style="width:100%;display:block;border-radius:8px;margin-bottom:16px;" />`
      : "";

    const gossipHtmlNote = gossipMode && editedData?.gossip_section
      ? `\nSECCIÓN GOSSIP "🍷 Los Susurros de Wall Street": fondo #F5F0E8, border-left 4px #C9A96E.\n${gossipImgTag ? `Imagen: ${gossipImgTag}` : ""}\nContenido: ${JSON.stringify(editedData.gossip_section)}`
      : "";

    const htmlPrompt = `Genera HTML completo de email newsletter editorial premium.
CONTENIDO: TITULAR: ${fullContent.copy.main_headline || "Bullfy Markets Daily"} | SUBTÍTULO: ${fullContent.copy.subtitle || ""} | RESUMEN: ${fullContent.copy.executive_summary || ""}
NOTICIAS: ${JSON.stringify(fullContent.copy.stories || [])}
DATO: ${fullContent.copy.fun_fact || ""} | CIERRE: ${fullContent.copy.closing || ""}
PREDICCIÓN: ${JSON.stringify(fullContent.prediction)}
${imgInstructions ? `IMÁGENES:\n${imgInstructions}` : ""}${gossipHtmlNote}
DISEÑO: Body #F7F9FC, contenedor 640px bg #FFFFFF border-radius 12px. Header: bg #062B63, logo: <img src="https://dpfqhwcjyecpnvtchudo.supabase.co/storage/v1/object/public/newsletter-images/brand/logo-bullfy-blue.svg" alt="Bullfy" width="160" style="display:block;margin:0 auto 12px;filter:brightness(0) invert(1);" />${headerImgTag ? `\nImagen header: ${headerImgTag}` : ""}
Hero: bg #EEF4FA, titular 32px bold. Resumen: border-left 4px #146EF5, bg #F0F7FF. Predicción: bg #062B63, pregunta blanca 18px, botones A(verde #00C853 📈) B(rojo #FF1744 📉). Dato: bg #FFF8E1 💡. Inline styles, tablas Gmail/Outlook.
Responde SOLO HTML.`;

    const [dirResult, htmlResult] = await Promise.all([
      callAI(LOVABLE_API_KEY, AGENTS.director.model,
        `Director editorial más exigente. ${brandGuidelines}`,
        `Eres ${AGENTS.director.name}. Revisa TODO:\n${JSON.stringify(fullContent, null, 1)}\nEvalúa calidad, titulares, predicción. JSON: { "approved": true, "score": 85, "final_notes": "..." }`),
      callAI(LOVABLE_API_KEY, "google/gemini-2.5-flash-lite",
        "Experto en diseño de email HTML premium. Responde SOLO HTML puro, sin markdown.",
        htmlPrompt),
    ]);

    logAgent(sb, edition_id, AGENTS.director, "final_review", "Full content", dirResult);

    // ── Build final HTML with legal footer ──
    let finalHtml = htmlResult;
    const htmlMatch = htmlResult.match(/```(?:html)?\s*([\s\S]*?)```/);
    if (htmlMatch) finalHtml = htmlMatch[1].trim();

    const legalFooter = `
<div style="background:#062B63;padding:32px 24px 24px;border-radius:0 0 12px 12px;">
  <div style="text-align:center;margin-bottom:20px;">
    <img src="https://dpfqhwcjyecpnvtchudo.supabase.co/storage/v1/object/public/newsletter-images/brand/logo-bullfy-blue.svg" alt="Bullfy" width="120" style="display:inline-block;filter:brightness(0) invert(1);" />
  </div>
  <div style="max-width:560px;margin:0 auto;font-family:Arial,Helvetica,sans-serif;">
    <p style="color:#83CBFF;font-size:11px;font-weight:bold;margin:0 0 6px;text-transform:uppercase;letter-spacing:1px;">Aviso Legal</p>
    <p style="color:#A0B1BD;font-size:10px;line-height:1.5;margin:0 0 12px;">
      Este mensaje es informativo y comercial; no constituye asesoramiento financiero ni recomendación de inversión.
      Bullfy Ltd. no garantiza la precisión de la información presentada.
    </p>
    <hr style="border:none;border-top:1px solid #146EF540;margin:12px 0;" />
    <p style="color:#83CBFF;font-size:11px;font-weight:bold;margin:0 0 6px;text-transform:uppercase;letter-spacing:1px;">Advertencia de Riesgo</p>
    <p style="color:#A0B1BD;font-size:10px;line-height:1.5;margin:0 0 12px;">
      Operar con productos apalancados implica un alto nivel de riesgo y puede resultar en la pérdida total de tu inversión.
      Consulta nuestra Declaración de Riesgos en nuestro sitio web.
    </p>
    <hr style="border:none;border-top:1px solid #146EF540;margin:12px 0;" />
    <p style="color:#83CBFF;font-size:11px;font-weight:bold;margin:0 0 6px;text-transform:uppercase;letter-spacing:1px;">Restricciones Regionales</p>
    <p style="color:#A0B1BD;font-size:10px;line-height:1.5;margin:0 0 12px;">
      Bullfy Ltd. no presta servicios a residentes de: Sudán, Siria, Corea del Norte, Cuba, Irán, Estados Unidos y Canadá.
    </p>
    <hr style="border:none;border-top:1px solid #146EF540;margin:12px 0;" />
    <p style="color:#A0B1BD;font-size:10px;line-height:1.5;margin:0 0 4px;">
      Aviso Legal&nbsp;|&nbsp;Política de Privacidad&nbsp;|&nbsp;Términos y Condiciones
    </p>
    <p style="color:#A0B1BD;font-size:10px;margin:0;">
      Contacto: <a href="mailto:support@bullfy.com" style="color:#146EF5;text-decoration:none;">support@bullfy.com</a>
    </p>
    <p style="color:#A0B1BD;font-size:9px;margin:16px 0 0;text-align:center;">
      © ${new Date().getFullYear()} Bullfy Ltd. — Ground Floor, The Sotheby Building, Rodney Village, Rodney Bay Gros-Islet, Saint Lucia
    </p>
  </div>
</div>`;

    if (finalHtml.includes("</body>")) {
      finalHtml = finalHtml.replace("</body>", legalFooter + "\n</body>");
    } else if (finalHtml.includes("</html>")) {
      finalHtml = finalHtml.replace("</html>", legalFooter + "\n</html>");
    } else {
      finalHtml += "\n" + legalFooter;
    }

    const contentToSave = {
      ...fullContent,
      html: finalHtml,
      images: { header: headerUrl, gossip: gossipUrl, stories: storyUrls },
      generated_at: new Date().toISOString(),
      gossip_mode: gossipMode,
    };

    const predictionOptions = [];
    if (ctaData.option_a) predictionOptions.push({ key: "A", label: ctaData.option_a });
    if (ctaData.option_b) predictionOptions.push({ key: "B", label: ctaData.option_b });

    await sb.from("newsletter_editions").update({
      status: "reviewing",
      content_json: contentToSave,
      prediction_question: ctaData.question || null,
      prediction_options: predictionOptions,
    }).eq("id", edition_id);

    console.log("Newsletter generation complete:", edition_id);

    return new Response(JSON.stringify({
      ok: true, edition_id,
      headline: fullContent.copy.main_headline,
      prediction: ctaData.question,
      gossip_mode: gossipMode,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err: any) {
    console.error("newsletter-generate error:", err);
    try {
      const failSb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      if (edition_id_ref) {
        const errorMsg = err.message?.includes("credits") || err.message?.includes("payment")
          ? "Créditos de IA insuficientes. Intenta más tarde."
          : err.message || "Error desconocido";
        await failSb.from("newsletter_editions").update({
          status: "failed", content_json: { error: errorMsg },
        }).eq("id", edition_id_ref);
        try {
          await failSb.from("newsletter_agent_logs").insert({
            edition_id: edition_id_ref, agent_name: "Sistema", agent_role: "Error Handler",
            agent_emoji: "❌", action: "error", input_summary: "Fallo", output_summary: errorMsg, iteration_number: 1,
          });
        } catch (_) { /* ignore */ }
      }
    } catch {}
    return new Response(JSON.stringify({ ok: false, error: err.message }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
