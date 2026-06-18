import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPPORTED = ["es", "en", "pt", "fr", "de", "it", "ru"] as const;

const VOICE_BY_LANG: Record<string, string> = {
  es: "EXAVITQu4vr4xnSDxMaL",
  en: "EXAVITQu4vr4xnSDxMaL",
  pt: "EXAVITQu4vr4xnSDxMaL",
  fr: "EXAVITQu4vr4xnSDxMaL",
  de: "EXAVITQu4vr4xnSDxMaL",
  it: "EXAVITQu4vr4xnSDxMaL",
  ru: "EXAVITQu4vr4xnSDxMaL",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { text, source_lang, target_lang } = await req.json();
    if (!text || !SUPPORTED.includes(target_lang)) {
      return new Response(JSON.stringify({ ok: false, error: "invalid_input" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
    if (!LOVABLE_API_KEY || !ELEVENLABS_API_KEY) {
      return new Response(JSON.stringify({ ok: false, error: "missing_keys" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Translate
    let translation = text;
    if (source_lang !== target_lang) {
      const langNames: Record<string, string> = {
        es: "Spanish", en: "English", pt: "Portuguese",
        fr: "French", de: "German", it: "Italian", ru: "Russian",
      };
      const tr = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-lite",
          messages: [
            { role: "system", content: `Translate from ${langNames[source_lang] || source_lang} to ${langNames[target_lang]}. Output ONLY the translation.` },
            { role: "user", content: text },
          ],
        }),
      });
      if (tr.status === 429 || tr.status === 402) {
        return new Response(JSON.stringify({ ok: false, error: tr.status === 429 ? "rate_limited" : "credits_exhausted" }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!tr.ok) {
        return new Response(JSON.stringify({ ok: false, error: "translate_failed" }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const trData = await tr.json();
      translation = (trData.choices?.[0]?.message?.content || "").trim();
    }

    // 2. TTS via ElevenLabs Flash v2.5 (low latency)
    const voiceId = VOICE_BY_LANG[target_lang] || VOICE_BY_LANG.en;
    const ttsResp = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_64`,
      {
        method: "POST",
        headers: { "xi-api-key": ELEVENLABS_API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({
          text: translation,
          model_id: "eleven_flash_v2_5",
          voice_settings: { stability: 0.4, similarity_boost: 0.7, speed: 1.0 },
        }),
      }
    );

    if (!ttsResp.ok) {
      const t = await ttsResp.text();
      console.error("ElevenLabs TTS error:", ttsResp.status, t);
      return new Response(JSON.stringify({ ok: false, error: "tts_failed", translation }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const audioBuf = await ttsResp.arrayBuffer();
    const audioBase64 = base64Encode(audioBuf);

    return new Response(JSON.stringify({ ok: true, translation, audio_base64: audioBase64, mime: "audio/mpeg" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("translate-tts error:", e);
    return new Response(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : "unknown" }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
