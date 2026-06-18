const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { room_id, host_id, transcript } = await req.json();

    if (!room_id || !transcript) {
      return new Response(
        JSON.stringify({ error: "room_id and transcript are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Upsert with processing status
    await supabase.from("live_stream_analysis").upsert({
      room_id,
      host_id: host_id || null,
      transcript,
      processing_status: "processing",
    }, { onConflict: "room_id" });

    // --- Keyword detection ---
    const { data: activeKeywords } = await supabase
      .from("live_alert_keywords")
      .select("id, keyword")
      .eq("active", true);

    if (activeKeywords && activeKeywords.length > 0) {
      const lowerTranscript = transcript.toLowerCase();
      const alertsToInsert: any[] = [];

      for (const kw of activeKeywords) {
        const keywordLower = kw.keyword.toLowerCase();
        const idx = lowerTranscript.indexOf(keywordLower);
        if (idx !== -1) {
          // Extract surrounding context (50 chars each side)
          const start = Math.max(0, idx - 50);
          const end = Math.min(lowerTranscript.length, idx + keywordLower.length + 50);
          const excerpt = transcript.substring(start, end);

          alertsToInsert.push({
            keyword_id: kw.id,
            keyword_text: kw.keyword,
            room_id,
            host_id: host_id || null,
            transcript_excerpt: excerpt,
          });
        }
      }

      if (alertsToInsert.length > 0) {
        const { error: alertError } = await supabase
          .from("live_keyword_alerts")
          .insert(alertsToInsert);
        if (alertError) {
          console.error("Failed to insert keyword alerts:", alertError);
        } else {
          console.log(`Detected ${alertsToInsert.length} keyword alerts for room ${room_id}`);
        }
      }
    }

    // --- AI Analysis ---
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableApiKey) {
      await supabase.from("live_stream_analysis").update({
        processing_status: "error",
        error_message: "LOVABLE_API_KEY not configured",
      }).eq("room_id", room_id);

      return new Response(
        JSON.stringify({ error: "AI not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const systemPrompt = `Eres un analista de streams de trading/finanzas. Analiza la siguiente transcripción de un stream en vivo y genera un resumen estructurado en español. Responde SOLO con JSON válido sin markdown.

El JSON debe tener esta estructura exacta:
{
  "summary": "Resumen ejecutivo del stream en 2-3 oraciones",
  "topics": ["tema1", "tema2"],
  "faqs": ["pregunta frecuente 1", "pregunta frecuente 2"],
  "objections": ["objeción detectada 1"],
  "products_mentioned": ["producto o servicio mencionado"]
}

Si no hay información suficiente para algún campo, usa un array vacío [].`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${lovableApiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Transcripción del stream:\n\n${transcript.substring(0, 15000)}` },
        ],
        temperature: 0.3,
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI error:", errText);
      await supabase.from("live_stream_analysis").update({
        processing_status: "error",
        error_message: errText.substring(0, 500),
      }).eq("room_id", room_id);

      return new Response(
        JSON.stringify({ error: "AI analysis failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || "{}";

    // Parse the AI response
    let analysis;
    try {
      const cleaned = content.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
      analysis = JSON.parse(cleaned);
    } catch {
      console.error("Failed to parse AI response:", content);
      analysis = { summary: content, topics: [], faqs: [], objections: [], products_mentioned: [] };
    }

    // Update the record
    const { error: updateError } = await supabase.from("live_stream_analysis").update({
      summary: analysis.summary || null,
      topics: analysis.topics || [],
      faqs: analysis.faqs || [],
      objections: analysis.objections || [],
      products_mentioned: analysis.products_mentioned || [],
      processing_status: "completed",
      error_message: null,
    }).eq("room_id", room_id);

    if (updateError) {
      console.error("Update error:", updateError);
    }

    return new Response(JSON.stringify({ success: true, analysis }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Stream analysis error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
