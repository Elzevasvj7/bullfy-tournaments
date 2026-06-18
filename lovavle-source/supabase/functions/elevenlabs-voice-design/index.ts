// Voice Design — crear/regenerar voces de marca en ElevenLabs
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const ELEVEN_KEY = Deno.env.get("ELEVENLABS_API_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: auth } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { action, voice_description, voice_name, generated_voice_id, sample_text, voice_id, text } = await req.json();

    // TTS preview (probar plantilla en una voz existente)
    if (action === "tts_preview") {
      if (!voice_id || !text) {
        return new Response(JSON.stringify({ ok: false, error: "voice_id y text requeridos" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice_id}?output_format=mp3_44100_128`, {
        method: "POST",
        headers: { "xi-api-key": ELEVEN_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ text, model_id: "eleven_multilingual_v2" }),
      });
      if (!r.ok) {
        const errTxt = await r.text();
        return new Response(JSON.stringify({ ok: false, error: errTxt }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const buf = new Uint8Array(await r.arrayBuffer());
      const { encode } = await import("https://deno.land/std@0.168.0/encoding/base64.ts");
      const b64 = encode(buf);
      return new Response(JSON.stringify({ ok: true, audio_base_64: b64, media_type: "audio/mpeg" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 1. Crear previews (no consume créditos, devuelve 3 muestras)
    if (action === "create_previews") {
      const r = await fetch("https://api.elevenlabs.io/v1/text-to-voice/create-previews", {
        method: "POST",
        headers: { "xi-api-key": ELEVEN_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({
          voice_description,
          text: sample_text || "Hola, soy un asesor de Bullfy. Te llamo para ayudarte a dar el siguiente paso en tu camino como trader profesional.",
        }),
      });
      const data = await r.json();
      if (!r.ok) {
        return new Response(JSON.stringify({ ok: false, error: data?.detail?.message ?? JSON.stringify(data) }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({ ok: true, previews: data.previews }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 2. Guardar voz seleccionada (ocupa 1 slot del Creator)
    if (action === "create_voice") {
      const r = await fetch("https://api.elevenlabs.io/v1/text-to-voice/create-voice-from-preview", {
        method: "POST",
        headers: { "xi-api-key": ELEVEN_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({
          voice_name,
          voice_description,
          generated_voice_id,
        }),
      });
      const data = await r.json();
      if (!r.ok) {
        return new Response(JSON.stringify({ ok: false, error: data?.detail?.message ?? JSON.stringify(data) }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({ ok: true, voice_id: data.voice_id, name: data.name }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 3. Listar voces de la cuenta (solo "My Voices": cloned/generated/professional, excluye premade)
    if (action === "list_voices") {
      const r = await fetch("https://api.elevenlabs.io/v1/voices", {
        headers: { "xi-api-key": ELEVEN_KEY },
      });
      const data = await r.json();
      if (!r.ok) {
        return new Response(JSON.stringify({ ok: false, error: data?.detail?.message ?? JSON.stringify(data) }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const all = (data.voices ?? []) as any[];
      const mine = all.filter((v) => v.category && v.category !== "premade");
      return new Response(JSON.stringify({ ok: true, voices: mine, total: all.length }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ ok: false, error: "unknown action" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e?.message ?? e) }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
