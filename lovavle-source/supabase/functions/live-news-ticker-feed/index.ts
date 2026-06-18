const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EconomicEvent {
  title: string;
  country: string;
  date: string;
  time: string;
  impact: "high" | "medium" | "low";
  forecast: string | null;
  previous: string | null;
  actual: string | null;
  url: string | null;
}

const FF_XML_URL = "https://nfs.faireconomy.media/ff_calendar_thisweek.xml";

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    let category = "general";
    let maxHeadlines = 10;
    let includeEconomicCalendar = true;

    if (req.method === "POST") {
      const body = await req.json();
      category = body.category || "general";
      maxHeadlines = body.maxHeadlines || 10;
      includeEconomicCalendar = body.includeEconomicCalendar ?? true;
    }

    const apiKey = Deno.env.get("FINNHUB_API_KEY");

    const [finnhubResult, economicCalendarResult] = await Promise.all([
      apiKey
        ? fetch(`https://finnhub.io/api/v1/news?category=${encodeURIComponent(category)}&token=${apiKey}`)
            .then(async (res) => ({ ok: res.ok, data: await res.json() }))
            .catch((error) => ({ ok: false, data: { error: String(error) } }))
        : Promise.resolve({ ok: false, data: [] }),
      includeEconomicCalendar
        ? fetch(FF_XML_URL, { headers: { "User-Agent": "Mozilla/5.0 BullfyLive/1.0" } })
            .then(async (res) => ({ ok: res.ok, data: await res.text() }))
            .catch((error) => ({ ok: false, data: String(error) }))
        : Promise.resolve({ ok: false, data: "" }),
    ]);

    const marketHeadlines = Array.isArray(finnhubResult.data)
      ? finnhubResult.data
          .filter((item: any) => item.headline && item.source)
          .map((item: any) => ({
            headline: item.headline,
            source: item.source,
            url: item.url || null,
            datetime: item.datetime || null,
            impact: null,
            country: null,
            time_label: null,
          }))
      : [];

    const economicEvents = economicCalendarResult.ok && typeof economicCalendarResult.data === "string"
      ? parseEconomicCalendar(economicCalendarResult.data)
      : [];

    const redFolderHeadlines = economicEvents
      .filter((event) => event.impact === "high")
      .slice(0, Math.max(4, Math.ceil(maxHeadlines / 2)))
      .map((event) => ({
        headline: `${event.country}: ${event.title}`,
        source: "ForexFactory",
        url: event.url,
        datetime: null,
        impact: event.impact,
        country: event.country,
        time_label: `${event.date} ${event.time}`.trim(),
      }));

    const headlines = [...redFolderHeadlines, ...marketHeadlines].slice(0, maxHeadlines);

    return new Response(JSON.stringify({
      headlines,
      economic_events: economicEvents.slice(0, 40),
      red_folder_events: economicEvents.filter((event) => event.impact === "high").slice(0, 12),
      providers: {
        market_news: finnhubResult.ok,
        economic_calendar: economicCalendarResult.ok,
      },
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("live-news-ticker-feed error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
