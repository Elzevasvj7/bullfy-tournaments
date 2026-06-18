const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const respond = (payload: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

async function transcribeWithElevenLabs(
  videoUrl: string,
  apiKey: string
): Promise<string | null> {
  console.log("Requesting transcription via source_url...");
  try {
    const formData = new FormData();
    formData.append("source_url", videoUrl);
    formData.append("model_id", "scribe_v2");
    formData.append("tag_audio_events", "true");
    formData.append("diarize", "true");
    formData.append("language_code", "spa");

    const scribeRes = await fetch(
      "https://api.elevenlabs.io/v1/speech-to-text",
      {
        method: "POST",
        headers: { "xi-api-key": apiKey },
        body: formData,
      }
    );

    if (!scribeRes.ok) {
      const errText = await scribeRes.text();
      console.error("ElevenLabs error:", errText);
      return null;
    }

    const scribeData = await scribeRes.json();
    let transcript = scribeData.text || "";

    if (scribeData.words?.length) {
      const segments: string[] = [];
      let segStart = 0;
      let segText = "";
      for (const w of scribeData.words) {
        if (w.start - segStart > 30 && segText) {
          segments.push(
            `[${formatTime(segStart)}-${formatTime(w.start)}] ${segText.trim()}`
          );
          segStart = w.start;
          segText = "";
        }
        segText += (w.text || "") + " ";
      }
      if (segText) {
        const lastWord = scribeData.words[scribeData.words.length - 1];
        segments.push(
          `[${formatTime(segStart)}-${formatTime(lastWord.end)}] ${segText.trim()}`
        );
      }
      transcript = segments.join("\n");
    }

    return transcript || null;
  } catch (e) {
    console.error("Transcription fetch error:", e);
    return null;
  }
}

async function analyzeWithAI(
  transcript: string,
  lovableApiKey: string
): Promise<{ analysis: Record<string, unknown>; model: string } | { error: string; status: number }> {
  const analysisPrompt = `Eres un experto en contenido viral de trading/finanzas para redes sociales (TikTok, Reels, YouTube Shorts).

Analiza esta transcripción de un video/stream y detecta los momentos más virales o valiosos para crear clips de 30-60 segundos.

TRANSCRIPCIÓN:
${transcript}

Responde EXCLUSIVAMENTE con JSON válido (sin markdown, sin backticks):
{
  "total_duration_estimated": <segundos estimados del video>,
  "clips": [
    {
      "title": "<título corto atractivo para el clip>",
      "start_time": <segundo de inicio>,
      "end_time": <segundo de fin>,
      "hook_score": <0-100, qué tan viral/enganchador es>,
      "hook_reason": "<por qué este momento es viral>",
      "transcript_segment": "<texto exacto del segmento>",
      "suggested_caption": "<caption sugerido para RRSS>",
      "best_platform": "tiktok|instagram|youtube",
      "hashtags": ["<hashtags sugeridos>"]
    }
  ],
  "overall_quality": <0-100>,
  "content_themes": ["<temas principales detectados>"],
  "speaker_charisma_score": <0-100>
}

Reglas:
- Detecta entre 3 y 8 clips potenciales
- Prioriza: hooks fuertes (preguntas, datos impactantes, opiniones controversiales), momentos educativos claros, y reacciones emocionales
- Los clips deben ser 30-60 segundos idealmente
- Ordénalos por hook_score descendente
- Considera el mercado LATAM de trading`;

  const models = [
    "google/gemini-2.5-flash",
    "google/gemini-2.5-flash-lite",
    "openai/gpt-5-mini",
  ];
  const maxAttempts = 2;
  let lastError = "";

  for (const model of models) {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const aiResponse = await fetch(
          "https://ai.gateway.lovable.dev/v1/chat/completions",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${lovableApiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model,
              messages: [
                {
                  role: "system",
                  content:
                    "Eres un experto en detección de contenido viral y edición de video para redes sociales en el nicho financiero/trading. Responde siempre en JSON válido.",
                },
                { role: "user", content: analysisPrompt },
              ],
            }),
          }
        );

        if (!aiResponse.ok) {
          const status = aiResponse.status;
          const errText = await aiResponse.text();
          console.error(`AI Gateway error with ${model} attempt ${attempt}:`, status, errText);

          if (status === 429) {
            return { error: "Demasiadas solicitudes. Intenta en un momento.", status: 429 };
          }
          if (status === 402) {
            return { error: "Créditos de IA agotados.", status: 402 };
          }
          if (status < 500) {
            return { error: `Error de análisis IA (${status})`, status };
          }

          lastError = `AI Gateway ${status} on ${model} attempt ${attempt}`;
          if (attempt < maxAttempts) {
            await sleep(500 * attempt);
            continue;
          }
          break;
        }

        const aiData = await aiResponse.json();
        const rawContent = aiData.choices?.[0]?.message?.content || "";

        const cleaned = rawContent
          .replace(/```json\n?/g, "")
          .replace(/```\n?/g, "")
          .trim();

        // Try to extract JSON
        let analysis;
        const candidates = [cleaned];
        const fb = cleaned.indexOf("{");
        const lb = cleaned.lastIndexOf("}");
        if (fb !== -1 && lb > fb) {
          candidates.push(cleaned.slice(fb, lb + 1));
        }

        for (const c of candidates) {
          try {
            analysis = JSON.parse(c);
            break;
          } catch { /* next */ }
        }

        if (analysis) {
          console.log(`Clip analysis succeeded with ${model} attempt ${attempt}`);
          return { analysis, model };
        }

        lastError = `Failed to parse response from ${model} attempt ${attempt}`;
        console.error("Failed to parse AI clip analysis:", rawContent.slice(0, 300));

        if (attempt < maxAttempts) {
          await sleep(500 * attempt);
        }
      } catch (e) {
        lastError = `Exception on ${model} attempt ${attempt}: ${e.message}`;
        console.error(lastError);
        if (attempt < maxAttempts) await sleep(500 * attempt);
      }
    }
  }

  return { error: `No se pudo analizar el video después de múltiples intentos. ${lastError}`, status: 503 };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");

    if (!LOVABLE_API_KEY) {
      return respond({ ok: false, error: "AI Gateway not configured" });
    }

    const { video_url, source_type, source_id, transcription } = await req.json();

    if (!video_url) {
      return respond({ ok: false, error: "video_url is required" });
    }

    // Step 1: Transcription
    let transcript = transcription || "";

    if (!transcript && ELEVENLABS_API_KEY) {
      transcript = (await transcribeWithElevenLabs(video_url, ELEVENLABS_API_KEY)) || "";
    }

    if (!transcript) {
      return respond({
        ok: false,
        error: "No se pudo obtener la transcripción. Verifica que el video sea accesible o configura ElevenLabs con suficientes créditos.",
      });
    }

    // Step 2: AI analysis with retries and model fallback
    const result = await analyzeWithAI(transcript, LOVABLE_API_KEY);

    if ("error" in result) {
      return respond({ ok: false, error: result.error }, result.status);
    }

    return respond({
      ok: true,
      source_type: source_type || "upload",
      source_id: source_id || null,
      video_url,
      analysis: result.analysis,
      diagnostics: { model_used: result.model },
    });
  } catch (error) {
    console.error("analyze-video-clips error:", error);
    return respond({ ok: false, error: error.message });
  }
});
