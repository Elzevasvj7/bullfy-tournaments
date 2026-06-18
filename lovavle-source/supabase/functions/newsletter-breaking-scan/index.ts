import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
    const MARKETAUX_API_KEY = Deno.env.get("MARKETAUX_API_KEY");
    const NEWSAPI_KEY = Deno.env.get("NEWSAPI_KEY");

    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sb = createClient(supabaseUrl, serviceKey);
    const newsItems: { source: string; title: string; description: string; url: string; agent: string }[] = [];

    // ── Marcus Chen: Financial news from MarketAux ──
    if (MARKETAUX_API_KEY) {
      try {
        const res = await fetch(`https://api.marketaux.com/v1/news/all?language=en&filter_entities=true&limit=5&api_token=${MARKETAUX_API_KEY}`);
        if (res.ok) {
          const data = await res.json();
          (data?.data || []).forEach((item: any) => {
            newsItems.push({
              source: item.source || "MarketAux",
              title: item.title || "",
              description: item.description || "",
              url: item.url || "",
              agent: "Marcus Chen",
            });
          });
        } else { await res.text(); }
      } catch (e) { console.error("MarketAux error:", e); }
    }

    // ── Marcus Chen: Firecrawl from Reuters ──
    if (FIRECRAWL_API_KEY) {
      try {
        const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
          method: "POST",
          headers: { Authorization: `Bearer ${FIRECRAWL_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({ url: "https://www.reuters.com/markets/", formats: ["markdown"], onlyMainContent: true, waitFor: 3000 }),
        });
        if (res.ok) {
          const data = await res.json();
          const md = data?.data?.markdown || "";
          if (md) {
            // Extract headlines from markdown
            const lines = md.split("\n").filter((l: string) => l.trim().startsWith("##") || l.trim().startsWith("**"));
            lines.slice(0, 5).forEach((line: string) => {
              newsItems.push({
                source: "Reuters",
                title: line.replace(/^[#*\s]+/, "").replace(/\*+$/g, "").trim(),
                description: "",
                url: "https://www.reuters.com/markets/",
                agent: "Marcus Chen",
              });
            });
          }
        } else { await res.text(); }
      } catch (e) { console.error("Firecrawl Reuters error:", e); }
    }

    // ── Vanessa Drake: Gossip from NewsAPI ──
    if (NEWSAPI_KEY) {
      try {
        const q = encodeURIComponent("CEO billionaire luxury scandal wedding wall street");
        const res = await fetch(`https://newsapi.org/v2/everything?q=${q}&language=en&sortBy=publishedAt&pageSize=5&apiKey=${NEWSAPI_KEY}`);
        if (res.ok) {
          const data = await res.json();
          (data?.articles || []).forEach((a: any) => {
            newsItems.push({
              source: a.source?.name || "NewsAPI",
              title: a.title || "",
              description: a.description || "",
              url: a.url || "",
              agent: "Vanessa Drake",
            });
          });
        } else { await res.text(); }
      } catch (e) { console.error("NewsAPI error:", e); }
    }

    // ── Vanessa Drake: Firecrawl gossip ──
    if (FIRECRAWL_API_KEY) {
      try {
        const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
          method: "POST",
          headers: { Authorization: `Bearer ${FIRECRAWL_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({ url: "https://pagesix.com/tag/wall-street/", formats: ["markdown"], onlyMainContent: true, waitFor: 3000 }),
        });
        if (res.ok) {
          const data = await res.json();
          const md = data?.data?.markdown || "";
          if (md) {
            const lines = md.split("\n").filter((l: string) => l.trim().startsWith("##") || l.trim().startsWith("**"));
            lines.slice(0, 3).forEach((line: string) => {
              newsItems.push({
                source: "Page Six",
                title: line.replace(/^[#*\s]+/, "").replace(/\*+$/g, "").trim(),
                description: "",
                url: "https://pagesix.com/tag/wall-street/",
                agent: "Vanessa Drake",
              });
            });
          }
        } else { await res.text(); }
      } catch (e) { console.error("Firecrawl PageSix error:", e); }
    }

    if (newsItems.length === 0) {
      return new Response(JSON.stringify({ ok: true, message: "No news found", breaking: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── AI evaluates urgency of each news item ──
    const newsForEval = newsItems.map((n, i) => `${i + 1}. [${n.agent}] ${n.title} — ${n.description} (${n.source})`).join("\n");

    const evalPrompt = `Eres un editor jefe de un newsletter financiero premium. Evalúa las siguientes noticias y asigna un score de urgencia (1-10) a cada una.

Score 8-10 = BREAKING NEWS: noticia que los traders NECESITAN saber YA.
Score 5-7 = Importante pero no urgente.
Score 1-4 = Puede esperar al próximo newsletter.

Noticias:
${newsForEval}

Responde en JSON:
{
  "evaluations": [
    { "index": 1, "urgency_score": 9, "headline_clean": "titular limpio en español", "summary_clean": "resumen en español de 2 líneas", "category": "financial|gossip" }
  ]
}`;

    const evalRes = await fetch(AI_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "Eres un editor financiero experto. Evalúa noticias con criterio profesional." },
          { role: "user", content: evalPrompt },
        ],
      }),
    });

    if (!evalRes.ok) {
      const t = await evalRes.text();
      throw new Error(`AI evaluation failed [${evalRes.status}]: ${t}`);
    }

    const evalData = await evalRes.json();
    const evalContent = evalData.choices?.[0]?.message?.content || "";
    const parsed = parseJSON(evalContent);

    if (!parsed?.evaluations?.length) {
      return new Response(JSON.stringify({ ok: true, message: "No evaluations parsed", breaking: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Insert breaking news (score >= 8) ──
    let breakingCount = 0;
    for (const ev of parsed.evaluations) {
      if (ev.urgency_score >= 8) {
        const idx = (ev.index || 1) - 1;
        const original = newsItems[idx] || newsItems[0];

        await sb.from("breaking_news").insert({
          headline: ev.headline_clean || original.title,
          summary: ev.summary_clean || original.description || "Noticia urgente detectada",
          source: original.source,
          source_url: original.url,
          urgency_score: ev.urgency_score,
          proposed_by: original.agent,
          proposed_by_emoji: original.agent === "Vanessa Drake" ? "🍷" : "🔍",
          category: ev.category === "gossip" ? "gossip" : "financial",
          status: "pending",
          raw_data: { original, evaluation: ev },
        });
        breakingCount++;
      }
    }

    console.log(`Breaking scan complete: ${newsItems.length} items evaluated, ${breakingCount} breaking news inserted`);

    return new Response(JSON.stringify({
      ok: true,
      total_scanned: newsItems.length,
      breaking: breakingCount,
      timestamp: new Date().toISOString(),
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("newsletter-breaking-scan error:", err);
    return new Response(JSON.stringify({ ok: false, error: err.message }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
