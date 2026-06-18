import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
    );

    // Get symbols from request body or query
    let symbols: string[] = [];
    if (req.method === "POST") {
      const body = await req.json();
      symbols = body.symbols || [];
    } else {
      const url = new URL(req.url);
      const s = url.searchParams.get("symbols");
      if (s) symbols = s.split(",").map((x: string) => x.trim());
    }

    if (symbols.length === 0) {
      // Fallback: read from integration_settings
      const { data: settings } = await supabase
        .from("integration_settings")
        .select("config, enabled")
        .eq("service_name", "twelvedata")
        .single();

      if (!settings?.enabled) {
        return new Response(JSON.stringify({ error: "Twelve Data no está habilitado" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const config = settings.config as any;
      symbols = config?.symbols || [];
    }

    if (symbols.length === 0) {
      return new Response(JSON.stringify({ prices: [] }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("TWELVEDATA_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "TWELVEDATA_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch prices from Twelve Data — /price endpoint supports multiple symbols
    const symbolStr = symbols.join(",");
    const tdUrl = `https://api.twelvedata.com/price?symbol=${encodeURIComponent(symbolStr)}&apikey=${apiKey}`;
    const tdRes = await fetch(tdUrl);
    const tdData = await tdRes.json();

    if (!tdRes.ok || tdData?.status === "error" || tdData?.code) {
      return new Response(JSON.stringify({
        error: tdData?.message || tdData?.status || "Error fetching ticker prices",
        details: tdData,
      }), {
        status: tdRes.ok ? 502 : tdRes.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Normalize response: single symbol returns {price}, multiple returns {SYM: {price}}
    const prices: { symbol: string; price: string }[] = [];

    if (symbols.length === 1) {
      if (tdData.price) {
        prices.push({ symbol: symbols[0], price: tdData.price });
      }
    } else {
      for (const sym of symbols) {
        const entry = tdData[sym];
        if (entry?.price) {
          prices.push({ symbol: sym, price: entry.price });
        }
      }
    }

    if (prices.length === 0) {
      return new Response(JSON.stringify({
        error: "No ticker prices returned",
        details: tdData,
      }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ prices }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("live-ticker-feed error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
