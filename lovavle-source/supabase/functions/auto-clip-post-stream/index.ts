const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function awsEncode(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}

function awsEncodePath(path: string): string {
  return path.split("/").map(awsEncode).join("/");
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function hmac(key: ArrayBuffer | Uint8Array | string, data: string): Promise<ArrayBuffer> {
  const enc = new TextEncoder();
  const rawKey = typeof key === "string" ? enc.encode(key) : key;
  const cryptoKey = await crypto.subtle.importKey("raw", rawKey, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return crypto.subtle.sign("HMAC", cryptoKey, enc.encode(data));
}

async function presignR2Url(filePath: string, expires = 86400): Promise<string | null> {
  const endpoint = (Deno.env.get("EGRESS_S3_ENDPOINT") || "").replace(/\/$/, "");
  const bucket = Deno.env.get("EGRESS_S3_BUCKET") || "";
  const accessKey = Deno.env.get("EGRESS_S3_ACCESS_KEY") || "";
  const secretKey = Deno.env.get("EGRESS_S3_SECRET") || "";
  const region = Deno.env.get("EGRESS_S3_REGION") || "auto";
  if (!endpoint || !bucket || !accessKey || !secretKey) return null;

  let key = filePath;
  if (filePath.startsWith("http://") || filePath.startsWith("https://")) {
    const parsed = new URL(filePath);
    const prefix = `/${bucket}/`;
    key = parsed.pathname.startsWith(prefix) ? parsed.pathname.slice(prefix.length) : parsed.pathname.replace(/^\//, "");
  }
  key = decodeURIComponent(key.replace(/^\//, "").replace(new RegExp(`^${bucket}/`), ""));

  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const scope = `${dateStamp}/${region}/s3/aws4_request`;
  const host = new URL(endpoint).host;
  const canonicalUri = `/${bucket}/${awsEncodePath(key)}`;
  const params: Record<string, string> = {
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": `${accessKey}/${scope}`,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": String(expires),
    "X-Amz-SignedHeaders": "host",
  };
  const canonicalQuery = Object.keys(params).sort().map((k) => `${awsEncode(k)}=${awsEncode(params[k])}`).join("&");
  const canonicalRequest = ["GET", canonicalUri, canonicalQuery, `host:${host}\n`, "host", "UNSIGNED-PAYLOAD"].join("\n");
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, toHex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonicalRequest)))].join("\n");
  const kDate = await hmac(`AWS4${secretKey}`, dateStamp);
  const kRegion = await hmac(kDate, region);
  const kService = await hmac(kRegion, "s3");
  const kSigning = await hmac(kService, "aws4_request");
  const signature = toHex(await hmac(kSigning, stringToSign));
  return `${endpoint}${canonicalUri}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { room_id, host_id, transcript } = await req.json();

    if (!room_id) {
      return new Response(
        JSON.stringify({ ok: false, error: "room_id required" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Get room info
    const { data: room } = await supabase
      .from("live_rooms")
      .select("id, title, host_id, started_at, ended_at")
      .eq("id", room_id)
      .maybeSingle();

    if (!room) {
      return new Response(
        JSON.stringify({ ok: false, error: "Room not found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const effectiveHostId = host_id || room.host_id;

    // ── 1. Validate Video Studio access ──
    if (!effectiveHostId) {
      return new Response(
        JSON.stringify({ ok: false, error: "No host_id available" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: access } = await supabase
      .from("video_studio_access")
      .select("enabled, can_auto_clip, tier, monthly_clip_limit")
      .eq("user_id", effectiveHostId)
      .maybeSingle();

    if (!access || !access.enabled || !access.can_auto_clip) {
      return new Response(
        JSON.stringify({ ok: false, error: "Video Studio or auto-clip not enabled for this host" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── 2. Check monthly usage limits ──
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();

    const { count: usedClips } = await supabase
      .from("video_studio_usage_log")
      .select("id", { count: "exact", head: true })
      .eq("user_id", effectiveHostId)
      .eq("action", "auto_clip")
      .gte("created_at", monthStart)
      .lt("created_at", monthEnd);

    const monthlyLimit = access.monthly_clip_limit ?? 3;
    const currentUsage = usedClips || 0;

    // Enterprise (limit 0 or very high) = unlimited
    if (monthlyLimit > 0 && currentUsage >= monthlyLimit) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: `Monthly clip limit reached (${currentUsage}/${monthlyLimit}). Upgrade tier for more clips.`,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const remainingClips = monthlyLimit > 0 ? monthlyLimit - currentUsage : 999;

    // ── 3. Find recording ──
    const { data: recording } = await supabase
      .from("live_recordings")
      .select("id, file_path, duration_seconds")
      .eq("room_id", room_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!recording || !recording.file_path) {
      return new Response(
        JSON.stringify({ ok: false, error: "No recording found for this room" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const totalDuration = recording.duration_seconds || 0;
    if (totalDuration < 30) {
      return new Response(
        JSON.stringify({ ok: false, error: "Recording too short for auto-clips (min 30s)" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── 4. Get URL for recording (R2 URL stored as-is, or signed Supabase Storage URL) ──
    let recordingUrl: string | null = null;
    if (recording.file_path.startsWith("http://") || recording.file_path.startsWith("https://")) {
      recordingUrl = await presignR2Url(recording.file_path, 86400) || recording.file_path;
    } else {
      const signedR2Url = await presignR2Url(recording.file_path, 86400);
      if (signedR2Url) {
        recordingUrl = signedR2Url;
      } else {
        const { data: signedData } = await supabase.storage
          .from("live-recordings")
          .createSignedUrl(recording.file_path, 3600);
        recordingUrl = signedData?.signedUrl || null;
      }
    }
    if (!recordingUrl) {
      return new Response(
        JSON.stringify({ ok: false, error: "Could not generate recording URL" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── 5. Get transcript (from param, stream analysis, keyword alerts, or final recording transcription) ──
    let effectiveTranscript = transcript || "";

    if (!effectiveTranscript || effectiveTranscript.length < 50) {
      const { data: streamAnalysis } = await supabase
        .from("live_stream_analysis")
        .select("transcript")
        .eq("room_id", room_id)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (streamAnalysis?.transcript) {
        effectiveTranscript = streamAnalysis.transcript;
      }
    }

    if (!effectiveTranscript || effectiveTranscript.length < 50) {
      // Try to get transcript from stream analysis
      const { data: analysis } = await supabase
        .from("live_keyword_alerts")
        .select("transcript_excerpt")
        .eq("room_id", room_id)
        .order("detected_at", { ascending: true });

      if (analysis && analysis.length > 0) {
        effectiveTranscript = analysis.map((a: any) => a.transcript_excerpt).filter(Boolean).join(" ");
      }
    }

    if (!effectiveTranscript || effectiveTranscript.length < 50) {
      const elevenLabsKey = Deno.env.get("ELEVENLABS_API_KEY");
      if (elevenLabsKey) {
        const formData = new FormData();
        formData.append("source_url", recordingUrl);
        formData.append("model_id", "scribe_v2");
        formData.append("language_code", "spa");
        formData.append("tag_audio_events", "false");
        formData.append("diarize", "false");
        const scribeRes = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
          method: "POST",
          headers: { "xi-api-key": elevenLabsKey },
          body: formData,
        });
        if (scribeRes.ok) {
          const scribeData = await scribeRes.json();
          effectiveTranscript = scribeData.text || "";
          if (effectiveTranscript.length >= 50) {
            await supabase.from("live_stream_analysis").upsert({
              room_id,
              host_id: effectiveHostId,
              transcript: effectiveTranscript,
              processing_status: "completed",
            }, { onConflict: "room_id" });
          }
        } else {
          console.error("ElevenLabs transcription failed:", await scribeRes.text());
        }
      }
    }

    if (!effectiveTranscript || effectiveTranscript.length < 50) {
      return new Response(
        JSON.stringify({ ok: false, error: "Insufficient transcript data for clip analysis" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── 6. AI analysis for highlight moments ──
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableApiKey) {
      return new Response(
        JSON.stringify({ ok: false, error: "AI not configured" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const maxClips = Math.min(3, remainingClips);

    const aiPrompt = `Eres un editor de video experto. Analiza este transcrito de un stream en vivo y encuentra los ${maxClips} mejores momentos para crear clips virales de 15-60 segundos.

El stream dura ${totalDuration} segundos en total.

TRANSCRIPCIÓN:
${effectiveTranscript.substring(0, 8000)}

Responde SOLO con un JSON array. Cada elemento debe tener:
- "start_time": segundo donde inicia el clip (número entero)
- "end_time": segundo donde termina el clip (número entero, máximo ${totalDuration})
- "title": título corto atractivo para el clip (máximo 50 caracteres)
- "subtitle_text": resumen del contenido hablado en ese segmento (máximo 200 caracteres)
- "reason": por qué es un buen momento para clip

Reglas:
- Clips de 15-60 segundos
- No se superpongan entre sí
- Prioriza momentos con insights clave, humor, datos impactantes o conclusiones
- start_time y end_time deben estar dentro de [0, ${totalDuration}]

Responde SOLO el JSON array, sin markdown ni texto adicional.`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${lovableApiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: aiPrompt }],
        temperature: 0.3,
        max_tokens: 2048,
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      console.error("AI error:", errText);
      return new Response(
        JSON.stringify({ ok: false, error: "AI analysis failed" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiText = await aiRes.text();
    let aiData;
    try {
      aiData = JSON.parse(aiText);
    } catch {
      console.error("AI response not JSON:", aiText);
      return new Response(
        JSON.stringify({ ok: false, error: "AI returned malformed response" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const rawContent = aiData.choices?.[0]?.message?.content || "[]";

    let highlights: Array<{
      start_time: number;
      end_time: number;
      title: string;
      subtitle_text: string;
      reason: string;
    }>;

    try {
      const cleaned = rawContent.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
      const match = cleaned.match(/\[[\s\S]*\]/);
      highlights = JSON.parse(match ? match[0] : cleaned);
    } catch {
      console.error("Failed to parse AI highlights:", rawContent);
      return new Response(
        JSON.stringify({ ok: false, error: "AI response parsing failed" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!Array.isArray(highlights) || highlights.length === 0) {
      return new Response(
        JSON.stringify({ ok: false, error: "No highlights identified" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate, clamp, and respect remaining limit
    highlights = highlights
      .filter((h) => h.start_time >= 0 && h.end_time > h.start_time && h.end_time <= totalDuration)
      .slice(0, maxClips)
      .map((h) => ({
        ...h,
        start_time: Math.floor(h.start_time),
        end_time: Math.min(Math.ceil(h.end_time), totalDuration),
      }));

    // ── 7. Generate clips via Shotstack ──
    const canRemoveBranding = access.tier === "enterprise";
    const clipResults = [];

    for (const highlight of highlights) {
      try {
        const clipRes = await fetch(`${supabaseUrl}/functions/v1/generate-video-clip`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceKey}`,
            apikey: serviceKey,
          },
          body: JSON.stringify({
            source_url: recordingUrl,
            start_time: highlight.start_time,
            end_time: highlight.end_time,
            format: "vertical",
            has_subtitles: true,
            subtitle_text: highlight.subtitle_text,
            title: highlight.title,
            source_type: "stream",
            source_id: room_id,
            created_by: effectiveHostId,
            add_watermark: !canRemoveBranding,
          }),
        });

        const clipData = await clipRes.json();
        clipResults.push({
          ...highlight,
          clip_id: clipData.clip_id || null,
          render_id: clipData.render_id || null,
          ok: !!clipData.ok,
          error: clipData.error || null,
        });
      } catch (err) {
        console.error("Clip generation error:", err);
        clipResults.push({ ...highlight, ok: false, error: String(err) });
      }
    }

    // ── 8. Log usage ──
    const clipsGenerated = clipResults.filter((c) => c.ok).length;
    if (clipsGenerated > 0) {
      await supabase.from("video_studio_usage_log").insert({
        user_id: effectiveHostId,
        action: "auto_clip",
        credits_used: clipsGenerated,
        metadata: {
          room_id,
          room_title: room.title,
          tier: access.tier,
          highlights_found: highlights.length,
          clips_generated: clipsGenerated,
        },
      });
    }

    return new Response(
      JSON.stringify({
        ok: true,
        tier: access.tier,
        highlights_found: highlights.length,
        clips: clipResults,
        usage: { used: currentUsage + clipsGenerated, limit: monthlyLimit },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("auto-clip-post-stream error:", error);
    return new Response(
      JSON.stringify({ ok: false, error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
